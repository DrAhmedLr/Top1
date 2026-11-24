import {
  actualDose,
  goalMetrics,
  sessionResult,
  type AdaptivePlan,
} from './adaptiveProgram';
import {isoWeekdayForDay, type AthleteDossier} from './athleteDossier';
import {weekdayLabel} from './coachDecision';
import {comparableDelta, type Observation} from './history';
import {testedValue, datedTests} from './goalAttempts';
import type {IsoWeekday} from './personalWorkspace';
import type {Workout} from './training';

export const OUTCOME_LEARNING_VERSION = 'outcome-learning-v1';

export type CalendarLearningSuggestion = {
  weekday: IsoWeekday;
  timeRelatedSkips: number;
  suggestedMinutes: number;
  prompt: [string, string, string];
};

export type PersonalLearningSummary = {
  version: typeof OUTCOME_LEARNING_VERSION;
  metric: string;
  /** Attendance learned separately from physical response. */
  attendance: {
    logged: number;
    completed: number;
    modified: number;
    skipped: number;
    rate: number | null;
    equipmentSubstitutions: number;
    /** Substitutions caused by unavailable equipment supply weak preference evidence. */
    equipmentSubstitutionNote: string | null;
  };
  /** Physical response learned ONLY from comparable same-metric tests after training. */
  physicalResponse: {
    comparableIntervals: number;
    personalEstimateUnlocked: boolean;
    /** Bayesian empirical shrinkage weight toward personal observations (0..1). */
    personalWeight: number;
    /** Shrunk expected gain per completed session in the goal's own units (null if <1 interval). */
    shrunkGainPerSession: number | null;
    priorGainPerSession: number;
    observedMedianGainPerSession: number | null;
    /** Bench forecast requires bench evidence; cross-exercise transfer is never fabricated. */
    crossExerciseTransferApplied: false;
  };
  /** Repeated time-related skips on a weekday can propose a recurring schedule adjustment. */
  calendarSuggestion: CalendarLearningSuggestion | null;
};

/**
 * Bayesian empirical shrinkage from the conservative shared prior toward personal
 * measured gains as comparable intervals accumulate (`w = n / (n + priorStrength)`).
 */
export function shrinkPersonalGain(
  priorGain: number,
  observedGains: readonly number[],
  priorStrength = 3,
): {weight: number; shrunkGain: number; medianObserved: number | null} {
  if (!observedGains.length) {
    return {weight: 0, shrunkGain: priorGain, medianObserved: null};
  }
  const sorted = [...observedGains].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const weight = observedGains.length / (observedGains.length + priorStrength);
  const shrunk = (1 - weight) * priorGain + weight * median;
  return {
    weight: Number(weight.toFixed(3)),
    shrunkGain: Number(shrunk.toFixed(4)),
    medianObserved: Number(median.toFixed(4)),
  };
}

/**
 * Evaluates what TOP1 has learned about ONE athlete's attendance and physical response
 * separately, keeping overall performance score strictly separate from goal probability.
 */
export function evaluatePersonalLearning(input: {
  dossier: AthleteDossier;
  plan: AdaptivePlan;
  observations: readonly Observation[];
  priorGainPerSession: number;
  now?: Date;
}): PersonalLearningSummary {
  const {dossier, plan, observations, priorGainPerSession} = input;
  const nowMs = (input.now ?? new Date()).getTime();
  const metric = goalMetrics.find(m => m.id === plan.config.metric);

  let completed = 0;
  let modified = 0;
  let skipped = 0;
  let equipmentSubstitutions = 0;
  const timeSkipsByWeekday = new Map<IsoWeekday, number>();

  for (const event of plan.sessions) {
    if (event.deleted || Date.parse(event.recordedAt) > nowMs) continue;
    const w = event.data as Workout;
    const rec = sessionResult(w);
    if (!rec || rec.routineId !== plan.config.routineId) continue;

    if (w.status === 'abandoned') {
      skipped++;
      if (rec.checkInReason === 'time' || rec.checkInReason === 'time-short') {
        const wd = isoWeekdayForDay(rec.day);
        timeSkipsByWeekday.set(wd, (timeSkipsByWeekday.get(wd) ?? 0) + 1);
      }
    } else if (w.status === 'completed') {
      const actual = actualDose(w);
      const subReason = w.exercises[0]?.substitutionReason ?? '';
      if (/equipment|barbell|no bar|unavailable/i.test(subReason)) {
        equipmentSubstitutions++;
      }
      const isExact =
        Boolean(actual) &&
        !subReason &&
        w.exercises[0]?.name === w.snapshot.exercises[0]?.name &&
        actual!.sets === rec.dose.sets &&
        actual!.amount === rec.dose.amount &&
        actual!.loadKg === rec.dose.loadKg;
      if (isExact) completed++;
      else modified++;
    }
  }

  const logged = completed + modified + skipped;
  const rate = logged > 0 ? (completed + modified) / logged : null;

  // Detect repeated time-related skips (>= 2) on a weekday that doesn't already have a short rule
  let calendarSuggestion: CalendarLearningSuggestion | null = null;
  for (const [wd, count] of timeSkipsByWeekday.entries()) {
    if (count < 2) continue;
    if (dossier.constraints.weekdayMinutes[wd] !== undefined) continue;
    const suggestedMinutes = Math.max(15, Math.min(25, Math.round(plan.config.minutes / 2)));
    // Use a reference date for that ISO weekday (2026-11-23 is Monday = ISO 1)
    const refDay = `2026-11-${String(22 + Number(wd)).padStart(2, '0')}`;
    const enDay = weekdayLabel(refDay, 'en');
    const frDay = weekdayLabel(refDay, 'fr');
    const arDay = weekdayLabel(refDay, 'ar');
    calendarSuggestion = {
      weekday: wd,
      timeRelatedSkips: count,
      suggestedMinutes,
      prompt: [
        `You skipped ${count} ${enDay} sessions for time — want TOP1 to plan ${suggestedMinutes}-min ${enDay}s automatically?`,
        `Tu as passé ${count} séances du ${frDay} par manque de temps — veux-tu limiter les ${frDay}s à ${suggestedMinutes} min ?`,
        `تخطيت ${count} حصص يوم ${arDay} بسبب الوقت — هل تريد ضبط أيام ${arDay} تلقائيًا على ${suggestedMinutes} دقيقة؟`,
      ],
    };
    break;
  }

  // Physical response: ONLY comparable tests of the SAME metric after plan start
  const perSessionGains: number[] = [];
  if (metric) {
    const tests = (datedTests(observations, nowMs).get(metric.id) ?? []).filter(
      t => t.at >= Date.parse(plan.config.createdAt) - 7 * 86_400_000,
    );
    for (let i = 1; i < tests.length; i++) {
      const prev = tests[i - 1];
      const next = tests[i];
      if (!comparableDelta([prev.entry, next.entry], nowMs)) continue;
      const a = testedValue(metric, plan.config.goalUnit, prev, nowMs);
      const b = testedValue(metric, plan.config.goalUnit, next, nowMs);
      if (a === undefined || b === undefined) continue;
      // Count completed sessions strictly in (prev, next]
      const intervalWorkouts = plan.sessions.filter(ev => {
        if (ev.deleted) return false;
        const w = ev.data as Workout;
        if (w.status !== 'completed' || !w.endedAt) return false;
        const t = Date.parse(w.endedAt);
        return t > prev.at && t <= next.at;
      }).length;
      if (intervalWorkouts < 1) continue;
      const signedDelta = (b - a) * metric.polarity;
      perSessionGains.push(signedDelta / intervalWorkouts);
    }
  }

  const shrunk = shrinkPersonalGain(priorGainPerSession, perSessionGains, 3);

  return {
    version: OUTCOME_LEARNING_VERSION,
    metric: plan.config.metric,
    attendance: {
      logged,
      completed,
      modified,
      skipped,
      rate: rate === null ? null : Number(rate.toFixed(3)),
      equipmentSubstitutions,
      equipmentSubstitutionNote:
        equipmentSubstitutions > 0
          ? 'Substitutions caused by unavailable equipment are recorded as weak preference evidence only.'
          : null,
    },
    physicalResponse: {
      comparableIntervals: perSessionGains.length,
      personalEstimateUnlocked: perSessionGains.length >= 3,
      personalWeight: shrunk.weight,
      shrunkGainPerSession: perSessionGains.length > 0 ? shrunk.shrunkGain : null,
      priorGainPerSession,
      observedMedianGainPerSession: shrunk.medianObserved,
      crossExerciseTransferApplied: false,
    },
    calendarSuggestion,
  };
}

export type ProspectiveCohortRecord = {
  athleteId: string;
  metric: string;
  modelVersion: string;
  issuedAt: string;
  /** Predicted on-time probability (0..1) issued BEFORE the outcome. */
  predictedProbability: number;
  /** Simple baseline model probability (0..1) for held-out comparison. */
  baselineProbability: number;
  /** Observed outcome: true = reached on time, false = missed, null = missing follow-up. */
  reachedOnTime: boolean | null;
  /** Optional predicted finish window and actual achievement date for coverage scoring. */
  finishWindow?: {early: string; late: string} | null;
  actualAchievedOn?: string | null;
};

export type CohortEvaluationReport = {
  totalIssued: number;
  measuredOutcomes: number;
  missingFollowUpCount: number;
  missingFollowUpRate: number;
  candidateBrierScore: number | null;
  baselineBrierScore: number | null;
  brierImprovement: number | null;
  meanPredicted: number | null;
  observedSuccessRate: number | null;
  calibrationGap: number | null;
  finishWindowEvaluated: number;
  finishWindowCoverage: number | null;
  /** Promotion gate: requires >= 20 independent measured outcomes, <= 30% missing follow-up, and >= 0.002 Brier improvement. */
  shouldPromote: boolean;
  promotionReason: string;
};

/**
 * Held-out prospective evaluation for population-level model updates (BMJ 2024 standard).
 * Enforces one attempt per independent athlete, reports missing follow-up, Brier score,
 * calibration gap, and finish-window coverage, and gates promotion with a rollback path.
 */
export function evaluateCohortCalibration(
  records: readonly ProspectiveCohortRecord[],
  options: {minIndependentOutcomes?: number; maxMissingRate?: number; minBrierGain?: number} = {},
): CohortEvaluationReport {
  const minOutcomes = options.minIndependentOutcomes ?? 20;
  const maxMissingRate = options.maxMissingRate ?? 0.3;
  const minBrierGain = options.minBrierGain ?? 0.002;

  // Enforce independence: at most one prospective attempt per athlete (earliest issued)
  const byAthlete = new Map<string, ProspectiveCohortRecord>();
  const sorted = [...records].sort((a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt));
  for (const r of sorted) {
    if (!byAthlete.has(r.athleteId)) byAthlete.set(r.athleteId, r);
  }
  const unique = [...byAthlete.values()];
  const totalIssued = unique.length;
  const measured = unique.filter(r => r.reachedOnTime !== null);
  const missingFollowUpCount = totalIssued - measured.length;
  const missingFollowUpRate = totalIssued > 0 ? missingFollowUpCount / totalIssued : 0;

  if (!measured.length) {
    return {
      totalIssued,
      measuredOutcomes: 0,
      missingFollowUpCount,
      missingFollowUpRate: Number(missingFollowUpRate.toFixed(4)),
      candidateBrierScore: null,
      baselineBrierScore: null,
      brierImprovement: null,
      meanPredicted: null,
      observedSuccessRate: null,
      calibrationGap: null,
      finishWindowEvaluated: 0,
      finishWindowCoverage: null,
      shouldPromote: false,
      promotionReason: 'No measured follow-up outcomes yet.',
    };
  }

  let candSum = 0;
  let baseSum = 0;
  let predSum = 0;
  let obsSum = 0;
  let winCount = 0;
  let winHits = 0;

  for (const r of measured) {
    const y = r.reachedOnTime ? 1 : 0;
    candSum += (r.predictedProbability - y) ** 2;
    baseSum += (r.baselineProbability - y) ** 2;
    predSum += r.predictedProbability;
    obsSum += y;
    if (r.finishWindow && r.actualAchievedOn) {
      winCount++;
      if (r.actualAchievedOn >= r.finishWindow.early && r.actualAchievedOn <= r.finishWindow.late) {
        winHits++;
      }
    }
  }

  const n = measured.length;
  const candidateBrierScore = Number((candSum / n).toFixed(5));
  const baselineBrierScore = Number((baseSum / n).toFixed(5));
  const brierImprovement = Number((baselineBrierScore - candidateBrierScore).toFixed(5));
  const meanPredicted = Number((predSum / n).toFixed(4));
  const observedSuccessRate = Number((obsSum / n).toFixed(4));
  const calibrationGap = Number((observedSuccessRate - meanPredicted).toFixed(4));
  const finishWindowCoverage = winCount > 0 ? Number((winHits / winCount).toFixed(4)) : null;

  let shouldPromote = false;
  let promotionReason = '';
  if (n < minOutcomes) {
    promotionReason = `Need at least ${minOutcomes} independent measured outcomes (have ${n}).`;
  } else if (missingFollowUpRate > maxMissingRate) {
    promotionReason = `Missing follow-up rate ${(missingFollowUpRate * 100).toFixed(1)}% exceeds ${(maxMissingRate * 100).toFixed(0)}% threshold.`;
  } else if (brierImprovement < minBrierGain) {
    promotionReason = `Brier improvement (${brierImprovement}) is below promotion threshold (${minBrierGain}); keep previous model.`;
  } else {
    shouldPromote = true;
    promotionReason = `Held-out Brier score improved by ${brierImprovement} across ${n} independent athletes; eligible for promotion with rollback retained.`;
  }

  return {
    totalIssued,
    measuredOutcomes: n,
    missingFollowUpCount,
    missingFollowUpRate: Number(missingFollowUpRate.toFixed(4)),
    candidateBrierScore,
    baselineBrierScore,
    brierImprovement,
    meanPredicted,
    observedSuccessRate,
    calibrationGap,
    finishWindowEvaluated: winCount,
    finishWindowCoverage,
    shouldPromote,
    promotionReason,
  };
}
