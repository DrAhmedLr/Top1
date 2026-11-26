import { describe, expect, it } from 'vitest';
import {
  buildRankPredictionCurve,
  calculateEstimated1RM,
  calculateExerciseRank,
  calculateTargetWeightForRating,
  kgToLbs,
  lbsToKg,
  ratingToRank,
  solvePlatesPerSide,
  STANDARD_KG_PLATES,
  STANDARD_LBS_PLATES,
  xpToLevel,
} from './index';

describe('@apexlift/shared rank & unit math', () => {
  it('maps SR boundaries accurately across tiers and divisions', () => {
    expect(ratingToRank(0).tier).toBe('Unranked');
    expect(ratingToRank(1).label).toBe('Wood I');
    expect(ratingToRank(200).label).toBe('Bronze I');
    expect(ratingToRank(350).tier).toBe('Enthusiast');
    expect(ratingToRank(400).label).toBe('Gold I');
    expect(ratingToRank(650).tier).toBe('Elite');
    expect(ratingToRank(900).label).toBe('Olympian I');
  });

  it('computes 1RM and allometric exercise rank consistently', () => {
    expect(calculateEstimated1RM(100, 1)).toBe(100);
    expect(calculateEstimated1RM(100, 5)).toBeGreaterThan(112);

    const goldBench = calculateExerciseRank({
      weightKg: 80,
      reps: 5,
      bodyweightKg: 80,
      sex: 'Male',
      standard: { maleBaseFactor: 4.9, femaleBaseFactor: 3.1 },
    });
    expect(goldBench.rating).toBeGreaterThan(350);
    expect(goldBench.estimatedOneRmKg).toBeGreaterThan(85);

    const targetKg = calculateTargetWeightForRating({
      targetRating: 500,
      reps: 5,
      bodyweightKg: 80,
      sex: 'Male',
      standard: { maleBaseFactor: 4.9, femaleBaseFactor: 3.1 },
    });
    expect(targetKg).toBeGreaterThan(80);
  });

  it('solves barbell plate loading for lbs and kg', () => {
    const lbs = solvePlatesPerSide(225, 45, STANDARD_LBS_PLATES);
    expect(lbs.platesPerSide).toEqual([45, 45]);
    expect(lbs.achievedTotal).toBe(225);
    expect(lbs.remainder).toBe(0);

    const kg = solvePlatesPerSide(100, 20, STANDARD_KG_PLATES);
    expect(kg.platesPerSide).toEqual([25, 15]);
    expect(kg.achievedTotal).toBe(100);
  });

  it('converts units, generates prediction curves, and computes levels', () => {
    expect(kgToLbs(100)).toBeCloseTo(220.5, 1);
    expect(lbsToKg(225)).toBeCloseTo(102.06, 1);
    const curve = buildRankPredictionCurve(320, 4, 12);
    expect(curve).toHaveLength(13);
    expect(curve[12].rating).toBeGreaterThan(curve[0].rating);
    expect(xpToLevel(0).level).toBe(1);
    expect(xpToLevel(600).level).toBe(3);
  });
});
