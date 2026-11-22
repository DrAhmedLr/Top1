import {challengeStanding, COMPETITIVE_CHALLENGE_METRICS} from './challengeProgress';
import {authoritativeMeasurementDetails, type MeasurementDetails, type MeasurementMetadata} from './measurementMetadata';
import {performanceTier} from './performanceTiers';
import {performanceProfileAtTest} from './performanceContext';
import type {Demographics, Values} from './registry';

export const OVERALL_PERFORMANCE_VERSION = 'overall-performance-v2';
export const performanceAreas = {
  push: ['pushups', 'bench_1rm', 'dips'],
  pull: ['pullups', 'pullup_1rm', 'grip_strength', 'dead_hang'],
  lower: ['squat_1rm', 'deadlift_1rm', 'cmj', 'broad_jump'],
  running: ['run_5k', 'sprint_400m'],
} as const;
export type PerformanceArea = keyof typeof performanceAreas;

/** Equal area weights are a game rule. Log points describe the difficulty of
 * milestones; they carry no population frequency or independence assumption. */
export function overallPerformance(values:Values, details:MeasurementMetadata, profile?:Demographics, now=Date.now()) {
  const areas = (Object.keys(performanceAreas) as PerformanceArea[]).map(area => {
    const tests = performanceAreas[area].flatMap(id => {
      const value = values[id];
      if (value === undefined) return [];
      const detail = details[id] ?? {};
      try {
        authoritativeMeasurementDetails({[id]:value}, {[id]:detail}, now);
      } catch {
        return [];
      }
      const result = challengeStanding(id, value, performanceProfileAtTest(profile, detail));
      if (!result || result.modelTopPercent === undefined) return [];
      const percent = result.modelTopPercent;
      return [{id, tier:result.tier, percent, points:Math.log10(100 / percent)}];
    });
    const points = tests.length ? tests.reduce((sum,test) => sum + test.points, 0) / tests.length : null;
    return {area, tests, points, tier:points === null ? null : performanceTier(100 * 10 ** -points)};
  });
  const points = areas.flatMap(area => area.points === null ? [] : [area.points]);
  const coverage = points.length;
  const testCount = areas.reduce((sum,area) => sum + area.tests.length, 0);
  const base = {version:OVERALL_PERFORMANCE_VERSION, coverage, testCount, areas};
  if (!coverage) return {...base, overall:null};
  const mean = points.reduce((sum,n) => sum + n, 0) / points.length;
  const bestAllowed = Math.min(...points) + 1;
  const score = Math.min(mean, bestAllowed);
  const percent=Number((100 * 10 ** -score).toPrecision(12));
  return {...base, overall:{points:score, percent, tier:performanceTier(percent), limitedByWeakest:mean > bestAllowed}};
}

export type OverallSaveChange={
  previous:number|null;
  current:number;
  coverage:number;
  testCount:number;
};

/** Describe exactly this write using the same rules as the Ranking view.
 * An update replaces that test's current value. It never counts a retest twice. */
export function overallChangeForSave(id:string, value:number, detail:MeasurementDetails, values:Values,
  details:MeasurementMetadata, beforeProfile?:Demographics, afterProfile=beforeProfile, now=Date.now()):OverallSaveChange|null {
  if (!COMPETITIVE_CHALLENGE_METRICS.has(id)) return null;
  const before=overallPerformance(values,details,beforeProfile,now);
  const after=overallPerformance({...values,[id]:value},{...details,[id]:detail},afterProfile,now);
  if (!after.overall || !after.areas.some(area=>area.tests.some(test=>test.id===id))) return null;
  return {previous:before.overall?.percent??null,current:after.overall.percent,coverage:after.coverage,testCount:after.testCount};
}
