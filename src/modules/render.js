import { DB, buildSkillIndex, collectOrderedFromSelected, effectiveCd, state } from './state.js';
import { applyExclusiveOnSelect, enforceMutualExclusion, enforceRequiredSkills, isMiaoyinRequiredSkill } from './rules.js';

export const $ = (id) => document.getElementById(id);
export const fmt = (t) => { const s = (Math.round(t * 100) / 100).toFixed(2); return s.endsWith('.00') ? s.slice(0, -3) : s.replace(/0$/, ''); };
export function setActiveStep(n) { for (let i = 1; i <= 5; i++) { $(`pill${i}`).classList.toggle('active', i === n); $(`step${i}`).classList.toggle('hidden', i !== n); } }

export function renderModeOptions() {
  const sel = $('modeSelect'); sel.innerHTML = '';
  DB.modes.forEach((m) => { const opt = document.createElement('option'); opt.value = m.id; opt.textContent = `${m.name}（${m.duration}s）`; sel.appendChild(opt); });
  sel.addEventListener('change', () => { const m = DB.modes.find((x) => x.id === sel.value); $('modeDuration').value = m ? m.duration : 120; });
  sel.value = DB.modes[0].id; $('modeDuration').value = DB.modes[0].duration;
}

export function renderProfOptions() {
  const sel = $('profSelect'); sel.innerHTML = '';
  DB.meta.profession_sheets.forEach((p) => { const opt = document.createElement('option'); opt.value = p; opt.textContent = p; sel.appendChild(opt); });
  sel.value = DB.meta.profession_sheets[0] || '';
}

export function renderSkillPicker() {
  state.skillIndex = buildSkillIndex(state.prof); enforceRequiredSkills(); enforceMutualExclusion();
  const container = $('skillContainer'); container.innerHTML = '';
  const search = ($('skillSearch').value || '').trim().toLowerCase();
  const grouped = new Map();
  for (const s of state.skillIndex.values()) { if (search && !s.name.toLowerCase().includes(search)) continue; if (!grouped.has(s.source)) grouped.set(s.source, []); grouped.get(s.source).push(s); }
  if (!grouped.size) { const empty = document.createElement('div'); empty.className = 'warn'; empty.textContent = '没有匹配到技能（请清空搜索关键词或检查数据）。'; container.appendChild(empty); return; }

  for (const [src, arr] of grouped.entries()) {
    arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    const sec = document.createElement('div'); sec.className = 'skill-section';
    sec.innerHTML = `<h3>${src === state.prof ? `职业：${src}` : `通用：${src}`}（${arr.length}）</h3>`;
    const list = document.createElement('div'); list.className = 'skill-list';
    for (const s of arr) {
      const willLoopTrap = !((s.cast ?? 0) > 0) && !(effectiveCd(s) > 0);
      const item = document.createElement('div'); item.className = `skill-item${willLoopTrap ? ' disabled' : ''}`;
      const cb = document.createElement('input'); cb.type = 'checkbox';
      const required = isMiaoyinRequiredSkill(s); if (required) state.selectedKeys.add(s.key);
      cb.checked = state.selectedKeys.has(s.key); cb.disabled = willLoopTrap || required;
      cb.addEventListener('change', () => { if (cb.checked) { state.selectedKeys.add(s.key); applyExclusiveOnSelect(s); } else state.selectedKeys.delete(s.key); renderSkillPicker(); });
      const meta = document.createElement('div');
      meta.innerHTML = `<div><span>${s.name}</span><span class="badge">${src}</span></div><small>冷却：<span class="mono">${fmt(effectiveCd(s))}</span>s ｜ 霸体：<span class="mono">${(s.cast ?? 0) > 0 ? s.cast : 0}</span>s${s.note ? ` ｜ 备注：${s.note}` : ''}</small>`;
      item.appendChild(cb); item.appendChild(meta); list.appendChild(item);
    }
    sec.appendChild(list); container.appendChild(sec);
  }
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

export function renderResults(eventsAll) {
  const tbody = $('resultTable').querySelector('tbody'); tbody.innerHTML = '';
  const { events } = applyNoCastFilter(eventsAll);
  const stats = state.stats || {};
  const modeName = DB.modes.find((m) => m.id === state.modeId)?.name || state.modeId;
  const T = Number(state.modeDuration);
  const schedLine = state.schedMode === 'dynamic' ? '动态' : '严格';
  const vacuum = Number(stats.vacuum ?? 0);
  const pct = Number(stats.vacuumPct ?? (T > 0 ? (vacuum / T) * 100 : 0));
  const skillCount = Number(stats.skillCount ?? 0);
  const skipCount = Number(stats.skipCount ?? 0);
  const maxVac = Number(stats.maxVac ?? 0);
  const deathCount = Number(stats.deathCount ?? 0);
  const firstDeathStart = stats.firstDeathStart;
  const wood3ProcCount = Number(stats.wood3ProcCount ?? 0);

  const th = Number(state.deathThreshold) || 0;
  const deathLine = (th > 0)
    ? ` ｜ 死亡阈值：<b>${fmt(th)}s</b> ｜ 死亡真空段数：<b>${deathCount}</b>${deathCount ? `（首次：<b>${fmt(firstDeathStart)}s</b>）` : ''}`
    : ' ｜ 死亡阈值：<b>未启用</b>';

  const woodLine = (state.woodChoice === 0)
    ? ' ｜ 木周天：<b>未选择</b>'
    : ` ｜ 木周天：<b>${state.woodChoice}木</b>${state.woodChoice === 3 ? `（特效触发：<b>${wood3ProcCount}</b> 次）` : ''}`;

  $('summaryBox').innerHTML =
    `模式：<b>${modeName}</b> ｜ 时长：<b>${T}s</b> ｜ 排轴策略：<b>${schedLine}</b> ｜ 施放次数：<b>${skillCount}</b> ｜ 跳过次数：<b>${skipCount}</b> ｜ 真空总时长：<b>${fmt(vacuum)}s</b>（<b>${fmt(pct)}%</b>） ｜ 最大单段真空：<b>${fmt(maxVac)}s</b>${deathLine}${woodLine}<br/>`
    + `顺序（循环优先级）：<span class="mono">${state.orderedKeys.map((k) => state.skillIndex.get(k)?.name).filter(Boolean).join(' → ')}</span>`;
  events.forEach((e) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="mono">${fmt(e.start)}s</td><td class="mono">${fmt(e.end)}s</td><td>${e.type === 'skill' ? `<b>${e.name}</b>` : e.type === 'skip' ? `<b>跳过：${e.name}</b>` : '<b>真空</b>'}</td><td>${(e.type === 'skill' || e.type === 'skip') ? e.source : '-'}</td><td class="mono">${e.type === 'skill' ? `${fmt(e.cast)}s` : `${fmt(e.duration || 0)}s`}</td><td class="mono">${e.type === 'skill' ? `${fmt(e.cd)}s` : '-'}</td>`;
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
