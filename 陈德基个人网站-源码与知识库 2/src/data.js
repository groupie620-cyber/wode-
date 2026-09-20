/**
 * 网站公开内容的唯一编辑入口。
 * 这里只放本人确认过、可以公开给访客的信息。不要放聊天原文、密钥或隐私资料。
 */
export const portfolioData = {
  site: {
    title: "陈德基｜个人主页",
    description: "陈德基的个人主页：性格、价值观、生活兴趣与 AI 介绍助手。",
    edition: "PORTFOLIO · 2026",
    status: "记录生活、兴趣与思考",
    navigation: [
      { label: "关于我与生活", href: "#about" },
      { label: "教育背景", href: "#journey" },
      { label: "与我对话 · AMA", href: "#ama" },
    ],
    footerNote: "只展示本人确认过的公开信息。",
  },

  profile: {
    name: "陈德基",
    initials: "陈",
    role: "中南财经政法大学 · 劳动关系专业",
    statement: "直接表达，认真生活，保持真实。",
    intro:
      "我喜欢直接说重点，也重视健康、自由和少而深的关系。平时会通过游戏、视频、散步和运动切换节奏，也想把生活里的想法慢慢记录下来。",
    location: "",
    email: "",
    photos: [],
  },

  highlights: [
    { value: "健康", label: "生活基础" },
    { value: "自由", label: "重视选择" },
    { value: "关系", label: "珍惜归属" },
  ],

  about: {
    eyebrow: "ABOUT ME · 关于我",
    title: "直接、真诚，也重视人与人之间的连接。",
    story:
      "我喜欢直接说重点，也愿意理解他人的感受；做决定时会比较不同选项、听取意见，再由自己拍板。我重视健康、自由，以及少而深的关系，也希望按照适合自己的节奏生活和成长。",
    style: {
      label: "SELF PORTRAIT · 自我描述",
      mbti: "ESFP",
      title: "直接表达，也愿意理解人",
      description: "这是我目前对自己的性格描述，并非专业测评结论。我偏好就事论事、不绕弯，也重视共情与真实的连接。",
    },
    values: [
      { number: "01", title: "健康", description: "把长期生活的基础照顾好。" },
      { number: "02", title: "自由", description: "希望对节奏与选择保有主动权。" },
      { number: "03", title: "关系与归属", description: "重视少而深、彼此支持的连接。" },
    ],
  },

  hobbies: {
    eyebrow: "EVERYDAY LIFE · 日常生活",
    title: "生活与兴趣",
    groups: [
      {
        title: "日常放松",
        icon: "music",
        accent: "clay",
        items: ["打游戏", "刷视频", "喝饮料"],
        note: "用轻松的小事给大脑换个频道。",
      },
      {
        title: "走一走，动一动",
        icon: "activity",
        accent: "sage",
        items: ["散步", "固定运动"],
        note: "散步和运动是我恢复精力、整理思路的方式。",
      },
      {
        title: "独处与连接",
        icon: "mic",
        accent: "sand",
        items: ["独处", "主动联系朋友", "定期见面"],
        note: "我享受独处，也珍惜少而深的朋友关系。",
      },
    ],
  },

  projects: {
    eyebrow: "SELECTED WORK · 项目与作品",
    title: "项目与作品",
    note: "",
    items: [],
  },

  journey: {
    eyebrow: "EDUCATION · 教育背景",
    title: "目前公开的教育背景。",
    items: [
      {
        period: "在读",
        type: "教育经历",
        title: "中南财经政法大学 · 劳动关系专业",
        description: "劳动关系专业学习经历。",
      },
    ],
  },

  contact: {
    eyebrow: "LET’S CONNECT · 保持联系",
    title: "如果你也重视真实、自由与人与人之间的连接，欢迎认识我。",
    note: "公开联系方式尚未由本人确认。现阶段请通过你收到本页面的原渠道联系我。",
    socialLinks: [],
  },

  ai: {
    model: "Qwen/Qwen2.5-7B-Instruct",
    eyebrow: "ASK ME ANYTHING · 与我对话",
    title: "问我任何事。",
    description:
      "这是一个以我的公开资料、长期讨论和表达偏好为知识基础的 AMA。它会寻找相近观点，用自然对话帮助你了解我。",
    disclaimer:
      "这是陈德基的 AI 分身实验，不是陈德基本人。它会区分本人确认、历史讨论和 AI 参考资料；启用 DeepSeek 后，访客问题会发送给 DeepSeek，请勿输入隐私。回答不能代替本人作出承诺。",
    welcome:
      "你好，我是陈德基的 AMA AI。你可以和我聊他的生活、兴趣、性格、价值观，以及他对一些问题的看法。",
    inputPlaceholder: "例如：你如何看待工作、成长与选择？",
    quickQuestions: [
      "你如何看待工作、成长与选择？",
      "你如何理解好的合作与沟通？",
      "你怎么看 AI 与人的关系？",
      "你觉得自己是一个怎样的人？",
    ],
  },
};
