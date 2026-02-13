import { DB } from '../data/db.js';

export const state = {
  currentStep: 1,
  maxVisitedStep: 1,
  modeId: DB.modes[0].id,
  modeDuration: DB.modes[0].duration,
  deathThreshold: 3.0,
  prof: DB.meta.profession_sheets[0] || '',
  woodChoice: 0,
  schedMode: 'strict',
  skillIndex: new Map(),
  selectedKeys: new Set(),
  orderedKeys: [],
  events: [],
  scheduleStats: null,
};

export function keyOf(source, name) { return `${source}::${name}`; }

export function buildSkillIndex(profName) {
  const index = new Map();
  const profSkills = (DB.skills.profession[profName] || []).map((s) => ({ ...s, source: profName }));
  const uni = [];
  for (const cat of Object.keys(DB.skills.universal)) {
    for (const s of DB.skills.universal[cat] || []) uni.push({ ...s, source: cat });
  }
  for (const s of [...profSkills, ...uni]) index.set(keyOf(s.source, s.name), { ...s, key: keyOf(s.source, s.name) });
  return index;
}

export function woodCdMultiplier(choice) {
  if (choice === 1) return 0.97;
  if (choice === 2) return 0.96;
  if (choice === 3) return 0.95;
  return 1;
}

export function effectiveCd(skill, profName = state.prof, woodChoice = state.woodChoice) {
  const base = Number(skill.cd ?? 0);
  if (skill.source === profName) return base * woodCdMultiplier(woodChoice);
  return base;
}

export function getKeysByNameExact(name) {
  return [...state.skillIndex.values()].filter((s) => s.name === name).map((s) => s.key);
}

export function getKeysByNameAndSource(name, source) {
  return [...state.skillIndex.values()].filter((s) => s.name === name && s.source === source).map((s) => s.key);
}

export function collectOrderedFromSelected() {
  const selected = [...state.selectedKeys];
  const existing = state.orderedKeys.filter((k) => state.selectedKeys.has(k));
  const existingSet = new Set(existing);
  const newOnes = selected.filter((k) => !existingSet.has(k));
  newOnes.sort((ka, kb) => (state.skillIndex.get(ka)?.name || '').localeCompare((state.skillIndex.get(kb)?.name || ''), 'zh-CN'));
  state.orderedKeys = [...existing, ...newOnes];
}

export function resetAll() {
  state.currentStep = 1;
  state.maxVisitedStep = 1;
  state.selectedKeys = new Set();
  state.orderedKeys = [];
  state.events = [];
  state.scheduleStats = null;
}

export { DB };
