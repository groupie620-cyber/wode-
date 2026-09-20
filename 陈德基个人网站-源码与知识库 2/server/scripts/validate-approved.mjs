import { readApprovedKnowledge } from "../knowledge/store.mjs";
import { redactSensitiveText } from "../knowledge/redact.mjs";
import {
  findDefaultPrivateSignals,
  findSitePublicExclusionSignals,
  findUntrustedInstructionSignals,
} from "../knowledge/content-policy.mjs";
import { readAmaKnowledge } from "../knowledge/ama-store.mjs";

const approved = await readApprovedKnowledge();
const ama = await readAmaKnowledge();
const items = [...approved.facts, ...approved.styleSamples];

for (const item of items) {
  if (!item.id || !item.text) throw new Error("公开知识库包含缺少 id 或 text 的条目。");
  const result = redactSensitiveText(item.text);
  if (result.redactions.length) {
    throw new Error(`公开知识条目 ${item.id} 可能包含敏感信息：${result.redactions.join("、")}`);
  }
  const instructionSignals = findUntrustedInstructionSignals(item.text);
  if (instructionSignals.length) {
    throw new Error(`公开知识条目 ${item.id} 包含疑似文档指令：${instructionSignals.join("、")}`);
  }
  const privateSignals = findDefaultPrivateSignals(item.text);
  if (privateSignals.length) {
    throw new Error(`公开知识条目 ${item.id} 包含默认不应公开的字段：${privateSignals.join("、")}`);
  }
  const siteExclusionSignals = findSitePublicExclusionSignals(item.text);
  if (siteExclusionSignals.length) {
    throw new Error(`公开知识条目 ${item.id} 违反当前站点公开边界：${siteExclusionSignals.join("、")}`);
  }
}

for (const document of ama.documents) {
  if (!document.id || !document.title || !document.content) throw new Error("AMA 认知库包含不完整条目。");
}

console.log(`公开知识库校验通过：${approved.facts.length} 条事实，${approved.styleSamples.length} 条表达样本，${ama.documents.length} 篇 AMA 认知资料。`);
