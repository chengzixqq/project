import { EXCLUSIVE_RULES, REQUIRED_SKILLS_MIAOYIN, SKILL_ID, SKILL_NAME, SKILL_NAME_ALIASES } from '../constants.js';
import { getKeyById, getKeysByNameAndSource, getKeysByNameExact, state } from './state.js';

function getKeysByAliases(id, aliases = []) {
  const out = new Set(getKeysByNameExact(id));
  for (const alias of aliases) {
    for (const key of getKeysByNameExact(alias)) out.add(key);
  }
  return [...out];
}

export function getActiveRules(profession = state.prof) {
  return getRulesForProfession(profession);
}

  for (const req of REQUIRED_SKILLS_MIAOYIN) {
    const idKey = getKeyById(req.id);
    if (idKey && state.skillIndex.get(idKey)?.source === state.prof) {
      state.selectedKeys.add(idKey);
      continue;
    }
    const aliases = SKILL_NAME_ALIASES[req.name] || [req.name];
    const keys = getKeysByNameAliases(req.name, aliases).filter((k) => state.skillIndex.get(k)?.source === state.prof);
    if (keys.length > 0) {
      console.warn(`[enforceRequiredSkills] 使用名称别名兜底匹配：${req.name}`);
      keys.forEach((k) => state.selectedKeys.add(k));
    }
  }
}

export function isMiaoyinRequiredSkill(skill) {
  if (state.prof !== '妙音') return false;
  if (REQUIRED_SKILLS_MIAOYIN.some((req) => req.id === skill.id)) return true;
  return REQUIRED_SKILLS_MIAOYIN.some((req) => {
    const aliases = SKILL_NAME_ALIASES[req.name] || [req.name];
    return aliases.includes(skill.name);
  });
}

export function enforceMutualExclusion(changedSkill) {
  for (const rule of EXCLUSIVE_RULES) {
    let aKeys = [];
    let bKeys = [];

    const aIdKey = getKeyById(rule.aId);
    const bIdKey = getKeyById(rule.bId);
    if (aIdKey) aKeys = [aIdKey];
    if (bIdKey) bKeys = [bIdKey];

    if (!aKeys.length) {
      aKeys = rule.source ? getKeysByNameAndSource(rule.a, rule.source) : getKeysByNameExact(rule.a);
      if (aKeys.length) console.warn(`[enforceMutualExclusion] A侧使用名称兜底：${rule.a}`);
    }
    if (!bKeys.length) {
      bKeys = rule.source ? getKeysByNameAndSource(rule.b, rule.source) : getKeysByNameExact(rule.b);
      if (bKeys.length) console.warn(`[enforceMutualExclusion] B侧使用名称兜底：${rule.b}`);
    }

    const aSelected = aKeys.some((k) => state.selectedKeys.has(k));
    const bSelected = bKeys.some((k) => state.selectedKeys.has(k));
    if (!(aSelected && bSelected)) continue;

    const keepA = changedSkill ? (changedSkill.id ? changedSkill.id === rule.aId : changedSkill.name === rule.a) : true;
    (keepA ? bKeys : aKeys).forEach((k) => state.selectedKeys.delete(k));
  }
}

export function applyExclusiveOnSelect(skill) {
  enforceMutualExclusion(skill);
}

export function initCtx() {
  return { lastFeitian: null, feitianWindowEnd: null, lianxinUsed: false };
}

function isZhuyueChengfeng(skill) {
  if (skill.id) return skill.id === SKILL_ID.ZHUYUE_CHENGFENG;
  return zhuyueChengfengAliases.includes(skill.name);
}

function isLianxin(skill) {
  if (skill.id) return skill.id === SKILL_ID.FEITIAN_LIANXIN;
  return feitianLianxinAliases.includes(skill.name);
}

function isFuyangTaixu(skill) {
  if (skill.id) return skill.id === SKILL_ID.FUYANG_TAIXU || skill.id === SKILL_ID.FUYANG_TAIXU_LINGYUN;
  return skill.name === SKILL_NAME.FUYANG_TAIXU || fuyangTaixuLingyunAliases.includes(skill.name);
}

export function prereqOk(skill, t, ctx, nextReady, zhuyueKey) {
  if (isLianxin(skill) || isZhuyueChengfeng(skill)) {
    if (ctx.lastFeitian === null || ctx.feitianWindowEnd === null) return false;
    if (isZhuyueChengfeng(skill) && ctx.lianxinUsed) return false;
    return t <= ctx.feitianWindowEnd + 1e-9;
  }

  if (isFuyangTaixu(skill)) {
    if (state.prof !== '妙音') return true;
    if (!zhuyueKey) return false;
    const readyAt = nextReady[zhuyueKey];
    if (readyAt === undefined) return false;
    return readyAt > t + EPS;
  }

  return true;
}

export function onCastUpdateCtx(skill, t, ctx) {
  if (skill.id ? skill.id === SKILL_ID.FEITIAN : skill.name === SKILL_NAME.FEITIAN) {
    ctx.lastFeitian = t;
    ctx.feitianWindowEnd = t + 20;
    ctx.lianxinUsed = false;
    return;
  }

  if (isLianxin(skill)) {
    ctx.lianxinUsed = true;
  }
}
