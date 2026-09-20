import test from "node:test";
import assert from "node:assert/strict";
import { localKnowledgeReply } from "../server/chat-knowledge.mjs";
import { portfolioData } from "../src/data.js";

const approved = {
  schemaVersion: 1,
  updatedAt: null,
  facts: [
    { id: "interest-1", category: "interests", text: "我曾多次关注 HRBP、招聘，以及 AI 在人力资源场景中的应用。" },
  ],
  styleSamples: [
    { id: "style-1", text: "我的表达与思考偏好具体、结构清晰，并重视可核验依据。" },
  ],
};

function reply(question) {
  return localKnowledgeReply({ question, approved, portfolioData });
}

test("本地模式用公开主页回答专业背景", () => {
  const answer = reply("请介绍他的专业背景");
  assert.match(answer, /中南财经政法大学/);
  assert.match(answer, /劳动关系/);
});

test("已删除的人力资源经历不会从其他资料回流，并自然转场", () => {
  const answer = reply("他有哪些人力资源相关经历？");
  assert.match(answer, /没有在主页上展开|不替他猜/);
  assert.doesNotMatch(answer, /新东方|电子厂|新闻部/);
});

test("已删除的校园经历会自然说明没有公开", () => {
  const answer = reply("他有哪些校园实践？");
  assert.match(answer, /没有在主页上展开|不替他猜/);
  assert.doesNotMatch(answer, /新东方|电子厂|新闻部/);
});

test("本地模式明确列出尚未补充的信息", () => {
  const answer = reply("目前还有哪些信息尚未补充？");
  assert.match(answer, /公开联系方式/);
  assert.match(answer, /个人照片/);
  assert.doesNotMatch(answer, /到岗时间|简历|项目与成果/);
  assert.doesNotMatch(answer, /曾多次关注/);
});

test("本地模式以第三人称转述批准知识", () => {
  const interestAnswer = reply("他关注哪些方向？");
  const styleAnswer = reply("他的表达风格是什么？");
  assert.match(interestAnswer, /陈德基曾多次关注/);
  assert.doesNotMatch(interestAnswer, /：我曾/);
  assert.match(styleAnswer, /陈德基的表达与思考偏好/);
  assert.doesNotMatch(styleAnswer, /：我的/);
});

test("本地模式不会用无关资料回答未知问题或代替本人承诺", () => {
  assert.match(reply("他的出生日期是什么？"), /没有在主页上展开|不替他猜/);
  assert.match(reply("请确认录用和工资"), /不能代表陈德基确认/);
});
