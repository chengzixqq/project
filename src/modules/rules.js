import { state, getKeysByNameAndSource, getKeysByNameExact } from './state.js';

export function isMiaoyinRequiredSkill(s) {
  if (!(state.prof === '妙音' && s.source === state.prof)) return false;
  return ['逐月', '飞天', '逐月·乘风', '逐月乘风', '逐月.乘风', '逐月 乘风', '飞天·莲心', '飞天莲心', '飞天.莲心', '飞天 莲心'].includes(s.name);
}

export function enforceRequiredSkills() {
  if (state.prof !== '妙音') return;
  const needs = [
    ['逐月'],
    ['逐月·乘风', '逐月乘风', '逐月.乘风', '逐月 乘风'],
    ['飞天'],
    ['飞天·莲心', '飞天莲心', '飞天.莲心', '飞天 莲心']
  ];
  for (const alts of needs) {
    for (const nm of alts) {
      const ks = getKeysByNameAndSource(nm, state.prof);
      if (ks.length) {
        ks.forEach((k) => state.selectedKeys.add(k));
        break;
      }
    }
  }
}

const EXCLUSIVE_RULES = [
  { a: '莲步盈华', b: '莲步盈华·并蒂', source: null },
  { a: '俯仰太虚', b: '俯仰太虚·灵韵', source: '内功' },
  { a: '纳百观', b: '纳百观·灵韵', source: '内功' }
];

export function enforceMutualExclusion() {
  for (const r of EXCLUSIVE_RULES) {
    const aKeys = r.source ? getKeysByNameAndSource(r.a, r.source) : getKeysByNameExact(r.a);
    const bKeys = r.source ? getKeysByNameAndSource(r.b, r.source) : getKeysByNameExact(r.b);
    if (aKeys.some((k) => state.selectedKeys.has(k)) && bKeys.some((k) => state.selectedKeys.has(k))) bKeys.forEach((k) => state.selectedKeys.delete(k));
  }
}

export function applyExclusiveOnSelect(skill) {
  for (const r of EXCLUSIVE_RULES) {
    const matchSource = (r.source === null) || (skill.source === r.source);
    if (!matchSource) continue;
    if (skill.name === r.a) (r.source ? getKeysByNameAndSource(r.b, r.source) : getKeysByNameExact(r.b)).forEach((k) => state.selectedKeys.delete(k));
    if (skill.name === r.b) (r.source ? getKeysByNameAndSource(r.a, r.source) : getKeysByNameExact(r.a)).forEach((k) => state.selectedKeys.delete(k));
  }
}

const isLianxin = (nm) => nm === '飞天·莲心';
const isZhuyueChengfeng = (nm) => ['逐月·乘风', '逐月乘风', '逐月.乘风', '逐月 乘风'].includes(nm);
const isFuyangTaixu = (nm) => nm === '俯仰太虚';
const isFuyangTaixuLingyun = (nm) => ['俯仰太虚·灵韵', '俯仰太虚灵韵', '俯仰太虚.灵韵', '俯仰太虚 灵韵'].includes(nm);

export function initCtx() { return { lastFeitian: null, feitianWindowEnd: null, lianxinUsed: false }; }

export function prereqOk(skill, t, ctx, nextReady, zhuyueKey) {
  const nm = skill.name;
  if (isLianxin(nm) || isZhuyueChengfeng(nm)) {
    if (ctx.lastFeitian === null || ctx.feitianWindowEnd === null) return false;
    if (isZhuyueChengfeng(nm) && ctx.lianxinUsed) return false;
    return t <= ctx.feitianWindowEnd + 1e-9;
  }
  if (isFuyangTaixu(nm) || isFuyangTaixuLingyun(nm)) {
    if (state.prof !== '妙音') return true;
    if (!zhuyueKey) return false;
    const zyReady = nextReady?.[zhuyueKey];
    if (zyReady === undefined) return false;
    return zyReady > t + 1e-12;
  }
  return true;
}

export function onCastUpdateCtx(skill, t, ctx) {
  if (skill.name === '飞天') {
    ctx.lastFeitian = t;
    ctx.feitianWindowEnd = t + 20;
    ctx.lianxinUsed = false;
  } else if (skill.name === '飞天·莲心') {
    ctx.lianxinUsed = true;
  }
}
