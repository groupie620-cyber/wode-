import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { redactSensitiveText } from "./redact.mjs";
import { inspectImportedKnowledgeText } from "./content-policy.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDir, "../..");
const approvedPath = path.join(moduleDir, "approved.json");
const privateRoot = path.join(projectRoot, "private-data");
const inboxPath = path.join(privateRoot, "deepseek-inbox");
const reviewRoot = path.join(privateRoot, "review");
const reviewPath = path.join(reviewRoot, "candidates.json");

const emptyApproved = () => ({ schemaVersion: 1, updatedAt: null, facts: [], styleSamples: [] });
const emptyReview = () => ({ schemaVersion: 1, updatedAt: null, candidates: [] });

function cleanText(value, maximum = 800) {
  return String(value ?? "").normalize("NFKC").replaceAll("\0", "").trim().slice(0, maximum);
}

function isSafeApprovedText(value) {
  try {
    return !inspectImportedKnowledgeText(value).blocked;
  } catch {
    // Public knowledge is fail-closed: an unexpected policy failure must not
    // turn an unverified entry into model context.
    return false;
  }
}

export function normalizeApprovedKnowledge(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== 1) return emptyApproved();
  const facts = Array.isArray(value.facts)
    ? value.facts.slice(0, 100).map((item) => ({
      id: cleanText(item?.id, 100) || randomUUID(),
      category: cleanText(item?.category, 40) || "personal",
      text: cleanText(item?.text),
    })).filter((item) => item.text && isSafeApprovedText(item.text))
    : [];
  const styleSamples = Array.isArray(value.styleSamples)
    ? value.styleSamples.slice(0, 20).map((item) => ({
      id: cleanText(item?.id, 100) || randomUUID(),
      text: cleanText(item?.text),
    })).filter((item) => item.text && isSafeApprovedText(item.text))
    : [];
  return { schemaVersion: 1, updatedAt: value.updatedAt || null, facts, styleSamples };
}

function normalizeReview(value) {
  const candidates = Array.isArray(value?.candidates)
    ? value.candidates.slice(-600).map((item) => ({
      id: cleanText(item?.id, 100) || randomUUID(),
      fingerprint: cleanText(item?.fingerprint, 100),
      type: item?.type === "style" ? "style" : "fact",
      category: cleanText(item?.category, 40) || "personal",
      content: cleanText(item?.content),
      evidence: cleanText(item?.evidence),
      sourceName: cleanText(item?.sourceName, 180),
      messageIndex: Number.isInteger(item?.messageIndex) ? item.messageIndex : null,
      warnings: Array.isArray(item?.warnings) ? item.warnings.map((warning) => cleanText(warning, 200)).filter(Boolean).slice(0, 8) : [],
      status: ["pending", "approved", "rejected"].includes(item?.status) ? item.status : "pending",
      createdAt: item?.createdAt || null,
      reviewedAt: item?.reviewedAt || null,
    })).filter((item) => item.content)
    : [];
  return { schemaVersion: 1, updatedAt: value?.updatedAt || null, candidates };
}

async function readJson(filePath, fallback, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") console.error(`${label} 无法读取，将按空数据处理。`);
    return fallback();
  }
}

async function atomicWriteJson(filePath, value, mode = 0o600) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode });
  await rename(tempPath, filePath);
}

export async function ensureKnowledgeDirectories() {
  await mkdir(inboxPath, { recursive: true, mode: 0o700 });
  await mkdir(reviewRoot, { recursive: true, mode: 0o700 });
}

export async function readApprovedKnowledge() {
  return normalizeApprovedKnowledge(await readJson(approvedPath, emptyApproved, "公开知识库"));
}

export async function readReviewQueue() {
  await ensureKnowledgeDirectories();
  return normalizeReview(await readJson(reviewPath, emptyReview, "本地审核队列"));
}

export async function saveReviewQueue(value) {
  const normalized = normalizeReview({ ...value, schemaVersion: 1, updatedAt: new Date().toISOString() });
  normalized.updatedAt = new Date().toISOString();
  await atomicWriteJson(reviewPath, normalized);
  return normalized;
}

export async function saveApprovedKnowledge(value) {
  const normalized = normalizeApprovedKnowledge({ ...value, schemaVersion: 1, updatedAt: new Date().toISOString() });
  normalized.updatedAt = new Date().toISOString();
  await atomicWriteJson(approvedPath, normalized, 0o644);
  return normalized;
}

export async function keepPrivateImport(extension, buffer) {
  await ensureKnowledgeDirectories();
  const savedName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}${extension}`;
  await writeFile(path.join(inboxPath, savedName), buffer, { mode: 0o600, flag: "wx" });
  return savedName;
}

export function sanitizeApprovedText(value) {
  const clean = redactSensitiveText(cleanText(value)).text;
  return clean.slice(0, 800);
}

export function renderApprovedKnowledge(approved) {
  const normalized = normalizeApprovedKnowledge(approved);
  const facts = normalized.facts.map((item) => `- [${item.category}] ${item.text}`).join("\n");
  const styles = normalized.styleSamples.map((item) => `- ${item.text}`).join("\n");
  const rendered = `【本人审核通过的公开事实】\n${facts || "- 暂无额外事实"}\n\n【本人审核通过的表达样本】\n${styles || "- 暂无表达样本；不要推测其语气或性格"}`;
  return rendered.slice(0, 30_000);
}

export const knowledgePaths = { approvedPath, privateRoot, inboxPath, reviewPath };
