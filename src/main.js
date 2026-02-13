import { buildSkillIndex, collectOrderedFromSelected, DB, effectiveCd, resetAll, state } from './modules/state.js';
import { enforceMutualExclusion, enforceRequiredSkills } from './modules/rules.js';
import { $, applyNoCastFilter, buildPlainText, exportCSV, prepareForOrderStep, renderModeOptions, renderOrderList, renderProfOptions, renderResults, renderSkillPicker, setActiveStep } from './modules/render.js';
import { generateSchedule } from './modules/scheduler.js';

function getWoodChoice() { const checked = document.querySelector('input[name="wood"]:checked'); return checked ? Number(checked.value) : 0; }
function getSchedMode() { const checked = document.querySelector('input[name="sched"]:checked'); return checked ? checked.value : 'strict'; }

function init() {
  $('filterNoCast')?.addEventListener('change', () => { if (state.events?.length) renderResults(state.events); });
  renderModeOptions();
  renderProfOptions();

  document.querySelectorAll('input[name="wood"]').forEach((r) => r.addEventListener('change', () => { state.woodChoice = getWoodChoice(); renderSkillPicker(); if (!$('step4').classList.contains('hidden')) renderOrderList(); }));
  document.querySelectorAll('input[name="sched"]').forEach((r) => r.addEventListener('change', () => { state.schedMode = getSchedMode(); }));

  $('toStep2').addEventListener('click', () => { state.modeId = $('modeSelect').value; state.modeDuration = Number($('modeDuration').value) || 120; state.deathThreshold = Math.max(0, Number($('deathThreshold').value) || 0); setActiveStep(2); });
  $('back1').addEventListener('click', () => setActiveStep(1));
  $('toStep3').addEventListener('click', () => { state.prof = $('profSelect').value; state.woodChoice = getWoodChoice(); renderSkillPicker(); setActiveStep(3); });
  $('back2').addEventListener('click', () => setActiveStep(2));
  $('skillSearch').addEventListener('input', () => renderSkillPicker());

  $('selectAll').addEventListener('click', () => {
    const search = ($('skillSearch').value || '').trim().toLowerCase();
    for (const s of state.skillIndex.values()) {
      if (search && !s.name.toLowerCase().includes(search)) continue;
      if (!((s.cast ?? 0) > 0) && !(effectiveCd(s) > 0)) continue;
      state.selectedKeys.add(s.key);
    }
    enforceMutualExclusion();
    renderSkillPicker();
  });
  $('clearAll').addEventListener('click', () => { state.selectedKeys.clear(); state.orderedKeys = []; enforceRequiredSkills(); renderSkillPicker(); });

  $('toStep4').addEventListener('click', () => { prepareForOrderStep(); renderOrderList(); setActiveStep(4); });
  $('back3').addEventListener('click', () => setActiveStep(3));

  $('calc').addEventListener('click', () => {
    enforceRequiredSkills(); collectOrderedFromSelected(); if (!state.orderedKeys.length) return renderOrderList();
    state.modeDuration = Number($('modeDuration').value) || state.modeDuration || 120;
    state.deathThreshold = Math.max(0, Number($('deathThreshold').value) || 0);
    state.woodChoice = getWoodChoice(); state.schedMode = getSchedMode();
    state.events = generateSchedule(); if (!state.events.length) return;
    renderResults(state.events); setActiveStep(5);
  });

  $('copyText').addEventListener('click', async () => {
    const text = buildPlainText(applyNoCastFilter(state.events || []).events);
    try { await navigator.clipboard.writeText(text); alert('已复制到剪贴板'); }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); alert('已复制到剪贴板（兼容模式）'); }
  });
  $('exportCsv').addEventListener('click', () => exportCSV(applyNoCastFilter(state.events || []).events));
  $('restart').addEventListener('click', () => { setActiveStep(1); resetAll(); $('skillSearch').value = ''; renderSkillPicker(); });

  state.prof = $('profSelect').value;
  state.skillIndex = buildSkillIndex(state.prof);
  state.woodChoice = getWoodChoice();
  state.schedMode = getSchedMode();
  renderSkillPicker();
}

init();
