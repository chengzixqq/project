(function initRulesData(global) {
  const requiredSkillsByProf = {
    "妙音": [
      { id: "MIAOYIN_REQUIRED_ZHUYUE", alts: ["逐月"], source: "妙音" },
      { id: "MIAOYIN_REQUIRED_ZHUYUE_CHENGFENG", alts: ["逐月·乘风", "逐月乘风", "逐月.乘风", "逐月 乘风"], source: "妙音" },
      { id: "MIAOYIN_REQUIRED_FEITIAN", alts: ["飞天"], source: "妙音" },
      { id: "MIAOYIN_REQUIRED_FEITIAN_LIANXIN", alts: ["飞天·莲心", "飞天莲心", "飞天.莲心", "飞天 莲心"], source: "妙音" }
    ]
  };

  const mutualExclusions = [
    { id: "LIANBUYINGHUA_MUTEX_BINGDI", a: "莲步盈华", b: "莲步盈华·并蒂", source: null },
    { id: "FUYANGTAIXU_MUTEX_LINGYUN", a: "俯仰太虚", b: "俯仰太虚·灵韵", source: "内功" },
    { id: "NABAIGUAN_MUTEX_LINGYUN", a: "纳百观", b: "纳百观·灵韵", source: "内功" }
  ];

  const prerequisites = [
    {
      id: "FEITIAN_LIANXIN_IN_WINDOW",
      type: "WINDOW_AFTER_SKILL",
      targetAlts: ["飞天·莲心"],
      anchorSkill: "飞天",
      windowSeconds: 20,
      extraCheck: "NONE"
    },
    {
      id: "FEITIAN_ZHUYUE_CHENGFENG_IN_WINDOW_BEFORE_LIANXIN",
      type: "WINDOW_AFTER_SKILL",
      targetAlts: ["逐月·乘风", "逐月乘风", "逐月.乘风", "逐月 乘风"],
      anchorSkill: "飞天",
      windowSeconds: 20,
      extraCheck: "LIANXIN_NOT_USED"
    },
    {
      id: "FUYANGTAIXU_ONLY_DURING_ZHUYUE_CD",
      type: "TARGET_SKILL_CD_WINDOW",
      targetAlts: ["俯仰太虚", "俯仰太虚·灵韵", "俯仰太虚灵韵", "俯仰太虚.灵韵", "俯仰太虚 灵韵"],
      requiredProf: "妙音",
      referenceSkill: "逐月"
    }
  ];

  const specialEffects = [
    {
      id: "WOOD3_PROC_WHEN_3_PROF_SKILLS_ON_CD",
      type: "WOOD3_PROC",
      requiredWoodChoice: 3,
      triggerExcludeSource: "内功",
      minProfSkillsOnCd: 3,
      reduceRatio: 0.4,
      maxReduceSeconds: 5,
      icdSeconds: 20
    }
  ];

  global.AppRulesData = {
    requiredSkillsByProf,
    mutualExclusions,
    prerequisites,
    specialEffects
  };
})(window);
