import express from "express";
import dotenv from "dotenv";
import http from "node:http";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { portfolioData } from "../src/data.js";
import { createAdminRouter } from "./admin-router.mjs";
import { localKnowledgeReply } from "./chat-knowledge.mjs";
import {
  buildCareerAgentSystemPrompt,
  amaOnlyResponse,
  classifyCareerTask,
  commitmentRefusal,
  containsNonPublicInformation,
  enforceCareerAgentReply,
  isCommitmentDecisionRequest,
  isDraftRequest,
  isPromptInjectionAttempt,
  promptInjectionRefusal,
} from "./career-agent.mjs";
import { ensureKnowledgeDirectories, readApprovedKnowledge, renderApprovedKnowledge } from "./knowledge/store.mjs";
import { readAmaKnowledge } from "./knowledge/ama-store.mjs";
import { renderAmaKnowledgeContext } from "./knowledge/ama-retrieval.mjs";
import { trustedProxyNetworks } from "./trusted-proxy.mjs";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");

dotenv.config({ path: path.join(projectRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });

const app = express();
const httpServer = http.createServer(app);
const port = Number(process.env.PORT) || 4175;
const isProduction = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const host = process.env.HOST || (isProduction ? "0.0.0.0" : "127.0.0.1");
const requestLog = new Map();

app.disable("x-powered-by");
app.set("trust proxy", trustedProxyNetworks(process.env.TRUSTED_PROXY_NETWORKS));

if (!isProduction) {
  await ensureKnowledgeDirectories();
  const adminToken = randomBytes(32).toString("hex");
  app.use("/admin/knowledge", createAdminRouter({ adminToken }));
} else {
  app.use("/admin/knowledge", (_request, response) => response.status(404).type("text/plain").send("Not found"));
}

app.use(express.json({ limit: "64kb" }));

function providerConfig() {
  const inferred = process.env.DEEPSEEK_API_KEY ? "deepseek" : "siliconflow";
  const provider = String(process.env.AI_PROVIDER || inferred).toLowerCase();
  const presets = {
    siliconflow: {
      label: "SiliconFlow",
      baseUrl: "https://api.siliconflow.cn/v1",
      apiKey: process.env.AI_API_KEY || process.env.SILICONFLOW_API_KEY || "",
      model: process.env.AI_MODEL || process.env.SILICONFLOW_MODEL || portfolioData.ai.model,
    },
    deepseek: {
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com",
      apiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || "",
      model: process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat",
    },
    "openai-compatible": {
      label: "OpenAI-compatible",
      baseUrl: process.env.AI_BASE_URL || "",
      apiKey: process.env.AI_API_KEY || "",
      model: process.env.AI_MODEL || "",
    },
  };
  const config = presets[provider] || presets.siliconflow;
  if (process.env.AI_BASE_URL && provider !== "openai-compatible") config.baseUrl = process.env.AI_BASE_URL;
  return { provider, ...config };
}

function chatEndpoint(baseUrl) {
  const parsed = new URL(baseUrl);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) {
    throw new Error("AI_BASE_URL 必须使用 HTTPS（本机地址除外）。");
  }
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function allowRequest(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  if (requestLog.size > 2_000) {
    for (const [key, times] of requestLog) {
      const recent = times.filter((time) => now - time < windowMs);
      if (recent.length) requestLog.set(key, recent);
      else requestLog.delete(key);
    }
  }
  const recent = (requestLog.get(ip) || []).filter((time) => now - time < windowMs);
  if (recent.length >= 20) return false;
  recent.push(now);
  requestLog.set(ip, recent);
  return true;
}

function publicPortfolioContext() {
  const { profile, journey } = portfolioData;
  return JSON.stringify(
    {
      姓名: profile.name,
      公开身份: profile.role,
      公开简介: profile.intro,
      已确认经历: journey.items.map(({ type, title, description, period }) => ({
        类型: type,
        名称: title,
        简介: description,
        ...(period ? { 时间: period } : {}),
      })),
    },
    null,
    2,
  );
}

async function systemPrompt(question) {
  const [approved, amaKnowledge] = await Promise.all([readApprovedKnowledge(), readAmaKnowledge()]);
  return buildCareerAgentSystemPrompt({
    name: portfolioData.profile.name,
    publicContext: publicPortfolioContext(),
    approvedContext: renderApprovedKnowledge(approved),
    amaContext: renderAmaKnowledgeContext({ question, knowledge: amaKnowledge }),
  });
}

app.get("/api/chat/status", async (_request, response) => {
  const config = providerConfig();
  const remoteEnabled = Boolean(config.apiKey && config.model && config.baseUrl && !config.apiKey.includes("填写"));
  const amaKnowledge = await readAmaKnowledge();
  response.set("Cache-Control", "no-store").json({
    enabled: true,
    mode: remoteEnabled ? "model" : "local",
    provider: remoteEnabled ? config.label : "本地资料模式",
    model: remoteEnabled ? config.model : "不向第三方发送问题",
    knowledgeDocuments: amaKnowledge.documents.filter((item) => item.enabled).length,
  });
});

app.post("/api/chat", async (request, response) => {
  response.set("Cache-Control", "no-store");
  const config = providerConfig();
  if (!allowRequest(request.ip || request.socket.remoteAddress || "unknown")) {
    return response.status(429).json({ error: "提问有些频繁，请十分钟后再试。" });
  }

  const incoming = Array.isArray(request.body?.messages) ? request.body.messages : [];
  const messages = incoming
    .filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.content === "string")
    .slice(-10)
    .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 1600) }))
    .filter((message) => message.content);

  const userMessages = messages.filter((message) => message.role === "user");
  if (!userMessages.length) return response.status(400).json({ error: "请输入一个问题。" });

  const latestQuestion = userMessages.at(-1).content;
  if (isPromptInjectionAttempt(latestQuestion)) {
    return response.json({ reply: promptInjectionRefusal(portfolioData.profile.name), mode: "guarded" });
  }
  if (isDraftRequest(latestQuestion)) {
    return response.json({ reply: amaOnlyResponse(portfolioData.profile.name), mode: "ama-only" });
  }
  if (classifyCareerTask(latestQuestion) === "knowledge" && isCommitmentDecisionRequest(latestQuestion)) {
    return response.json({ reply: commitmentRefusal(portfolioData.profile.name), mode: "guarded" });
  }
  const safeMessages = messages.filter((message) => {
    if (isPromptInjectionAttempt(message.content)) return false;
    return message.role === "user" || !containsNonPublicInformation(message.content);
  });

  const remoteEnabled = Boolean(config.apiKey && config.model && config.baseUrl && !config.apiKey.includes("填写"));
  if (!remoteEnabled) {
    const [approved, amaKnowledge] = await Promise.all([readApprovedKnowledge(), readAmaKnowledge()]);
    return response.json({
      reply: localKnowledgeReply({ question: latestQuestion, approved, amaKnowledge, portfolioData }),
      mode: "local",
    });
  }

  let endpoint;
  try {
    endpoint = chatEndpoint(config.baseUrl);
  } catch (error) {
    console.error("AI 服务地址配置无效。", error.message);
    return response.status(500).json({ error: "AI 服务地址配置无效。" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "system", content: await systemPrompt(latestQuestion) }, ...safeMessages],
        temperature: 0.55,
        max_tokens: 500,
        stream: false,
      }),
      signal: controller.signal,
    });

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("AI provider request failed with status", upstream.status);
      return response.status(upstream.status === 429 ? 429 : 502).json({
        error: upstream.status === 429 ? "AI 服务当前较忙，请稍后再试。" : "AI 服务暂时不可用，请检查密钥与模型设置。",
      });
    }

    const reply = payload?.choices?.[0]?.message?.content?.trim();
    if (!reply) return response.status(502).json({ error: "AI 没有返回有效内容，请重新提问。" });
    return response.json({
      reply: enforceCareerAgentReply({ question: latestQuestion, reply, name: portfolioData.profile.name }).slice(0, 4_000),
    });
  } catch (error) {
    if (error.name === "AbortError") return response.status(504).json({ error: "AI 思考时间过长，请重新试一次。" });
    console.error("Chat proxy connection failed.", error.message);
    return response.status(502).json({ error: "连接 AI 服务失败，请稍后再试。" });
  } finally {
    clearTimeout(timeout);
  }
});

if (isProduction) {
  const distPath = path.join(projectRoot, "dist");
  app.use(express.static(distPath));
  app.get("*splat", (_request, response) => response.sendFile(path.join(distPath, "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root: projectRoot,
    server: { middlewareMode: true, hmr: { server: httpServer } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

httpServer.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`无法启动：端口 ${port} 正在被其他程序使用。请在 .env.local 中换一个 PORT。`);
  } else {
    console.error("无法启动网站：", error.message);
  }
  process.exit(1);
});

httpServer.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(`\n  陈德基个人主页 → http://${displayHost}:${port}`);
  if (!isProduction) console.log(`  本地知识审核 → http://localhost:${port}/admin/knowledge\n`);
});
