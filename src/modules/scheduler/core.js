const EPS = 1e-12;

function initCtx() {
  return { lastCastAt: Object.create(null) };
}

function buildRuleIndex(relations, skillsByKey) {
  const byTargetPrereq = new Map();
  const byTargetWindow = new Map();
  const byTargetSharedTime = new Map();
  const replacementByTarget = new Map();
  const sharedCooldownPairs = [];

  for (const r of relations || []) {
    if (r.relation_type === '前置') {
      if (!byTargetPrereq.has(r.from_id)) byTargetPrereq.set(r.from_id, []);
      byTargetPrereq.get(r.from_id).push(r.to_id);
    } else if (r.relation_type === '窗口期') {
      if (!byTargetWindow.has(r.from_id)) byTargetWindow.set(r.from_id, []);
      byTargetWindow.get(r.from_id).push({ anchor: r.to_id, window: Number(r.param) || 0 });
    } else if (r.relation_type === '替换技能') {
      if (!replacementByTarget.has(r.to_id)) replacementByTarget.set(r.to_id, []);
      replacementByTarget.get(r.to_id).push({ anchor: r.from_id, delay: Number(r.param) || 0 });
    } else if (r.relation_type === '共享时间') {
      if (!byTargetSharedTime.has(r.from_id)) byTargetSharedTime.set(r.from_id, []);
      const duration = Number(skillsByKey.get(r.to_id)?.duration || 0);
      byTargetSharedTime.get(r.from_id).push({ anchor: r.to_id, duration });
    } else if (r.relation_type === '共享冷却') {
      sharedCooldownPairs.push([r.from_id, r.to_id]);
    }
  }

  return {
    byTargetPrereq,
    byTargetWindow,
    byTargetSharedTime,
    replacementByTarget,
    sharedCooldownPairs,
  };
}

function prereqOk(skill, t, ctx, ruleIndex) {
  const key = skill.key;

  const reqs = ruleIndex.byTargetPrereq.get(key) || [];
  for (const anchor of reqs) {
    if (ctx.lastCastAt[anchor] == null) return false;
  }

  const windows = ruleIndex.byTargetWindow.get(key) || [];
  for (const w of windows) {
    const castAt = ctx.lastCastAt[w.anchor];
    if (castAt == null) return false;
    if (t > castAt + w.window + EPS) return false;
  }

  const replacements = ruleIndex.replacementByTarget.get(key) || [];
  for (const rp of replacements) {
    const castAt = ctx.lastCastAt[rp.anchor];
    if (castAt == null) return false;
    if (t + EPS < castAt + rp.delay) return false;
  }

  const sharedTimes = ruleIndex.byTargetSharedTime.get(key) || [];
  for (const st of sharedTimes) {
    const castAt = ctx.lastCastAt[st.anchor];
    if (castAt == null) return false;
    if (st.duration > 0 && t > castAt + st.duration + EPS) return false;
  }

  return true;
}

function onCastUpdateCtx(skill, t, ctx, nextReady, ruleIndex) {
  ctx.lastCastAt[skill.key] = t;
  for (const [a, b] of ruleIndex.sharedCooldownPairs) {
    if (skill.key === a) nextReady[b] = nextReady[a];
    else if (skill.key === b) nextReady[a] = nextReady[b];
  }
}

function countProfCooldown(nextReady, profKeys, t) {
  let count = 0;
  for (const key of profKeys) {
    const readyAt = nextReady[key];
    if (readyAt !== undefined && readyAt > t + EPS) count += 1;
  }
  return count;
}

function applyWood3Proc(nextReady, profKeys, t) {
  for (const key of profKeys) {
    const readyAt = nextReady[key];
    if (readyAt === undefined || readyAt <= t + EPS) continue;
    const remaining = readyAt - t;
    const reduce = Math.min(remaining * 0.4, 5);
    nextReady[key] = Math.max(t, readyAt - reduce);
  }
}

function canTriggerWood3ByCast(skill) {
  return skill.source !== '内功';
}

export function mergeVacuumAndSkips(events) {
  const out = [];
  for (const event of events) {
    if (event.type !== 'vacuum') {
      out.push(event);
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.type === 'vacuum' && Math.abs(last.end - event.start) < 1e-9) {
      last.end = event.end;
      last.duration += event.duration;
      if (event.note) {
        if (last.note && last.note !== event.note) last.note = `${last.note} / ${event.note}`;
        else if (!last.note) last.note = event.note;
      }
    } else {
      out.push({ ...event });
    }
  }
  return out;
}

export function annotateDeath(events, threshold) {
  const th = Number(threshold) || 0;
  if (!(th > 0)) return events.map((event) => ({ ...event, death: false }));
  return events.map((event) => (event.type !== 'vacuum'
    ? { ...event, death: false }
    : { ...event, death: event.duration >= th }));
}

export function nextCastableTime(skill, t, ctx, nextReady, ruleIndex) {
  if (!prereqOk(skill, t, ctx, ruleIndex)) return Infinity;
  const readyAt = Math.max(t, nextReady[skill.key] ?? 0);
  if (!prereqOk(skill, readyAt, ctx, ruleIndex)) return Infinity;
  return readyAt;
}

export function summarizeEvents(events, totalDuration) {
  let vacuum = 0;
  let maxVac = 0;
  let deathCount = 0;
  let firstDeathStart = null;
  let skillCount = 0;
  let skipCount = 0;
  let wood3ProcCount = 0;

  for (const event of events) {
    if (event.type === 'vacuum') {
      vacuum += event.duration;
      maxVac = Math.max(maxVac, event.duration);
      if (event.death) {
        deathCount += 1;
        if (firstDeathStart === null || event.start < firstDeathStart) firstDeathStart = event.start;
      }
      continue;
    }
    if (event.type === 'skill') {
      skillCount += 1;
      if (event.wood3Triggered) wood3ProcCount += 1;
      continue;
    }
    if (event.type === 'skip') skipCount += 1;
  }

  return {
    totalDuration,
    vacuum,
    vacuumPct: totalDuration > 0 ? (vacuum / totalDuration) * 100 : 0,
    maxVac,
    deathCount,
    firstDeathStart,
    skillCount,
    skipCount,
    wood3ProcCount,
  };
}

export function generateSchedule(input) {
  const { modeDuration, skills, rules, strategy } = input;

  const T = Number(modeDuration);
  const order = Array.isArray(skills) ? skills.filter(Boolean) : [];
  if (!order.length || !(T > 0)) {
    const empty = [];
    return { events: empty, stats: summarizeEvents(empty, T), error: null };
  }

  const profKeys = order.filter((s) => s.source === rules.profession).map((s) => s.key);
  const traps = order.filter((s) => !((s.cast ?? 0) > 0) && !((s.cd ?? 0) > 0));
  if (traps.length > 0) {
    return {
      events: [],
      stats: summarizeEvents([], T),
      error: `存在“霸体=0 且 有效冷却=0”的技能：${traps.map((s) => `${s.name}（${s.source}）`).join('、')}`,
    };
  }

  const ruleIndex = buildRuleIndex(rules.relations || [], new Map(order.map((s) => [s.key, s])));
  const nextReady = {};
  const ctx = initCtx();

  const WOOD3_ICD = 20;
  let wood3NextReady = 0;
  let t = 0;
  let idx = 0;
  let guard = 0;
  let stagnantCount = 0;
  let lastT = t;
  const events = [];

  const doCast = (skill) => {
    const cast = Math.max(0, Number(skill.cast ?? 0));
    const cdEff = Number(skill.cd ?? 0);

    let wood3Triggered = false;
    if (rules.woodChoice === 3 && canTriggerWood3ByCast(skill) && t + EPS >= wood3NextReady) {
      const cooldownCount = countProfCooldown(nextReady, profKeys, t);
      if (cooldownCount >= 3) {
        applyWood3Proc(nextReady, profKeys, t);
        wood3NextReady = t + WOOD3_ICD;
        wood3Triggered = true;
      }
    }

    const end = Math.min(t + cast, T);
    events.push({ type: 'skill', key: skill.key, name: skill.name, source: skill.source, start: t, end, cast, cd: cdEff, wood3Triggered });

    nextReady[skill.key] = t + cdEff;
    onCastUpdateCtx(skill, t, ctx, nextReady, ruleIndex);
    t += cast;
  };

  while (t < T - 1e-9 && guard < 300000) {
    guard += 1;

    if (strategy === 'strict') {
      const skill = order[idx];
      if (!prereqOk(skill, t, ctx, ruleIndex)) {
        events.push({ type: 'skip', start: t, end: t, name: skill.name, source: skill.source, reason: '前置条件不满足' });
        idx = (idx + 1) % order.length;
        continue;
      }

      const ready = nextReady[skill.key] ?? 0;
      if (ready > t + EPS) {
        const endVac = Math.min(ready, T);
        events.push({ type: 'vacuum', start: t, end: endVac, duration: endVac - t });
        t = ready;
        if (t >= T - 1e-9) break;
      }

      doCast(skill);
      idx = (idx + 1) % order.length;
    } else {
      let found = -1;
      for (let off = 0; off < order.length; off += 1) {
        const skill = order[(idx + off) % order.length];
        if (!prereqOk(skill, t, ctx, ruleIndex)) continue;
        const ready = nextReady[skill.key] ?? 0;
        if (ready <= t + EPS) {
          found = off;
          break;
        }
      }

      if (found >= 0) {
        const skill = order[(idx + found) % order.length];
        doCast(skill);
        idx = (idx + found + 1) % order.length;
      } else {
        let nextT = Infinity;
        for (const skill of order) {
          const nt = nextCastableTime(skill, t, ctx, nextReady, ruleIndex);
          if (nt < nextT) nextT = nt;
        }

        if (!Number.isFinite(nextT) || nextT <= t + EPS) {
          events.push({ type: 'vacuum', start: t, end: Math.min(T, t), duration: 0, note: '动态排轴无法推进：当前无可施放技能（可能因前置条件未满足或冷却限制）。' });
          break;
        }

        const endVac = Math.min(nextT, T);
        events.push({ type: 'vacuum', start: t, end: endVac, duration: endVac - t });
        t = nextT;
      }
    }

    if (Math.abs(t - lastT) < EPS) stagnantCount += 1;
    else {
      stagnantCount = 0;
      lastT = t;
    }

    if (stagnantCount > order.length * 120) {
      events.push({ type: 'vacuum', start: t, end: Math.min(T, t), duration: 0, note: '检测到时间长期不推进（大量0秒占用/跳过循环）。请补齐“霸体时间”或调整排轴/前置条件。' });
      break;
    }
  }

  if (guard >= 300000) {
    events.push({ type: 'vacuum', start: Math.min(t, T), end: T, duration: Math.max(0, T - t), note: '触发安全退出：事件数过多。' });
  }

  const merged = mergeVacuumAndSkips(events).filter((e) => e.end >= e.start - 1e-9);
  const finalEvents = annotateDeath(merged, rules.deathThreshold);
  return { events: finalEvents, stats: summarizeEvents(finalEvents, T), error: null };
}
