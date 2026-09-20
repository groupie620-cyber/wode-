import {
  classifyCareerTask,
  amaOnlyResponse,
  commitmentRefusal,
  enforceCareerAgentReply,
  isCommitmentDecisionRequest,
  isDraftRequest,
  isPromptInjectionAttempt,
  promptInjectionRefusal,
} from "./career-agent.mjs";
import { normalizeApprovedKnowledge } from "./knowledge/store.mjs";
import { retrieveAmaKnowledge } from "./knowledge/ama-retrieval.mjs";

function cleanSentence(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replaceAll("\0", "")
    .trim()
    .replace(/(?<=[\u3400-\u9fff]),(?=[\u3400-\u9fff])/g, "，")
    .replaceAll(";", "；")
    .replace(/[。！？!?；;]+$/g, "");
}

export function toThirdPerson(value, name) {
  const text = cleanSentence(value);
  if (!text) return "";

  return text
    .replace(/由我自己/g, `由${name}本人`)
    .replace(/我自己/g, `${name}本人`)
    .replace(/由我(?=来|决定|选择|判断|确认)/g, `由${name}本人`)
    .replace(/^这是我的/, `这是${name}的`)
    .replace(/(^|[，,。！？!?；;：:]\s*)本人(?=的|曾|在|是|有|目前|就读|学习|参与|担任|负责|希望|喜欢|关注|认为|偏好|重视|能|会|把|将)/g, `$1${name}`)
    .replace(/(^|[，,。！？!?；;：:]\s*)我的/g, `$1${name}的`)
    .replace(/(^|[，,。！？!?；;：:]\s*)我(?=曾|在|是|有|目前|就读|学习|参与|担任|负责|希望|喜欢|关注|认为|偏好|重视|能|会|把|将)/g, `$1${name}`);
}

function toFirstPerson(value, name) {
  const text = cleanSentence(value);
  if (!text) return "";
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(new RegExp(`由${escapedName}本人`, "g"), "由我自己")
    .replace(new RegExp(`${escapedName}本人`, "g"), "我自己")
    .replace(new RegExp(`${escapedName}的`, "g"), "我的")
    .replace(new RegExp(escapedName, "g"), "我")
    .replace(/^本人的/, "我的")
    .replace(/^本人(?=曾|在|是|有|目前|就读|学习|参与|担任|负责|希望|喜欢|关注|认为|偏好|重视|能|会|把|将)/, "我");
}

function journeyCategory(item) {
  const text = `${item?.type || ""} ${item?.title || ""}`;
  if (/(?:教育|学校|大学|学院|专业)/.test(text)) return "education";
  if (/(?:校园|新闻部|社团|学生会)/.test(text)) return "campus";
  if (/(?:实习|工作|HRBP|人事|行政|招聘|人力资源)/i.test(text)) return "experience";
  return "experience";
}

function publicFacts(portfolioData) {
  const name = portfolioData.profile.name;
  const facts = [];

  if (portfolioData.profile.intro) {
    facts.push({ id: "public-profile-intro", category: "overview", text: toThirdPerson(portfolioData.profile.intro, name) });
  }

  for (const [index, item] of portfolioData.journey.items.entries()) {
    if (!item?.title) continue;
    const category = journeyCategory(item);
    const period = item.period ? `（${item.period}）` : "";
    const description = cleanSentence(item.description);
    facts.push({
      id: `public-journey-${index}`,
      category,
      text: `${name}${period}的${item.type || "公开经历"}：${cleanSentence(item.title)}${description ? `；${description}` : ""}`,
    });
  }

  for (const [groupIndex, group] of portfolioData.hobbies.groups.entries()) {
    const items = Array.isArray(group?.items) ? group.items.filter(Boolean) : [];
    if (!items.length) continue;
    facts.push({
      id: `public-hobby-${groupIndex}`,
      category: "interests",
      text: `${name}公开的兴趣包括${items.join("、")}`,
    });
  }

  return facts;
}

function missingPublicInformation(portfolioData) {
  const missing = [];
  const { profile, hobbies, contact } = portfolioData;
  if (!profile.email && !contact.socialLinks.length) missing.push("公开联系方式");
  if (!profile.photos.length) missing.push("个人照片");
  if (!hobbies.groups.length) missing.push("兴趣爱好");
  return missing;
}

function uniqueFacts(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = cleanSentence(item.text).replace(/[\s，。；、·]/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function localStyleRules(styleSamples) {
  const corpus = (styleSamples || []).map((item) => cleanSentence(item?.text)).filter(Boolean).join("；");
  return {
    direct: /(?:直接|先说重点|开门见山|不绕弯)/.test(corpus),
    concise: /(?:简洁|精炼|短句|短段落|简短)/.test(corpus),
    structured: /(?:结构清晰|有条理|列表|分点|关键词)/.test(corpus),
    concrete: /(?:具体|案例|例子|依据|可核验|事实)/.test(corpus),
    considerate: /(?:真诚|温和|礼貌|友好|共情|感受)/.test(corpus),
  };
}

function genericDraftBody(query, styleRules) {
  const directLead = styleRules.direct || styleRules.structured ? "先说重点：" : "我想认真地说：";

  if (/(?:感谢|谢谢|致谢)/.test(query)) {
    const secondSentence = styleRules.considerate
      ? "你的帮助和心意我都感受到了，也很珍惜。"
      : "你的帮助对我很重要，我很珍惜。";
    return `${directLead}谢谢你[请补充具体的帮助或陪伴]。${secondSentence}`;
  }

  if (/(?:道歉|抱歉)/.test(query)) {
    return `${directLead}关于[具体事情]，我很抱歉。我的理解是[简要说明]；接下来我会[经本人确认的处理方式]。`;
  }

  if (/(?:邮件|回信|来信)/.test(query)) {
    return `您好：\n\n${directLead}[请补充邮件的核心内容]。\n${styleRules.concrete ? "具体情况是：[请填写已核验的信息]。\n" : ""}\n谢谢。`;
  }

  if (/(?:朋友|消息|短信|私信)/.test(query)) {
    return `嗨，[称呼]。${directLead}[请补充想告诉对方的核心内容]。${styleRules.considerate ? "也想听听你的想法。" : ""}`;
  }

  if (styleRules.structured) {
    return `${directLead}\n- 核心内容：[请填写]\n- 具体说明：[请填写已核验的信息]\n- 下一步：[如有需要，请本人确认]`;
  }

  return `${directLead}[请填写需要表达的核心内容]。${styleRules.concrete ? "具体情况：[请补充已核验的信息]。" : ""}`;
}

function localAmaSummary(question, amaKnowledge, name) {
  if (!amaKnowledge?.documents?.length) return "";
  const wantsDetail = /(?:详细|深入|展开|具体分析|逐条|举例|例子|为什么)/.test(question);
  const matches = retrieveAmaKnowledge({ question, knowledge: amaKnowledge, limit: wantsDetail ? 14 : 8, maxCharacters: wantsDetail ? 16_000 : 8_000 });
  const confirmed = matches.filter((item) => item.document.kind === "confirmed").slice(0, wantsDetail ? 2 : 1);
  const categoryFilter = (() => {
    if (/(?:ai|人工智能|算法|技术|机器人)/i.test(question)) return new Set(["technology", "labor_and_society", "career_and_business"]);
    if (/(?:工作|职业|合作|团队|沟通|成长|选择)/.test(question)) return new Set(["career_and_business", "learning_and_writing"]);
    if (/(?:世界|价值|公平|正义|社会|人生|意义)/.test(question)) return new Set(["worldview_and_justice", "labor_and_society"]);
    return null;
  })();
  const discussionDocuments = [];
  const discussionIds = new Set();
  for (const item of matches) {
    if (item.document.kind !== "discussion" || (categoryFilter && !categoryFilter.has(item.document.category))) continue;
    if (discussionIds.has(item.document.id)) continue;
    discussionIds.add(item.document.id);
    discussionDocuments.push(item.document);
  }
  if (!confirmed.length && !discussionDocuments.length) return "";
  const parts = [];
  if (confirmed.length) {
    const confirmedLimit = wantsDetail ? 320 : 120;
    parts.push(confirmed.map((item) => cleanSentence(item.content).replace(/\s+/g, " ").slice(0, confirmedLimit)).join("；"));
  }
  if (discussionDocuments.length) {
    const selectedDiscussion = discussionDocuments.find((item) => /谨慎推演/.test(item.sourceName)) || discussionDocuments[0];
    const discussionLimit = wantsDetail ? 420 : 150;
    parts.push(`${cleanSentence(selectedDiscussion.content).replace(/\s+/g, " ").slice(0, discussionLimit)}${wantsDetail ? "" : "（这是结合过往讨论作出的推测。）"}`);
  }
  return `${parts.join("。") }。`;
}

export function localKnowledgeReply({ question, approved, amaKnowledge, portfolioData }) {
  const name = portfolioData.profile.name;
  const query = String(question ?? "").trim();
  if (isPromptInjectionAttempt(query)) return promptInjectionRefusal(name);
  if (isDraftRequest(query)) return amaOnlyResponse(name);

  const taskType = classifyCareerTask(query);
  const safeApproved = normalizeApprovedKnowledge(approved);
  const approvedFacts = safeApproved.facts.map((item) => ({ ...item, text: toThirdPerson(item.text, name) }));
  const facts = uniqueFacts([...publicFacts(portfolioData), ...approvedFacts]);
  const styleRules = localStyleRules(safeApproved.styleSamples);
  const commitmentRequested = isCommitmentDecisionRequest(query);

  if (taskType === "knowledge" && commitmentRequested) {
    return commitmentRefusal(name);
  }

  if (/(?:尚未|未补充|缺少|还没有|哪些信息)/.test(query)) {
    const missing = missingPublicInformation(portfolioData);
    return missing.length
      ? `${name}目前尚未公开${missing.join("、")}。这些内容需要由本人核实后再补充。`
      : `${name}当前主页中的公开资料已经较完整；如需更具体的信息，请向本人确认。`;
  }

  const selected = [];
  const addFacts = (predicate) => {
    facts.filter(predicate).forEach((item) => {
      if (!selected.some((known) => known.id === item.id)) selected.push(item);
    });
  };
  let hasFocusedIntent = false;
  const addIntentFacts = (matches, predicate) => {
    if (!matches) return;
    hasFocusedIntent = true;
    addFacts(predicate);
  };

  addIntentFacts(
    /(?:工作.{0,8}成长|成长.{0,8}工作|工作.{0,12}选择|职业认知)/.test(query),
    (item) => ["values", "learning", "decision_style", "growth", "strengths", "communication_style"].includes(item.category),
  );

  addIntentFacts(/(?:校园|新闻部|社团|学生会)/.test(query), (item) => item.category === "campus");
  addIntentFacts(/(?:人力资源|HR(?:BP)?|招聘|人事|行政|实习)/i.test(query), (item) => item.category === "experience");
  addIntentFacts(/(?:学校|大学|专业|教育|学习|课程)/.test(query), (item) => item.category === "education");
  addIntentFacts(/(?:价值观|看重|重视什么)/.test(query), (item) => item.category === "values");
  addIntentFacts(
    /(?:兴趣|爱好|关注)/.test(query) || (/(?:方向)/.test(query) && !/(?:职业|求职|HR)/i.test(query)),
    (item) => item.category === "interests",
  );
  addIntentFacts(/(?:所在|城市|地点|哪里|哪儿|深圳)/.test(query), (item) => item.category === "location");
  addIntentFacts(/(?:优势|长处|擅长|能力)/.test(query), (item) => item.category === "strengths");
  addIntentFacts(
    /(?:工作方式|工作风格|沟通方式|沟通偏好|协作方式|直接表达)/.test(query),
    (item) => ["communication_style", "work_style", "work_preferences"].includes(item.category),
  );
  addIntentFacts(/(?:工作环境|管理方式|工作节奏|自主节奏|加班|工作边界|偏好什么工作)/.test(query), (item) => item.category === "work_preferences");
  addIntentFacts(/(?:学习方式|学习偏好|怎么学习|如何学习)/.test(query), (item) => item.category === "learning");
  addIntentFacts(/(?:决策|做决定|如何决定|拍板)/.test(query), (item) => item.category === "decision_style");
  addIntentFacts(/(?:生活|日常|休闲|朋友|人际|关系)/.test(query), (item) => ["interests", "personal_style"].includes(item.category));
  addIntentFacts(/(?:性格|人格|MBTI)/i.test(query), (item) => ["personality", "personal_style"].includes(item.category));
  addIntentFacts(/(?:成长|改进|不足|短板|弱点|缺点|拖延|分心|耐心)/.test(query), (item) => item.category === "growth");
  if (!hasFocusedIntent && /(?:经历|背景|介绍|了解)/.test(query)) {
    ["overview", "education", "personality", "communication_style", "values", "strengths", "interests", "personal_style"]
      .forEach((category) => addFacts((item) => item.category === category));
  }

  const addPersonalOverview = () => addFacts((item) => ["overview", "strengths", "communication_style", "values", "personal_style", "interests", "personality", "learning", "decision_style", "education"].includes(item.category));
  const firstPersonFacts = () => selected.slice(0, 6).map((item) => toFirstPerson(item.text, name)).filter(Boolean);
  const draftHeader = `【草稿｜请${name}本人核对后使用】`;
  const guardDraft = (text) => enforceCareerAgentReply({ question: query, reply: text, name });

  if (taskType === "self_introduction") {
    const priorityCategories = ["overview", "strengths", "communication_style", "values", "personal_style", "interests", "personality", "education"];
    const prioritized = uniqueFacts([
      ...priorityCategories.flatMap((category) => facts.filter((item) => item.category === category)),
      ...selected,
    ]);
    if (!prioritized.length) addPersonalOverview();
    const lines = (prioritized.length ? prioritized : selected).slice(0, 6).map((item) => toFirstPerson(item.text, name)).filter(Boolean);
    if (!lines.length) return guardDraft(`${draftHeader}\n这部分尚未包含在${name}批准公开的资料中，请由本人补充后再使用。`);
    return guardDraft(`${draftHeader}\n您好，我是${name}。${lines.join("；")}。\n（AI 草稿，仅依据已批准公开资料，不补全未核实的能力或成果，也不代表本人作出确认或承诺。）`);
  }

  if (taskType === "email_reply") {
    const greeting = /(?:邮件|回信|来信)/.test(query) ? "您好，感谢您的来信。" : "谢谢你发来的内容。";
    return guardDraft(`${draftHeader}\n${greeting}\n[请在这里补充希望回应的重点；涉及事实时请先核验。]\n（AI 草稿，尚未发送。）`);
  }

  if (taskType === "general_draft") {
    return guardDraft(`${draftHeader}\n${genericDraftBody(query, styleRules)}\n（AI 草稿，尚未发送。）`);
  }

  if (taskType === "style_draft") {
    const hasPersonalIntroductionIntent = /(?:介绍|关于我|我是谁)/.test(query);
    const lines = hasPersonalIntroductionIntent ? firstPersonFacts() : [];
    const body = lines.length
      ? `${styleRules.direct ? "先说重点：" : "简单介绍一下自己："}${lines.slice(0, styleRules.concise ? 3 : 6).join("；")}。`
      : genericDraftBody(query, styleRules);
    return guardDraft(`${draftHeader}\n${body}\n（AI 草稿，尚未发送；请本人补充并核对后使用。）`);
  }

  if (/(?:怎么看|如何看待|如何理解|你的看法|你认为)/.test(query)) {
    const amaSummary = localAmaSummary(query, amaKnowledge, name);
    if (amaSummary) return amaSummary;
  }

  if (/(?:表达|风格|语气|性格)/.test(query) && safeApproved.styleSamples.length) {
    const styles = safeApproved.styleSamples
      .slice(0, 4)
      .map((item) => toThirdPerson(item.text, name))
      .filter(Boolean);
    if (styles.length) {
      const factsPrefix = selected.length
        ? `${selected.slice(0, 3).map((item) => cleanSentence(item.text)).join("；")}。`
        : "";
      return `${factsPrefix}${name}平时更喜欢这样表达：${styles.slice(0, 2).join("；")}。`;
    }
  }

  if (!selected.length) {
    const amaSummary = localAmaSummary(query, amaKnowledge, name);
    if (amaSummary) return amaSummary;
    return `这个${name}没有在主页上展开，我就不替他猜了。你可以换个角度，问问他的兴趣、性格或对具体事情的看法。`;
  }

  return `${selected.slice(0, 4).map((item) => cleanSentence(item.text)).join("；")}。`;
}
