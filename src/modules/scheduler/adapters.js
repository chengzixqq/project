import { getRulesForProfession } from '../../data/rules.js';

export function buildSchedulerInputFromState(state, options) {
  const { effectiveCd } = options;

  const modeDuration = Number(state.modeDuration);
  const orderedSkills = state.orderedKeys
    .map((key) => state.skillIndex.get(key))
    .filter(Boolean)
    .map((skill) => ({
      key: skill.key,
      id: skill.id,
      name: skill.name,
      source: skill.source,
      cast: Math.max(0, Number(skill.cast ?? 0)),
      duration: Math.max(0, Number(skill.duration ?? 0)),
      cd: Number(effectiveCd(skill, state.prof, state.woodChoice) ?? 0),
    }));

  return {
    modeDuration,
    skills: orderedSkills,
    rules: {
      profession: state.prof,
      woodChoice: state.woodChoice,
      deathThreshold: Number(state.deathThreshold) || 0,
      relations: getRulesForProfession(state.prof),
    },
    strategy: state.schedMode,
  };
}
