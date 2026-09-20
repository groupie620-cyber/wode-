import test from "node:test";
import assert from "node:assert/strict";
import { prepareAmaDocument, readAmaKnowledge } from "../server/knowledge/ama-store.mjs";
import { renderAmaKnowledgeContext, retrieveAmaKnowledge } from "../server/knowledge/ama-retrieval.mjs";

test("AMA 长文入库会隐藏密钥并移除站点排除片段", () => {
  const prepared = prepareAmaDocument({
    title: "测试认知",
    kind: "confirmed",
    content: "我重视真实、自由与长期成长。\n\n我住深圳。\n\nAPI_KEY=secret-value-123456",
  });
  assert.match(prepared.document.content, /真实、自由与长期成长/);
  assert.doesNotMatch(prepared.document.content, /我住深圳|secret-value/);
  assert.ok(prepared.removedSegments >= 1);
  assert.ok(prepared.redactions.length >= 1);
});

test("AMA 检索只带入相关资料，不强塞无关人格锚点", () => {
  const knowledge = {
    schemaVersion: 1,
    documents: [
      { id: "core", title: "核心价值", category: "personal_values", kind: "confirmed", tags: ["真实"], content: "我重视真实。", enabled: true, pinned: true },
      { id: "ai", title: "AI 与招聘伦理", category: "technology", kind: "discussion", tags: ["AI"], content: "我关注算法筛选中的公平、解释与人的最终判断。", enabled: true },
      { id: "econ", title: "经济学", category: "economics_and_methods", kind: "reference", tags: ["回归"], content: "回归分析参考。", enabled: true },
    ],
  };
  const items = retrieveAmaKnowledge({ question: "你怎么看 AI 与人的关系？", knowledge });
  assert.ok(items.some((item) => item.document.id === "ai"));
  assert.equal(items.some((item) => item.document.id === "core"), false);
  assert.equal(items.some((item) => item.document.id === "econ"), false);
  assert.ok(retrieveAmaKnowledge({ question: "他重视真实吗？", knowledge }).some((item) => item.document.id === "core"));
  assert.match(renderAmaKnowledgeContext({ question: "AI 公平", knowledge }), /历史讨论线索/);
});

test("导入后的 AMA 知识库包含丰富讨论且排除高敏感主题", async () => {
  const knowledge = await readAmaKnowledge();
  assert.ok(knowledge.documents.length >= 60);
  assert.ok(knowledge.documents.some((item) => item.kind === "confirmed"));
  assert.ok(knowledge.documents.some((item) => item.kind === "discussion"));
  assert.ok(knowledge.documents.some((item) => item.kind === "reference"));
  const corpus = knowledge.documents.map((item) => `${item.title}\n${item.content}`).join("\n");
  assert.doesNotMatch(corpus, /我不想活了|哪里可以看得到自残|sk-[A-Za-z0-9_-]{10,}/i);
});
