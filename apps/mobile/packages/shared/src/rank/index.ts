import {
  MAX_LEGIT_GSR,
  RANK_DISPLAY_NAMES,
  RANK_SR_FLOORS,
  RANK_TIERS,
  type RankTier,
} from '../constants';

export type RankingSex = 'Male' | 'Female';

export interface RankResult {
  rating: number; // 0..2000 GSR
  tier: RankTier;
  displayName: string;
  division: 0 | 1 | 2 | 3;
  label: string;
  progressToNext: number; // 0..1
  nextThresholdRating: number;
  estimatedOneRmKg: number;
}

export interface ExerciseRankStandard {
  /** Multiplier relative to bodyweight^0.67 at Intermediate (Gold 1, SR=400) for Male */
  maleBaseFactor: number;
  /** Multiplier relative to bodyweight^0.67 at Intermediate (Gold 1, SR=400) for Female */
  femaleBaseFactor: number;
  /** If true, bodyweight is included in total lifted load (e.g. pull-ups, dips) */
  includesBodyweight?: boolean;
}

export const DEFAULT_EXERCISE_STANDARD: ExerciseRankStandard = {
  maleBaseFactor: 4.0,
  femaleBaseFactor: 2.8,
  includesBodyweight: false,
};

/**
 * Epley + Brzycki hybrid 1RM estimator (clamped safely for high reps).
 */
export function calculateEstimated1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return Number(weightKg.toFixed(2));
  const clampedReps = Math.min(reps, 30);
  const epley = weightKg * (1 + clampedReps / 30);
  if (clampedReps <= 10) {
    const brzycki = weightKg * (36 / (37 - clampedReps));
    return Number(((epley + brzycki) / 2).toFixed(2));
  }
  return Number(epley.toFixed(2));
}

/**
 * Convert raw GSR rating (0..2000) into Tier + Division (I, II, III) + progress.
 */
export function ratingToRank(rawRating: number): Omit<RankResult, 'estimatedOneRmKg'> {
  const rating = Math.max(0, Math.min(MAX_LEGIT_GSR, Math.round(rawRating)));

  if (rating <= 0) {
    return {
      rating: 0,
      tier: 'Unranked',
      displayName: RANK_DISPLAY_NAMES.Unranked,
      division: 0,
      label: 'Unranked',
      progressToNext: 0,
      nextThresholdRating: 1,
    };
  }

  if (rating >= RANK_SR_FLOORS.Olympian) {
    return {
      rating,
      tier: 'Olympian',
      displayName: RANK_DISPLAY_NAMES.Olympian,
      division: 1,
      label: 'Olympian I',
      progressToNext: 1,
      nextThresholdRating: MAX_LEGIT_GSR,
    };
  }

  let matchedTier: RankTier = 'Rookie';
  let floor = 1;
  let ceiling = 200;

  for (let i = 1; i < RANK_TIERS.length - 1; i++) {
    const tier = RANK_TIERS[i];
    const nextTier = RANK_TIERS[i + 1];
    const tierFloor = RANK_SR_FLOORS[tier];
    const nextFloor = RANK_SR_FLOORS[nextTier];
    if (rating >= tierFloor && rating < nextFloor) {
      matchedTier = tier;
      floor = tierFloor;
      ceiling = nextFloor;
      break;
    }
  }

  const span = ceiling - floor;
  const offset = rating - floor;
  const third = span / 3;
  const division = Math.min(3, Math.floor(offset / third) + 1) as 1 | 2 | 3;
  const divFloor = floor + (division - 1) * third;
  const divCeil = floor + division * third;
  const progressToNext = Math.max(0, Math.min(1, (rating - divFloor) / (divCeil - divFloor)));
  const roman = division === 1 ? 'I' : division === 2 ? 'II' : 'III';
  const displayName = RANK_DISPLAY_NAMES[matchedTier];

  return {
    rating,
    tier: matchedTier,
    displayName,
    division,
    label: `${displayName} ${roman}`,
    progressToNext: Number(progressToNext.toFixed(3)),
    nextThresholdRating: Math.ceil(divCeil),
  };
}

/**
 * Calculate clean-room Strength Rating (GSR) for a single set using allometric bodyweight scaling.
 */
export function calculateExerciseRank(params: {
  weightKg: number;
  reps: number;
  bodyweightKg: number;
  sex: RankingSex;
  standard?: ExerciseRankStandard;
}): RankResult {
  const bw = Math.max(35, params.bodyweightKg || 75);
  const std = params.standard ?? DEFAULT_EXERCISE_STANDARD;
  const effectiveWeight = std.includesBodyweight ? bw + Math.max(0, params.weightKg) : params.weightKg;
  const e1rm = calculateEstimated1RM(effectiveWeight, params.reps);

  if (e1rm <= 0) {
    return { ...ratingToRank(0), estimatedOneRmKg: 0 };
  }

  const allometricBw = Math.pow(bw, 0.67);
  const baseFactor = params.sex === 'Female' ? std.femaleBaseFactor : std.maleBaseFactor;
  // Reference Gold I (SR = 400) equals baseFactor * bw^0.67
  const goldOneRm = baseFactor * allometricBw;
  const ratio = e1rm / Math.max(1, goldOneRm);
  // Smooth monotonic curve mapping ratio=1.0 -> 400 SR, ratio=2.25 -> 900 SR (Olympian)
  const rating = Math.round(400 * Math.pow(ratio, 1.0));
  return {
    ...ratingToRank(rating),
    estimatedOneRmKg: e1rm,
  };
}

/**
 * Predict weight (kg) required at given reps to reach a target GSR rating.
 */
export function calculateTargetWeightForRating(params: {
  targetRating: number;
  reps: number;
  bodyweightKg: number;
  sex: RankingSex;
  standard?: ExerciseRankStandard;
}): number {
  const bw = Math.max(35, params.bodyweightKg || 75);
  const std = params.standard ?? DEFAULT_EXERCISE_STANDARD;
  const baseFactor = params.sex === 'Female' ? std.femaleBaseFactor : std.maleBaseFactor;
  const goldOneRm = baseFactor * Math.pow(bw, 0.67);
  const targetE1rm = (params.targetRating / 400) * goldOneRm;
  const clampedReps = Math.max(1, Math.min(30, params.reps));
  const rawWeight = clampedReps === 1 ? targetE1rm : targetE1rm / (1 + clampedReps / 30);
  const adjusted = std.includesBodyweight ? Math.max(0, rawWeight - bw) : rawWeight;
  return Number(adjusted.toFixed(1));
}

/**
 * Generate a 12-week rank progression curve for onboarding & prediction charts.
 */
export function buildRankPredictionCurve(
  currentRating: number,
  weeklySessions: number,
  weeks = 12
): Array<{ week: number; rating: number; label: string }> {
  const gainPerWeek = Math.max(6, Math.min(22, 5 + weeklySessions * 2.8));
  const points: Array<{ week: number; rating: number; label: string }> = [];
  for (let w = 0; w <= weeks; w++) {
    // Mild diminishing returns curve
    const projected = Math.min(
      MAX_LEGIT_GSR,
      Math.round(currentRating + gainPerWeek * w * Math.pow(0.985, w))
    );
    const r = ratingToRank(projected);
    points.push({ week: w, rating: projected, label: r.label });
  }
  return points;
}

/**
 * Solve plates needed per side for a target barbell weight.
 */
export function solvePlatesPerSide(
  totalWeight: number,
  barWeight: number,
  availablePlates: readonly number[]
): { platesPerSide: number[]; achievedTotal: number; remainder: number } {
  if (totalWeight <= barWeight) {
    return { platesPerSide: [], achievedTotal: barWeight, remainder: 0 };
  }
  const sorted = [...availablePlates].sort((a, b) => b - a);
  let remainingPerSide = (totalWeight - barWeight) / 2;
  const platesPerSide: number[] = [];

  for (const plate of sorted) {
    if (plate <= 0) continue;
    while (remainingPerSide >= plate - 0.001 && platesPerSide.length < 12) {
      platesPerSide.push(plate);
      remainingPerSide -= plate;
    }
  }

  const sideSum = platesPerSide.reduce((sum, p) => sum + p, 0);
  const achievedTotal = Number((barWeight + sideSum * 2).toFixed(2));
  const remainder = Number(Math.max(0, totalWeight - achievedTotal).toFixed(2));
  return { platesPerSide, achievedTotal, remainder };
}
