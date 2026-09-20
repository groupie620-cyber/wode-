function clean(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase();
}

function tokens(value) {
  const text = clean(value);
  const output = new Set(text.match(/[a-z][a-z0-9.+#-]{1,}|\d{2,}/g) || []);
  for (const sequence of text.match(/[\u3400-\u9fff]{2,}/g) || []) {
    if (sequence.length <= 8) output.add(sequence);
    for (let index = 0; index < sequence.length - 1; index += 1) output.add(sequence.slice(index, index + 2));
  }
  return output;
}

function expandedQuery(value) {
  const text = clean(value);
  const additions = [];
  if (/(?:工作|职业|成长|合作|团队|选择)/.test(text)) additions.push("工作 成长 合作 沟通 决策 学习 价值观 边界 选择");
  if (/(?:岗位|面试|hr|招聘|人力资源|劳动关系)/i.test(text)) additions.push("职业 业务 HRBP 招聘 人力资源 劳动关系 组织");
  if (/(?:世界|价值|公平|正义|社会|选择|人生|意义)/.test(text)) additions.push("价值观 公平 正义 自由 关系 真实 决策 社会");
  if (/(?:劳动|工会|劳工|合同|就业|保险|法律)/.test(text)) additions.push("劳动法 国际劳工标准 工会 劳动监察 劳动合同 工伤保险");
  if (/(?:ai|人工智能|算法|技术|机器人|slam|vla|vln)/i.test(text)) additions.push("AI 人工智能 招聘伦理 机器人 技术 算法 SLAM VLA");
  if (/(?:学习|课程|研究|论文|怎么学)/.test(text)) additions.push("学习 研究 结构 案例 依据 经济学 计量");
  if (/(?:性格|表达|沟通|怎么说|回复|写)/.test(text)) additions.push("表达 直接 简洁 结构清晰 共情 沟通");
  return `${text} ${additions.join(" ")}`;
}

function chunkContent(content, maximum = 1_500) {
  const paragraphs = String(content ?? "").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maximum) {
      chunks.push(current);
      current = "";
    }
    if (paragraph.length > maximum) {
      if (current) chunks.push(current);
      for (let index = 0; index < paragraph.length; index += maximum) chunks.push(paragraph.slice(index, index + maximum));
      current = "";
    } else {
      current += `${current ? "\n\n" : ""}${paragraph}`;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function overlapScore(queryTokens, candidateTokens) {
  let score = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) score += token.length >= 3 ? 2.2 : 1;
  }
  return score;
}

export function retrieveAmaKnowledge({ question, knowledge, limit = 9, maxCharacters = 14_000 }) {
  const query = expandedQuery(question);
  const queryTokens = tokens(query);
  const ranked = [];

  for (const document of knowledge?.documents || []) {
    if (!document.enabled) continue;
    const meta = `${document.title} ${document.category} ${(document.tags || []).join(" ")}`;
    const metaTokens = tokens(meta);
    for (const [chunkIndex, content] of chunkContent(document.content).entries()) {
      const contentTokens = tokens(content);
      let relevance = overlapScore(queryTokens, contentTokens) + overlapScore(queryTokens, metaTokens) * 3;
      if (clean(content).includes(clean(question)) && clean(question).length >= 3) relevance += 12;
      if (/(?:工作|职业|成长|合作|团队|选择)/.test(query) && ["career_and_business", "thinking_style", "communication_style", "personal_values"].includes(document.category)) relevance += 5;
      if (/(?:ai|人工智能|算法|技术|机器人)/i.test(query) && ["technology", "professional_thinking"].includes(document.category)) relevance += 7;
      if (/(?:劳动|工会|劳工|合同|就业|保险|法律)/.test(query) && document.category === "labor_and_society") relevance += 7;
      if (/(?:世界|价值|公平|正义|社会|人生|意义)/.test(query) && ["worldview_and_justice", "personal_values"].includes(document.category)) relevance += 7;
      if (relevance <= 0) continue;
      let score = relevance;
      if (document.kind === "confirmed") score += 0.75;
      if (document.pinned) score += 0.25;
      ranked.push({ document, chunkIndex, content, score });
    }
  }

  ranked.sort((left, right) => right.score - left.score || Number(right.document.pinned) - Number(left.document.pinned));
  const selected = [];
  const seen = new Set();
  const perDocument = new Map();
  let used = 0;
  for (const item of ranked) {
    const key = `${item.document.id}:${item.chunkIndex}`;
    if (seen.has(key)) continue;
    const documentCount = perDocument.get(item.document.id) || 0;
    const documentLimit = item.document.kind === "reference" ? 2 : 1;
    if (documentCount >= documentLimit) continue;
    const cost = item.content.length + item.document.title.length + 80;
    if (selected.length >= limit || used + cost > maxCharacters) continue;
    selected.push(item);
    seen.add(key);
    perDocument.set(item.document.id, documentCount + 1);
    used += cost;
  }
  return selected;
}

export function renderAmaKnowledgeContext({ question, knowledge }) {
  const wantsDetail = /(?:详细|深入|展开|逐条|举例|例子|全面|系统分析)/.test(String(question));
  const items = retrieveAmaKnowledge({
    question,
    knowledge,
    limit: wantsDetail ? 8 : 5,
    maxCharacters: wantsDetail ? 12_000 : 7_000,
  });
  if (!items.length) return "【AMA 认知库】\n- 暂无与问题直接相关的认知片段。可基于已确认的价值观进行谨慎推理，但不能编造个人事实。";
  const lines = items.map(({ document, content }) => {
    const meaning = document.kind === "confirmed"
      ? "本人确认"
      : document.kind === "discussion"
        ? "历史讨论线索，不等于最终立场"
        : "历史参考资料，不代表本人观点且需核验时效";
    return `- [${meaning}｜${document.category}｜${document.title}]\n${content}`;
  });
  return `【与本题最相关的 AMA 认知片段】\n${lines.join("\n\n")}`;
}
