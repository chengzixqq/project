(function initRuleEngine(global) {
  const data = global.AppRulesData || {};

  function matchesAlt(name, alts) {
    return (alts || []).includes(name);
  }

  function getKeysByName(state, name, source) {
    const out = [];
    for (const s of state.skillIndex.values()) {
      if (s.name !== name) continue;
      if (source !== null && source !== undefined && s.source !== source) continue;
      out.push(s.key);
    }
    return out;
  }

  function getRuleKeys(state, ruleName, source) {
    return getKeysByName(state, ruleName, source);
  }

  function applyRequiredSkills(state) {
    const rules = (data.requiredSkillsByProf && data.requiredSkillsByProf[state.prof]) || [];
    const appliedRuleIds = [];
    for (const rule of rules) {
      for (const nm of rule.alts) {
        const keys = getKeysByName(state, nm, rule.source);
        if (keys.length) {
          keys.forEach(k => state.selectedKeys.add(k));
          appliedRuleIds.push(rule.id);
          break;
        }
      }
    }
    return { appliedRuleIds };
  }

  function isRequiredSkill(state, skill) {
    const rules = (data.requiredSkillsByProf && data.requiredSkillsByProf[state.prof]) || [];
    return rules.some(rule =>
      (rule.source ? skill.source === rule.source : true) && matchesAlt(skill.name, rule.alts)
    );
  }

  function applyMutualExclusions(state, changedSkill) {
    const appliedRuleIds = [];
    for (const rule of data.mutualExclusions || []) {
      const aKeys = getRuleKeys(state, rule.a, rule.source);
      const bKeys = getRuleKeys(state, rule.b, rule.source);
      const aSelected = aKeys.some(k => state.selectedKeys.has(k));
      const bSelected = bKeys.some(k => state.selectedKeys.has(k));
      if (!(aSelected && bSelected)) continue;

      const keepA = changedSkill
        ? changedSkill.name === rule.a
        : true;
      if (keepA) bKeys.forEach(k => state.selectedKeys.delete(k));
      else aKeys.forEach(k => state.selectedKeys.delete(k));
      appliedRuleIds.push(rule.id);
    }
    return { appliedRuleIds };
  }

  function createRuntimeContext(overrides) {
    return Object.assign({
      prof: "",
      time: 0,
      combo: { lastFeitian: null, feitianWindowEnd: null, lianxinUsed: false },
      nextReady: {},
      referenceKeys: {}
    }, overrides || {});
  }

  function checkPrerequisite(skill, context) {
    const ctx = createRuntimeContext(context);

    for (const rule of data.prerequisites || []) {
      if (!matchesAlt(skill.name, rule.targetAlts)) continue;

      if (rule.type === "WINDOW_AFTER_SKILL") {
        if (ctx.combo.lastFeitian === null || ctx.combo.feitianWindowEnd === null) {
          return { ok: false, ruleId: rule.id };
        }
        if (rule.extraCheck === "LIANXIN_NOT_USED" && ctx.combo.lianxinUsed) {
          return { ok: false, ruleId: rule.id };
        }
        if (ctx.time > ctx.combo.feitianWindowEnd + 1e-9) {
          return { ok: false, ruleId: rule.id };
        }
      }

      if (rule.type === "TARGET_SKILL_CD_WINDOW") {
        if (rule.requiredProf && ctx.prof !== rule.requiredProf) return { ok: true, ruleId: null };
        const refKey = ctx.referenceKeys[rule.referenceSkill];
        if (!refKey) return { ok: false, ruleId: rule.id };
        const refReady = ctx.nextReady[refKey];
        if (refReady === undefined) return { ok: false, ruleId: rule.id };
        if (!(refReady > ctx.time + 1e-12)) return { ok: false, ruleId: rule.id };
      }
    }

    return { ok: true, ruleId: null };
  }

  function applySpecialEffects(castEvent, context) {
    const ctx = context;
    const appliedRuleIds = [];

    for (const rule of data.specialEffects || []) {
      if (rule.type !== "WOOD3_PROC") continue;
      if (ctx.woodChoice !== rule.requiredWoodChoice) continue;
      if (castEvent.source === rule.triggerExcludeSource) continue;
      if (ctx.time + 1e-12 < (ctx.wood3NextReady || 0)) continue;

      let onCdCount = 0;
      for (const key of ctx.profKeys || []) {
        const ready = ctx.nextReady[key];
        if (ready !== undefined && ready > ctx.time + 1e-12) onCdCount++;
      }
      if (onCdCount < rule.minProfSkillsOnCd) continue;

      for (const key of ctx.profKeys || []) {
        const ready = ctx.nextReady[key];
        if (ready === undefined || ready <= ctx.time + 1e-12) continue;
        const remain = ready - ctx.time;
        const reduce = Math.min(remain * rule.reduceRatio, rule.maxReduceSeconds);
        ctx.nextReady[key] = Math.max(ctx.time, ready - reduce);
      }

      ctx.wood3NextReady = ctx.time + rule.icdSeconds;
      appliedRuleIds.push(rule.id);
    }

    return { appliedRuleIds, wood3NextReady: ctx.wood3NextReady };
  }

  function updateCastContext(skill, time, context) {
    if (skill.name === "飞天") {
      context.combo.lastFeitian = time;
      context.combo.feitianWindowEnd = time + 20;
      context.combo.lianxinUsed = false;
    } else if (skill.name === "飞天·莲心") {
      context.combo.lianxinUsed = true;
    }
  }

  global.RuleEngine = {
    applyRequiredSkills,
    applyMutualExclusions,
    checkPrerequisite,
    applySpecialEffects,
    isRequiredSkill,
    updateCastContext,
    createRuntimeContext
  };
})(window);
