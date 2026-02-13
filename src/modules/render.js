import { DB, buildSkillIndex, collectOrderedFromSelected, effectiveCd, getProfessionOptions, state } from './state.js';
import { applyExclusiveOnSelect, enforceMutualExclusion, enforceRequiredSkills, isMiaoyinRequiredSkill } from './rules.js';

export const $ = (id) => document.getElementById(id);
export const fmt = (t) => { const s = (Math.round(t * 100) / 100).toFixed(2); return s.endsWith('.00') ? s.slice(0, -3) : s.replace(/0$/, ''); };
export function setActiveStep(n) {
  const next = Math.max(1, Math.min(5, Number(n) || 1));
  state.currentStep = next;
  state.maxVisitedStep = Math.max(state.maxVisitedStep || 1, next);
  for (let i = 1; i <= 5; i++) {
    const pill = $(`pill${i}`);
    pill.classList.toggle('active', i === next);
    pill.classList.toggle('clickable', i <= state.maxVisitedStep);
    $(`step${i}`).classList.toggle('hidden', i !== next);
  }
}

export function renderModeOptions() {
  const sel = $('modeSelect'); sel.innerHTML = '';
  DB.modes.forEach((m) => { const opt = document.createElement('option'); opt.value = m.id; opt.textContent = `${m.name}（${m.duration}s）`; sel.appendChild(opt); });
  sel.addEventListener('change', () => { const m = DB.modes.find((x) => x.id === sel.value); $('modeDuration').value = m ? m.duration : 120; });
  sel.value = DB.modes[0].id; $('modeDuration').value = DB.modes[0].duration;
}

export function renderProfOptions() {
  const sel = $('profSelect'); sel.innerHTML = '';
  const professions = getProfessionOptions();
  professions.forEach((p) => { const opt = document.createElement('option'); opt.value = p; opt.textContent = p; sel.appendChild(opt); });
  const fallback = professions[0] || '';
  if (!professions.includes(state.prof)) state.prof = fallback;
  sel.value = state.prof || fallback;
}

export function renderSkillPicker() {
  state.skillIndex = buildSkillIndex(state.prof); enforceRequiredSkills(); enforceMutualExclusion();
  const container = $('skillContainer'); container.innerHTML = '';
  const search = ($('skillSearch').value || '').trim().toLowerCase();
  const grouped = new Map();

  for (const s of state.skillIndex.values()) {
    if (search && !s.name.toLowerCase().includes(search)) continue;
    const bucket = s.bucket || '通用';
    const src = s.source || bucket;
    const groupKey = `${bucket}::${src}`;
    if (!grouped.has(groupKey)) grouped.set(groupKey, { bucket, src, skills: [] });
    grouped.get(groupKey).skills.push(s);
  }

  if (!grouped.size) {
    const empty = document.createElement('div');
    empty.className = 'warn';
    empty.textContent = '没有匹配到技能（请清空搜索关键词或检查数据）。';
    container.appendChild(empty);
    return;
  }

  for (const { bucket, src, skills: arr } of grouped.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    const sec = document.createElement('div'); sec.className = 'skill-section';
    const groupLabel = src && src !== bucket ? `${bucket}/${src}` : bucket;
    sec.innerHTML = `<h3>${groupLabel}（${arr.length}）</h3>`;

    const list = document.createElement('div'); list.className = 'skill-list';
    for (const s of arr) {
      const willLoopTrap = !((s.cast ?? 0) > 0) && !(effectiveCd(s) > 0);
      const required = isMiaoyinRequiredSkill(s);
      if (required) state.selectedKeys.add(s.key);

      const isSelected = state.selectedKeys.has(s.key);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `skill-item${isSelected ? ' selected' : ''}${willLoopTrap ? ' disabled' : ''}${required ? ' required' : ''}`;
      item.disabled = willLoopTrap;
      item.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      const marker = document.createElement('span');
      marker.className = `skill-marker${isSelected ? ' checked' : ''}`;
      marker.textContent = isSelected ? '✓' : '';

      const meta = document.createElement('div');
      meta.className = 'skill-meta';
      const statusLabel = required ? '<span class="badge blue">必带</span>' : '';
      meta.innerHTML = `<div><span>${s.name}</span><span class="badge">${src}</span>${statusLabel}</div><small>冷却：<span class="mono">${fmt(effectiveCd(s))}</span>s ｜ 霸体：<span class="mono">${(s.cast ?? 0) > 0 ? s.cast : 0}</span>s${s.note ? ` ｜ 备注：${s.note}` : ''}</small>`;

      item.appendChild(marker);
      item.appendChild(meta);

      if (!required && !willLoopTrap) {
        item.addEventListener('click', () => {
          if (state.selectedKeys.has(s.key)) state.selectedKeys.delete(s.key);
          else {
            state.selectedKeys.add(s.key);
            applyExclusiveOnSelect(s);
          }
          renderSkillPicker();
        });
      }

      list.appendChild(item);
    }

    sec.appendChild(list);
    container.appendChild(sec);
  }
}

export function sortOrderByCd(direction = 'asc') {
  if (!state.orderedKeys.length) return;
  const sign = direction === 'desc' ? -1 : 1;
  state.orderedKeys.sort((ka, kb) => {
    const a = state.skillIndex.get(ka);
    const b = state.skillIndex.get(kb);
    const cdA = Number(effectiveCd(a) ?? 0);
    const cdB = Number(effectiveCd(b) ?? 0);
    if (cdA !== cdB) return (cdA - cdB) * sign;
    const castA = Number(a?.cast ?? 0);
    const castB = Number(b?.cast ?? 0);
    if (castA !== castB) return (castA - castB) * sign;
    return (a?.name || '').localeCompare((b?.name || ''), 'zh-CN');
  });
}

export function renderOrderList() {
  const box = $('orderList'); box.innerHTML = ''; $('orderEmpty').classList.toggle('hidden', state.orderedKeys.length !== 0);
  state.orderedKeys.forEach((k, idx) => {
    const s = state.skillIndex.get(k); if (!s) return;
    const row = document.createElement('div'); row.className = 'order-row'; row.draggable = true;
    row.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', k));
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.style.borderColor = 'rgba(122,162,255,0.8)'; });
    row.addEventListener('dragleave', () => { row.style.borderColor = 'var(--border)'; });
    row.addEventListener('drop', (e) => { e.preventDefault(); row.style.borderColor = 'var(--border)'; const fromKey = e.dataTransfer.getData('text/plain'); const from = state.orderedKeys.indexOf(fromKey); const to = state.orderedKeys.indexOf(k); if (from >= 0 && to >= 0 && fromKey !== k) { state.orderedKeys.splice(from, 1); state.orderedKeys.splice(to, 0, fromKey); renderOrderList(); } });
    row.innerHTML = `<div><b>${idx + 1}.</b> ${s.name} <span class="badge">${s.source}</span></div><div class="mono">${fmt(effectiveCd(s))}s</div><div class="mono">${(s.cast ?? 0) > 0 ? s.cast : 0}s</div>`;
    const mini = document.createElement('div'); mini.className = 'miniBtns';
    [['↑', idx === 0, () => { [state.orderedKeys[idx - 1], state.orderedKeys[idx]] = [state.orderedKeys[idx], state.orderedKeys[idx - 1]]; renderOrderList(); }], ['↓', idx === state.orderedKeys.length - 1, () => { [state.orderedKeys[idx + 1], state.orderedKeys[idx]] = [state.orderedKeys[idx], state.orderedKeys[idx + 1]]; renderOrderList(); }]].forEach(([t, disabled, fn]) => { const b = document.createElement('button'); b.textContent = t; b.disabled = disabled; b.addEventListener('click', fn); mini.appendChild(b); });
    const del = document.createElement('button'); del.textContent = '移除'; del.className = 'danger'; del.disabled = isMiaoyinRequiredSkill(s); del.addEventListener('click', () => { state.selectedKeys.delete(k); state.orderedKeys = state.orderedKeys.filter((x) => x !== k); renderSkillPicker(); renderOrderList(); }); mini.appendChild(del);
    row.appendChild(mini); box.appendChild(row);
  });
}

const isFilterNoCastOn = () => !!$('filterNoCast')?.checked;
export function applyNoCastFilter(events) { if (!isFilterNoCastOn()) return { events, hidden: 0 }; const filtered = events.filter((e) => !(e.type === 'skill' && !(e.cast > 0))); return { events: filtered, hidden: events.length - filtered.length }; }


function buildSummaryFromEvents(events, totalDuration) {
  let vacuum = 0;
  let maxVac = 0;
  let deathCount = 0;
  let firstDeathStart = null;
  let skillCount = 0;
  let skipCount = 0;
  let wood3ProcCount = 0;

  for (const e of events) {
    if (e.type === 'vacuum') {
      const duration = e.duration || 0;
      vacuum += duration;
      maxVac = Math.max(maxVac, duration);
      if (e.death) {
        deathCount += 1;
        if (firstDeathStart === null || e.start < firstDeathStart) firstDeathStart = e.start;
      }
      continue;
    }
    if (e.type === 'skill') {
      skillCount += 1;
      if (e.wood3Triggered) wood3ProcCount += 1;
      continue;
    }
    if (e.type === 'skip') skipCount += 1;
  }

  return {
    skillCount,
    skipCount,
    vacuum,
    vacuumPct: totalDuration > 0 ? (vacuum / totalDuration) * 100 : 0,
    maxVac,
    deathCount,
    firstDeathStart,
    wood3ProcCount,
  };
}

export function renderResults(eventsAll, stats = null) {
  const tbody = $('resultTable').querySelector('tbody');
  tbody.innerHTML = '';

  const filterOn = isFilterNoCastOn();
  const { events } = applyNoCastFilter(eventsAll);
  const summarySource = filterOn ? events : eventsAll;
  const summary = (!filterOn && stats) ? stats : buildSummaryFromEvents(summarySource, state.modeDuration);
  const schedLine = state.schedMode === 'dynamic' ? '动态' : '严格';
  const deathThreshold = Number(state.deathThreshold) || 0;
  const deathPart = deathThreshold > 0
    ? ` ｜ 死亡阈值：<b>${fmt(deathThreshold)}s</b> ｜ 死亡真空段数：<b>${summary.deathCount}</b>${summary.deathCount > 0 ? `（首次：<b>${fmt(summary.firstDeathStart ?? 0)}s</b>）` : ''}`
    : ' ｜ 死亡阈值：<b>未启用</b>';
  const woodPart = state.woodChoice === 0
    ? ' ｜ 木周天：<b>未选择</b>'
    : ` ｜ 木周天：<b>${state.woodChoice}木</b>${state.woodChoice === 3 ? `（特效触发：<b>${summary.wood3ProcCount || 0}</b>次）` : ''}`;
  const orderLine = state.orderedKeys.map((k) => state.skillIndex.get(k)?.name).filter(Boolean).join(' → ');

  $('summaryBox').innerHTML = `模式：<b>${DB.modes.find((m) => m.id === state.modeId)?.name || state.modeId}</b> ｜ 时长：<b>${state.modeDuration}s</b> ｜ 排轴策略：<b>${schedLine}</b> ｜ 施放次数：<b>${summary.skillCount}</b> ｜ 跳过次数：<b>${summary.skipCount}</b> ｜ 真空总时长：<b>${fmt(summary.vacuum)}s</b>（<b>${fmt(summary.vacuumPct)}%</b>） ｜ 最大单段真空：<b>${fmt(summary.maxVac)}s</b>${deathPart}${woodPart}<br/>顺序（循环优先级）：<span class="mono">${orderLine || '-'}</span>`;

  events.forEach((e) => {
    const tr = document.createElement('tr');
    if (e.type === 'skip') tr.classList.add('skip', 'row-skip');
    if (e.type === 'vacuum') {
      tr.classList.add('vacuum', 'row-vacuum');
      if (e.death === true) tr.classList.add('death', 'row-death');
    }

    let actionText = `<b>${e.name}</b>${e.wood3Triggered ? ' <span class="badge blue">木周天触发</span>' : ''} <span class="muted">（起始秒：${Math.floor(e.start)}）</span>`;
    if (e.type === 'skip') {
      actionText = `<b>跳过：${e.name}</b>`;
    } else if (e.type === 'vacuum') {
      const vacuumLabel = e.death === true ? '死亡真空（单段真空 ≥ 阈值）' : '真空（无可施放技能）';
      actionText = `<b>${vacuumLabel}</b>${e.note ? `<div class="muted">${e.note}</div>` : ''}`;
    }

    tr.innerHTML = `<td class="mono">${fmt(e.start)}s</td><td class="mono">${fmt(e.end)}s</td><td>${actionText}</td><td>${(e.type === 'skill' || e.type === 'skip') ? e.source : '-'}</td><td class="mono">${e.type === 'skill' ? `${fmt(e.cast)}s` : `${fmt(e.duration || 0)}s`}</td><td class="mono">${e.type === 'skill' ? `${fmt(e.cd)}s` : '-'}</td>`;
    tbody.appendChild(tr);
  });
}


export const buildPlainText = (events) => [`模式：${DB.modes.find((m) => m.id === state.modeId)?.name || state.modeId}（${state.modeDuration}s）`, `排轴策略：${state.schedMode}`, `顺序：${state.orderedKeys.map((k) => state.skillIndex.get(k)?.name).filter(Boolean).join(' -> ')}`, '', ...events.map((e) => (e.type === 'skill' ? `[${fmt(e.start)}s] 施放：${e.name}` : `[${fmt(e.start)}s - ${fmt(e.end)}s] ${e.type === 'skip' ? '跳过' : '真空'}`))].join('\n');

export function exportCSV(events) {
  const rows = [['type', 'start_s', 'end_s', 'name', 'source', 'cast_or_vacuum_s', 'cooldown_s_effective']];
  events.forEach((e) => rows.push([e.type, e.start, e.end, e.name || (e.type === 'vacuum' ? '真空' : ''), e.source || '', e.type === 'skill' ? e.cast : (e.duration || 0), e.type === 'skill' ? e.cd : '']));
  const csv = rows.map((r) => r.map((v) => String(v ?? '')).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = '逆水寒_排轴.csv'; document.body.appendChild(a); a.click(); a.remove();
}

export function prepareForOrderStep() { state.skillIndex = buildSkillIndex(state.prof); enforceRequiredSkills(); collectOrderedFromSelected(); }
