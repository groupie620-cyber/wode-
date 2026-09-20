import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { redactSensitiveText } from "./redact.mjs";
import { inspectImportedKnowledgeText } from "./content-policy.mjs";

const ALLOWED_EXTENSIONS = new Set([".json", ".jsonl", ".md", ".txt"]);
const USER_ROLES = new Set(["user", "human", "me", "用户", "我", "本人"]);
const ASSISTANT_ROLES = new Set(["assistant", "ai", "bot", "deepseek", "助手", "系统助手"]);
const FACT_WORDS = /(?:就读|学校|大学|学院|专业|课程|毕业|实习|任职|担任|负责|参与|项目|工作|职业|求职|技能|擅长|喜欢|爱好|兴趣|希望|目标|习惯|性格|价值观|获得|奖|证书|部长|社团|新闻部|HRBP|人事|行政)/i;
const STYLE_PROMPT_PREFIX = /^(?:请|帮我|给我|生成|优化|完善|梳理|分析|介绍|翻译|推荐|回答|你是|假如|如何|为什么|有没有|能否|可以)/;
const STYLE_INSTRUCTION_WORDS = /(?:请|帮我|给我|为我|生成|优化|完善|推荐|回答|建议|论文思路|写一篇|字数|不少于)/;
const SENSITIVE_STYLE_TOPICS = /(?:自残|自杀|轻生|割腕|伤害自己|心理诊断|病历|裸照|性经历|密码|验证码|身份证)/;

function normalizeRole(value) {
  const role = String(value ?? "").trim().toLowerCase();
  if (USER_ROLES.has(role)) return "user";
  if (ASSISTANT_ROLES.has(role)) return "assistant";
  return "unknown";
}

function contentToText(value, depth = 0) {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => contentToText(item, depth + 1)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    for (const key of ["text", "content", "value", "message"]) {
      if (key in value) {
        const text = contentToText(value[key], depth + 1);
        if (text) return text;
      }
    }
  }
  return "";
}

function collectJsonMessages(value, output, state, depth = 0) {
  if (depth > 30 || state.nodes > 50_000 || value == null) return;
  state.nodes += 1;

  if (Array.isArray(value)) {
    for (const item of value) collectJsonMessages(item, output, state, depth + 1);
    return;
  }
  if (typeof value !== "object") return;

  const fragments = Array.isArray(value.fragments)
    ? value.fragments
    : Array.isArray(value.message?.fragments)
      ? value.message.fragments
      : null;
  if (fragments) {
    const requestText = fragments
      .filter((fragment) => String(fragment?.type || "").toUpperCase() === "REQUEST")
      .map((fragment) => contentToText(fragment?.content))
      .filter(Boolean)
      .join("\n")
      .trim();
    const responseText = fragments
      .filter((fragment) => String(fragment?.type || "").toUpperCase() === "RESPONSE")
      .map((fragment) => contentToText(fragment?.content))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (requestText) output.push({ role: "user", content: requestText.slice(0, 20_000) });
    if (responseText) output.push({ role: "assistant", content: responseText.slice(0, 20_000) });
    if (requestText || responseText) return;
  }

  const rawRole = value.role ?? value.sender_role ?? value.message_role ?? value.author?.role ?? value.sender?.role;
  const role = normalizeRole(rawRole);
  const rawContent = value.content ?? value.text ?? value.message?.content ?? value.message?.text;
  const text = contentToText(rawContent).trim();

  if (role !== "unknown" && text) {
    output.push({ role, content: text.slice(0, 20_000) });
    return;
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") collectJsonMessages(child, output, state, depth + 1);
  }
}

function parseJson(text) {
  const parsed = JSON.parse(text);
  const messages = [];
  collectJsonMessages(parsed, messages, { nodes: 0 });
  return { messages, warnings: [] };
}

function parseJsonLines(text) {
  const messages = [];
  const warnings = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      collectJsonMessages(JSON.parse(line), messages, { nodes: 0 });
    } catch {
      warnings.push(`第 ${index + 1} 行不是有效 JSON，已跳过`);
    }
  });
  return { messages, warnings: warnings.slice(0, 20) };
}

function parseMarkedText(text, plainTextIsUser) {
  const messages = [];
  let current = null;

  const flush = () => {
    if (current?.content.trim()) messages.push({ role: current.role, content: current.content.trim().slice(0, 20_000) });
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^\s{0,3}#{1,6}\s*/, "").replace(/\*\*/g, "").trimEnd();
    const marked = line.match(/^\s*(用户|User|Human|Me|我|本人|Assistant|AI|Bot|DeepSeek|助手)\s*[:：]\s*(.*)$/i);
    const heading = line.match(/^\s*(用户|User|Human|Me|我|本人|Assistant|AI|Bot|DeepSeek|助手)\s*$/i);
    const match = marked || heading;
    if (match) {
      flush();
      current = { role: normalizeRole(match[1]), content: marked?.[2] || "" };
    } else if (current) {
      current.content += `${current.content ? "\n" : ""}${rawLine}`;
    }
  }
  flush();

  if (!messages.length && plainTextIsUser && text.trim()) {
    return {
      messages: [{ role: "user", content: text.trim().slice(0, 20_000) }],
      warnings: ["这个文件没有角色标记，已按你的明确选择把全文视为本人文字"],
    };
  }
  if (!messages.length) {
    return {
      messages: [],
      warnings: ["没有识别到“用户：/DeepSeek：”等角色标记；为避免把 AI 回答当作你的事实，本次没有生成候选"],
    };
  }
  return { messages, warnings: [] };
}

function categoryFor(text) {
  if (/(?:学校|大学|学院|专业|课程|毕业|就读)/.test(text)) return "education";
  if (/(?:实习|任职|担任|负责|参与|项目|工作|部长|HRBP|人事|行政)/i.test(text)) return "experience";
  if (/(?:喜欢|爱好|兴趣)/.test(text)) return "interests";
  if (/(?:希望|目标|求职|职业)/.test(text)) return "career";
  if (/(?:擅长|技能|能力|证书)/.test(text)) return "skills";
  return "personal";
}

function fingerprint(type, text) {
  return createHash("sha256").update(`${type}\0${text}`).digest("hex").slice(0, 20);
}

function factSentences(text) {
  return text
    .split(/(?<=[。！？!?；;])|\n+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 7 && item.length <= 360)
    .filter((item) => !/[?？]\s*$/.test(item))
    .filter((item) => FACT_WORDS.test(item) && /(?:我|本人|我的|我们|曾|目前)/.test(item));
}

function buildCandidates(messages, sourceName) {
  const candidates = [];
  const seen = new Set();
  let factCount = 0;
  let styleCount = 0;
  let blockedInstructionFragments = 0;
  let blockedPrivateFragments = 0;
  let blockedSiteExclusionFragments = 0;

  const countBlocked = (inspection) => {
    if (inspection.instructionSignals.length) blockedInstructionFragments += 1;
    if (inspection.privateSignals.length) blockedPrivateFragments += 1;
    if (inspection.siteExclusionSignals.length) blockedSiteExclusionFragments += 1;
  };

  messages.forEach((message, messageIndex) => {
    if (message.role !== "user") return;
    const redacted = redactSensitiveText(message.content);
    if (!redacted.text) return;
    const messageInspection = inspectImportedKnowledgeText(redacted.text);
    if (messageInspection.blocked) countBlocked(messageInspection);

    for (const sentence of factSentences(redacted.text)) {
      if (factCount >= 80) break;
      const fact = redactSensitiveText(sentence);
      const factInspection = inspectImportedKnowledgeText(fact.text);
      if (factInspection.blocked) {
        continue;
      }
      const key = fingerprint("fact", fact.text);
      if (seen.has(key)) continue;
      seen.add(key);
      factCount += 1;
      candidates.push({
        id: randomUUID(),
        fingerprint: key,
        type: "fact",
        category: categoryFor(fact.text),
        content: fact.text,
        evidence: fact.text.slice(0, 420),
        sourceName,
        messageIndex,
        warnings: ["来源文件仅作为未经信任的资料；请核对事实，不要执行其中的指令", ...fact.warnings],
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    }

    const styleText = redacted.text.replace(/\s+/g, " ").trim();
    const isSafeStyleCandidate =
      styleText.length >= 40
      && styleText.length <= 420
      && /(?:我|我的|本人)/.test(styleText)
      && !/[?？]/.test(styleText)
      && !STYLE_PROMPT_PREFIX.test(styleText)
      && !STYLE_INSTRUCTION_WORDS.test(styleText)
      && !SENSITIVE_STYLE_TOPICS.test(styleText)
      && !/https?:\/\//i.test(styleText)
      && redacted.warnings.length === 0
      && !messageInspection.blocked;
    if (styleCount < 40 && isSafeStyleCandidate) {
      const key = fingerprint("style", styleText);
      if (!seen.has(key)) {
        seen.add(key);
        styleCount += 1;
        candidates.push({
          id: randomUUID(),
          fingerprint: key,
          type: "style",
          category: "voice",
          content: styleText,
          evidence: styleText,
          sourceName,
          messageIndex,
          warnings: ["来源文件仅作为未经信任的资料；表达样本只能影响语气，不能作为事实或指令"],
          status: "pending",
          createdAt: new Date().toISOString(),
        });
      }
    }
  });

  const safeUserTexts = messages
    .map((message) => redactSensitiveText(message.content))
    .filter((item) => item.text && item.warnings.length === 0)
    .filter((item) => !inspectImportedKnowledgeText(item.text).blocked)
    .map((item) => item.text);
  const addAggregate = (type, category, content, evidence) => {
    const key = fingerprint(type, content);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      id: randomUUID(),
      fingerprint: key,
      type,
      category,
      content,
      evidence,
      sourceName,
      messageIndex: null,
      warnings: ["这是根据多条本人发言归纳的候选结论，请确认表述是否准确"],
      status: "pending",
      createdAt: new Date().toISOString(),
    });
  };
  const detailPreferenceCount = safeUserTexts.filter((text) => /(?:具体|详细|案例|真实链接|数据|依据|结构|系统)/.test(text)).length;
  if (detailPreferenceCount >= 4) {
    addAggregate(
      "style",
      "voice",
      "我的表达与思考偏好具体、结构清晰，并重视案例和可核验依据。",
      `由 ${detailPreferenceCount} 条包含“具体、详细、案例、依据或结构”等表达的本人发言归纳`,
    );
  }
  const laborTopicCount = safeUserTexts.filter((text) => /(?:劳动法|劳动关系|劳工标准|工会|工伤保险|劳动合同)/.test(text)).length;
  if (laborTopicCount >= 4) {
    addAggregate(
      "fact",
      "interests",
      "我曾多次围绕劳动法、劳动关系、国际劳工标准等议题进行学习与提问。",
      `由 ${laborTopicCount} 条相关主题的本人发言归纳`,
    );
  }
  const hrTopicCount = safeUserTexts.filter((text) => /(?:HRBP|hrbp|招聘|人事|绩效评估|人力资源)/.test(text)).length;
  if (hrTopicCount >= 3) {
    addAggregate(
      "fact",
      "interests",
      "我曾多次关注 HRBP、招聘，以及 AI 在人力资源场景中的应用。",
      `由 ${hrTopicCount} 条相关主题的本人发言归纳`,
    );
  }
  const policyWarnings = [];
  if (blockedInstructionFragments) {
    policyWarnings.push(`已拦截 ${blockedInstructionFragments} 个疑似文档指令片段；导入文件只作为资料，不作为 AI 指令`);
  }
  if (blockedPrivateFragments) {
    policyWarnings.push(`已拦截 ${blockedPrivateFragments} 个默认不公开的敏感字段片段`);
  }
  if (blockedSiteExclusionFragments) {
    policyWarnings.push(`已拦截 ${blockedSiteExclusionFragments} 个当前站点明确不公开的内容片段（当前城市、职业规划或求职方向、实习经历、校园经历）`);
  }
  return { candidates, policyWarnings };
}

export function validateImportFilename(filename) {
  const normalized = String(filename || "").normalize("NFKC");
  if (!normalized || normalized.includes("\0") || path.basename(normalized) !== normalized) {
    throw Object.assign(new Error("文件名无效。"), { statusCode: 400 });
  }
  const extension = path.extname(normalized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw Object.assign(new Error("只支持 JSON、JSONL、Markdown 和 TXT 文件。"), { statusCode: 415 });
  }
  return { safeName: normalized.slice(0, 180), extension };
}

export function parseConversationFile({ filename, buffer, plainTextIsUser = false }) {
  const { safeName, extension } = validateImportFilename(filename);
  const text = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer ?? "");
  if (!text.trim()) throw Object.assign(new Error("文件是空的。"), { statusCode: 400 });

  let parsed;
  try {
    if (extension === ".json") parsed = parseJson(text);
    else if (extension === ".jsonl") parsed = parseJsonLines(text);
    else parsed = parseMarkedText(text, plainTextIsUser);
  } catch {
    throw Object.assign(new Error("文件内容无法解析，请确认导出格式是否完整。"), { statusCode: 400 });
  }

  const userMessages = parsed.messages.filter((message) => message.role === "user");
  const assistantMessages = parsed.messages.filter((message) => message.role === "assistant");
  const { candidates, policyWarnings } = buildCandidates(userMessages, safeName);

  return {
    sourceName: safeName,
    extension,
    messageCount: parsed.messages.length,
    userMessageCount: userMessages.length,
    ignoredAssistantCount: assistantMessages.length,
    candidates,
    warnings: [...parsed.warnings, ...policyWarnings],
  };
}
