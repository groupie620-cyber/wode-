let adminToken = "";
let currentState = { candidates: [], approved: { facts: [], styleSamples: [] }, ama: { documents: [] }, aiConfig: { configured: false } };
let noticeTimer;

const byId = (id) => document.getElementById(id);

function notify(message) {
  const notice = byId("notice");
  notice.textContent = message;
  notice.classList.add("show");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.classList.remove("show"), 3800);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "操作失败，请稍后重试。");
  return payload;
}

function setState(payload) {
  if (payload.adminToken) adminToken = payload.adminToken;
  if (payload.candidates) currentState.candidates = payload.candidates;
  if (payload.approved) currentState.approved = payload.approved;
  if (payload.ama) currentState.ama = payload.ama;
  if (payload.aiConfig) currentState.aiConfig = payload.aiConfig;
  render();
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function reviewCandidate(candidate, action, textarea, checkbox, buttons) {
  if (action === "approve" && !checkbox.checked) {
    notify("请先确认这条内容可以公开。");
    checkbox.focus();
    return;
  }
  buttons.forEach((button) => { button.disabled = true; });
  try {
    const payload = await requestJson("/admin/knowledge/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Admin-Token": adminToken },
      body: JSON.stringify({
        items: [{ id: candidate.id, action, content: textarea.value, confirmPublic: checkbox.checked }],
      }),
    });
    setState(payload);
    notify(action === "approve" ? "已批准并更新公开 AI 知识。" : "已拒绝，这条内容不会公开。");
  } catch (error) {
    notify(error.message);
    buttons.forEach((button) => { button.disabled = false; });
  }
}

function candidateCard(candidate) {
  const article = make("article", "candidate");
  const meta = make("div", "candidate-meta");
  meta.append(
    make("span", "tag", candidate.type === "style" ? "表达样本" : "个人事实"),
    make("span", "", candidate.category),
    make("span", "", `来源：${candidate.sourceName}`),
  );
  article.append(meta);

  const textarea = make("textarea");
  textarea.value = candidate.content;
  textarea.maxLength = 800;
  textarea.setAttribute("aria-label", "可编辑的候选内容");
  article.append(textarea);

  const evidence = make("p", "evidence", `脱敏后的来源片段：${candidate.evidence}`);
  article.append(evidence);
  if (candidate.warnings?.length) {
    article.append(make("p", "warnings", candidate.warnings.join("；")));
  }

  const actions = make("div", "candidate-actions");
  const confirmLabel = make("label", "check-row");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  confirmLabel.append(checkbox, make("span", "", "我已逐字检查，并确认可公开给网站访客"));

  const buttonGroup = make("div");
  const reject = make("button", "reject", "拒绝");
  reject.type = "button";
  const approve = make("button", "approve", "批准公开");
  approve.type = "button";
  buttonGroup.append(reject, approve);
  actions.append(confirmLabel, buttonGroup);
  article.append(actions);

  const buttons = [reject, approve];
  reject.addEventListener("click", () => reviewCandidate(candidate, "reject", textarea, checkbox, buttons));
  approve.addEventListener("click", () => reviewCandidate(candidate, "approve", textarea, checkbox, buttons));
  return article;
}

function publishedItem(item, type) {
  const row = make("article", "published-item");
  const copy = make("div");
  copy.append(make("small", "", type === "style" ? "表达样本" : `公开事实 · ${item.category || "personal"}`));
  copy.append(make("p", "", item.text));
  const remove = make("button", "remove", "移除公开");
  remove.type = "button";
  remove.addEventListener("click", async () => {
    if (!window.confirm("确定把这条内容从公开 AI 知识中移除吗？")) return;
    remove.disabled = true;
    try {
      const payload = await requestJson("/admin/knowledge/api/remove-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Local-Admin-Token": adminToken },
        body: JSON.stringify({ id: item.id, confirm: true }),
      });
      setState(payload);
      notify("已从公开 AI 知识中移除。");
    } catch (error) {
      notify(error.message);
      remove.disabled = false;
    }
  });
  row.append(copy, remove);
  return row;
}

function amaItem(item) {
  const article = make("article", "ama-item");
  const copy = make("div", "ama-copy");
  const meta = make("div", "candidate-meta");
  const kindLabel = item.kind === "confirmed" ? "本人确认" : item.kind === "discussion" ? "讨论线索" : "历史参考";
  meta.append(make("span", "tag", kindLabel), make("span", "", item.category), make("span", "", (item.tags || []).join(" · ")));
  copy.append(make("h3", "", item.title), meta, make("p", "ama-excerpt", `${item.content.slice(0, 520)}${item.content.length > 520 ? "…" : ""}`));

  const actions = make("div", "item-actions");
  const toggle = make("button", item.enabled ? "reject" : "approve", item.enabled ? "暂停用于回答" : "启用用于回答");
  toggle.type = "button";
  toggle.addEventListener("click", async () => {
    toggle.disabled = true;
    try {
      const payload = await requestJson("/admin/knowledge/api/ama/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Local-Admin-Token": adminToken },
        body: JSON.stringify({ id: item.id, enabled: !item.enabled }),
      });
      setState(payload);
      notify(item.enabled ? "这篇知识已暂停使用。" : "这篇知识已重新启用。");
    } catch (error) {
      notify(error.message);
      toggle.disabled = false;
    }
  });
  const remove = make("button", "remove", "删除");
  remove.type = "button";
  remove.addEventListener("click", async () => {
    if (!window.confirm("确定删除这篇 AMA 知识吗？删除后无法从网站恢复。")) return;
    remove.disabled = true;
    try {
      const payload = await requestJson("/admin/knowledge/api/ama/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Local-Admin-Token": adminToken },
        body: JSON.stringify({ id: item.id, confirm: true }),
      });
      setState(payload);
      notify("已删除这篇 AMA 知识。");
    } catch (error) {
      notify(error.message);
      remove.disabled = false;
    }
  });
  actions.append(toggle, remove);
  article.append(copy, actions);
  if (!item.enabled) article.classList.add("is-disabled");
  return article;
}

function renderAma() {
  const query = byId("ama-search")?.value.trim().toLowerCase() || "";
  const documents = currentState.ama?.documents || [];
  const filtered = documents.filter((item) => !query || `${item.title} ${item.category} ${(item.tags || []).join(" ")}`.toLowerCase().includes(query));
  const list = byId("ama-list");
  list.replaceChildren(...filtered.map(amaItem));
  byId("ama-empty").hidden = filtered.length > 0;
  byId("ama-count").textContent = `${documents.filter((item) => item.enabled).length} 篇启用 / ${documents.length} 篇总计`;
}

function render() {
  const aiStatus = byId("ai-config-status");
  if (aiStatus) aiStatus.textContent = currentState.aiConfig?.configured ? "已连接 DeepSeek · deepseek-chat" : "尚未连接";
  const pending = currentState.candidates.filter((candidate) => candidate.status === "pending");
  const list = byId("candidate-list");
  list.replaceChildren(...pending.map(candidateCard));
  byId("candidate-empty").hidden = pending.length > 0;
  byId("pending-count").textContent = `${pending.length} 条待审核`;

  const facts = currentState.approved?.facts || [];
  const styles = currentState.approved?.styleSamples || [];
  const approvedList = byId("approved-list");
  approvedList.replaceChildren(
    ...facts.map((item) => publishedItem(item, "fact")),
    ...styles.map((item) => publishedItem(item, "style")),
  );
  if (!facts.length && !styles.length) approvedList.append(make("p", "empty", "目前没有公开知识。"));
  byId("approved-count").textContent = `${facts.length + styles.length} 条`;
  renderAma();
}

byId("ai-config-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = byId("deepseek-api-key");
  const submit = event.submitter;
  submit.disabled = true;
  submit.textContent = "正在安全保存…";
  try {
    const payload = await requestJson("/admin/knowledge/api/ai-config", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Admin-Token": adminToken },
      body: JSON.stringify({ apiKey: input.value }),
    });
    input.value = "";
    setState(payload);
    notify("DeepSeek 已启用，可以返回主页测试 AMA。 ");
  } catch (error) {
    notify(error.message);
  } finally {
    input.value = "";
    submit.disabled = false;
    submit.textContent = "保存并启用语言模型";
  }
});

byId("import-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = byId("conversation-file").files[0];
  if (!file) return;
  const submit = event.submitter;
  submit.disabled = true;
  submit.textContent = "正在本机处理…";
  try {
    const response = await requestJson("/admin/knowledge/api/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Local-Admin-Token": adminToken,
        "X-File-Name": encodeURIComponent(file.name),
        "X-Plain-Text-Is-User": String(byId("plain-user").checked),
        "X-Keep-Private-Copy": String(byId("keep-original").checked),
      },
      body: await file.arrayBuffer(),
    });
    const summary = response.summary;
    const box = byId("import-summary");
    const warnings = summary.warnings?.length ? ` 提示：${summary.warnings.join("；")}` : "";
    box.textContent = `识别 ${summary.messageCount} 条消息，其中本人发言 ${summary.userMessageCount} 条；忽略 AI 回答 ${summary.ignoredAssistantCount} 条；新增 ${summary.candidateCount} 条候选。${warnings}`;
    box.hidden = false;
    notify("导入完成，请逐条审核候选。");
    setState(await requestJson("/admin/knowledge/api/state"));
  } catch (error) {
    notify(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = "读取并生成候选";
  }
});

byId("ama-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 200_000) {
    notify("单篇文件请控制在 200 KB 内；较长资料建议拆成多个主题。 ");
    event.target.value = "";
    return;
  }
  const text = await file.text();
  byId("ama-content").value = text.slice(0, 60000);
  if (!byId("ama-document-title").value) byId("ama-document-title").value = file.name.replace(/\.[^.]+$/, "");
  if (text.length > 60000) notify("文件较长，已载入前 60000 个字符；建议按主题拆分。 ");
});

byId("ama-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!byId("ama-confirm").checked) {
    notify("请先确认过滤后的内容可以用于公开 AMA。 ");
    byId("ama-confirm").focus();
    return;
  }
  const submit = event.submitter;
  submit.disabled = true;
  submit.textContent = "正在保存…";
  try {
    const payload = await requestJson("/admin/knowledge/api/ama", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Local-Admin-Token": adminToken },
      body: JSON.stringify({
        title: byId("ama-document-title").value,
        kind: byId("ama-kind").value,
        category: byId("ama-category").value,
        tags: byId("ama-tags").value,
        content: byId("ama-content").value,
        confirmPublic: true,
      }),
    });
    setState(payload);
    const removed = payload.summary?.removedSegments || 0;
    const redactions = payload.summary?.redactions || [];
    const note = removed || redactions.length ? ` 已过滤 ${removed} 个片段；自动隐藏：${redactions.join("、") || "无"}。` : "";
    notify(`已保存到 AMA 认知库。${note}`);
    event.currentTarget.reset();
  } catch (error) {
    notify(error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = "保存到 AMA 认知库";
  }
});

byId("ama-search").addEventListener("input", renderAma);

requestJson("/admin/knowledge/api/state")
  .then(setState)
  .catch((error) => notify(error.message));
