export const RELATION_TYPE = Object.freeze({
  PREREQUISITE: '前置',
  REPLACEMENT: '替换技能',
  MUTEX: '互斥',
  SHARED_DURATION: '共享时间',
  SHARED_COOLDOWN: '共享冷却',
  WINDOW: '窗口期',
});

const RULES = Object.freeze([
  {
    from_id: '飞天·莲心',
    to_id: '飞天',
    relation_type: RELATION_TYPE.WINDOW,
    param: { seconds: 20, aliases: ['飞天莲心', '飞天.莲心', '飞天 莲心'] },
    scope: { profession: '妙音' },
  },
  {
    from_id: '逐月·乘风',
    to_id: '飞天',
    relation_type: RELATION_TYPE.WINDOW,
    param: { seconds: 20, aliases: ['逐月乘风', '逐月.乘风', '逐月 乘风'], blocked_after: '飞天·莲心' },
    scope: { profession: '妙音' },
  },
  {
    from_id: '飞天·莲心',
    to_id: '飞天',
    relation_type: RELATION_TYPE.REPLACEMENT,
    param: { seconds: 20, anchor_aliases: ['飞天'], target_aliases: ['飞天莲心', '飞天.莲心', '飞天 莲心'] },
    scope: { profession: '妙音' },
  },
  {
    from_id: '俯仰太虚',
    to_id: '逐月',
    relation_type: RELATION_TYPE.PREREQUISITE,
    param: { mode: 'target_on_cooldown', aliases: ['俯仰太虚·灵韵', '俯仰太虚灵韵', '俯仰太虚.灵韵', '俯仰太虚 灵韵'] },
    scope: { profession: '妙音' },
  },
  { from_id: '莲步盈华', to_id: '莲步盈华·并蒂', relation_type: RELATION_TYPE.MUTEX, param: null, scope: null },
  { from_id: '俯仰太虚', to_id: '俯仰太虚·灵韵', relation_type: RELATION_TYPE.MUTEX, param: { source: '内功' }, scope: null },
  { from_id: '纳百观', to_id: '纳百观·灵韵', relation_type: RELATION_TYPE.MUTEX, param: { source: '内功' }, scope: null },
]);

export const REQUIRED_SKILLS_BY_PROF = Object.freeze({
  妙音: Object.freeze([
    { id: '逐月', aliases: ['逐月'] },
    { id: '逐月·乘风', aliases: ['逐月·乘风', '逐月乘风', '逐月.乘风', '逐月 乘风'] },
    { id: '飞天', aliases: ['飞天'] },
    { id: '飞天·莲心', aliases: ['飞天·莲心', '飞天莲心', '飞天.莲心', '飞天 莲心'] },
  ]),
});

export function getRulesForProfession(profession) {
  return RULES.filter((rule) => !rule.scope?.profession || rule.scope.profession === profession);
}

export { RULES };
