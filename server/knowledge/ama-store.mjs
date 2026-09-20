import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectImportedKnowledgeText } from "./content-policy.mjs";
import { redactSensitiveText } from "./redact.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const amaPath = path.join(moduleDir, "ama.json");

const VALID_KINDS = new Set(["confirmed", "discussion", "reference"]);
const emptyAma = () => ({ schemaVersion: 1, updatedAt: null, documents: [] });

function cleanText(value, maximum) {
  return String(value ?? "").normalize("NFKC").replaceAll("\0", "").trim().slice(0, maximum);
}

function safeSegments(value) {
  const redacted = redactSensitiveText(cleanText(value, 80_000));
  const paragraphs = redacted.text
    .split(/\n{2,}|(?<=[。！？!?；;])\s*(?=.{20,})/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const kept = paragraphs.filter((paragraph) => !inspectImportedKnowledgeText(paragraph).blocked);
  return {
    content: kept.join("\n\n").slice(0, 60_000),
    removedSegments: paragraphs.length - kept.length,
    redactions: redacted.redactions,
  };
}

export function prepareAmaDocument(value) {
  const sanitized = safeSegments(value?.content);
  const title = cleanText(value?.title, 160);
  const tags = Array.isArray(value?.tags)
    ? value.tags.map((tag) => cleanText(tag, 40)).filter(Boolean).slice(0, 12)
    : cleanText(value?.tags, 240).split(/[,，、]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 12);
  return {
    document: {
      id: cleanText(value?.id, 100) || randomUUID(),
      title,
      category: cleanText(value?.category, 40) || "personal_thinking",
      kind: VALID_KINDS.has(value?.kind) ? value.kind : "discussion",
      tags,
      content: sanitized.content,
      sourceName: cleanText(value?.sourceName, 180) || "本机后台输入",
      enabled: value?.enabled !== false,
      pinned: value?.pinned === true,
      createdAt: value?.createdAt || new Date().toISOString(),
      updatedAt: value?.updatedAt || new Date().toISOString(),
    },
    removedSegments: sanitized.removedSegments,
    redactions: sanitized.redactions,
  };
}

export function normalizeAmaKnowledge(value) {
  if (!value || typeof value !== "object" || value.schemaVersion !== 1) return emptyAma();
  const documents = Array.isArray(value.documents)
    ? value.documents.slice(0, 240).map((item) => prepareAmaDocument(item).document).filter((item) => item.title && item.content)
    : [];
  return { schemaVersion: 1, updatedAt: value.updatedAt || null, documents };
}

async function readJson() {
  try {
    return JSON.parse(await readFile(amaPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("AMA 认知库无法读取，将按空数据处理。");
    return emptyAma();
  }
}

async function atomicWrite(value) {
  await mkdir(path.dirname(amaPath), { recursive: true });
  const temporary = `${amaPath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o644 });
  await rename(temporary, amaPath);
}

export async function readAmaKnowledge() {
  return normalizeAmaKnowledge(await readJson());
}

export async function saveAmaKnowledge(value) {
  const normalized = normalizeAmaKnowledge({ ...value, schemaVersion: 1, updatedAt: new Date().toISOString() });
  normalized.updatedAt = new Date().toISOString();
  await atomicWrite(normalized);
  return normalized;
}

export const amaKnowledgePaths = { amaPath };

