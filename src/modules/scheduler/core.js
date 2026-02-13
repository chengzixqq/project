import { SKILL_NAME, SKILL_NAME_ALIASES } from '../../constants.js';

const EPS = 1e-12;

const zhuyueChengfengAliases = SKILL_NAME_ALIASES[SKILL_NAME.ZHUYUE_CHENGFENG] || [SKILL_NAME.ZHUYUE_CHENGFENG];
const feitianLianxinAliases = SKILL_NAME_ALIASES[SKILL_NAME.FEITIAN_LIANXIN] || [SKILL_NAME.FEITIAN_LIANXIN];
const fuyangTaixuLingyunAliases = SKILL_NAME_ALIASES[SKILL_NAME.FUYANG_TAIXU_LINGYUN] || [SKILL_NAME.FUYANG_TAIXU_LINGYUN];

function initCtx() {
  return { lastFeitian: null, feitianWindowEnd: null, lianxinUsed: false };
}
function isFeitian(name) { return name === SKILL_NAME.FEITIAN; }
function isLianxin(name) { return feitianLianxinAliases.includes(name); }
function isZhuyueChengfeng(name) {
  return zhuyueChengfengAliases.includes(name);
}
function isFuyangTaixu(name) { return name === SKILL_NAME.FUYANG_TAIXU; }
function isFuyangTaixuLingyun(name) {
  return fuyangTaixuLingyunAliases.includes(name);
}

function prereqOk(skill, t, ctx, nextReady, options) {
  const name = skill.name;
  const { profession, zhuyueKey } = options;

  if (isLianxin(name) || isZhuyueChengfeng(name)) {
    if (ctx.lastFeitian === null || ctx.feitianWindowEnd === null) return false;
    if (isZhuyueChengfeng(name) && ctx.lianxinUsed) return false;
    return t <= ctx.feitianWindowEnd + 1e-9;
  }

  if (isFuyangTaixu(name) || isFuyangTaixuLingyun(name)) {
    if (profession !== "妙音") return true;
    if (!zhuyueKey) return false;
    const readyAt = nextReady[zhuyueKey];
    if (readyAt === undefined) return false;
    return readyAt > t + EPS;
  }

  return true;
}

function onCastUpdateCtx(skill, t, ctx) {
  if (isFeitian(skill.name)) {
    ctx.lastFeitian = t;
    ctx.feitianWindowEnd = t + 20;
    ctx.lianxinUsed = false;
    return;
  }
  if (isLianxin(skill.name)) ctx.lianxinUsed = true;
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
  return skill.source !== "内功";
}

export function mergeVacuumAndSkips(events) {
  const out = [];
  for (const event of events) {
    if (event.type !== "vacuum") {
      out.push(event);
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.type === "vacuum" && Math.abs(last.end - event.start) < 1e-9) {
      last.end = event.end;
      last.duration += event.duration;
    } else {
      out.push({ ...event });
    }
  }
  return out;
}

export function annotateDeath(events, threshold) {
  const th = Number(threshold) || 0;
  if (!(th > 0)) return events.map((event) => ({ ...event, death: false }));
  return events.map((event) => (event.type !== "vacuum"
    ? { ...event, death: false }
    : { ...event, death: event.duration >= th }));
}

export function nextCastableTime(skill, t, ctx, nextReady, prereqOptions) {
  if (!prereqOk(skill, t, ctx, nextReady, prereqOptions)) return Infinity;
  return Math.max(t, nextReady[skill.key] ?? 0);
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
    if (event.type === "vacuum") {
      vacuum += event.duration;
      maxVac = Math.max(maxVac, event.duration);
      if (event.death) {
        deathCount += 1;
        if (firstDeathStart === null || event.start < firstDeathStart) firstDeathStart = event.start;
      }
      continue;
    }
    if (event.type === "skill") {
      skillCount += 1;
      if (event.wood3Triggered) wood3ProcCount += 1;
      continue;
    }
    if (event.type === "skip") skipCount += 1;
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
  const {
    modeDuration,
    skills,
    rules,
    strategy,
  } = input;

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
      error: `存在“霸体=0 且 有效冷却=0”的技能：${traps.map((s) => `${s.name}（${s.source}）`).join("、")}`,
    };
  }

  const nextReady = {};
  const ctx = initCtx();
  const prereqOptions = {
    profession: rules.profession,
    zhuyueKey: rules.zhuyueKey || null,
  };

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
    events.push({
      type: "skill",
      key: skill.key,
      name: skill.name,
      source: skill.source,
      start: t,
      end,
      cast,
      cd: cdEff,
      wood3Triggered,
    });

    nextReady[skill.key] = t + cdEff;
    onCastUpdateCtx(skill, t, ctx);
    t += cast;
  };

  while (t < T - 1e-9 && guard < 300000) {
    guard += 1;

    if (strategy === "strict") {
      const skill = order[idx];
      if (!prereqOk(skill, t, ctx, nextReady, prereqOptions)) {
        events.push({
          type: "skip",
          start: t,
          end: t,
          name: skill.name,
          source: skill.source,
          reason: "前置条件不满足（飞天联动）",
        });
        idx = (idx + 1) % order.length;
        continue;
      }

      const ready = nextReady[skill.key] ?? 0;
      if (ready > t + EPS) {
        const endVac = Math.min(ready, T);
        events.push({ type: "vacuum", start: t, end: endVac, duration: endVac - t });
        t = ready;
        if (t >= T - 1e-9) break;
      }

      doCast(skill);
      idx = (idx + 1) % order.length;
    } else {
      let found = -1;
      for (let off = 0; off < order.length; off += 1) {
        const skill = order[(idx + off) % order.length];
        if (!prereqOk(skill, t, ctx, nextReady, prereqOptions)) continue;
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
          const nt = nextCastableTime(skill, t, ctx, nextReady, prereqOptions);
          if (nt < nextT) nextT = nt;
        }

        if (!Number.isFinite(nextT) || nextT <= t + EPS) {
          events.push({
            type: "vacuum",
            start: t,
            end: Math.min(T, t),
            duration: 0,
            note: "动态排轴无法推进：当前无可施放技能（可能因飞天联动前置未满足且无飞天可施放）。",
          });
          break;
        }

        const endVac = Math.min(nextT, T);
        events.push({ type: "vacuum", start: t, end: endVac, duration: endVac - t });
        t = nextT;
      }
    }

    if (Math.abs(t - lastT) < EPS) stagnantCount += 1;
    else {
      stagnantCount = 0;
      lastT = t;
    }

    if (stagnantCount > order.length * 120) {
      events.push({
        type: "vacuum",
        start: t,
        end: Math.min(T, t),
        duration: 0,
        note: "检测到时间长期不推进（大量0秒占用/跳过循环）。请补齐“霸体时间”或调整排轴/前置条件。",
      });
      break;
    }
  }

  if (guard >= 300000) {
    events.push({
      type: "vacuum",
      start: Math.min(t, T),
      end: T,
      duration: Math.max(0, T - t),
      note: "触发安全退出：事件数过多。",
    });
  }

  const merged = mergeVacuumAndSkips(events);
  const annotated = annotateDeath(merged, rules.deathThreshold);
  return {
    events: annotated,
    stats: summarizeEvents(annotated, T),
    error: null,
  };
}
