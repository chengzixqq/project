import { getRulesForProfession, RELATION_TYPE, REQUIRED_SKILLS_BY_PROF } from '../data/rules.js';
import { getKeysByNameAndSource, getKeysByNameExact, state } from './state.js';

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

export function enforceRequiredSkills() {
  const required = REQUIRED_SKILLS_BY_PROF[state.prof] || [];
  for (const item of required) {
    const keys = getKeysByAliases(item.id, item.aliases).filter((k) => state.skillIndex.get(k)?.source === state.prof);
    keys.forEach((k) => state.selectedKeys.add(k));
  }
}

export function isMiaoyinRequiredSkill(skill) {
  const required = REQUIRED_SKILLS_BY_PROF[state.prof] || [];
  return required.some((item) => (item.aliases || [item.id]).includes(skill.name));
}

export function enforceMutualExclusion(changedSkill) {
  const rules = getActiveRules().filter((rule) => rule.relation_type === RELATION_TYPE.MUTEX);
  for (const rule of rules) {
    const source = rule.param?.source || null;
    const fromKeys = source ? getKeysByNameAndSource(rule.from_id, source) : getKeysByNameExact(rule.from_id);
    const toKeys = source ? getKeysByNameAndSource(rule.to_id, source) : getKeysByNameExact(rule.to_id);
    const fromSelected = fromKeys.some((k) => state.selectedKeys.has(k));
    const toSelected = toKeys.some((k) => state.selectedKeys.has(k));
    if (!(fromSelected && toSelected)) continue;

    const keepFrom = changedSkill ? changedSkill.name === rule.from_id : true;
    (keepFrom ? toKeys : fromKeys).forEach((k) => state.selectedKeys.delete(k));
  }
}

export function applyExclusiveOnSelect(skill) {
  enforceMutualExclusion(skill);
}
