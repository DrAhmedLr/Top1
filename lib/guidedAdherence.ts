import {binomialTail, goalMetrics, type AdaptiveConfig} from './adaptiveProgram';
import {countGuidedSessions, isGuidedTrainingDay} from './guidedSchedule';
import {countMetrics} from './measurementRules';
import {goalDate} from './personalGoal';
import {PERFORMANCE_RULES} from './performanceRules';

export function measurementStep(config:AdaptiveConfig) {
  if (config.goalUnit === 'kg' || countMetrics.has(config.metric)) return 1;
  return 1 / (PERFORMANCE_RULES[config.metric]?.ticksPerUnit ?? 10);
}

export function illustrativeGain(config:AdaptiveConfig) {
  const step = measurementStep(config);
  return Number((step * Math.max(1, Math.round(0.01 * config.baseline / step))).toFixed(3));
}

/** Illustrative full-attendance scenario. The response rate and gain are explicit
 * assumptions, not measured effects of a specific exercise or athlete. */
export function guidedAdherenceScenario(config:AdaptiveConfig, today:string, current=config.baseline, alreadyLoggedToday=false) {
  const metric = goalMetrics.find(item => item.id === config.metric);
  if (config.guidedVersion !== 1 || !metric || !Number.isFinite(current) ||
      !goalDate(today) || today > config.deadline) return null;
  const sessions = countGuidedSessions(config, today, config.deadline) -
    Number(alreadyLoggedToday && isGuidedTrainingDay(config, today));
  const gain = illustrativeGain(config);
  const gap = Math.max(0, (config.target - current) * metric.polarity);
  const required = Math.ceil(Number((gap / gain).toFixed(9)));
  const probability = binomialTail(sessions, required, 0.5);
  if (probability === undefined) return null;
  return {kind:'illustrative' as const, sessions, intervals:0, gain, response:50, probability,
    low:binomialTail(sessions, required, 0.4)!, high:binomialTail(sessions, required, 0.6)!};
}
