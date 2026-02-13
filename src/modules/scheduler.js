import { effectiveCd, state } from './state.js';
import { initCtx, onCastUpdateCtx, prereqOk } from './rules.js';

function mergeVacuumAndSkips(events) {
  const out = [];
  for (const e of events) {
    if (e.type !== 'vacuum') { out.push(e); continue; }
    const last = out[out.length - 1];
    if (last && last.type === 'vacuum' && Math.abs(last.end - e.start) < 1e-9) { last.end = e.end; last.duration += e.duration; }
    else out.push({ ...e });
  }
  return out;
}

function annotateDeath(events, threshold) {
  const th = Number(threshold) || 0;
  if (!(th > 0)) return events.map((e) => ({ ...e, death: false }));
  return events.map((e) => (e.type !== 'vacuum' ? { ...e, death: false } : { ...e, death: e.duration >= th }));
}

const countProfCooldown = (nextReady, profKeys, t) => profKeys.reduce((n, k) => n + ((nextReady[k] !== undefined && nextReady[k] > t + 1e-12) ? 1 : 0), 0);
function applyWood3Proc(nextReady, profKeys, t) {
  for (const k of profKeys) {
    const r = nextReady[k];
    if (r === undefined || r <= t + 1e-12) continue;
    const reduce = Math.min((r - t) * 0.4, 5);
    nextReady[k] = Math.max(t, r - reduce);
  }
}
const canTriggerWood3ByCast = (skill) => skill.source !== '内功';
const nextCastableTime = (skill, t, ctx, nextReady, zhuyueKey) => (!prereqOk(skill, t, ctx, nextReady, zhuyueKey) ? Infinity : Math.max(t, nextReady[skill.key] ?? 0));

export function generateSchedule() {
  const T = Number(state.modeDuration);
  const order = state.orderedKeys.map((k) => state.skillIndex.get(k)).filter(Boolean);
  if (!order.length || !(T > 0)) return [];

  const profKeys = order.filter((s) => s.source === state.prof).map((s) => s.key);
  const traps = order.filter((s) => !((s.cast ?? 0) > 0) && !(effectiveCd(s) > 0));
  if (traps.length > 0) {
    alert(`存在“霸体=0 且 有效冷却=0”的技能，会导致排轴无限循环：\n${traps.map((s) => `${s.name}（${s.source}）`).join('\n')}\n请补齐冷却或取消选择。`);
    return [];
  }

  const nextReady = {};
  let wood3NextReady = 0;
  let t = 0;
  let idx = 0;
  let guard = 0;
  let stagnantCount = 0;
  let lastT = t;
  const events = [];
  const ctx = initCtx();
  const zhuyueKey = state.prof === '妙音' ? (order.find((s) => s?.name === '逐月')?.key || null) : null;

  function doCast(skill) {
    const cast = Number(skill.cast ?? 0) > 0 ? Number(skill.cast) : 0;
    const cdEff = effectiveCd(skill);
    let wood3Triggered = false;
    if (state.woodChoice === 3 && canTriggerWood3ByCast(skill) && t + 1e-12 >= wood3NextReady && countProfCooldown(nextReady, profKeys, t) >= 3) {
      applyWood3Proc(nextReady, profKeys, t);
      wood3NextReady = t + 20;
      wood3Triggered = true;
    }
    events.push({ type: 'skill', key: skill.key, name: skill.name, source: skill.source, start: t, end: Math.min(t + cast, T), cast, cd: cdEff, wood3Triggered });
    nextReady[skill.key] = t + cdEff;
    onCastUpdateCtx(skill, t, ctx);
    t += cast;
  }

  while (t < T - 1e-9 && guard < 300000) {
    guard++;
    if (state.schedMode === 'strict') {
      const s = order[idx];
      if (!prereqOk(s, t, ctx, nextReady, zhuyueKey)) { events.push({ type: 'skip', start: t, end: t, name: s.name, source: s.source, reason: '前置条件不满足（飞天联动）' }); idx = (idx + 1) % order.length; continue; }
      const ready = nextReady[s.key] ?? 0;
      if (ready > t + 1e-12) { const endVac = Math.min(ready, T); events.push({ type: 'vacuum', start: t, end: endVac, duration: endVac - t }); t = ready; if (t >= T - 1e-9) break; }
      doCast(s); idx = (idx + 1) % order.length;
    } else {
      let found = -1;
      for (let off = 0; off < order.length; off++) { const s = order[(idx + off) % order.length]; if (prereqOk(s, t, ctx, nextReady, zhuyueKey) && (nextReady[s.key] ?? 0) <= t + 1e-12) { found = off; break; } }
      if (found >= 0) { doCast(order[(idx + found) % order.length]); idx = (idx + found + 1) % order.length; }
      else {
        let nextT = Infinity;
        for (const s of order) nextT = Math.min(nextT, nextCastableTime(s, t, ctx, nextReady, zhuyueKey));
        if (!isFinite(nextT) || nextT <= t + 1e-12) { events.push({ type: 'vacuum', start: t, end: Math.min(T, t), duration: 0, note: '动态排轴无法推进：当前无可施放技能（可能因飞天联动前置未满足且无飞天可施放）。' }); break; }
        const endVac = Math.min(nextT, T); events.push({ type: 'vacuum', start: t, end: endVac, duration: endVac - t }); t = nextT;
      }
    }
    if (Math.abs(t - lastT) < 1e-12) stagnantCount++; else { stagnantCount = 0; lastT = t; }
    if (stagnantCount > order.length * 120) { events.push({ type: 'vacuum', start: t, end: Math.min(T, t), duration: 0, note: '检测到时间长期不推进（大量0秒占用/跳过循环）。请补齐“霸体时间”或调整排轴/前置条件。' }); break; }
  }
  if (guard >= 300000) events.push({ type: 'vacuum', start: Math.min(t, T), end: T, duration: Math.max(0, T - t), note: '触发安全退出：事件数过多。' });
  return annotateDeath(mergeVacuumAndSkips(events), state.deathThreshold);
}
