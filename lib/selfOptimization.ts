import {sessionResult} from './adaptiveProgram';
import type {AthleteDossier} from './athleteDossier';
import {
  matchExerciseByName,
  MUSCLE_META,
  type ExerciseDefinition,
  type MuscleId,
  type MuscleRegion,
} from './exerciseOntology';
import {
  evaluateCohortCalibration,
  type CohortEvaluationReport,
  type ProspectiveCohortRecord,
} from './outcomeLearning';
import type {TrainingEvent, Workout} from './training';

export type {ProspectiveCohortRecord, CohortEvaluationReport} from './outcomeLearning';
export const SELF_OPTIMIZATION_VERSION = 'self-opt-v1';

export type ActionOutcomeStats = {
  action: 'shorten' | 'move' | 'substitute';
  trials: number;
  completions: number;
  /** Empirical Bayes posterior completion rate with Beta(alpha, beta) prior. */
  posteriorCompletionRate: number;
  /** Bounded score adjustment applied to tie-breaking (-8..+8), never overriding safety or feasibility. */
  scoreDelta: number;
};

export type PersonalPolicyUpdate = {
  version: typeof SELF_OPTIMIZATION_VERSION;
  athleteId: string;
  observationsUsed: number;
  /** True once the athlete has >= 3 resolved coaching decisions with matching logged outcomes. */
  active: boolean;
  actions: Record<'shorten' | 'move' | 'substitute', ActionOutcomeStats>;
  preferredTimeAction: 'shorten' | 'move';
  explanation: string;
};

/**
 * Beta-Binomial Empirical Bayes personal policy optimizer.
 * Learns from THIS athlete's actual workout ledger whether `shorten` or `move`
 * leads to higher real completion when time is tight, gently nudging action scores
 * within a strict ±8 bound so safety, equipment, and clinical rules always remain dominant.
 */
export function optimizePersonalPolicy(
  dossier: AthleteDossier,
  trainingEvents: readonly TrainingEvent[],
): PersonalPolicyUpdate {
  const byDay = new Map<string, Workout>();
  for (const ev of trainingEvents) {
    if (ev.kind !== 'workout' || ev.deleted) continue;
    const w = ev.data as Workout;
    const rec = sessionResult(w);
    if (!rec) continue;
    byDay.set(rec.day, w);
  }

  // Conservative Beta priors: shorten starts slightly favored (0.72), move (0.64), substitute (0.70)
  const priors: Record<'shorten' | 'move' | 'substitute', {alpha: number; beta: number}> = {
    shorten: {alpha: 3.6, beta: 1.4},
    move: {alpha: 3.2, beta: 1.8},
    substitute: {alpha: 3.5, beta: 1.5},
  };

  const counts: Record<'shorten' | 'move' | 'substitute', {trials: number; completions: number}> = {
    shorten: {trials: 0, completions: 0},
    move: {trials: 0, completions: 0},
    substitute: {trials: 0, completions: 0},
  };

  let totalMatched = 0;
  for (const dec of dossier.decisionHistory) {
    if (dec.undoneAt) continue;
    if (dec.action !== 'shorten' && dec.action !== 'move' && dec.action !== 'substitute') continue;
    const targetDay = dec.after?.date ?? dec.day;
    const logged = byDay.get(targetDay);
    if (!logged) continue;
    counts[dec.action].trials++;
    if (logged.status === 'completed') counts[dec.action].completions++;
    totalMatched++;
  }

  const actions = {} as Record<'shorten' | 'move' | 'substitute', ActionOutcomeStats>;
  for (const act of ['shorten', 'move', 'substitute'] as const) {
    const p = priors[act];
    const c = counts[act];
    const priorMean = p.alpha / (p.alpha + p.beta);
    const posterior = (p.alpha + c.completions) / (p.alpha + p.beta + c.trials);
    const rawDelta = (posterior - priorMean) * 35;
    const scoreDelta =
      totalMatched >= 3 ? Number(Math.max(-8, Math.min(8, rawDelta)).toFixed(2)) : 0;
    actions[act] = {
      action: act,
      trials: c.trials,
      completions: c.completions,
      posteriorCompletionRate: Number(posterior.toFixed(3)),
      scoreDelta,
    };
  }

  const preferredTimeAction: 'shorten' | 'move' =
    actions.move.posteriorCompletionRate > actions.shorten.posteriorCompletionRate + 0.08 &&
    actions.move.trials >= 2
      ? 'move'
      : 'shorten';

  const explanation =
    totalMatched < 3
      ? 'Using conservative coaching defaults until at least 3 adapted sessions have logged outcomes.'
      : preferredTimeAction === 'move'
        ? `Learned from ${totalMatched} outcomes: you complete rescheduled full sessions (${Math.round(actions.move.posteriorCompletionRate * 100)}%) more reliably than shortened ones (${Math.round(actions.shorten.posteriorCompletionRate * 100)}%).`
        : `Learned from ${totalMatched} outcomes: shortening in place yields ${Math.round(actions.shorten.posteriorCompletionRate * 100)}% completion for your schedule.`;

  return {
    version: SELF_OPTIMIZATION_VERSION,
    athleteId: dossier.identity.owner,
    observationsUsed: totalMatched,
    active: totalMatched >= 3,
    actions,
    preferredTimeAction,
    explanation,
  };
}

export type PopulationModelParams = {
  modelVersion: string;
  responsePrior: number; // default 0.50 (bounded 0.30..0.75)
  shortSessionEfficiency: number; // default 0.80 (bounded 0.50..1.00)
  maintenanceWeeklySessionsUnder60: number; // default 1 (bounded 1..2)
  calibrationShift: number; // bounded -0.15..+0.15
};

export const DEFAULT_POPULATION_PARAMS: PopulationModelParams = {
  modelVersion: 'goal-paths-v3',
  responsePrior: 0.5,
  shortSessionEfficiency: 0.8,
  maintenanceWeeklySessionsUnder60: 1,
  calibrationShift: 0,
};

export type SelfOptimizationCycleResult = {
  cycleVersion: typeof SELF_OPTIMIZATION_VERSION;
  evaluatedAt: string;
  previousParams: PopulationModelParams;
  candidateParams: PopulationModelParams;
  fitCount: number;
  holdoutReport: CohortEvaluationReport;
  decision: 'promote' | 'hold' | 'rollback';
  rollbackTarget: PopulationModelParams;
  summary: string;
};

/**
 * Chronological train/holdout self-optimization cycle for population-level model upgrades.
 * 1. Splits independent matured outcomes chronologically (earliest 50% fit, latest 50% holdout).
 * 2. Fits a shrunk calibration shift on the fit cohort (capped at ±15 percentage points).
 * 3. Evaluates candidate vs active model on the independent later holdout cohort.
 * 4. Promotes ONLY if held-out Brier score improves >= 0.002 with <= 30% missing follow-up;
 *    triggers `rollback` if an already-shifted model degrades held-out Brier score.
 */
export function runSelfOptimizationCycle(input: {
  records: readonly ProspectiveCohortRecord[];
  activeParams?: PopulationModelParams;
  now?: Date;
  minHoldoutOutcomes?: number;
}): SelfOptimizationCycleResult {
  const evaluatedAt = (input.now ?? new Date()).toISOString();
  const previousParams = input.activeParams ?? DEFAULT_POPULATION_PARAMS;
  const minHoldout = input.minHoldoutOutcomes ?? 20;

  // Deduplicate to one earliest prospective attempt per independent athlete
  const byAthlete = new Map<string, ProspectiveCohortRecord>();
  const chronological = [...input.records].sort(
    (a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt),
  );
  for (const rec of chronological) {
    if (!byAthlete.has(rec.athleteId)) byAthlete.set(rec.athleteId, rec);
  }
  const unique = [...byAthlete.values()];
  const splitIdx = Math.floor(unique.length / 2);
  const fitGroup = unique.slice(0, splitIdx);
  const holdoutGroup = unique.slice(splitIdx);

  // Fit shrunk calibration shift strictly on the earlier fit group
  const fitMeasured = fitGroup.filter(r => r.reachedOnTime !== null);
  let learnedShift = previousParams.calibrationShift;
  if (fitMeasured.length >= 10) {
    const avgError =
      fitMeasured.reduce(
        (sum, r) => sum + ((r.reachedOnTime ? 1 : 0) - r.predictedProbability),
        0,
      ) / fitMeasured.length;
    // Shrink toward zero by n / (n + 15) and cap at ±0.15
    const shrinkage = fitMeasured.length / (fitMeasured.length + 15);
    learnedShift = Number(Math.max(-0.15, Math.min(0.15, avgError * shrinkage)).toFixed(4));
  }

  const candidateParams: PopulationModelParams = {
    ...previousParams,
    modelVersion: `${previousParams.modelVersion}-opt`,
    calibrationShift: learnedShift,
  };

  // Evaluate candidate on the independent later holdout group
  const scoredHoldout: ProspectiveCohortRecord[] = holdoutGroup.map(r => ({
    ...r,
    predictedProbability: Math.max(
      0.01,
      Math.min(0.99, r.predictedProbability + learnedShift),
    ),
    baselineProbability: Math.max(
      0.01,
      Math.min(0.99, r.predictedProbability + previousParams.calibrationShift),
    ),
  }));

  const holdoutReport = evaluateCohortCalibration(scoredHoldout, {
    minIndependentOutcomes: minHoldout,
    maxMissingRate: 0.3,
    minBrierGain: 0.002,
  });

  // Auto-rollback check: compare active shifted model directly against unshifted baseline on holdout
  const activeVsDefaultReport =
    previousParams.calibrationShift !== 0
      ? evaluateCohortCalibration(
          holdoutGroup.map(r => ({
            ...r,
            predictedProbability: Math.max(
              0.01,
              Math.min(0.99, r.predictedProbability + previousParams.calibrationShift),
            ),
            baselineProbability: Math.max(0.01, Math.min(0.99, r.predictedProbability)),
          })),
          {
            minIndependentOutcomes: minHoldout,
            maxMissingRate: 0.3,
            minBrierGain: 0.002,
          },
        )
      : null;

  let decision: 'promote' | 'hold' | 'rollback' = 'hold';
  let summary = holdoutReport.promotionReason;

  if (holdoutReport.shouldPromote && Math.abs(learnedShift - previousParams.calibrationShift) >= 0.005) {
    decision = 'promote';
    summary = `Promoted ${candidateParams.modelVersion} (shift ${learnedShift >= 0 ? '+' : ''}${(learnedShift * 100).toFixed(1)}pp): held-out Brier improved by ${holdoutReport.brierImprovement} across ${holdoutReport.measuredOutcomes} independent athletes.`;
  } else if (
    activeVsDefaultReport &&
    activeVsDefaultReport.measuredOutcomes >= minHoldout &&
    (activeVsDefaultReport.brierImprovement ?? 0) < -0.002
  ) {
    decision = 'rollback';
    summary = `Rolled back to baseline parameters because active shifted model degraded held-out Brier by ${activeVsDefaultReport.brierImprovement}.`;
  }

  return {
    cycleVersion: SELF_OPTIMIZATION_VERSION,
    evaluatedAt,
    previousParams,
    candidateParams,
    fitCount: fitMeasured.length,
    holdoutReport,
    decision,
    rollbackTarget: DEFAULT_POPULATION_PARAMS,
    summary,
  };
}

export type PersonalPhysiologyCalibration = {
  version: typeof SELF_OPTIMIZATION_VERSION;
  athleteId: string;
  active: boolean;
  recoveryPairsObserved: number;
  volumeBlocksObserved: number;
  /** Learned global multiplier on muscle recoveryTauHours (bounded 0.75..1.40; >1 = slower recovery). */
  recoveryTauMultiplier: number;
  /** Optional per-region learned multipliers (bounded 0.75..1.40). */
  regionRecoveryMultipliers: Record<MuscleRegion, number>;
  /** Learned personal MRV ceiling multiplier (bounded 0.75..1.25; <1 = lower volume tolerance). */
  mrvMultiplier: number;
  /** Observed rate of performance drop-off or RPE overshoot on short-turnaround sessions. */
  shortTurnaroundDropoffRate: number | null;
  explanation: string;
};

function parseLoggedRpe(notes: string): number | null {
  if (!notes) return null;
  const rpeMatch = notes.match(/\brpe\s*[:=]?\s*(10(?:\.0)?|[5-9](?:\.\d)?)/i);
  if (rpeMatch) return Number(rpeMatch[1]);
  const rirMatch = notes.match(/\brir\s*[:=]?\s*([0-5](?:\.\d)?)/i);
  if (rirMatch) return Number((10 - Number(rirMatch[1])).toFixed(1));
  if (/\b(wrecked|exhausted|very sore|overtrained|drained|heavy legs|fried)\b/i.test(notes)) {
    return 9.5;
  }
  return null;
}

function bestExercisePerformance(ex: Workout['exercises'][number]): number | null {
  let best = 0;
  for (const s of ex.sets ?? []) {
    if (!s.completed) continue;
    const reps = s.reps ?? 0;
    if (reps <= 0) continue;
    if (s.loadKg && s.loadKg > 0) {
      const capped = Math.min(12, reps);
      const e1rm = capped === 1 ? s.loadKg : s.loadKg * (1 + capped / 30);
      if (e1rm > best) best = e1rm;
    } else if (reps > best) {
      best = reps;
    }
  }
  return best > 0 ? best : null;
}

/**
 * Learns each athlete's personal `recoveryTauHours` multiplier (0.75..1.40) and personal `MRV`
 * ceiling multiplier (0.75..1.25) from logged e1RM/rep performance drop-offs, RPE overshoot
 * notes, and high-volume fatigue skips via conservative Empirical Bayes shrinkage.
 */
export function optimizePersonalPhysiology(
  dossier: AthleteDossier,
  trainingEvents: readonly TrainingEvent[],
  customExercises?: readonly ExerciseDefinition[],
): PersonalPhysiologyCalibration {
  // Deduplicate latest non-deleted workouts and sort chronologically
  const latest = new Map<string, Workout>();
  for (const ev of trainingEvents) {
    if (ev.kind !== 'workout') continue;
    if (ev.deleted) latest.delete(ev.id);
    else latest.set(ev.id, ev.data as Workout);
  }

  const workouts = [...latest.values()]
    .map(w => ({w, ms: Date.parse(w.endedAt ?? w.startedAt)}))
    .filter(item => Number.isFinite(item.ms))
    .sort((a, b) => a.ms - b.ms);

  type Exposure = {
    ms: number;
    exerciseId: string;
    primaryMuscles: MuscleId[];
    region: MuscleRegion;
    perf: number;
    rpe: number | null;
    sets: number;
  };

  const exposures: Exposure[] = [];
  const lastByExercise = new Map<string, Exposure>();
  const lastByMuscle = new Map<MuscleId, Exposure>();

  let recoveryPairs = 0;
  let recoverySignalSum = 0; // +1 = under-recovered (increase tau), -1 = fast-recovered (decrease tau)
  let dropoffCount = 0;

  const regionStats: Record<MuscleRegion, {pairs: number; signalSum: number}> = {
    upper_anterior: {pairs: 0, signalSum: 0},
    upper_posterior: {pairs: 0, signalSum: 0},
    core: {pairs: 0, signalSum: 0},
    lower_body: {pairs: 0, signalSum: 0},
  };

  let volumeBlocks = 0;
  let mrvSignalSum = 0; // -1 = volume overload (lower MRV), +1 = thriving near MRV (raise MRV)

  for (const {w, ms} of workouts) {
    const workoutRpe = parseLoggedRpe(w.notes || '');

    // Check fatigue-related abandoned workouts following high trailing 7-day volume
    if (w.status === 'abandoned' && /\b(fatigue|sore|tired|recovery|drained|overreach)/i.test(w.notes || '')) {
      const trailing7dTotal = exposures
        .filter(e => ms - e.ms > 0 && ms - e.ms <= 168 * 3_600_000)
        .reduce((acc, e) => acc + e.sets, 0);
      if (trailing7dTotal >= 12) {
        volumeBlocks++;
        mrvSignalSum -= 1.0;
      }
      continue;
    }
    if (w.status !== 'completed') continue;

    for (const actualEx of w.exercises ?? []) {
      const def = matchExerciseByName(actualEx.name, customExercises);
      if (!def) continue;
      const perf = bestExercisePerformance(actualEx);
      if (perf === null) continue;
      const completedSets = (actualEx.sets ?? []).filter(s => s.completed).length;
      if (completedSets === 0) continue;

      const primaryMuscles = def.muscles.filter(inv => inv.role === 'primary').map(inv => inv.muscle);
      if (primaryMuscles.length === 0) continue;
      const region = MUSCLE_META[primaryMuscles[0]].region;
      const rpe = parseLoggedRpe(actualEx.notes || '') ?? workoutRpe;

      // Compare against previous exposure of same exercise (preferred) or primary muscle
      const prev = lastByExercise.get(def.id) ?? lastByMuscle.get(primaryMuscles[0]);
      if (prev) {
        const hours = (ms - prev.ms) / 3_600_000;
        if (hours >= 12 && hours <= 96) {
          const perfDelta = prev.exerciseId === def.id ? (perf - prev.perf) / Math.max(1, prev.perf) : 0;
          const underRecovered =
            (hours <= 60 && perfDelta <= -0.03) ||
            (hours <= 60 && rpe !== null && rpe >= 9.3);
          const fastRecovered =
            hours <= 48 &&
            perfDelta >= 0 &&
            (rpe === null || rpe <= 8.5);

          if (underRecovered || fastRecovered) {
            const sig = underRecovered ? 1 : -0.7;
            recoveryPairs++;
            recoverySignalSum += sig;
            if (underRecovered) dropoffCount++;
            regionStats[region].pairs++;
            regionStats[region].signalSum += sig;
          }

          // Trailing 7d fractional sets for primary muscle leading into this exposure
          const pMuscle = primaryMuscles[0];
          const trailingSets = exposures
            .filter(
              e =>
                ms - e.ms > 0 &&
                ms - e.ms <= 168 * 3_600_000 &&
                e.primaryMuscles.includes(pMuscle),
            )
            .reduce((sum, e) => sum + e.sets, 0);
          const baseMrv = MUSCLE_META[pMuscle].baseLandmarks.mrv;
          const mrvFraction = trailingSets / Math.max(6, baseMrv);

          if (mrvFraction >= 0.65) {
            if (perfDelta <= -0.025 || (rpe !== null && rpe >= 9.5)) {
              volumeBlocks++;
              mrvSignalSum -= 1.0;
            } else if (mrvFraction >= 0.8 && perfDelta >= 0 && (rpe === null || rpe <= 8.5)) {
              volumeBlocks++;
              mrvSignalSum += 0.8;
            }
          }
        }
      }

      const exp: Exposure = {
        ms,
        exerciseId: def.id,
        primaryMuscles,
        region,
        perf,
        rpe,
        sets: completedSets,
      };
      exposures.push(exp);
      lastByExercise.set(def.id, exp);
      for (const pm of primaryMuscles) lastByMuscle.set(pm, exp);
    }
  }

  // Empirical Bayes shrinkage toward neutral 1.0 (requires >= 3 observations to activate)
  const tauActive = recoveryPairs >= 3;
  const tauMeanSig = recoveryPairs > 0 ? recoverySignalSum / recoveryPairs : 0;
  const tauShrink = recoveryPairs / (recoveryPairs + 4);
  const recoveryTauMultiplier = tauActive
    ? Number(Math.max(0.75, Math.min(1.4, 1 + tauMeanSig * tauShrink * 0.42)).toFixed(3))
    : 1.0;

  const regionRecoveryMultipliers = {} as Record<MuscleRegion, number>;
  for (const reg of ['upper_anterior', 'upper_posterior', 'core', 'lower_body'] as MuscleRegion[]) {
    const rs = regionStats[reg];
    if (rs.pairs >= 3) {
      const mean = rs.signalSum / rs.pairs;
      const sh = rs.pairs / (rs.pairs + 4);
      regionRecoveryMultipliers[reg] = Number(
        Math.max(0.75, Math.min(1.4, 1 + mean * sh * 0.42)).toFixed(3),
      );
    } else {
      regionRecoveryMultipliers[reg] = recoveryTauMultiplier;
    }
  }

  const mrvActive = volumeBlocks >= 3;
  const mrvMeanSig = volumeBlocks > 0 ? mrvSignalSum / volumeBlocks : 0;
  const mrvShrink = volumeBlocks / (volumeBlocks + 4);
  const mrvMultiplier = mrvActive
    ? Number(Math.max(0.75, Math.min(1.25, 1 + mrvMeanSig * mrvShrink * 0.28)).toFixed(3))
    : 1.0;

  const active = tauActive || mrvActive;
  const shortTurnaroundDropoffRate =
    recoveryPairs > 0 ? Number((dropoffCount / recoveryPairs).toFixed(2)) : null;

  const explanation = !active
    ? 'Using evidence-based default recovery constants and MRV landmarks until at least 3 paired training blocks are logged.'
    : `Learned from ${recoveryPairs} recovery pairs & ${volumeBlocks} high-volume blocks: personal recovery tau ×${recoveryTauMultiplier}, MRV ceiling ×${mrvMultiplier}.`;

  return {
    version: SELF_OPTIMIZATION_VERSION,
    athleteId: dossier.identity.owner,
    active,
    recoveryPairsObserved: recoveryPairs,
    volumeBlocksObserved: volumeBlocks,
    recoveryTauMultiplier,
    regionRecoveryMultipliers,
    mrvMultiplier,
    shortTurnaroundDropoffRate,
    explanation,
  };
}
