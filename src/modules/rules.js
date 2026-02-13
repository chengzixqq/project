import { DB, state } from './state.js';

function relations() {
  return DB?.rules?.relations || [];
}

function mutexRules() {
  return relations().filter((r) => r.relation_type === '互斥');
}

export function enforceRequiredSkills() {
  // 现阶段不再硬编码“妙音必带”，保留函数以兼容调用方。
  state.autoRequiredKeys = new Set();
}

export function isMiaoyinRequiredSkill(skill) {
  return state.autoRequiredKeys.has(skill.key);
}

export function enforceMutualExclusion(changedSkill) {
  const selected = state.selectedKeys;
  for (const rule of mutexRules()) {
    const a = rule.from_id;
    const b = rule.to_id;
    if (!(selected.has(a) && selected.has(b))) continue;

    if (changedSkill?.key === a) selected.delete(b);
    else if (changedSkill?.key === b) selected.delete(a);
    else selected.delete(b);
  }
}

export function applyExclusiveOnSelect(skill) {
  enforceMutualExclusion(skill);
}
