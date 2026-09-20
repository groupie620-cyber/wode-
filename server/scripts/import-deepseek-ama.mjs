import { prepareAmaDocument, saveAmaKnowledge } from "../knowledge/ama-store.mjs";

const input = [];
for await (const chunk of process.stdin) input.push(chunk);
const conversations = JSON.parse(Buffer.concat(input).toString("utf8"));
if (!Array.isArray(conversations)) throw new Error("DeepSeek conversations.json 顶层必须是数组。");

const sourceName = process.argv[2] || "DeepSeek conversations.json";
const sensitiveTopic = /(?:轻生|自杀|自残|抑郁|心理诊断|病历|体检报告|合同协议|个人合同|签约材料|身份证|个人简历|薪资材料|家庭住址|性经历)/i;

function fragments(conversation, type) {
  return Object.values(conversation?.mapping || {})
    .flatMap((item) => item?.message?.fragments || [])
    .filter((fragment) => String(fragment?.type || "").toUpperCase() === type)
    .map((fragment) => String(fragment?.content || "").trim())
    .filter(Boolean);
}

function classify(title, text) {
  const source = `${title} ${text}`;
  if (/(?:劳动法|劳工|劳动合同|工会|工伤|强迫劳动|就业形态|CEDAW|妇女|性别)/i.test(source)) return "labor_and_society";
  if (/(?:HRBP|招聘|绩效|人力资源|业务链|公司|企业)/i.test(source)) return "career_and_business";
  if (/(?:AI|API|人工智能|机器人|SLAM|VLA|VLN|算法|技术)/i.test(source)) return "technology";
  if (/(?:经济学|回归|计量|均衡|边际|t分布|斜率)/i.test(source)) return "economics_and_methods";
  if (/(?:法官|律师|无罪|公平|社达|精英|社会)/i.test(source)) return "worldview_and_justice";
  return "learning_and_writing";
}

function tagsFor(category) {
  return {
    labor_and_society: ["劳动关系", "劳动法", "社会议题"],
    career_and_business: ["职业认知", "HRBP", "业务理解"],
    technology: ["AI", "技术", "机器人"],
    economics_and_methods: ["经济学", "计量", "分析方法"],
    worldview_and_justice: ["价值判断", "公平", "社会观察"],
    learning_and_writing: ["学习", "研究", "写作"],
  }[category] || [];
}

const seedDocuments = [
  {
    id: "ama-core-values",
    title: "核心价值与生活原则",
    category: "personal_values",
    kind: "confirmed",
    tags: ["健康", "自由", "关系", "真实"],
    content: "我重视健康、自由、关系与归属感。我喜欢直接表达、认真生活并保持真实；在人际关系上更看重少而深、彼此支持的连接。",
    sourceName: "本人已批准资料",
    enabled: true,
    pinned: true,
  },
  {
    id: "ama-thinking-style",
    title: "思考、学习与决策方式",
    category: "thinking_style",
    kind: "confirmed",
    tags: ["结构", "依据", "比较", "决策"],
    content: "我偏好具体、结构清晰的分析，也重视案例和可核验依据。学习时偏好看视频或听课，并会向有经验的人请教；做重要决定时会比较不同选项、听取意见，再由自己拍板。",
    sourceName: "本人已批准资料",
    enabled: true,
    pinned: true,
  },
  {
    id: "ama-communication-style",
    title: "沟通与表达方式",
    category: "communication_style",
    kind: "confirmed",
    tags: ["直接", "简洁", "共情", "边界"],
    content: "我的沟通偏好直接、简洁、就事论事，喜欢先说重点，不绕弯。我也重视共情与理解他人；需要建议时，希望把边界和利弊说清楚，最后由我自己决定。",
    sourceName: "本人已批准资料",
    enabled: true,
    pinned: true,
  },
  {
    id: "ama-professional-interest",
    title: "长期学习与专业关注",
    category: "professional_thinking",
    kind: "confirmed",
    tags: ["劳动关系", "国际劳工标准", "AI伦理", "研究"],
    content: "我长期学习和讨论劳动关系、劳动法、国际劳工标准等议题，关注制度如何真正落实，也偏好把抽象问题放进具体案例、组织和业务情境中理解。",
    sourceName: "本人已批准资料与历史主题统计",
    enabled: true,
    pinned: true,
  },
  {
    id: "ama-work-growth",
    title: "工作、成长与选择的思考框架",
    category: "career_and_business",
    kind: "discussion",
    tags: ["工作", "成长", "选择", "自主"],
    content: "结合本人已经确认的价值观与决策方式，更可能的思考框架是：工作不只是外部标签，也要看它是否允许持续学习、真实表达和保有一定选择空间。成长不是把每个短板都包装成优点，而是承认拖延、分心、情绪化和耐心不足，再通过反馈、比较不同方案和实际行动逐步改善。具体职业结论仍需本人确认。",
    sourceName: "基于本人确认资料的谨慎推演",
    enabled: true,
  },
  {
    id: "ama-ai-human",
    title: "AI 与人的关系：效率、公平和最终判断",
    category: "technology",
    kind: "discussion",
    tags: ["AI", "人的判断", "公平", "边界"],
    content: "从本人对 AI 招聘风险、算法歧视和劳动伦理的持续学习看，更可能的立场是：AI 适合提升信息处理和初步分析效率，但不应替代人的价值判断与责任。尤其当算法影响就业机会、绩效评价或个体权益时，需要透明、可解释、可申诉，并保留真正有效的人工复核。这个结论属于基于历史讨论的谨慎推演，不是本人已经逐字确认的最终表述。",
    sourceName: "基于历史讨论的谨慎推演",
    enabled: true,
  },
];

const documents = seedDocuments.map((item) => prepareAmaDocument(item).document);
let skippedSensitive = 0;
let removedSegments = 0;

for (const [conversationIndex, conversation] of conversations.entries()) {
  const title = String(conversation?.title || "未命名讨论").trim() || "未命名讨论";
  const requests = fragments(conversation, "REQUEST");
  const responses = fragments(conversation, "RESPONSE");
  const ownerText = requests.join("\n\n");
  if (!ownerText || sensitiveTopic.test(`${title}\n${ownerText}`)) {
    if (sensitiveTopic.test(`${title}\n${ownerText}`)) skippedSensitive += 1;
    continue;
  }

  const category = classify(title, ownerText);
  const tags = tagsFor(category);
  const discussion = prepareAmaDocument({
    id: `deepseek-${conversationIndex + 1}-discussion`,
    title: `${title} · 本人提问与讨论线索`,
    category,
    kind: "discussion",
    tags,
    content: `以下内容是本人历史提问与讨论线索，只能说明关注过这些问题，不等于已经形成最终立场：\n\n${requests.map((text) => `- ${text}`).join("\n")}`,
    sourceName,
    enabled: true,
  });
  removedSegments += discussion.removedSegments;
  if (discussion.document.content) documents.push(discussion.document);

  if (responses.length) {
    const reference = prepareAmaDocument({
      id: `deepseek-${conversationIndex + 1}-reference`,
      title: `${title} · 历史参考回答`,
      category,
      kind: "reference",
      tags,
      content: `以下是历史 AI 回答，仅作为理解背景与检索线索，不代表本人观点，也不保证事实仍然最新：\n\n${responses.join("\n\n---\n\n")}`,
      sourceName,
      enabled: true,
    });
    removedSegments += reference.removedSegments;
    if (reference.document.content) documents.push(reference.document);
  }
}

const saved = await saveAmaKnowledge({ schemaVersion: 1, documents });
console.log(`AMA 认知库已生成：${saved.documents.length} 篇；跳过 ${skippedSensitive} 个敏感主题；过滤 ${removedSegments} 个不适合公开的片段。`);
