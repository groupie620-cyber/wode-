const THIRD_PARTY_WORDS = /(?:他|她|他们|她们|同学|朋友|同事|老师|导师|经理|主管|老板|室友|客户|候选人)/;
const RELATION_WORDS = "同学|朋友|同事|老师|导师|经理|主管|老板|室友|客户";
const COMMON_SURNAME = "赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计伏成戴宋茅庞熊纪舒屈项祝董梁杜阮蓝闵席季麻强贾路娄危江童颜郭梅盛林钟徐邱骆高夏蔡田樊胡凌霍虞万支柯管卢莫房裘缪干解应宗丁宣邓郁单杭洪包诸左石崔吉龚程嵇邢裴陆荣翁荀羊甄曲封芮储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲邰鄂索咸籍赖卓蔺屠蒙池乔阴胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍郤璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习宦艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧殳沃利蔚越隆师巩厍聂晁勾敖融冷訾辛阚那简饶空曾沙乜养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公";
const COMPOUND_SURNAME = "欧阳|太史|端木|上官|司马|东方|独孤|南宫|万俟|闻人|夏侯|诸葛|尉迟|公羊|赫连|澹台|皇甫|宗政|濮阳|公冶|太叔|申屠|公孙|慕容|仲孙|钟离|长孙|宇文|司徒|鲜于|司空|闾丘|子车|亓官|司寇|巫马|公西|颛孙|壤驷|公良|漆雕|乐正|宰父|谷梁|拓跋|夹谷|轩辕|令狐|段干|百里|呼延|东郭|南门|羊舌|微生";
const FULL_CHINESE_NAME = `(?:(?:${COMPOUND_SURNAME})[\\u3400-\\u9fff]{1,2}|[${COMMON_SURNAME}][\\u3400-\\u9fff]{1,2})`;
const TITLED_CHINESE_NAME = `(?:(?:${COMPOUND_SURNAME})[\\u3400-\\u9fff]{0,2}|[${COMMON_SURNAME}][\\u3400-\\u9fff]{0,2})`;
const RELATION_NAME_PATTERN = new RegExp(
  `(${RELATION_WORDS})(?:(?:叫|名叫|名为|是)|\\s*[:：]\\s*)?(${FULL_CHINESE_NAME})(?=[，,。；;、\\s]|$|在|曾|正|与|和|负责|参与|担任|表示|说)`,
  "g",
);
const TITLED_NAME_PATTERN = new RegExp(
  `(${TITLED_CHINESE_NAME})(老师|同学|经理|主管|主任)(?=[，,。；;、\\s]|$|在|曾|正|与|和|一同|一起|负责|参与|担任|指导|表示|说)`,
  "g",
);

function applyRule(state, name, pattern, replacement) {
  const next = state.text.replace(pattern, (...args) => {
    state.redactions.add(name);
    return typeof replacement === "function" ? replacement(...args) : replacement;
  });
  state.text = next;
}

export function redactSensitiveText(input) {
  const state = {
    text: String(input ?? "").normalize("NFKC").replaceAll("\0", ""),
    redactions: new Set(),
  };

  applyRule(state, "API 密钥", /\b(?:sk|ak)-[A-Za-z0-9_-]{10,}\b/gi, "[API 密钥已隐藏]");
  applyRule(
    state,
    "密钥或密码",
    /\b(api[_ -]?key|access[_ -]?token|secret|password|passwd|token)\b\s*[:=：]\s*[^\s,，;；]{6,}/gi,
    (_match, label) => `${label}=[已隐藏]`,
  );
  applyRule(state, "Bearer 凭证", /\bBearer\s+[A-Za-z0-9._~+\/-]{10,}=*/gi, "Bearer [已隐藏]");
  applyRule(state, "JWT", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[JWT 已隐藏]");
  applyRule(state, "身份证号", /(?<!\d)\d{17}[\dXx](?!\d)/g, "[身份证号已隐藏]");
  applyRule(state, "手机号", /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g, "[手机号已隐藏]");
  applyRule(state, "银行卡号", /(?<!\d)(?:\d[ -]?){16,19}(?!\d)/g, "[银行卡号已隐藏]");
  applyRule(state, "邮箱", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[邮箱已隐藏]");
  applyRule(state, "账号", /(?:微信|微信号|QQ|账号|用户名)\s*[:：]\s*[A-Za-z0-9_.-]{4,}/gi, "账号：[已隐藏]");
  applyRule(
    state,
    "精确地址",
    /(?:家庭住址|现住址|住址|宿舍|详细地址|收货地址|公司地址|地址)\s*[:：]?\s*[^\n，。；;]{4,100}/g,
    (match) => `${match.split(/[:：]/)[0]}：[精确地址已隐藏]`,
  );
  applyRule(
    state,
    "第三方姓名",
    RELATION_NAME_PATTERN,
    (_match, relation) => `${relation}[第三方姓名已隐藏]`,
  );
  applyRule(
    state,
    "第三方姓名",
    TITLED_NAME_PATTERN,
    (_match, _name, title) => `[第三方姓名已隐藏]${title}`,
  );

  state.text = state.text
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const warnings = [];
  if (THIRD_PARTY_WORDS.test(state.text)) {
    warnings.push("可能仍含第三方信息，请逐字检查");
  }
  if (state.redactions.size) {
    warnings.push(`已自动隐藏：${[...state.redactions].join("、")}`);
  }

  return { text: state.text, redactions: [...state.redactions], warnings };
}
