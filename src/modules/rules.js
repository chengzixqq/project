import { EXCLUSIVE_RULES, REQUIRED_SKILLS_MIAOYIN, SKILL_NAME, SKILL_NAME_ALIASES } from '../constants.js';
import { getKeysByNameAndSource, getKeysByNameExact, state } from './state.js';

const EPS = 1e-12;

const zhuyueChengfengAliases = SKILL_NAME_ALIASES[SKILL_NAME.ZHUYUE_CHENGFENG] || [SKILL_NAME.ZHUYUE_CHENGFENG];
const feitianLianxinAliases = SKILL_NAME_ALIASES[SKILL_NAME.FEITIAN_LIANXIN] || [SKILL_NAME.FEITIAN_LIANXIN];
const fuyangTaixuLingyunAliases = SKILL_NAME_ALIASES[SKILL_NAME.FUYANG_TAIXU_LINGYUN] || [SKILL_NAME.FUYANG_TAIXU_LINGYUN];

function getKeysByNameAliases(name, aliases) {
  const out = new Set(getKeysByNameExact(name));
  for (const alt of aliases || []) {
    for (const key of getKeysByNameExact(alt)) out.add(key);
  }
  return [...out];
}

export function enforceRequiredSkills() {
  if (state.prof !== '妙音') return;

  for (const name of REQUIRED_SKILLS_MIAOYIN) {
    const aliases = SKILL_NAME_ALIASES[name] || [name];
    const keys = getKeysByNameAliases(name, aliases).filter((k) => state.skillIndex.get(k)?.source === state.prof);
    keys.forEach((k) => state.selectedKeys.add(k));
  }
}

export function isMiaoyinRequiredSkill(skill) {
  if (state.prof !== '妙音') return false;
  return REQUIRED_SKILLS_MIAOYIN.includes(skill.name);
}

export function enforceMutualExclusion(changedSkill) {
  for (const rule of EXCLUSIVE_RULES) {
    const aKeys = rule.source ? getKeysByNameAndSource(rule.a, rule.source) : getKeysByNameExact(rule.a);
    const bKeys = rule.source ? getKeysByNameAndSource(rule.b, rule.source) : getKeysByNameExact(rule.b);
    const aSelected = aKeys.some((k) => state.selectedKeys.has(k));
    const bSelected = bKeys.some((k) => state.selectedKeys.has(k));
    if (!(aSelected && bSelected)) continue;

    const keepA = changedSkill ? changedSkill.name === rule.a : true;
    (keepA ? bKeys : aKeys).forEach((k) => state.selectedKeys.delete(k));
  }
}

export function applyExclusiveOnSelect(skill) {
  enforceMutualExclusion(skill);
}

export function initCtx() {
  return { lastFeitian: null, feitianWindowEnd: null, lianxinUsed: false };
}

function isZhuyueChengfeng(name) {
  return zhuyueChengfengAliases.includes(name);
}

function isLianxin(name) {
  return feitianLianxinAliases.includes(name);
}

function isFuyangTaixu(name) {
  return name === SKILL_NAME.FUYANG_TAIXU || fuyangTaixuLingyunAliases.includes(name);
}

export function prereqOk(skill, t, ctx, nextReady, zhuyueKey) {
  if (isLianxin(skill.name) || isZhuyueChengfeng(skill.name)) {
    if (ctx.lastFeitian === null || ctx.feitianWindowEnd === null) return false;
    if (isZhuyueChengfeng(skill.name) && ctx.lianxinUsed) return false;
    return t <= ctx.feitianWindowEnd + 1e-9;
  }

  if (isFuyangTaixu(skill.name)) {
    if (state.prof !== '妙音') return true;
    if (!zhuyueKey) return false;
    const readyAt = nextReady[zhuyueKey];
    if (readyAt === undefined) return false;
    return readyAt > t + EPS;
  }

  return true;
}

export function onCastUpdateCtx(skill, t, ctx) {
  if (skill.name === SKILL_NAME.FEITIAN) {
    ctx.lastFeitian = t;
    ctx.feitianWindowEnd = t + 20;
    ctx.lianxinUsed = false;
    return;
  }

  if (isLianxin(skill.name)) {
    ctx.lianxinUsed = true;
  }
}
