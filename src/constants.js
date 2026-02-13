export const SCHED_MODE = Object.freeze({
  STRICT: "strict",
  DYNAMIC: "dynamic"
});

export const SKILL_SOURCE = Object.freeze({
  PROFESSION: "妙音",
  NEIGONG: "内功",
  BAIJIA: "百家",
  JUEJI: "绝技"
});

export const SKILL_NAME = Object.freeze({
  ZHUYUE: "逐月",
  ZHUYUE_CHENGFENG: "逐月·乘风",
  FEITIAN: "飞天",
  FEITIAN_LIANXIN: "飞天·莲心",
  FUYANG_TAIXU: "俯仰太虚",
  FUYANG_TAIXU_LINGYUN: "俯仰太虚·灵韵",
  LIANBU_YINGHUA: "莲步盈华",
  LIANBU_YINGHUA_BINGDI: "莲步盈华·并蒂",
  NABAIGUAN: "纳百观",
  NABAIGUAN_LINGYUN: "纳百观·灵韵"
});

export const SKILL_NAME_ALIASES = Object.freeze({
  [SKILL_NAME.ZHUYUE]: ["逐月"],
  [SKILL_NAME.ZHUYUE_CHENGFENG]: ["逐月·乘风", "逐月乘风", "逐月.乘风", "逐月 乘风"],
  [SKILL_NAME.FEITIAN]: ["飞天"],
  [SKILL_NAME.FEITIAN_LIANXIN]: ["飞天·莲心", "飞天莲心", "飞天.莲心", "飞天 莲心"],
  [SKILL_NAME.FUYANG_TAIXU]: ["俯仰太虚"],
  [SKILL_NAME.FUYANG_TAIXU_LINGYUN]: ["俯仰太虚·灵韵", "俯仰太虚灵韵", "俯仰太虚.灵韵", "俯仰太虚 灵韵"]
});

export const REQUIRED_SKILLS_MIAOYIN = Object.freeze([
  SKILL_NAME.ZHUYUE,
  SKILL_NAME.ZHUYUE_CHENGFENG,
  SKILL_NAME.FEITIAN,
  SKILL_NAME.FEITIAN_LIANXIN
]);

export const EXCLUSIVE_RULES = Object.freeze([
  { a: SKILL_NAME.LIANBU_YINGHUA, b: SKILL_NAME.LIANBU_YINGHUA_BINGDI, source: null },
  { a: SKILL_NAME.FUYANG_TAIXU, b: SKILL_NAME.FUYANG_TAIXU_LINGYUN, source: SKILL_SOURCE.NEIGONG },
  { a: SKILL_NAME.NABAIGUAN, b: SKILL_NAME.NABAIGUAN_LINGYUN, source: SKILL_SOURCE.NEIGONG }
]);
