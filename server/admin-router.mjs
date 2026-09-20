import express from "express";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  keepPrivateImport,
  readApprovedKnowledge,
  readReviewQueue,
  sanitizeApprovedText,
  saveApprovedKnowledge,
  saveReviewQueue,
} from "./knowledge/store.mjs";
import { parseConversationFile, validateImportFilename } from "./knowledge/parse-deepseek.mjs";
import { inspectImportedKnowledgeText } from "./knowledge/content-policy.mjs";
import { prepareAmaDocument, readAmaKnowledge, saveAmaKnowledge } from "./knowledge/ama-store.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.join(moduleDir, "admin");
const projectRoot = path.resolve(moduleDir, "..");
const localEnvPath = path.join(projectRoot, ".env.local");

function upsertEnvValue(source, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(source)) return source.replace(pattern, line);
  return `${source.trimEnd()}${source.trim() ? "\n" : ""}${line}\n`;
}

async function saveDeepSeekConfig(apiKey) {
  const current = await readFile(localEnvPath, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  let next = upsertEnvValue(current, "AI_PROVIDER", "deepseek");
  next = upsertEnvValue(next, "AI_API_KEY", apiKey);
  next = upsertEnvValue(next, "AI_MODEL", "deepseek-chat");
  const temporaryPath = `${localEnvPath}.tmp`;
  await writeFile(temporaryPath, next, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, localEnvPath);
  process.env.AI_PROVIDER = "deepseek";
  process.env.AI_API_KEY = apiKey;
  process.env.AI_MODEL = "deepseek-chat";
}

function isLoopback(address) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(String(address || ""));
}

function isLocalHost(host) {
  return /^(?:localhost|127\.0\.0\.1)(?::\d+)?$|^\[::1\](?::\d+)?$/i.test(String(host || ""));
}

function localOnly(request, response, next) {
  if (!isLoopback(request.socket.remoteAddress) || !isLocalHost(request.headers.host)) {
    return response.status(404).type("text/plain").send("Not found");
  }
  response.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
  return next();
}

function sameOrigin(request) {
  const origin = request.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host === request.get("host") && ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function approvalPolicyError(value) {
  const inspection = inspectImportedKnowledgeText(value);
  if (inspection.instructionSignals.length) {
    return `这条内容包含疑似 AI 指令（${inspection.instructionSignals.join("、")}），不能作为公开知识。请只保留可核验的个人事实或表达偏好。`;
  }
  if (inspection.privateSignals.length) {
    return `这条内容包含默认不公开的信息（${inspection.privateSignals.join("、")}），不能发布到公开网站。请删除相关字段后重试。`;
  }
  if (inspection.siteExclusionSignals.length) {
    return `这条内容属于本人明确要求当前站点不公开的类别（${inspection.siteExclusionSignals.join("、")}），不能发布到公开网站。`;
  }
  return null;
}

export function createAdminRouter({ adminToken }) {
  const router = express.Router();
  router.use(localOnly);

  const verifyMutation = (request, response, next) => {
    if (!sameOrigin(request) || request.get("x-local-admin-token") !== adminToken) {
      return response.status(403).json({ error: "本地管理授权已失效，请刷新页面后重试。" });
    }
    return next();
  };

  router.get("/", (_request, response) => response.sendFile(path.join(adminDir, "knowledge.html")));
  router.get("/admin.js", (_request, response) => response.type("text/javascript").sendFile(path.join(adminDir, "knowledge.js")));
  router.get("/admin.css", (_request, response) => response.type("text/css").sendFile(path.join(adminDir, "knowledge.css")));

  router.get("/api/state", async (_request, response) => {
    const [review, approved, ama] = await Promise.all([readReviewQueue(), readApprovedKnowledge(), readAmaKnowledge()]);
    response.json({
      adminToken,
      candidates: review.candidates,
      approved,
      ama,
      aiConfig: {
        configured: Boolean(process.env.AI_API_KEY),
        provider: process.env.AI_PROVIDER || "deepseek",
        model: process.env.AI_MODEL || "deepseek-chat",
      },
      limits: { maximumFileBytes: 8 * 1024 * 1024, maximumCandidatesPerImport: 120 },
    });
  });

  router.post("/api/ai-config", verifyMutation, express.json({ limit: "8kb" }), async (request, response) => {
    const apiKey = String(request.body?.apiKey || "").trim();
    if (!/^sk-[A-Za-z0-9_-]{16,200}$/.test(apiKey)) {
      return response.status(400).json({ error: "密钥格式不正确，请粘贴新创建的 DeepSeek API Key。" });
    }
    try {
      await saveDeepSeekConfig(apiKey);
      return response.json({
        aiConfig: { configured: true, provider: "deepseek", model: "deepseek-chat" },
      });
    } catch (error) {
      console.error("保存 AI 配置失败。", error.message);
      return response.status(500).json({ error: "保存失败，请检查项目目录权限后重试。" });
    }
  });

  router.post("/api/ama", verifyMutation, express.json({ limit: "256kb" }), async (request, response) => {
    if (request.body?.confirmPublic !== true) {
      return response.status(400).json({ error: "保存前必须确认这份内容可以公开给 AMA 访客。" });
    }
    const prepared = prepareAmaDocument({
      id: request.body?.id,
      title: request.body?.title,
      category: request.body?.category,
      kind: request.body?.kind,
      tags: request.body?.tags,
      content: request.body?.content,
      sourceName: request.body?.sourceName || "本机后台输入",
      enabled: request.body?.enabled !== false,
    });
    if (!prepared.document.title) return response.status(400).json({ error: "请填写知识标题。" });
    if (!prepared.document.content) {
      return response.status(400).json({ error: "内容为空，或全部属于当前站点不公开、隐私或文档指令范围。" });
    }
    try {
      const ama = await readAmaKnowledge();
      const index = ama.documents.findIndex((item) => item.id === prepared.document.id);
      if (index >= 0) ama.documents[index] = prepared.document;
      else ama.documents.unshift(prepared.document);
      const saved = await saveAmaKnowledge(ama);
      return response.json({
        ama: saved,
        summary: {
          removedSegments: prepared.removedSegments,
          redactions: prepared.redactions,
        },
      });
    } catch (error) {
      console.error("保存 AMA 认知失败。", error.message);
      return response.status(500).json({ error: "保存 AMA 认知失败，请重试。" });
    }
  });

  router.post("/api/ama/toggle", verifyMutation, express.json({ limit: "16kb" }), async (request, response) => {
    if (typeof request.body?.id !== "string" || typeof request.body?.enabled !== "boolean") {
      return response.status(400).json({ error: "AMA 知识状态无效。" });
    }
    const ama = await readAmaKnowledge();
    const document = ama.documents.find((item) => item.id === request.body.id);
    if (!document) return response.status(404).json({ error: "没有找到这篇 AMA 知识。" });
    document.enabled = request.body.enabled;
    document.updatedAt = new Date().toISOString();
    return response.json({ ama: await saveAmaKnowledge(ama) });
  });

  router.post("/api/ama/remove", verifyMutation, express.json({ limit: "16kb" }), async (request, response) => {
    if (request.body?.confirm !== true || typeof request.body?.id !== "string") {
      return response.status(400).json({ error: "删除 AMA 知识前需要再次确认。" });
    }
    const ama = await readAmaKnowledge();
    ama.documents = ama.documents.filter((item) => item.id !== request.body.id);
    return response.json({ ama: await saveAmaKnowledge(ama) });
  });

  router.post(
    "/api/import",
    verifyMutation,
    express.raw({ type: "application/octet-stream", limit: "8mb" }),
    async (request, response) => {
      try {
        let filename;
        try {
          filename = decodeURIComponent(request.get("x-file-name") || "");
        } catch {
          return response.status(400).json({ error: "文件名编码无效。" });
        }
        const validated = validateImportFilename(filename);
        if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
          return response.status(400).json({ error: "请选择一个非空文件。" });
        }

        const result = parseConversationFile({
          filename: validated.safeName,
          buffer: request.body,
          plainTextIsUser: request.get("x-plain-text-is-user") === "true",
        });

        const review = await readReviewQueue();
        const known = new Set(review.candidates.map((candidate) => candidate.fingerprint || `${candidate.type}:${candidate.content}`));
        const additions = result.candidates.filter((candidate) => {
          const key = candidate.fingerprint || `${candidate.type}:${candidate.content}`;
          if (known.has(key)) return false;
          known.add(key);
          return true;
        });
        review.candidates.push(...additions);
        await saveReviewQueue(review);

        let retainedPrivateCopy = null;
        if (request.get("x-keep-private-copy") === "true") {
          retainedPrivateCopy = await keepPrivateImport(validated.extension, request.body);
        }

        return response.json({
          summary: {
            sourceName: result.sourceName,
            messageCount: result.messageCount,
            userMessageCount: result.userMessageCount,
            ignoredAssistantCount: result.ignoredAssistantCount,
            candidateCount: additions.length,
            duplicateCount: result.candidates.length - additions.length,
            warnings: result.warnings,
            retainedPrivateCopy,
          },
        });
      } catch (error) {
        const status = Number(error.statusCode) || (error.type === "entity.too.large" ? 413 : 500);
        if (status >= 500) console.error("本地知识导入失败。", error.message);
        return response.status(status).json({
          error: status === 413 ? "文件超过 8 MB，请拆分后再导入。" : error.message || "导入失败。",
        });
      }
    },
  );

  router.post("/api/review", verifyMutation, express.json({ limit: "256kb" }), async (request, response) => {
    const items = Array.isArray(request.body?.items) ? request.body.items.slice(0, 100) : [];
    if (!items.length) return response.status(400).json({ error: "没有收到审核操作。" });

    try {
      const [review, approved] = await Promise.all([readReviewQueue(), readApprovedKnowledge()]);
      for (const decision of items) {
        const candidate = review.candidates.find((item) => item.id === decision?.id);
        if (!candidate || !["approve", "reject"].includes(decision?.action)) continue;

        approved.facts = approved.facts.filter((item) => item.id !== candidate.id);
        approved.styleSamples = approved.styleSamples.filter((item) => item.id !== candidate.id);

        if (decision.action === "reject") {
          candidate.status = "rejected";
          candidate.reviewedAt = new Date().toISOString();
          continue;
        }
        if (decision.confirmPublic !== true) {
          return response.status(400).json({ error: "发布前必须确认这条内容可以公开。" });
        }

        const clean = sanitizeApprovedText(decision.content ?? candidate.content);
        if (!clean) return response.status(400).json({ error: "批准内容不能为空。" });
        const policyError = approvalPolicyError(clean);
        if (policyError) return response.status(400).json({ error: policyError });
        candidate.content = clean;
        candidate.status = "approved";
        candidate.reviewedAt = new Date().toISOString();
        if (candidate.type === "style") approved.styleSamples.push({ id: candidate.id, text: clean });
        else approved.facts.push({ id: candidate.id, category: candidate.category, text: clean });
      }

      const savedApproved = await saveApprovedKnowledge(approved);
      const savedReview = await saveReviewQueue(review);
      return response.json({ approved: savedApproved, candidates: savedReview.candidates });
    } catch (error) {
      console.error("本地知识审核失败。", error.message);
      return response.status(500).json({ error: "保存审核结果失败，请重试。" });
    }
  });

  router.post("/api/remove-approved", verifyMutation, express.json({ limit: "16kb" }), async (request, response) => {
    if (request.body?.confirm !== true || typeof request.body?.id !== "string") {
      return response.status(400).json({ error: "删除公开资料前需要再次确认。" });
    }
    try {
      const [review, approved] = await Promise.all([readReviewQueue(), readApprovedKnowledge()]);
      const id = request.body.id;
      approved.facts = approved.facts.filter((item) => item.id !== id);
      approved.styleSamples = approved.styleSamples.filter((item) => item.id !== id);
      const candidate = review.candidates.find((item) => item.id === id);
      if (candidate) {
        candidate.status = "rejected";
        candidate.reviewedAt = new Date().toISOString();
      }
      const savedApproved = await saveApprovedKnowledge(approved);
      const savedReview = await saveReviewQueue(review);
      return response.json({ approved: savedApproved, candidates: savedReview.candidates });
    } catch (error) {
      console.error("删除公开知识失败。", error.message);
      return response.status(500).json({ error: "删除失败，请重试。" });
    }
  });

  router.use((error, _request, response, _next) => {
    if (error?.type === "entity.too.large") {
      return response.status(413).json({ error: "文件超过 8 MB，请拆分后再导入。" });
    }
    console.error("本地知识管理请求失败。", error?.message || "Unknown error");
    return response.status(500).json({ error: "本地知识管理请求失败。" });
  });

  return router;
}
