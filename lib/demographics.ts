import { metrics, type Demographics } from './registry';

export const ageBrackets = ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70+'] as const;
export type AgeBracket = typeof ageBrackets[number];
export interface MetricCohortNorm {
  mean: number;
  stdDev: number;
  lms?: { L: number; M: number; S: number };
  boundedOptimal?: { minOptimal: number; maxOptimal: number };
  benchmark?: number;
  provenance: 'published' | 'provisional';
  source?: string;
  sourceAgeRange?: [number,number];
  method?: string;
}
export interface DemographicLookup {
  [metricId: string]: {
    male: { [bracket in AgeBracket]: MetricCohortNorm };
    female: { [bracket in AgeBracket]: MetricCohortNorm };
  };
}

// No dataset was supplied with the brief. These LMS fits are provisional model
// parameters, not estimates extracted from the registry's contextual citations.
export const skewedDefaults = {
  apob: { L: .2, M: 95, S: .26 },
  fasting_insulin: { L: 0, M: 9, S: .52 },
  hscrp: { L: 0, M: 1.5, S: .70 },
  visceral_fat: { L: .1, M: 85, S: .50 },
  lpa: { L: 0, M: 35, S: .90 },
  ggt: { L: .1, M: 28, S: .50 },
} satisfies Record<string, { L: number; M: number; S: number }>;

const strength = {
  squat_1rm: { male: 2.25, female: 1.65, mean: 1.1 },
  deadlift_1rm: { male: 2.55, female: 1.95, mean: 1.35 },
  bench_1rm: { male: 1.65, female: 1.05, mean: .8 },
};
// FRIEND 2015 Table 4: directly measured treadmill CPET, US adults without CVD.
// These are cohort means/SDs, not global norms or a wearable-estimate calibration.
const friend2015 = {
  male: [[47.6,11.3],[43,9.9],[38.8,9.6],[33.8,9.1],[29.4,7.9],[25.8,7.1]],
  female: [[37.6,10.2],[30.9,8],[27.9,7.7],[24.2,6.1],[20.7,5],[18.3,3.6]],
};

export function getAgeBracket(age: number): AgeBracket {
  if (!Number.isFinite(age) || age < 18) throw new RangeError('Reference cohorts require age 18 or older.');
  if (age >= 70) return '70+';
  if (age < 25) return '18-24';
  return ageBrackets[1 + Math.floor((age - 25) / 5)];
}

// Materialize metric/sex/age cells, including preserved legacy inputs. Unspecified cohorts retain V1
// parameters without inventing age or sex effects. VO2 uses published decade cohorts; other effects remain assumptions.
export const demographicLookup: DemographicLookup = Object.fromEntries(metrics.map(metric => {
  const cohorts = Object.fromEntries((['male', 'female'] as const).map(sex => [sex,
    Object.fromEntries(ageBrackets.map(bracket => {
      const norm: MetricCohortNorm = { mean: metric.mean, stdDev: metric.sd, provenance: 'provisional' };
      if (metric.optimal) norm.boundedOptimal = { minOptimal: metric.optimal[0], maxOptimal: metric.optimal[1] };
      if (metric.id in skewedDefaults) norm.lms = { ...skewedDefaults[metric.id as keyof typeof skewedDefaults] };
      if (metric.id === 'vo2_max') {
        const age = Number.parseInt(bracket, 10);
        const decade = Math.min(5, Math.max(0, Math.floor((age - 20) / 10)));
        [norm.mean,norm.stdDev] = friend2015[sex][decade];
        norm.provenance = 'published';
        norm.source = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/';
        norm.sourceAgeRange = [20,79];
        norm.method = 'Direct treadmill CPET; FRIEND 2015, no cardiovascular disease';
      }
      if (metric.id === 'grip_strength') {
        norm.mean = sex === 'male' ? 48 : 31;
        norm.stdDev = sex === 'male' ? 7.5 : 5.2;
        norm.provenance = 'provisional';
      }
      if (metric.id in strength) {
        const lift = strength[metric.id as keyof typeof strength];
        const scale = lift[sex] / lift.male;
        norm.mean = lift.mean * scale;
        norm.stdDev = metric.sd * scale;
        norm.benchmark = lift[sex];
        // Sex scaling is an explicit product assumption; no P99 is implied.
      }
      return [bracket, norm];
    }))
  ]));
  return [metric.id, cohorts];
})) as DemographicLookup;

export function getMetricCohortNorm(metricId: string, profile: Pick<Demographics, 'age' | 'sex'>): MetricCohortNorm {
  const cohorts = demographicLookup[metricId];
  if (!cohorts) throw new RangeError(`Unknown metric: ${metricId}`);
  if (profile.sex !== 'male' && profile.sex !== 'female') throw new RangeError('Unsupported biological sex cohort.');
  const norm=cohorts[profile.sex][getAgeBracket(profile.age)];
  if(norm.sourceAgeRange&&(profile.age<norm.sourceAgeRange[0]||profile.age>norm.sourceAgeRange[1]))return {...norm,provenance:'provisional',source:undefined,method:'Outside published cohort age range'};
  return norm;
}

export function getMetricBenchmark(metricId: string, profile: Pick<Demographics, 'age' | 'sex'>): string {
  const metric=metrics.find(metric=>metric.id===metricId);
  if(!metric)throw new RangeError(`Unknown metric: ${metricId}`);
  if(!metric.scoringEligible)return 'Context required · tracked without scoring';
  if(metricId==='vo2_max')return 'Direct treadmill CPET reference · ages 20–79';
  const norm = getMetricCohortNorm(metricId, profile);
  if (norm.boundedOptimal) return `${norm.boundedOptimal.minOptimal}–${norm.boundedOptimal.maxOptimal}`;
  if (norm.benchmark !== undefined) return `≥ ${Number(norm.benchmark.toFixed(2))}`;
  return metrics.find(metric => metric.id === metricId)!.target;
}
