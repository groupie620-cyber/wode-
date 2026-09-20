# 陈德基的个人主页

一个中文个人主页，用来展示已经确认的性格、价值观、生活兴趣与教育背景，并提供一个明确标注身份的 AMA 对话助手。网站使用 React、Vite、Tailwind CSS、Lucide 和 Express。

最重要的隐私原则：DeepSeek 原始对话不会自动公开。导入后只从“用户”发言生成脱敏候选，必须由本人逐条批准，公开 AI 才能读取。

## 直接预览

需要 Node.js 20.19 或更高版本，以及 pnpm。

```bash
pnpm install
pnpm run dev
```

然后打开：

- 个人主页：[http://localhost:4175](http://localhost:4175)
- 本地知识审核：[http://localhost:4175/admin/knowledge](http://localhost:4175/admin/knowledge)

按 `Control + C` 停止网站。端口被占用时，可在 `.env.local` 中加入 `PORT=4176` 并重启。

## 用 DeepSeek 对话更新 AI 知识

1. 从 DeepSeek 导出对话，或把对话复制成 JSON、JSONL、Markdown、TXT 文件。
2. 打开本地知识审核页，选择文件并点击“读取并生成候选”。
3. 系统会忽略 DeepSeek/Assistant 的回答，只从 User/用户/我 的发言中寻找候选事实和表达样本。
4. 检查自动隐藏后的手机号、邮箱、地址、密钥和第三方信息。
5. 修改文字，勾选“确认可公开”，再点击“批准公开”。
6. 本机预览的下一次 AI 回答会读取新内容。已经上线的网站不会自动同步本机修改；请重新运行检查并重新部署。

纯文本没有角色标记时，系统默认不采纳；只有你勾选“全文都是我本人写的”才会处理。自动脱敏无法保证识别所有第三方信息，人工复核不可省略。

传统 `.wps` 文件不直接上传到网站：应先在本机禁用宏并另存为纯文本，再按上面的流程审核。本次提供的 WPS 只在本机转换；原文没有复制进项目，文档中的建议或命令也不会被当作 AI 指令。

除了逐条事实，审核页还提供“AMA 长篇认知库”。这里适合粘贴完整的世界观、职业认知、判断过程和案例，也可以先从 `.md`、`.txt`、`.json` 文件载入编辑框。系统会把长文分段过滤，并在每次提问时只检索最相关的片段；“本人确认”“历史讨论线索”“历史参考”三类资料会以不同可信度参与回答。

数据分别存放在：

```text
server/knowledge/approved.json       从对话中额外批准、可以部署和公开的短事实
server/knowledge/ama.json            AMA 长篇认知、讨论线索与历史参考资料
private-data/review/candidates.json  本机待审核候选（Git 忽略）
private-data/deepseek-inbox/         可选保留的原始文件（Git 忽略）
```

管理页只在开发模式、且请求来自本机时开放；生产模式不会挂载这些管理接口。原始聊天不会进入前端构建产物，也不会被发送给回答问题的 AI 服务。

部署时请从干净的 Git 工作副本构建，不要把整个项目文件夹直接拖入托管平台或压缩上传。项目同时提供 `.gitignore` 与 `.dockerignore` 来排除 `private-data/`、`.env*` 和依赖目录，但发布前仍应检查实际上传清单。

## 启用 AI 介绍助手

导入 DeepSeek 历史和选择回答模型是两件独立的事。导入不需要密钥；未配置密钥时，网站会使用不联网的本地资料模式回答基础问题。要获得更自然的生成式回答与连续提问能力，需要你自己选择一个 OpenAI-compatible 服务并创建密钥。

复制 `.env.example` 为 `.env.local`，然后选一种配置。任何已经发到聊天、截图或公开页面中的密钥都应先在供应商后台撤销，不要继续使用：

SiliconFlow：

```text
AI_PROVIDER=siliconflow
AI_API_KEY=你的完整密钥
AI_MODEL=Qwen/Qwen2.5-7B-Instruct
```

DeepSeek：

```text
AI_PROVIDER=deepseek
AI_API_KEY=你的完整密钥
AI_MODEL=deepseek-chat
```

保存后重启 `pnpm run dev`。密钥只能放在 `.env.local` 或部署平台的私密环境变量中，不要粘贴到聊天、截图、`src/data.js`、Git 或网页代码里。建议为网站单独创建密钥并设置费用上限。

访客发送的问题会传给你配置的模型供应商，但本站不持久化访客聊天。AI 只进行 AMA 对话与信息问答，不提供代写，也不能代表本人发送消息、作出决定或承诺任何安排。

## 补充公开主页

公开文字集中在 `src/data.js`。目前只写入已经确认、且适合这个个人主页的信息：

- 陈德基
- 中南财经政法大学劳动关系专业
- 自我描述为 ESFP（不作为专业测评结论）
- 健康、自由、关系与归属感
- 游戏、视频、散步、运动、独处与朋友连接
- 直接、简洁、先说重点的表达偏好

城市、职业规划、实习经历和校园经历已按本人要求从主页及公开 AI 知识中移除。照片、邮箱、精确日期与项目成果尚未填写；对应区块会在没有真实内容时隐藏。

添加照片时，把图片放进 `public/photos/`，再在 `profile.photos` 中加入路径。填写公开邮箱后，联系区会自动出现。

## 检查与构建

```bash
pnpm run check
```

该命令会依次校验公开知识库、运行导入与脱敏测试、构建正式前端。也可以分别运行：

```bash
pnpm run knowledge:validate
pnpm test
pnpm run build
pnpm start
```

`pnpm start` 会运行 `dist` 和 AI 服务端，部署时应选择支持 Node.js 的平台。只把 `dist` 上传到 Netlify 静态托管无法运行当前 AI 接口；若要正式上线，需要另配 Node 服务或改写成平台函数。

如果 Node 服务位于反向代理之后，请在确认代理的确切地址、且代理会覆盖访客传入的 `X-Forwarded-For` 后，通过 `TRUSTED_PROXY_NETWORKS` 填写代理 IP 或 CIDR。留空时服务只按直接连接地址限流；不要为了省事信任所有代理来源。

## 发布前检查

- 所有经历、日期、数字、作品和评价都可核验。
- 照片没有他人、住址、车牌、证件或公司机密。
- `server/knowledge/approved.json` 中的每一条都确定可以公开。
- `private-data/`、`.env.local` 和 API 密钥没有被提交或上传。
- 已设置调用额度、限流和正式域名；手机、电脑都测试过。

任何账号创建、付费服务、API 密钥申请、聊天上传或正式部署，都应由本人确认后再执行。
