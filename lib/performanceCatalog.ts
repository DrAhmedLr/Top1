import {COMPETITIVE_CHALLENGE_METRICS} from './competitiveMetrics';
import {activeMetrics, bloodMetricIds, type Metric} from './registry';

export const measurementTracks=['performance','capped','journal'] as const;
export type MeasurementTrack=typeof measurementTracks[number];
const cappedTests=new Set(['sit_to_stand','single_leg_balance','vo2_max']);

export function measurementTrack(id:string):MeasurementTrack {
  if(COMPETITIVE_CHALLENGE_METRICS.has(id)) return 'performance';
  return cappedTests.has(id)?'capped':'journal';
}

const sections = [
  {id: 'bodyweight', name: ['Bodyweight', 'Poids du corps', 'وزن الجسم'], ids: ['pushups', 'sit_to_stand', 'single_leg_balance', 'dead_hang', 'pullups', 'dips', 'broad_jump', 'cmj']},
  {id: 'gym', name: ['Gym strength', 'Force en salle', 'القوة في النادي'], ids: ['bench_1rm', 'squat_1rm', 'deadlift_1rm', 'grip_strength', 'pullup_1rm']},
  {id: 'cardio', name: ['Running & cardio', 'Course et cardio', 'الجري والكارديو'], ids: ['run_5k', 'sprint_400m', 'vo2_max', 'zone2_power']},
  {id: 'body', name: ['Body measurements', 'Mesures corporelles', 'قياسات الجسم'], ids: ['waist_height_ratio', 'body_fat', 'bp_systolic']},
  {id: 'recovery', name: ['Recovery', 'Récupération', 'التعافي'], ids: ['total_sleep', 'rhr', 'hrv', 'hrr_1min', 'sleep_efficiency', 'circadian_regularity', 'reaction_time']},
  {id: 'blood', name: ['Blood tests', 'Analyses sanguines', 'تحاليل الدم'], ids: ['fasting_glucose', 'hba1c', 'apob', 'lpa', 'hscrp', 'fasting_insulin', 'ggt', 'cystatin_c', 'homocysteine']},
] as const;

export type PerformanceCategoryId = typeof sections[number]['id'];

function fallbackCategory(metric: Metric): PerformanceCategoryId {
  if (bloodMetricIds.includes(metric.id)) return 'blood';
  if (metric.pillar === 'recovery') return 'recovery';
  if (/^(run|sprint|swim|cycle|cycling|row|rowing|walk|vo2|zone2)_/.test(metric.id)) return 'cardio';
  if (metric.pillar === 'bodymarkers') return 'body';
  return metric.tier === 'tier1_everyday' ? 'bodyweight' : 'gym';
}

/** The registry controls availability. The curated lists only set placement and order. */
export function buildPerformanceCatalog(registry: readonly Metric[]) {
  const available = new Map<string, Metric>();
  for (const metric of registry) {
    if (!metric.archived && !available.has(metric.id)) available.set(metric.id, metric);
  }

  const groups = sections.map(section => {
    const metrics: Metric[] = [];
    for (const id of section.ids) {
      const metric = available.get(id);
      if (metric) {
        metrics.push(metric);
        available.delete(id);
      }
    }
    return {id: section.id, name: section.name, metrics};
  });

  const byCategory = new Map(groups.map(group => [group.id, group]));
  for (const metric of available.values()) {
    byCategory.get(fallbackCategory(metric))!.metrics.push(metric);
  }

  return {
    categories: groups.map(group => ({...group, ids: group.metrics.map(metric => metric.id)})),
    order: groups.flatMap(group => group.metrics),
  };
}

export const {categories: performanceCategories, order: performanceOrder} = buildPerformanceCatalog(activeMetrics);
