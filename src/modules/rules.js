import { EXCLUSIVE_RULES, REQUIRED_SKILLS_MIAOYIN, SKILL_ID, SKILL_NAME, SKILL_NAME_ALIASES } from '../constants.js';
import { getRulesForProfession } from '../data/rules.js';
import { getKeyById, getKeysByNameAndSource, getKeysByNameExact, state } from './state.js';

const EPS = 1e-12;
const zhuyueChengfengAliases = SKILL_NAME_ALIASES[SKILL_NAME.ZHUYUE_CHENGFENG] || [SKILL_NAME.ZHUYUE_CHENGFENG];
const feitianLianxinAliases = SKILL_NAME_ALIASES[SKILL_NAME.FEITIAN_LIANXIN] || [SKILL_NAME.FEITIAN_LIANXIN];
const fuyangTaixuLingyunAliases = SKILL_NAME_ALIASES[SKILL_NAME.FUYANG_TAIXU_LINGYUN] || [SKILL_NAME.FUYANG_TAIXU_LINGYUN];

function getKeysByAliases(id, aliases = []) {
  const out = new Set();
  const idKey = getKeyById(id);
  if (idKey) out.add(idKey);
  for (const alias of aliases) {
    for (const key of getKeysByNameExact(alias)) out.add(key);
  }
  return [...out];
}

export function getActiveRules(profession = state.prof) {
  return getRulesForProfession(profession);
}

export function enforceRequiredSkills() {
  if (state.prof !== '妙音') return;

  for (const req of REQUIRED_SKILLS_MIAOYIN) {
    const aliases = SKILL_NAME_ALIASES[req.name] || [req.name];
    const keys = getKeysByAliases(req.id, aliases).filter((k) => state.skillIndex.get(k)?.source === state.prof);
    if (keys.length > 0) keys.forEach((k) => state.selectedKeys.add(k));
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

    if (!aKeys.length) aKeys = rule.source ? getKeysByNameAndSource(rule.a, rule.source) : getKeysByNameExact(rule.a);
    if (!bKeys.length) bKeys = rule.source ? getKeysByNameAndSource(rule.b, rule.source) : getKeysByNameExact(rule.b);

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
  return skill?.id === SKILL_ID.ZHUYUE_CHENGFENG || zhuyueChengfengAliases.includes(skill?.name);
}

function isLianxin(skill) {
  return skill?.id === SKILL_ID.FEITIAN_LIANXIN || feitianLianxinAliases.includes(skill?.name);
}

function isFuyangTaixu(skill) {
  const fuyangAliases = SKILL_NAME_ALIASES[SKILL_NAME.FUYANG_TAIXU] || [SKILL_NAME.FUYANG_TAIXU];
  return skill?.id === SKILL_ID.FUYANG_TAIXU
    || skill?.id === SKILL_ID.FUYANG_TAIXU_LINGYUN
    || fuyangAliases.includes(skill?.name)
    || fuyangTaixuLingyunAliases.includes(skill?.name);
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
  if (skill?.id === SKILL_ID.FEITIAN || (SKILL_NAME_ALIASES[SKILL_NAME.FEITIAN] || [SKILL_NAME.FEITIAN]).includes(skill?.name)) {
    ctx.lastFeitian = t;
    ctx.feitianWindowEnd = t + 20;
    ctx.lianxinUsed = false;
    return;
  }

  if (isLianxin(skill)) {
    ctx.lianxinUsed = true;
  }
}
