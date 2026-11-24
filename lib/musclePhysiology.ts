import type {AthleteDossier} from './athleteDossier';
import {
  ALL_MUSCLES,
  EXERCISE_CATALOG,
  matchExerciseByName,
  MUSCLE_META,
  type ExerciseDefinition,
  type MuscleId,
  type MuscleRegion,
} from './exerciseOntology';
import {
  optimizePersonalPhysiology,
  type PersonalPhysiologyCalibration,
} from './selfOptimization';
import type {TrainingEvent, Workout} from './training';
import {
  evaluateWearableReadiness,
  type WearableDailySnapshot,
  type WearableReadinessSignal,
} from './wearableReadiness';

export const MUSCLE_PHYSIOLOGY_VERSION = 'muscle-physiology-v2';

export type MuscleTier =
  | 'unmeasured'
  | 'foundation'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'top1';

export type RecoveryBand = 'fresh' | 'ready' | 'recovering' | 'fatigued';
export type VolumeZone = 'under_mev' | 'optimal_mav' | 'near_mrv' | 'over_mrv';
export type MeasurementConfidence = 'unmeasured' | 'verified' | 'estimated' | 'stale';

export type MuscleState = {
  muscle: MuscleId;
  region: MuscleRegion;
  label: [string, string, string];
  /** Strength / capability standing — NEVER inflated by junk volume or exercise count. */
  capability: {
    tier: MuscleTier;
    /** Normalized 0–100 score from allometric/bodyweight-scaled best valid performance (null if unmeasured). */
    score: number | null;
    confidence: MeasurementConfidence;
    daysSinceMeasured: number | null;
    sourceExercise: string | null;
  };
  /** Local physiological recovery state (0–100%), modeled via fractional set decay + systemic fatigue. */
  recovery: {
    percent: number;
    band: RecoveryBand;
    hoursUntilReady: number;
    lastStimulatedAt: string | null;
    /** Fractional effective sets accumulated over the trailing 72h. */
    acuteSets72h: number;
  };
  /** Trailing 7-day fractional hard sets vs individualized MEV / MAV / MRV landmarks. */
  volume: {
    weeklyEffectiveSets: number;
    mev: number;
    mav: number;
    mrv: number;
    zone: VolumeZone;
  };
  /** True if training this muscle hard today would pre-fatigue a pinned TOP1 goal session within 36h. */
  protectedForUpcomingGoal: boolean;
  /** Composite priority score (0–100) for smart next-session targeting. */
  nextTargetPriority: number;
};

export type StructuralBalanceCheck = {
  id: 'push_pull' | 'quad_hamstring' | 'anterior_posterior_shoulder';
  label: string;
  ratio: number | null;
  idealRange: [number, number];
  status: 'balanced' | 'imbalanced' | 'insufficient_data';
  dominantSide: string | null;
  remediationMuscles: MuscleId[];
  guidance: string;
};

export type BodyPhysiologyReport = {
  version: typeof MUSCLE_PHYSIOLOGY_VERSION;
  asOf: string;
  systemicReadiness: {
    score: number; // 0-100
    band: RecoveryBand;
    cnsFatigueLoad48h: number;
    sleepModifier: number;
    ageRecoveryFactor: number;
    wearableReadinessMultiplier: number;
    illnessOrOverreachingFlag: boolean;
    note: string;
  };
  /** Learned personal recoveryTauHours & MRV ceiling multipliers from logged RPE/performance history. */
  personalCalibration: PersonalPhysiologyCalibration;
  /** Smartwatch biometric readiness & rolling personal baseline deltas (HRV RMSSD, RHR, Sleep, Temp, ACWR). */
  wearableReadiness: WearableReadinessSignal;
  overallBodyTier: {
    tier: MuscleTier;
    measuredMuscles: number;
    totalMuscles: number;
    coveragePercent: number;
    note: string;
  };
  muscles: Record<MuscleId, MuscleState>;
  structuralBalance: StructuralBalanceCheck[];
  /** Top 3–5 muscles safest and highest-leverage to target right now (respects readiness, MRV, balance & upcoming goals). */
  recommendedTargets: Array<{
    muscle: MuscleId;
    priority: number;
    reason: string;
  }>;
  /** Muscles currently protected from heavy work because of fatigue (<65% ready), MRV cap, or an upcoming pinned goal. */
  protectedMuscles: Array<{
    muscle: MuscleId;
    reason: 'fatigued' | 'over_mrv' | 'upcoming_goal';
  }>;
};

const TIER_ORDER: readonly MuscleTier[] = [
  'unmeasured',
  'foundation',
  'bronze',
  'silver',
  'gold',
  'platinum',
  'diamond',
  'top1',
];

export function scoreToTier(score: number | null): MuscleTier {
  if (score === null || !Number.isFinite(score)) return 'unmeasured';
  if (score >= 92) return 'top1';
  if (score >= 82) return 'diamond';
  if (score >= 70) return 'platinum';
  if (score >= 56) return 'gold';
  if (score >= 42) return 'silver';
  if (score >= 25) return 'bronze';
  return 'foundation';
}

/**
 * Jaric (2002) allometric scaling factor: strength scales proportionally to BW^0.67 rather than BW^1.0.
 * Reference athlete: 75 kg male / 62 kg female. Prevents penalizing taller/heavier athletes unfairly
 * while still rewarding relative strength over raw mass.
 */
function allometricReferenceWeight(sex: 'male' | 'female' | 'unknown', bodyWeightKg: number | null): number {
  const refBw = sex === 'female' ? 62 : 75;
  const bw = bodyWeightKg && bodyWeightKg >= 35 && bodyWeightKg <= 200 ? bodyWeightKg : refBw;
  return Math.pow(bw / refBw, 0.67);
}

/** Conservative Epley e1RM capped at 12 reps (above 12 reps, 1RM equations lose validity). */
function safeE1rmKg(loadKg: number, reps: number): number | null {
  if (!Number.isFinite(loadKg) || loadKg <= 0 || !Number.isFinite(reps) || reps < 1) return null;
  const cappedReps = Math.min(12, Math.max(1, reps));
  if (cappedReps === 1) return loadKg;
  return loadKg * (1 + cappedReps / 30);
}

/** Age-based strength expectation factor (gradual physiological decline after age 40, ~0.7%/yr floor 0.72). */
function ageStrengthFactor(age: number | null): number {
  if (!age || age <= 40) return 1.0;
  return Math.max(0.72, 1 - (age - 40) * 0.007);
}

/** Age-based recovery tau multiplier (older athletes recover slightly slower from eccentric mechanical load). */
function ageRecoveryMultiplier(age: number | null): number {
  if (!age || age <= 35) return 1.0;
  return Math.min(1.45, 1 + (age - 35) * 0.01);
}

/** Experience-scaled weekly volume landmarks (MEV / MAV / MRV). */
function scaleVolumeLandmarks(
  base: {mev: number; mav: number; mrv: number},
  experience: NonNullable<AthleteDossier['constraints']['experience']>['value'] | undefined,
  age: number | null,
): {mev: number; mav: number; mrv: number} {
  const expMult =
    experience === 'new'
      ? 0.65
      : experience === 'under_year'
        ? 0.8
        : experience === 'over_three'
          ? 1.15
          : 1.0;
  const ageCapMult = age && age >= 55 ? 0.85 : 1.0;
  const mult = expMult * ageCapMult;
  const mev = Math.max(2, Math.round(base.mev * mult));
  const mav = Math.max(mev + 2, Math.round(base.mav * mult));
  const mrv = Math.max(mav + 2, Math.round(base.mrv * mult));
  return {mev, mav, mrv};
}

/** Reference "gold/top1" allometric 1RM targets in kg for a 75 kg male (scaled by sex, BW^0.67, age). */
const REFERENCE_1RM_MALE_75KG: Partial<Record<string, number>> = {
  barbell_bench_press: 115,
  dumbbell_bench_press: 95,
  dumbbell_floor_press: 90,
  machine_chest_press: 110,
  incline_dumbbell_press: 85,
  overhead_barbell_press: 75,
  dumbbell_shoulder_press: 65,
  barbell_back_squat: 155,
  leg_press: 240,
  goblet_squat: 60,
  barbell_deadlift: 185,
  dumbbell_rdl: 100,
  barbell_bent_over_row: 105,
  chest_supported_db_row: 80,
  seated_cable_row: 100,
  lat_pulldown: 95,
};

/** Reference rep targets for bodyweight benchmarks (top-tier calibration). */
const REFERENCE_BODYWEIGHT_REPS_MALE: Partial<Record<string, number>> = {
  push_ups: 55,
  decline_push_ups: 42,
  pull_ups: 20,
  parallel_bar_dips: 28,
  inverted_row: 28,
  tempo_bodyweight_squat: 50,
  bulgarian_split_squat: 26,
  single_leg_glute_bridge: 32,
};

const GOAL_METRIC_PROTECTED_MUSCLES: Record<string, MuscleId[]> = {
  bench_1rm: ['mid_chest', 'upper_chest', 'front_delt', 'triceps'],
  squat_1rm: ['quads', 'glutes', 'erectors'],
  deadlift_1rm: ['hamstrings', 'glutes', 'erectors'],
  pullups: ['lats', 'upper_back', 'biceps', 'forearms'],
  pushups: ['mid_chest', 'triceps', 'front_delt'],
  run_5k: ['calves', 'hamstrings', 'quads'],
  run_10k: ['calves', 'hamstrings', 'quads'],
  grip_strength: ['forearms'],
};

function recoveryBand(pct: number): RecoveryBand {
  if (pct >= 85) return 'fresh';
  if (pct >= 65) return 'ready';
  if (pct >= 40) return 'recovering';
  return 'fatigued';
}

export function buildBodyPhysiologyReport(input: {
  dossier: AthleteDossier;
  trainingEvents: readonly TrainingEvent[];
  asOf?: Date;
  /** Optional list of pinned/planned goal metrics scheduled within the next 36 hours. */
  upcomingGoalMetricsWithin36h?: readonly string[];
  /** Optional rolling smartwatch biometric history (Apple Watch, Wear OS/Health Connect, Garmin, Oura, WHOOP). */
  wearableHistory?: readonly WearableDailySnapshot[];
  /** Optional user-created custom exercises from Supabase `custom_exercises`. */
  customExercises?: readonly ExerciseDefinition[];
}): BodyPhysiologyReport {
  const now = input.asOf ?? new Date(input.dossier.asOf);
  const nowMs = now.getTime();
  const sex: 'male' | 'female' | 'unknown' = input.dossier.identity.profile.sex?.value ?? 'unknown';
  const age = input.dossier.identity.profile.age?.value ?? null;
  const bwKg = input.dossier.identity.profile.weightKg?.value ?? null;
  const experience = input.dossier.constraints.experience?.value;

  const sexStrengthFactor = sex === 'female' ? 0.68 : 1.0;
  const alloFactor = allometricReferenceWeight(sex, bwKg) * sexStrengthFactor * ageStrengthFactor(age);
  const ageRecMult = ageRecoveryMultiplier(age);

  // Self-optimized personal recoveryTauHours & MRV multipliers from logged RPE/performance history
  const personalCalibration = optimizePersonalPhysiology(
    input.dossier,
    input.trainingEvents,
    input.customExercises,
  );
  // Smartwatch rolling biometric baseline & autonomic readiness fusion
  const wearableReadiness = evaluateWearableReadiness(
    input.wearableHistory ?? [],
    input.dossier.today,
  );

  // Check optional sleep duration in dossier metrics when no smartwatch sleep history is supplied
  const sleepMetric = input.dossier.measuredResults['total_sleep'];
  let sleepModifier = 1.0;
  if (!wearableReadiness.hasWearableData && sleepMetric?.rawValue !== undefined && Number.isFinite(sleepMetric.rawValue)) {
    if (sleepMetric.rawValue < 360) sleepModifier = 0.88; // < 6h sleep
    else if (sleepMetric.rawValue < 420) sleepModifier = 0.94; // 6-7h sleep
    else if (sleepMetric.rawValue >= 450) sleepModifier = 1.04; // >= 7.5h sleep
  }

  // Track best valid capability score per muscle (never summed across exercises!)
  const bestCapability = new Map<
    MuscleId,
    {score: number; confidence: MeasurementConfidence; measuredAtMs: number; source: string}
  >();

  const recordCapability = (
    muscle: MuscleId,
    rawScore: number,
    confidence: MeasurementConfidence,
    measuredAtMs: number,
    source: string,
  ) => {
    const score = Number(Math.max(5, Math.min(100, rawScore)).toFixed(1));
    const daysOld = Math.max(0, (nowMs - measuredAtMs) / 86_400_000);
    const effectiveConfidence: MeasurementConfidence = daysOld > 42 ? 'stale' : confidence;
    const prev = bestCapability.get(muscle);
    // Prefer fresh measurements over stale ones; otherwise take best valid strength evidence
    const prevFresh = prev && prev.confidence !== 'stale';
    const currFresh = effectiveConfidence !== 'stale';
    if (!prev || (!prevFresh && currFresh) || (prevFresh === currFresh && score > prev.score)) {
      bestCapability.set(muscle, {score, confidence: effectiveConfidence, measuredAtMs, source});
    }
  };

  // 1. Seed capability from verified TOP1 dossier benchmarks (bench, squat, deadlift, pullups, pushups, grip, 5k)
  for (const ex of EXERCISE_CATALOG) {
    if (!ex.linkedMetric) continue;
    const snap = input.dossier.measuredResults[ex.linkedMetric];
    if (!snap || !Number.isFinite(snap.rawValue)) continue;
    const measuredAtMs = snap.observedAt ? Date.parse(snap.observedAt) : nowMs;
    const conf: MeasurementConfidence =
      snap.freshness === 'stale' ? 'stale' : snap.method === 'estimated' ? 'estimated' : 'verified';

    let ratio: number | null = null;
    if (ex.linkedMetric === 'bench_1rm' || ex.linkedMetric === 'squat_1rm' || ex.linkedMetric === 'deadlift_1rm') {
      const liftKg =
        snap.goalUnit === 'kg'
          ? snap.value
          : bwKg
            ? snap.rawValue * bwKg
            : snap.rawValue * (sex === 'female' ? 62 : 75);
      const refKg = (REFERENCE_1RM_MALE_75KG[ex.id] ?? 100) * alloFactor;
      ratio = liftKg / Math.max(15, refKg);
    } else if (ex.linkedMetric === 'pushups' || ex.linkedMetric === 'pullups') {
      const refReps = (REFERENCE_BODYWEIGHT_REPS_MALE[ex.id] ?? 30) * (sex === 'female' ? 0.65 : 1.0) * ageStrengthFactor(age);
      ratio = snap.rawValue / Math.max(5, refReps);
    } else if (ex.linkedMetric === 'grip_strength') {
      const refGrip = (sex === 'female' ? 40 : 62) * allometricReferenceWeight(sex, bwKg) * ageStrengthFactor(age);
      ratio = snap.rawValue / Math.max(15, refGrip);
    } else if (ex.linkedMetric === 'run_5k') {
      // Faster time (lower minutes) = higher score. 19 min male / 21.5 min female = ~92 score.
      const eliteMin = (sex === 'female' ? 21.5 : 19.0) / ageStrengthFactor(age);
      ratio = eliteMin / Math.max(12, snap.rawValue);
    }

    if (ratio !== null && Number.isFinite(ratio)) {
      const score = Math.min(100, ratio * 88);
      for (const inv of ex.muscles) {
        if (inv.role === 'primary' || inv.role === 'secondary') {
          // Secondary muscles receive conservative 0.90 attribution unless directly measured
          recordCapability(inv.muscle, inv.role === 'primary' ? score : score * 0.9, conf, measuredAtMs, ex.name);
        }
      }
    }
  }

  // 2. Process real logged workouts for:
  //    (a) Trailing 7-day fractional weekly volume
  //    (b) Local muscle fatigue impulse + exponential recovery decay
  //    (c) Systemic CNS fatigue over trailing 48h
  //    (d) Working-set e1RM capability updates
  const weeklySets = new Map<MuscleId, number>();
  const acuteSets72h = new Map<MuscleId, number>();
  const fatigueAccum = new Map<MuscleId, number>();
  const lastStimMs = new Map<MuscleId, number>();
  for (const id of ALL_MUSCLES) {
    weeklySets.set(id, 0);
    acuteSets72h.set(id, 0);
    fatigueAccum.set(id, 0);
  }

  let cnsFatigue48h = 0;

  // Deduplicate to latest non-deleted workout revision per event ID
  const latestWorkouts = new Map<string, Workout>();
  for (const ev of input.trainingEvents) {
    if (ev.kind !== 'workout') continue;
    if (ev.deleted) {
      latestWorkouts.delete(ev.id);
    } else {
      latestWorkouts.set(ev.id, ev.data as Workout);
    }
  }

  for (const workout of latestWorkouts.values()) {
    if (workout.status !== 'completed') continue;
    const endedMs = Date.parse(workout.endedAt ?? workout.startedAt);
    if (!Number.isFinite(endedMs) || endedMs > nowMs + 3_600_000) continue;
    const hoursAgo = Math.max(0, (nowMs - endedMs) / 3_600_000);

    for (const actualEx of workout.exercises ?? []) {
      const exDef = matchExerciseByName(actualEx.name, input.customExercises);
      if (!exDef) continue;
      const validSets = (actualEx.sets ?? []).filter(set => {
        if (!set.completed) return false;
        const repsOrSec = set.reps ?? set.durationSeconds ?? 0;
        return repsOrSec > 0;
      });
      if (validSets.length === 0) continue;

      // Update capability from actual working sets (best single set only — no volume inflation!)
      if (hoursAgo <= 24 * 90) {
        const ref1rm = REFERENCE_1RM_MALE_75KG[exDef.id];
        const refBw = REFERENCE_BODYWEIGHT_REPS_MALE[exDef.id];
        let bestRatio = 0;
        for (const set of validSets) {
          if (ref1rm && set.loadKg && set.loadKg > 0 && set.reps && set.reps > 0) {
            const est = safeE1rmKg(set.loadKg, set.reps);
            if (est) bestRatio = Math.max(bestRatio, est / Math.max(15, ref1rm * alloFactor));
          } else if (refBw && set.reps && set.reps > 0) {
            const adjRef = refBw * (sex === 'female' ? 0.65 : 1.0) * ageStrengthFactor(age);
            bestRatio = Math.max(bestRatio, set.reps / Math.max(5, adjRef));
          }
        }
        if (bestRatio > 0) {
          const score = Math.min(100, bestRatio * 88);
          for (const inv of exDef.muscles) {
            if (inv.role === 'primary') {
              recordCapability(inv.muscle, score, 'verified', endedMs, exDef.name);
            }
          }
        }
      }

      // Accumulate trailing 7-day fractional volume & exponential fatigue impulse
      if (hoursAgo <= 168) {
        const setCount = validSets.length;
        if (hoursAgo <= 48) {
          const cnsDecay = Math.exp(-hoursAgo / 28);
          cnsFatigue48h += setCount * exDef.systemicFatigue * 0.08 * cnsDecay;
        }
        for (const inv of exDef.muscles) {
          const fracSets = setCount * inv.weight;
          weeklySets.set(inv.muscle, (weeklySets.get(inv.muscle) ?? 0) + fracSets);
          if (hoursAgo <= 72) {
            acuteSets72h.set(inv.muscle, (acuteSets72h.get(inv.muscle) ?? 0) + fracSets);
          }
          const prevLast = lastStimMs.get(inv.muscle) ?? 0;
          if (endedMs > prevLast) lastStimMs.set(inv.muscle, endedMs);

          // Exponential recovery impulse modulated by age, learned personal recovery tau, and smartwatch biometrics
          const meta = MUSCLE_META[inv.muscle];
          const personalTauMult = personalCalibration.regionRecoveryMultipliers[meta.region];
          const tau =
            meta.recoveryTauHours *
            ageRecMult *
            personalTauMult *
            wearableReadiness.recoveryTauModifier;
          const acuteDrop = fracSets * (0.09 + 0.03 * exDef.systemicFatigue);
          const remainingFatigue = acuteDrop * Math.exp(-hoursAgo / tau);
          fatigueAccum.set(inv.muscle, (fatigueAccum.get(inv.muscle) ?? 0) + remainingFatigue);
        }
      }
    }
  }

  // Systemic readiness score (combines CNS load + sleep + smartwatch biometric readiness multiplier)
  const rawBase =
    (1 - Math.min(0.65, cnsFatigue48h)) * sleepModifier * wearableReadiness.readinessMultiplier;
  const systemicRaw = wearableReadiness.illnessOrOverreachingFlag
    ? Math.min(0.45, Math.max(0.2, rawBase))
    : Math.max(0.25, Math.min(1.0, rawBase));
  const systemicScore = Math.round(systemicRaw * 100);

  // Determine which muscles are protected for an upcoming pinned TOP1 goal session within 36h
  const upcomingSet = new Set<MuscleId>();
  const upcomingMetrics = input.upcomingGoalMetricsWithin36h ?? [];
  for (const metricId of upcomingMetrics) {
    for (const m of GOAL_METRIC_PROTECTED_MUSCLES[metricId] ?? []) {
      upcomingSet.add(m);
    }
  }

  // Assemble preliminary MuscleState map
  const muscles = {} as Record<MuscleId, MuscleState>;
  const combinedMrvMult = personalCalibration.mrvMultiplier * wearableReadiness.mrvModifier;
  for (const id of ALL_MUSCLES) {
    const meta = MUSCLE_META[id];
    const baseLand = scaleVolumeLandmarks(meta.baseLandmarks, experience, age);
    const adjustedMrv = Math.max(baseLand.mev + 2, Math.round(baseLand.mrv * combinedMrvMult));
    const adjustedMav = Math.min(adjustedMrv - 1, Math.max(baseLand.mev + 1, baseLand.mav));
    const landmarks = {mev: baseLand.mev, mav: adjustedMav, mrv: adjustedMrv};
    const wkSets = Number((weeklySets.get(id) ?? 0).toFixed(2));
    const zone: VolumeZone =
      wkSets > landmarks.mrv
        ? 'over_mrv'
        : wkSets >= landmarks.mrv - 2
          ? 'near_mrv'
          : wkSets >= landmarks.mev
            ? 'optimal_mav'
            : 'under_mev';

    const localFatigue = Math.min(0.92, fatigueAccum.get(id) ?? 0);
    // Blend local muscle recovery (82%) with systemic readiness (18%)
    const combinedReadiness = Math.max(
      0.08,
      Math.min(1.0, (1 - localFatigue) * 0.82 + systemicRaw * 0.18),
    );
    const recPct = Math.round(combinedReadiness * 100);
    const personalTauMult = personalCalibration.regionRecoveryMultipliers[meta.region];
    const tau =
      meta.recoveryTauHours *
      ageRecMult *
      personalTauMult *
      wearableReadiness.recoveryTauModifier;
    const hoursUntilReady =
      recPct >= 65
        ? 0
        : Math.max(1, Math.ceil(tau * Math.log(Math.max(1.01, localFatigue / 0.35))));

    const cap = bestCapability.get(id);
    const capScore = cap ? cap.score : null;
    const daysSinceMeasured = cap ? Math.max(0, Math.round((nowMs - cap.measuredAtMs) / 86_400_000)) : null;

    muscles[id] = {
      muscle: id,
      region: meta.region,
      label: meta.label,
      capability: {
        tier: scoreToTier(capScore),
        score: capScore,
        confidence: cap ? cap.confidence : 'unmeasured',
        daysSinceMeasured,
        sourceExercise: cap ? cap.source : null,
      },
      recovery: {
        percent: recPct,
        band: recoveryBand(recPct),
        hoursUntilReady,
        lastStimulatedAt: lastStimMs.has(id) ? new Date(lastStimMs.get(id)!).toISOString() : null,
        acuteSets72h: Number((acuteSets72h.get(id) ?? 0).toFixed(2)),
      },
      volume: {
        weeklyEffectiveSets: wkSets,
        ...landmarks,
        zone,
      },
      protectedForUpcomingGoal: upcomingSet.has(id),
      nextTargetPriority: 0,
    };
  }

  // 3. Structural Antagonist Balance Audit (something Liftoff completely lacks!)
  const sumVolume = (ids: MuscleId[]) =>
    ids.reduce((acc, id) => acc + muscles[id].volume.weeklyEffectiveSets, 0);
  const avgScore = (ids: MuscleId[]) => {
    const vals = ids.map(id => muscles[id].capability.score).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const makeBalance = (
    id: StructuralBalanceCheck['id'],
    label: string,
    sideALabel: string,
    sideAMuscles: MuscleId[],
    sideBLabel: string,
    sideBMuscles: MuscleId[],
    idealRange: [number, number],
  ): StructuralBalanceCheck => {
    const volA = sumVolume(sideAMuscles);
    const volB = sumVolume(sideBMuscles);
    const scoreA = avgScore(sideAMuscles);
    const scoreB = avgScore(sideBMuscles);

    let ratio: number | null = null;
    if (volA + volB >= 4) {
      ratio = Number(((volA + 0.5) / (volB + 0.5)).toFixed(2));
    } else if (scoreA !== null && scoreB !== null && scoreB > 0) {
      ratio = Number((scoreA / scoreB).toFixed(2));
    }

    if (ratio === null) {
      return {
        id,
        label,
        ratio: null,
        idealRange,
        status: 'insufficient_data',
        dominantSide: null,
        remediationMuscles: [],
        guidance: `Log balanced ${sideALabel.toLowerCase()} and ${sideBLabel.toLowerCase()} work to track structural ratio.`,
      };
    }

    if (ratio > idealRange[1]) {
      return {
        id,
        label,
        ratio,
        idealRange,
        status: 'imbalanced',
        dominantSide: sideALabel,
        remediationMuscles: sideBMuscles,
        guidance: `${sideALabel} volume/strength exceeds ${sideBLabel} (${ratio}:1 vs ideal ${idealRange[0]}–${idealRange[1]}). Prioritize ${sideBLabel.toLowerCase()} to protect joint balance.`,
      };
    }
    if (ratio < idealRange[0]) {
      return {
        id,
        label,
        ratio,
        idealRange,
        status: 'imbalanced',
        dominantSide: sideBLabel,
        remediationMuscles: sideAMuscles,
        guidance: `${sideBLabel} leads ${sideALabel} (${ratio}:1 vs ideal ${idealRange[0]}–${idealRange[1]}). Add targeted ${sideALabel.toLowerCase()} sets.`,
      };
    }
    return {
      id,
      label,
      ratio,
      idealRange,
      status: 'balanced',
      dominantSide: null,
      remediationMuscles: [],
      guidance: `${sideALabel} to ${sideBLabel} ratio (${ratio}:1) is well balanced.`,
    };
  };

  const structuralBalance: StructuralBalanceCheck[] = [
    makeBalance(
      'push_pull',
      'Upper Push : Pull Balance',
      'Push (Chest & Front Delt)',
      ['mid_chest', 'upper_chest', 'front_delt'],
      'Pull (Upper Back & Lats)',
      ['upper_back', 'lats', 'rear_delt'],
      [0.75, 1.15],
    ),
    makeBalance(
      'quad_hamstring',
      'Quad : Posterior Chain Balance',
      'Quads',
      ['quads'],
      'Hamstrings & Glutes',
      ['hamstrings', 'glutes'],
      [0.75, 1.3],
    ),
    makeBalance(
      'anterior_posterior_shoulder',
      'Front : Rear Shoulder Balance',
      'Front Delt',
      ['front_delt'],
      'Rear Delt & Upper Back',
      ['rear_delt', 'upper_back'],
      [0.5, 1.05],
    ),
  ];

  const balanceBoostMuscles = new Set<MuscleId>(
    structuralBalance.flatMap(b => b.remediationMuscles),
  );

  // 4. Compute Next-Target Priority Score for each muscle
  const protectedMuscles: BodyPhysiologyReport['protectedMuscles'] = [];
  for (const id of ALL_MUSCLES) {
    const st = muscles[id];
    if (st.recovery.percent < 65) {
      protectedMuscles.push({muscle: id, reason: 'fatigued'});
      st.nextTargetPriority = 0;
      continue;
    }
    if (st.volume.zone === 'over_mrv') {
      protectedMuscles.push({muscle: id, reason: 'over_mrv'});
      st.nextTargetPriority = 0;
      continue;
    }
    if (st.protectedForUpcomingGoal) {
      protectedMuscles.push({muscle: id, reason: 'upcoming_goal'});
      st.nextTargetPriority = 5;
      continue;
    }

    // Priority combines:
    // - Volume headroom below MAV (up to 40 pts)
    // - Structural imbalance remediation bonus (+25 pts)
    // - Lower relative capability / unmeasured discovery (+20 pts)
    // - Freshness bonus (+15 pts)
    const mavRatio = Math.min(1, st.volume.weeklyEffectiveSets / Math.max(1, st.volume.mav));
    const volumeNeed = (1 - mavRatio) * 40;
    const balanceBonus = balanceBoostMuscles.has(id) ? 25 : 0;
    const capabilityNeed =
      st.capability.score === null ? 14 : Math.max(0, (85 - st.capability.score) / 85) * 20;
    const freshness = ((st.recovery.percent - 65) / 35) * 15;
    st.nextTargetPriority = Math.round(Math.min(100, volumeNeed + balanceBonus + capabilityNeed + freshness));
  }

  const recommendedTargets = ALL_MUSCLES.map(id => muscles[id])
    .filter(st => st.nextTargetPriority >= 25)
    .sort((a, b) => b.nextTargetPriority - a.nextTargetPriority || a.muscle.localeCompare(b.muscle))
    .slice(0, 5)
    .map(st => {
      const reasons: string[] = [];
      if (balanceBoostMuscles.has(st.muscle)) reasons.push('closes antagonist balance gap');
      if (st.volume.zone === 'under_mev') reasons.push(`under weekly MEV (${st.volume.weeklyEffectiveSets}/${st.volume.mev} sets)`);
      else if (st.volume.weeklyEffectiveSets < st.volume.mav) reasons.push(`below optimal MAV (${st.volume.weeklyEffectiveSets}/${st.volume.mav} sets)`);
      reasons.push(`${st.recovery.percent}% recovered`);
      return {
        muscle: st.muscle,
        priority: st.nextTargetPriority,
        reason: reasons.join(' · '),
      };
    });

  // Overall Body Tier — honestly weighted across measured muscles, never fabricating rank for unmeasured areas
  const measured = ALL_MUSCLES.map(id => muscles[id]).filter(m => m.capability.score !== null);
  const overallScore =
    measured.length > 0
      ? measured.reduce((sum, m) => sum + (m.capability.score ?? 0), 0) / measured.length
      : null;
  const overallTier = scoreToTier(overallScore);

  return {
    version: MUSCLE_PHYSIOLOGY_VERSION,
    asOf: now.toISOString(),
    systemicReadiness: {
      score: systemicScore,
      band: recoveryBand(systemicScore),
      cnsFatigueLoad48h: Number(cnsFatigue48h.toFixed(2)),
      sleepModifier,
      ageRecoveryFactor: Number(ageRecMult.toFixed(2)),
      wearableReadinessMultiplier: wearableReadiness.readinessMultiplier,
      illnessOrOverreachingFlag: wearableReadiness.illnessOrOverreachingFlag,
      note: wearableReadiness.illnessOrOverreachingFlag
        ? 'Smartwatch biometrics indicate elevated autonomic strain or possible illness — rest and recovery strongly recommended today.'
        : systemicScore >= 80
          ? 'Systemic CNS readiness is high — full compound intensity is well supported.'
          : systemicScore >= 60
            ? 'Moderate recent systemic load — prioritize fresh muscle groups and avoid unnecessary junk volume.'
            : 'Elevated systemic fatigue over the last 48h — favor low-axial work, aerobic recovery, or rest.',
    },
    personalCalibration,
    wearableReadiness,
    overallBodyTier: {
      tier: TIER_ORDER.includes(overallTier) ? overallTier : 'unmeasured',
      measuredMuscles: measured.length,
      totalMuscles: ALL_MUSCLES.length,
      coveragePercent: Math.round((measured.length / ALL_MUSCLES.length) * 100),
      note:
        measured.length === 0
          ? 'Unmeasured — log your first working set or benchmark to establish an honest baseline.'
          : `Based on ${measured.length}/${ALL_MUSCLES.length} measured muscle groups using allometric bodyweight scaling (never inflated by exercise count).`,
    },
    muscles,
    structuralBalance,
    recommendedTargets,
    protectedMuscles,
  };
}
