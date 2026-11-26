import { describe, expect, it } from 'vitest';
import {
  buildAthleteDossier,
  buildBodyPhysiologyReport,
  challengeProgress,
  demoValues,
  evaluate,
  evaluateWearableReadiness,
  generateAdaptiveWorkout,
  normalizeWearableSnapshot,
  overallPerformance,
  performanceTier,
  simulate,
  translate,
} from './index';

describe('@top1/engine core scientific & adaptive algorithms', () => {
  it('evaluates 3-pillar scientific model score and simulates scenarios', () => {
    const profile = { age: 28, sex: 'male' as const, weight: 78, height: 180 };
    const details = {
      bench_1rm: { method: 'direct_1rm' as const, measuredAt: '2026-11-20T10:00:00Z' },
      squat_1rm: { method: 'direct_1rm' as const, measuredAt: '2026-11-20T10:00:00Z' },
      deadlift_1rm: { method: 'direct_1rm' as const, measuredAt: '2026-11-20T10:00:00Z' },
      total_sleep: { method: 'device' as const, measuredAt: '2026-11-20T10:00:00Z' },
      rhr: { method: 'device' as const, measuredAt: '2026-11-20T10:00:00Z' },
    };
    const res = evaluate(demoValues, profile, details);
    expect(res.ready).toBe(true);
    expect(res.modelScore).toBeGreaterThan(40);
    expect(res.modelScore).toBeLessThanOrEqual(100);
    expect(res.domains.strength).toBeDefined();

    const sim = simulate(demoValues, profile, Math.min(95, res.modelScore + 6), 'Balanced', details);
    expect(sim.points.length).toBeGreaterThan(1);
  });

  it('computes TOP1% Overall Performance Rank across 4 areas with weakest-link limiter', () => {
    const profile = { age: 28, sex: 'male' as const, weight: 78 };
    const values = {
      bench_1rm: 1.5, // Top 1%
      pushups: 60, // Top 1%
      pullups: 12, // Top 10%
      squat_1rm: 1.7, // Top 10%
      run_5k: 25, // Top 10%
    };
    const details = {
      bench_1rm: { method: 'direct_1rm' as const, measuredAt: '2026-11-20T10:00:00Z' },
      pushups: { method: 'manual' as const, measuredAt: '2026-11-20T10:00:00Z' },
      pullups: { method: 'manual' as const, measuredAt: '2026-11-20T10:00:00Z' },
      squat_1rm: { method: 'direct_1rm' as const, measuredAt: '2026-11-20T10:00:00Z' },
      run_5k: { method: 'device' as const, measuredAt: '2026-11-20T10:00:00Z' },
    };
    const overall = overallPerformance(values, details, profile);
    expect(overall.coverage).toBe(4);
    expect(overall.overall).not.toBeNull();
    expect(overall.overall!.percent).toBeGreaterThan(0);
    expect(overall.overall!.percent).toBeLessThan(20);
    expect(performanceTier(0.85)).toBe('1%');

    const prog = challengeProgress('pushups', 30, profile);
    expect(prog).not.toBeNull();
    expect(prog!.next).not.toBeNull();
  });

  it('validates wearable readiness (rejects SDNN, detects illness guardrail)', () => {
    expect(() =>
      normalizeWearableSnapshot({
        date: '2026-11-25',
        source: 'apple_watch',
        hrvRmssdMs: 55,
        hrvStatistic: 'sdnn',
      })
    ).toThrow(/RMSSD/);

    const history = Array.from({ length: 10 }, (_, idx) =>
      normalizeWearableSnapshot({
        date: `2026-11-${String(10 + idx).padStart(2, '0')}`,
        source: 'apple_watch',
        hrvRmssdMs: 72,
        restingHeartRateBpm: 52,
        totalSleepMinutes: 460,
        cardioLoadTrimp: 65,
      })
    );
    history.push(
      normalizeWearableSnapshot({
        date: '2026-11-20',
        source: 'apple_watch',
        hrvRmssdMs: 38,
        restingHeartRateBpm: 63,
        totalSleepMinutes: 340,
        wristTempDeviationC: 1.1,
        cardioLoadTrimp: 90,
      })
    );
    const readiness = evaluateWearableReadiness(history, '2026-11-20');
    expect(readiness.hasWearableData).toBe(true);
    expect(readiness.illnessOrOverreachingFlag).toBe(true);
  });

  it('builds body physiology report and adaptive time-bounded workout with clinical guardrails', () => {
    const dossier = buildAthleteDossier({
      owner: 'demo',
      profile: { age: 29, sex: 'male', weight: 78, height: 180 },
      values: { bench_1rm: 1.35, squat_1rm: 1.65, pullups: 14 },
      details: {
        bench_1rm: { method: 'direct_1rm', measuredAt: '2026-11-20T10:00:00Z' },
        squat_1rm: { method: 'direct_1rm', measuredAt: '2026-11-20T10:00:00Z' },
        pullups: { method: 'manual', measuredAt: '2026-11-20T10:00:00Z' },
      },
      asOf: '2026-11-25T12:00:00Z',
    });

    const report = buildBodyPhysiologyReport({
      dossier,
      trainingEvents: [],
      asOf: new Date('2026-11-25T12:00:00Z'),
    });
    expect(report.muscles.mid_chest.recovery.percent).toBe(100);
    expect(report.structuralBalance.length).toBe(3);

    const workout = generateAdaptiveWorkout({
      dossier,
      trainingEvents: [],
      request: {
        mode: 'smart_next',
        preset: 'gym',
        availableMinutes: 45,
        asOf: new Date('2026-11-25T12:00:00Z'),
      },
    });
    expect(workout.status).toBe('generated');
    expect(workout.exercises.length).toBeGreaterThan(0);
    expect(workout.timeBreakdown.totalMinutes).toBeLessThanOrEqual(46);

    const guarded = generateAdaptiveWorkout({
      dossier,
      trainingEvents: [],
      request: {
        mode: 'smart_next',
        availableMinutes: 45,
        discomfort: { severity: 'concerning', area: 'shoulder' },
      },
    });
    expect(guarded.status).toBe('rest_recommended');
    expect(guarded.exercises.length).toBe(0);
  });

  it('translates UI messages in French and Arabic', () => {
    expect(translate('en', 'Strength')).toBe('Strength');
    expect(translate('fr', 'Strength').length).toBeGreaterThan(0);
    expect(translate('ar', 'Strength').length).toBeGreaterThan(0);
  });
});
