import { describe, expect, it } from 'vitest';
import { buildAthleteDossier, buildBodyPhysiologyReport } from '@top1/engine';
import {
  buildSvgMuscleMapFromPhysiology,
  buildTop1WorkoutEventFromPost,
  detectTop1BenchmarkFromSets,
  RANKED_MUSCLE_GROUPS,
  topPercentToBadge,
} from './index';

describe('@apexlift/shared top1Bridge', () => {
  it('maps TOP1% percentiles to sculpted badge tiers deterministically', () => {
    expect(topPercentToBadge(0.08).badgeTier).toBe('Olympian');
    expect(topPercentToBadge(0.4).badgeTier).toBe('Titan');
    expect(topPercentToBadge(0.95).badgeTier).toBe('Champion');
    expect(topPercentToBadge(2.0).badgeTier).toBe('Elite');
    expect(topPercentToBadge(4.2).badgeTier).toBe('Veteran');
    expect(topPercentToBadge(8.5).badgeTier).toBe('Intermediate');
    expect(topPercentToBadge(18).badgeTier).toBe('Enthusiast');
    expect(topPercentToBadge(40).badgeTier).toBe('Novice');
    expect(topPercentToBadge(70).badgeTier).toBe('Rookie');
    expect(topPercentToBadge(null).badgeTier).toBe('Unranked');
  });

  it('maps all 19 TOP1 physiology muscles onto all 20 SVG bodygraph groups', () => {
    const dossier = buildAthleteDossier({
      owner: 'bridge-test',
      profile: { age: 28, sex: 'male', weight: 80 },
      values: { bench_1rm: 1.4, squat_1rm: 1.8 },
      details: {
        bench_1rm: { method: 'direct_1rm', measuredAt: '2026-11-24T10:00:00Z' },
        squat_1rm: { method: 'direct_1rm', measuredAt: '2026-11-24T10:00:00Z' },
      },
      asOf: '2026-11-25T10:00:00Z',
    });
    const report = buildBodyPhysiologyReport({ dossier, trainingEvents: [] });
    const svgMap = buildSvgMuscleMapFromPhysiology(report.muscles);
    expect(Object.keys(svgMap).length).toBe(RANKED_MUSCLE_GROUPS.length);
    expect(svgMap['Lower Chest'].muscleIds).toEqual(['mid_chest', 'lower_chest']);
    expect(svgMap['Upper Chest'].recoveryPercent).toBe(100);
  });

  it('detects competitive TOP1 benchmarks from logged workout sets', () => {
    const bench = detectTop1BenchmarkFromSets({
      exerciseName: 'Barbell Bench Press',
      bodyweightKg: 80,
      sets: [{ weightKg: 100, reps: 5, isCompleted: true }],
    });
    expect(bench?.metricId).toBe('bench_1rm');
    expect(bench?.value).toBeGreaterThan(1.4);

    const pushups = detectTop1BenchmarkFromSets({
      exerciseName: 'Push-Ups',
      bodyweightKg: 80,
      sets: [{ weightKg: 0, reps: 42, isCompleted: true }],
    });
    expect(pushups?.metricId).toBe('pushups');
    expect(pushups?.value).toBe(42);
  });

  it('converts a Liftoff workout post into a canonical Top1.Fit TrainingEvent', () => {
    const ev = buildTop1WorkoutEventFromPost({
      postId: 'pst_1',
      sequence: 1,
      title: 'Push Day',
      startedAt: '2026-11-25T09:00:00Z',
      completedAt: '2026-11-25T09:45:00Z',
      exercises: [
        {
          exerciseId: 'ex_bench',
          exerciseName: 'Barbell Bench Press',
          equipment: 'Barbell',
          sets: [
            { weightKg: 60, reps: 8, setType: 'warmup', isCompleted: true },
            { weightKg: 100, reps: 5, setType: 'normal', rpe: 8, isCompleted: true },
          ],
        },
      ],
    });
    expect(ev.kind).toBe('workout');
    expect((ev.data as { exercises: Array<{ sets: unknown[] }> }).exercises[0].sets.length).toBe(1);
  });
});
