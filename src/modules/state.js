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
  autoRequiredKeys: new Set(),
  orderedKeys: [],
  events: [],
  scheduleStats: null,
};

export function keyOf(source, name) { return `${source}::${name}`; }

function normalizeSkill(raw, bucket, fallbackSource = '') {
  const name = raw?.name || raw?.id || '';
  const source = raw?.source || raw?.所属 || fallbackSource || bucket;
  return {
    ...raw,
    id: raw?.id,
    name,
    source,
    bucket,
  };
}

function mapUniversalCategory(cat) {
  if (cat === '内功') return { bucket: '内功', source: '内功' };
  return { bucket: '江湖技能', source: cat };
}

export function getProfessionOptions() {
  const options = new Set();

  if (DB.skills?.profession && typeof DB.skills.profession === 'object') {
    Object.keys(DB.skills.profession).forEach((name) => name && options.add(name));
  }

  const profBucket = DB.skills?.职业技能;
  if (Array.isArray(profBucket)) {
    profBucket.forEach((skill) => {
      const source = skill?.source || skill?.所属;
      if (source) options.add(source);
    });
  }

  (DB.meta?.profession_sheets || []).forEach((name) => name && options.add(name));
  return [...options];
}

function collectSkillsByScope(profName) {
  const prof = [];
  const jianghu = [];
  const neigong = [];

  if (DB.skills?.profession && typeof DB.skills.profession === 'object') {
    (DB.skills.profession[profName] || []).forEach((s) => prof.push(normalizeSkill(s, '职业技能', profName)));
  }

  const professionBucket = DB.skills?.职业技能;
  if (Array.isArray(professionBucket)) {
    professionBucket.forEach((s) => {
      const source = s?.source || s?.所属;
      if (source === profName) prof.push(normalizeSkill(s, '职业技能', source));
    });
  }

  if (DB.skills?.universal && typeof DB.skills.universal === 'object') {
    for (const cat of Object.keys(DB.skills.universal)) {
      const list = DB.skills.universal[cat] || [];
      const mapped = mapUniversalCategory(cat);
      list.forEach((s) => {
        const source = s?.source || s?.所属 || mapped.source;
        const skill = normalizeSkill(s, mapped.bucket, source);
        if (mapped.bucket === '内功') neigong.push(skill);
        else jianghu.push(skill);
      });
    }
  }

  const jianghuBucket = DB.skills?.江湖技能;
  if (Array.isArray(jianghuBucket)) {
    jianghuBucket.forEach((s) => jianghu.push(normalizeSkill(s, '江湖技能', s?.source || s?.所属 || '江湖')));
  }

  const neigongBucket = DB.skills?.内功;
  if (Array.isArray(neigongBucket)) {
    neigongBucket.forEach((s) => neigong.push(normalizeSkill(s, '内功', '内功')));
  }

  return [...prof, ...jianghu, ...neigong];
}

export function buildSkillIndex(profName) {
  const index = new Map();
  const all = collectSkillsByScope(profName);
  for (const s of all) {
    if (!s.name) continue;
    const key = keyOf(s.source, s.name);
    index.set(key, { ...s, key });
  }
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

export function getKeyById(id) {
  return state.skillIndex.has(id) ? id : null;
}

export function getKeysByNameExact(name) {
  return [...state.skillIndex.values()].filter((s) => s.name === name).map((s) => s.id);
}

export function getKeysByNameAndSource(name, source) {
  return [...state.skillIndex.values()].filter((s) => s.name === name && s.source === source).map((s) => s.id);
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
  state.autoRequiredKeys = new Set();
  state.orderedKeys = [];
  state.events = [];
  state.scheduleStats = null;
}

export { DB };
