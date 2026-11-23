import {doseKey, goalMetrics, goalValue, scenarioResult, sessionResult, type AdaptivePlan, type Scenario} from './adaptiveProgram';
import {guidedAdherenceScenario, illustrativeGain} from './guidedAdherence';
import {latestObservation, observationDate, type Observation} from './history';
import type {MeasurementMetadata} from './measurementMetadata';
import {overallPerformance} from './overallPerformance';
import {performanceProfileAtTest, withPerformanceProfile} from './performanceContext';
import {PERFORMANCE_RULES} from './performanceRules';
import {personalForecast} from './personalForecast';
import {recentPaceForecast} from './recentGoalPace';
import {guidedGoalEvidence} from './goalAttempts';
import type {Demographics, Values} from './registry';
import type {Workout} from './training';

export const GOAL_MODEL_VERSION = 'goal-paths-v3';

export function scenarioAssumptions(plan:AdaptivePlan):{source:'saved'|'illustrative'; assumptions:Scenario} {
  const {config, prescription} = plan;
  const dose = doseKey(config, prescription);
  if (config.scenario?.dose === dose) return {source:'saved', assumptions:config.scenario};
  return {source:'illustrative', assumptions:{dose, gain:illustrativeGain(config), response:50, attendance:80}};
}

export type InsightInputs = {
  values:Values; details:MeasurementMetadata; profile?:Demographics; plan?:AdaptivePlan|null;
  entries:Observation[]; today:string; now?:number;
};

export function performanceInsights({values, details, profile, plan, entries, today, now = Date.now()}:InsightInputs, sharedPerformance?:ReturnType<typeof overallPerformance>) {
  const performance = sharedPerformance ?? overallPerformance(values, details, profile, now);
  const base = {version:GOAL_MODEL_VERSION, performance};
  if (!plan) return {...base, goal:null};
  const {config} = plan;
  const metric = goalMetrics.find(item => item.id === config.metric)!;
  const history = entries.filter(entry => entry.metricId === metric.id && Date.parse(entry.recordedAt) <= now && Date.parse(observationDate(entry)) <= now);
  const latest = latestObservation(history);
  const observed = latest && Date.parse(observationDate(latest)) >= Date.parse(config.createdAt) &&
    Date.parse(observationDate(latest)) <= now ? latest : undefined;
  const guidedEvidence=config.guidedVersion===1 ? guidedGoalEvidence(plan,history,now) : null;
  const current = guidedEvidence ? guidedEvidence.current :
    (observed && goalValue(metric, config.goalUnit, observed.value ?? undefined, observed)) ?? config.baseline;

  const {source, assumptions} = scenarioAssumptions(plan);
  const simulation = scenarioResult({...plan, config:{...config, scenario:assumptions}}, current, today);
  const scenario = simulation ? {...simulation, source, assumptions} : null;
  const personal = personalForecast(plan, guidedEvidence?.entries ?? history, current, today, 'program');
  const recentPace=recentPaceForecast(plan,guidedEvidence?.entries ?? history,current,today,now);
  const adherenceEvidence = guidedEvidence ? personalForecast(plan, guidedEvidence.entries, current, today, 'adherent-program') : null;
  const loggedToday = plan.sessions.some(event => sessionResult(event.data as Workout)?.day === today);
  const adherence = adherenceEvidence?.kind === 'ready' && adherenceEvidence.targetSensitivity ?
    {kind:'personal' as const, probability:adherenceEvidence.probability, ...adherenceEvidence.targetSensitivity,
      sessions:adherenceEvidence.remainingSessions, intervals:adherenceEvidence.intervals} :
    guidedAdherenceScenario(config,today,current,loggedToday);
  if (adherence?.kind === 'illustrative' && adherenceEvidence?.kind === 'unavailable') adherence.intervals=adherenceEvidence.intervals;
  // Change only the target test. Preserve its scoring context while never using
  // the actual measurement's raw calculation inputs as proof of a hypothetical lift.
  const context = performanceProfileAtTest(profile, details[metric.id]);
  const target = config.goalUnit === 'kg' ? (context.weight ? config.target / context.weight : undefined) : config.target;
  let atTargetPercent:number|null = null;
  if (target !== undefined && PERFORMANCE_RULES[metric.id] && !details[metric.id]?.invalidContext) {
    const targetDetails = withPerformanceProfile(metric.id, {}, context);
    const projected = overallPerformance({...values, [metric.id]:target}, {...details, [metric.id]:targetDetails}, profile, now);
    if (projected.areas.some(area => area.tests.some(test => test.id === metric.id))) atTargetPercent = projected.overall?.percent ?? null;
  }
  return {...base, goal:{planId:plan.event.id, metric:metric.id, current, scenario, personal, adherence, recentPace, atTargetPercent}};
}

export type PerformanceInsights = ReturnType<typeof performanceInsights>;
