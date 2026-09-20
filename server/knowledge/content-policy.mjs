const INSTRUCTION_SIGNAL_RULES = [
  [
    "试图覆盖既有规则",
    /(?:忽略|无视|跳过|绕过|覆盖|取代|撤销|废除|不要遵守|不必遵守).{0,32}(?:先前|之前|此前|以上|上文|系统|开发者|安全|规则|指令|提示词|限制)/iu,
  ],
  [
    "试图覆盖既有规则",
    /\b(?:ignore|disregard|override|bypass|forget)\b.{0,60}\b(?:previous|prior|above|system|developer|instructions?|prompts?|rules?|safety)\b/isu,
  ],
  [
    "伪装成高优先级消息",
    /(?:^|\n)\s*(?:system|developer|assistant|系统|开发者)\s*(?:message|prompt|指令|消息|提示词)?\s*[:：]/imu,
  ],
  [
    "试图重设 AI 角色",
    /(?:你现在是|从现在起你|接下来你|将自己视为|扮演.{0,12}(?:角色|身份)|\byou are now\b|\bfrom now on\b|\bact as\b)/iu,
  ],
  [
    "试图索取隐藏信息",
    /(?:输出|显示|打印|透露|泄露|复述|告诉我|返回).{0,36}(?:系统提示|提示词|system prompt|developer message|密钥|token|环境变量|内部指令)/iu,
  ],
  [
    "包含模型控制标记",
    /<\|(?:system|developer|assistant|tool|user)\|>|\[INST\]|BEGIN\s+(?:SYSTEM|DEVELOPER)\s+(?:MESSAGE|PROMPT)/iu,
  ],
  [
    "试图设置持续回答规则",
    /(?:后续|以后|从此|每次|所有).{0,16}(?:回答|回复).{0,24}(?:必须|都要|只能|不要|遵循|执行)/iu,
  ],
  [
    "试图设置回答行为",
    /(?:回答|回复)时.{0,20}(?:必须|务必|始终|只能|不要)|(?:必须|务必|始终).{0,24}(?:回答|回复|输出|遵守|执行)|\b(?:always|never|must)\b.{0,28}\b(?:answer|respond|reply|obey|follow|reveal|output)\b/isu,
  ],
];

const DEFAULT_PRIVATE_RULES = [
  [
    "证件、金融或内部编号",
    /(?:身份证(?:号|号码)?|护照(?:号|号码)?|驾驶证(?:号|号码)?|社保卡(?:号|号码)?|银行卡(?:号|号码)?|银行账户|信用卡(?:号|号码)?|学号|工号|员工编号)/iu,
  ],
  [
    "私密联系方式或精确位置",
    /(?:手机号|联系电话|私人邮箱|家庭住址|现住址|宿舍地址|详细地址|收货地址|微信号|QQ号)/iu,
  ],
  [
    "精确出生信息",
    /(?:出生日期|出生年月日|出生年月|生日)\s*[:：为是]?\s*(?:19|20)?\d{2}\s*[年./-]\s*\d{1,2}(?:\s*[月./-]\s*\d{1,2}\s*日?)?/iu,
  ],
  [
    "年龄或性别",
    /(?:(?:我|本人|他|她)\s*今年\s*\d{1,3}\s*岁|(?:年龄|性别|gender)\s*[:：为是]\s*[^，。；;\n]{1,16})/iu,
  ],
  [
    "健康或高度私密信息",
    /(?:病历|诊断证明|病史|心理诊断|精神疾病|性取向|性生活|性经历)/iu,
  ],
  [
    "身份鉴权信息",
    /(?:密码|验证码|API\s*密钥|access[_ -]?token|secret|private[_ -]?key)/iu,
  ],
  [
    "私人收入或信用信息",
    /(?:期望薪资|薪资要求|月薪|年薪|个人收入|家庭收入|征信|负债|存款余额)/iu,
  ],
  [
    "受保护的身份或家庭信息",
    /(?:(?:我的|本人(?:的)?)\s*(?:民族|种族|政治面貌|党派|宗教信仰|婚姻状况|生育情况|残疾状况)|(?:民族|种族|政治面貌|党派|宗教信仰|婚姻状况|生育情况|残疾状况)\s*[:：])/iu,
  ],
  [
    "第三方家庭信息",
    /(?:父亲|母亲|配偶|伴侣|子女|家庭成员).{0,24}(?:姓名|电话|工作单位|住址|身份证)/iu,
  ],
  [
    "精确行踪或法律记录",
    /(?:实时位置|精确定位|经纬度|详细行程|犯罪记录|刑事记录|处分记录|征信记录)/iu,
  ],
];

// These are owner-selected publication boundaries for this public portfolio.
// They are intentionally narrower than generic privacy detection and should not
// be reused as universal assumptions for another person's website.
const SITE_PUBLIC_EXCLUSION_RULES = [
  [
    "当前城市",
    /(?:当前城市|所在城市|现居城市|现居地|居住地|常住城市|常住地|目前所在地)\s*[:：为是]\s*[^，。；;\n]{1,40}|(?:我|本人|他|她)?\s*(?:目前|现在|当前)\s*(?:居住在|住在|住|生活在|常住于|定居于)\s*[^，。；;\n]{1,40}|(?:我|本人|他|她)\s*(?:现居|居住在|住在|住|生活在|常住于|定居于)\s*[^，。；;\n]{1,40}/iu,
  ],
  [
    "职业规划或求职方向",
    /(?:(?:我的|本人(?:的)?)\s*(?:职业规划|职业目标|职业方向|求职方向|求职目标|意向岗位|目标岗位|期望岗位|就业方向)|(?:职业规划|职业目标|职业方向|求职方向|求职目标|意向岗位|目标岗位|期望岗位|就业方向)\s*[:：为是]\s*[^，。；;\n]{1,80}|(?:我|本人|他|她)\s*(?:目前|当前|未来)?\s*(?:希望|想|计划|打算|准备|目标是).{0,24}(?:从事|成为|进入|应聘|求职|就业)|(?:毕业后|未来|下一步|长期|短期).{0,20}(?:计划|希望|想|打算|目标).{0,24}(?:从事|成为|进入|应聘|求职|就业)|(?:我|本人|他|她|毕业后|未来).{0,12}(?:希望|想|计划|打算|准备).{0,12}(?:做|干|从事|进入)\s*(?:人力资源|HRBP|招聘|人事|[^，。；;\n]{1,24}(?:岗位|工作|行业)))/iu,
  ],
  [
    "实习经历",
    /(?:实习经历|实习单位|实习岗位|实习职责|实习成果|实习时间|实习期间)\s*[:：为是]?|(?:我|本人|曾|此前).{0,32}(?:在|于|作为|担任|任职|参加|完成).{0,24}(?:实习|实习生)|(?:曾|此前|目前|现在)\s*(?:在|于).{0,32}实习|(?:担任|任职为|作为)\s*[^，。；;\n]{0,16}实习生|(?:^|[，。；;\n])\s*(?:(?:我|本人|他|她)\s*)?(?:曾经?\s*)?(?:有(?:过|一段)?|做过|参加过|完成过).{0,24}实习(?!生招聘)/iu,
  ],
  [
    "校园经历",
    /(?:校园经历|校园实践|校园任职|校园活动经历|学生工作经历|社团经历|学生组织经历)\s*[:：为是]?|(?:我|本人|曾|此前|在校期间).{0,32}(?:参加|参与|加入|担任|任职|负责|组织|创办).{0,24}(?:社团|学生会|新闻部|校园媒体|学生组织|校级组织|院级组织|班委|志愿者协会)|(?:我|本人|曾|此前|在校期间).{0,32}(?:社团|学生会|新闻部|校园媒体|学生组织|校级组织|院级组织|班委|志愿者协会).{0,24}(?:担任|任职|负责|部长|主席|干事|记者|成员|负责人)|(?:社团|学生会|新闻部|校园媒体|学生组织|校级组织|院级组织|班委|志愿者协会)(?:的)?(?:部长|主席|干事|记者|负责人)/iu,
  ],
];

function matchingLabels(value, rules) {
  const text = String(value ?? "").normalize("NFKC").replaceAll("\0", "");
  return [...new Set(rules.filter(([, pattern]) => pattern.test(text)).map(([label]) => label))];
}

export function findUntrustedInstructionSignals(value) {
  return matchingLabels(value, INSTRUCTION_SIGNAL_RULES);
}

export function findDefaultPrivateSignals(value) {
  return matchingLabels(value, DEFAULT_PRIVATE_RULES);
}

export function findSitePublicExclusionSignals(value) {
  return matchingLabels(value, SITE_PUBLIC_EXCLUSION_RULES);
}

export function inspectImportedKnowledgeText(value) {
  const instructionSignals = findUntrustedInstructionSignals(value);
  const privateSignals = findDefaultPrivateSignals(value);
  const siteExclusionSignals = findSitePublicExclusionSignals(value);
  return {
    instructionSignals,
    privateSignals,
    siteExclusionSignals,
    blocked: instructionSignals.length > 0 || privateSignals.length > 0 || siteExclusionSignals.length > 0,
  };
}
