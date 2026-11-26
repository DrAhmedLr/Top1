import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@libsql/client';
import { createDatabase, type AppDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { appRouter } from './routers/index.js';

describe('@apexlift/server TOP1% unified engine integration', () => {
  let client: Client;
  let db: AppDatabase;
  let token: string;

  beforeAll(async () => {
    const conn = await createDatabase(':memory:');
    client = conn.client;
    db = conn.db;
    await seedDatabase(db);

    const anon = appRouter.createCaller({ db });
    const login = await anon.auth.signIn({
      identifier: 'demo@apexlift.app',
      password: 'demo1234',
    });
    token = login.accessToken;
  });

  afterAll(() => {
    client.close();
  });

  const authed = () =>
    appRouter.createCaller({ db, authorizationHeader: `Bearer ${token}` });

  it('serves live TOP1% Overview, 3-pillar scores, 4 areas, and Benchmark Lab metrics', async () => {
    const caller = authed();
    const overview = await caller.top1.getOverview();
    expect(overview.overall.coverage).toBe(4);
    expect(overview.overall.overall).not.toBeNull();
    expect(overview.scientific.ready).toBe(true);
    expect(overview.scientific.pillars.length).toBe(3);
    expect(overview.wearable.hasWearableData).toBe(true);
    expect(overview.coachDecision).not.toBeNull();

    const metrics = await caller.top1.listMetrics({ pillar: 'all', tier: 'all' });
    expect(metrics.items.length).toBeGreaterThanOrEqual(25);

    const logged = await caller.top1.logObservation({
      metricId: 'pushups',
      value: 52,
      method: 'manual',
    });
    expect(logged.metricId).toBe('pushups');
    expect(logged.overallChange).not.toBeNull();
    expect(logged.overallBadge.topLabel).toContain('Top');
  });

  it('runs Scenario Simulator and Percentile Explorer accurately', async () => {
    const caller = authed();
    const sim = await caller.top1.simulateScenario({
      targetScore: 78,
      strategy: 'Balanced',
    });
    expect(sim.points.length).toBeGreaterThan(1);
    expect(sim.metricTargets.length).toBeGreaterThan(0);

    const explored = await caller.top1.exploreRank({
      metricId: 'bench_1rm',
      value: 1.5,
      age: 27,
      sex: 'male',
      weightKg: 82,
    });
    expect(explored.percent).not.toBeNull();
    expect(explored.percent!).toBeLessThanOrEqual(1.2);
    expect(explored.badge.badgeTier).toBe('Champion');
  });

  it('evaluates Coach Decision Engine with time/discomfort guardrails & creates adaptive goal programs', async () => {
    const caller = authed();
    const normal = await caller.coach.getTodayDecision();
    expect(normal.hasPlan).toBe(true);
    expect(normal.decision).not.toBeNull();

    const shortDay = await caller.coach.getTodayDecision({ availableMinutes: 15 });
    expect(shortDay.decision).not.toBeNull();
    expect(['shorten', 'move', 'rest', 'keep', 'substitute']).toContain(shortDay.decision!.action);

    const painful = await caller.coach.getTodayDecision({
      discomfort: { severity: 'concerning', area: 'shoulder' },
    });
    expect(painful.decision?.action).toBe('rest');

    const accepted = await caller.coach.acceptDecision({
      planId: normal.planId!,
      targetDay: normal.targetDay!,
      action: normal.decision!.action,
      reasonCode: normal.decision!.reasonCode,
      decisionJson: JSON.stringify(normal.decision),
    });
    expect(accepted.id).toBeTruthy();

    const created = await caller.coach.createGoalProgram({
      metricId: 'pullups',
      goalUnit: 'metric',
      baseline: 18,
      target: 25,
      weeks: 8,
      daysPerWeek: 3,
      minutesPerSession: 35,
    });
    expect(created.planId).toBeTruthy();

    const progs = await caller.coach.listPrograms();
    expect(progs.programs.length).toBeGreaterThanOrEqual(2);

    const opt = await caller.coach.getSelfOptimization();
    expect(opt.policy.version).toBe('self-opt-v1');
  });

  it('computes 3-mode Physiology Bodygraph, Structural Balance & Smart Recovery-Aware Workout Generator', async () => {
    const caller = authed();
    const report = await caller.physiology.getBodyReport();
    expect(Object.keys(report.svgMuscles).length).toBe(20);
    expect(report.structuralBalance.length).toBe(3);
    // Recent seeded Push workout should make chest recovery < 100%
    expect(report.svgMuscles['Lower Chest'].recoveryPercent).toBeLessThan(100);

    const smart = await caller.workoutGeneration.generateWorkout({
      mode: 'smart_next',
      preset: 'gym',
      durationMin: 45,
    });
    expect(smart.status).toBe('generated');
    expect(smart.exercises.length).toBeGreaterThan(0);
    expect(smart.timeBreakdown.totalMinutes).toBeLessThanOrEqual(46);

    const guarded = await caller.workoutGeneration.generateWorkout({
      mode: 'smart_next',
      durationMin: 45,
      discomfort: { severity: 'concerning', area: 'knee' },
    });
    expect(guarded.status).toBe('rest_recommended');
    expect(guarded.exercises.length).toBe(0);
  });

  it('enforces RMSSD-only Wearable Readiness and auto-syncs logged workouts into TOP1% standings', async () => {
    const caller = authed();

    await expect(
      caller.wearable.upsertSnapshot({
        date: '2026-11-25',
        source: 'apple_watch',
        hrvRmssdMs: 55,
        hrvStatistic: 'sdnn',
      })
    ).rejects.toThrow(/RMSSD/);

    const savedWear = await caller.wearable.upsertSnapshot({
      date: '2026-11-25',
      source: 'apple_watch',
      hrvRmssdMs: 79,
      restingHeartRateBpm: 51,
      totalSleepMinutes: 470,
      sleepEfficiencyPercent: 94,
      wristTempDeviationC: 0.0,
      cardioLoadTrimp: 70,
    });
    expect(savedWear.readiness.hasWearableData).toBe(true);

    const post = await caller.post.create({
      title: 'TOP1 Bench & Push-up Test',
      durationSeconds: 2400,
      exercises: [
        {
          exerciseId: 'ex_bench_press',
          notes: 'Felt strong',
          sets: [
            { weightKg: 110, reps: 5, rpe: 8.5, setType: 'normal', isCompleted: true },
          ],
        },
        {
          exerciseId: 'ex_push_ups',
          notes: 'Strict form',
          sets: [{ weightKg: 0, reps: 55, rpe: 9, setType: 'normal', isCompleted: true }],
        },
      ],
    });
    expect(post.top1Impact).not.toBeNull();
    expect(post.top1Impact!.syncedBenchmarks.length).toBe(2);
  });
});
