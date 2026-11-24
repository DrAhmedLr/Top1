import assert from 'node:assert/strict';
import test from 'node:test';
import {buildAthleteDossier} from './athleteDossier';
import {
  ALL_DETAILED_EQUIPMENT,
  ALL_MUSCLES,
  EXERCISE_BY_ID,
  EXERCISE_CATALOG,
  findBiomechanicalSubstitutes,
  inferCustomExerciseProfile,
  isExerciseFeasible,
  matchExerciseByName,
  queryExercises,
} from './exerciseOntology';
import {buildBodyPhysiologyReport} from './musclePhysiology';
import {emptyWorkspace, normalizeTrainingContext, type PersonalWorkspace} from './personalWorkspace';
import {buildAthleteProgression, buildEntitlementPolicy} from './progressionEngine';
import {optimizePersonalPhysiology} from './selfOptimization';
import {appendTraining, type TrainingEvent, type Workout} from './training';
import {
  evaluateWearableReadiness,
  normalizeWearableSnapshot,
  type WearableDailySnapshot,
} from './wearableReadiness';
import {generateAdaptiveWorkout} from './workoutGenerator';

function makeAdHocWorkout(
  id: string,
  startedIso: string,
  endedIso: string,
  exercises: Array<{name: string; sets: Array<{reps?: number; loadKg?: number; durationSeconds?: number}>}>,
): TrainingEvent {
  const actualExercises: Workout['exercises'] = exercises.map(ex => ({
    id: crypto.randomUUID(),
    name: ex.name,
    notes: '',
    substitutionReason: '',
    status: 'performed',
    sets: ex.sets.map(s => ({
      id: crypto.randomUUID(),
      ...s,
      completed: true,
    })),
  }));
  const workout: Workout = {
    version: 1,
    name: 'Logged Training Session',
    notes: '',
    timeZone: 'UTC',
    startedAt: startedIso,
    endedAt: endedIso,
    status: 'completed',
    origin: null,
    snapshot: {name: 'Logged Training Session', exercises: []},
    exercises: actualExercises,
  };
  return appendTraining(
    [],
    {
      version: 1,
      id,
      requestId: crypto.randomUUID(),
      kind: 'workout',
      expectedRevision: 0,
      epoch: 0,
      data: workout,
      deleted: false,
      reason: '',
    },
    0,
    Date.parse(endedIso),
  )[0];
}

function makeTestDossier(asOf: Date, overrides: {benchBwRatio?: number; days?: number} = {}) {
  const workspace: PersonalWorkspace = {
    ...emptyWorkspace(),
    context: normalizeTrainingContext({
      experience: 'one_to_three',
      days: overrides.days ?? 2,
      minutes: 45,
      equipment: ['barbell', 'dumbbells', 'machines', 'pullup_bar', 'outdoor'],
      timezone: 'UTC',
      pinnedMetrics: ['bench_1rm'],
    }),
  };
  return buildAthleteDossier({
    owner: 'test-athlete',
    profile: {sex: 'male', age: 32, weight: 80},
    values: overrides.benchBwRatio !== undefined ? {bench_1rm: overrides.benchBwRatio} : {},
    details: {},
    observations: [],
    workspace,
    trainingEvents: [],
    asOf,
  });
}

test('exerciseOntology enforces simultaneous equipment dependencies, accurate anatomy, and joint-sparing substitutes', () => {
  const bench = EXERCISE_BY_ID.get('barbell_bench_press')!;
  const pushups = EXERCISE_BY_ID.get('push_ups')!;

  // Barbell bench requires BOTH bars_plates AND benches_racks
  assert.equal(isExerciseFeasible(bench, ['bars_plates']), false);
  assert.equal(isExerciseFeasible(bench, ['bars_plates', 'benches_racks']), true);

  // Fixes Liftoff misclassification: strict push-ups primarily hit mid_chest, not upper_chest
  const pushupPrimary = pushups.muscles.filter(m => m.role === 'primary').map(m => m.muscle);
  assert.deepEqual(pushupPrimary, ['mid_chest']);

  // Biomechanical substitution without barbell + with mild shoulder discomfort returns joint-friendly horizontal push
  const subs = findBiomechanicalSubstitutes('barbell_bench_press', {
    availableEquipment: ['none', 'small_weights'],
    discomfortArea: 'left shoulder',
  });
  assert.ok(subs.length >= 1);
  assert.ok(subs.every(s => (s.exercise.jointStress.shoulder ?? 0) <= 1));
  assert.ok(subs.some(s => s.exercise.id === 'dumbbell_floor_press' || s.exercise.id === 'push_ups'));

  // Travel filter only returns travel-friendly movements
  const travel = queryExercises({travelOnly: true, equipment: ['none']});
  assert.ok(travel.length >= 6);
  assert.ok(travel.every(ex => ex.travelFriendly));
});

test('musclePhysiology separates allometric capability from exponential recovery, detects push/pull imbalance, and protects upcoming goals', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  const dossier = makeTestDossier(now, {benchBwRatio: 1.0}); // 80 kg bench at 80 kg BW

  // Heavy push workout 6 hours ago (8 sets bench + 4 sets incline DB press), zero pull work
  const recentPush = makeAdHocWorkout(
    crypto.randomUUID(),
    '2026-11-24T05:00:00Z',
    '2026-11-24T06:00:00Z',
    [
      {
        name: 'Barbell Bench Press',
        sets: Array.from({length: 8}, () => ({reps: 6, loadKg: 65})),
      },
      {
        name: 'Incline Dumbbell Press',
        sets: Array.from({length: 4}, () => ({reps: 10, loadKg: 24})),
      },
    ],
  );

  const report = buildBodyPhysiologyReport({
    dossier,
    trainingEvents: [recentPush],
    asOf: now,
    upcomingGoalMetricsWithin36h: ['squat_1rm'],
  });

  // 1. Unmeasured lower-body muscles remain honestly `unmeasured` (never faked as Bronze)
  assert.equal(report.muscles.calves.capability.tier, 'unmeasured');
  assert.equal(report.muscles.calves.capability.score, null);

  // 2. Local recovery reflects acute fatigue: mid_chest is fatigued (<65%), whereas upper_back is fresh (>85%)
  assert.ok(report.muscles.mid_chest.recovery.percent < 65);
  assert.ok(report.muscles.mid_chest.recovery.hoursUntilReady > 0);
  assert.ok(report.muscles.upper_back.recovery.percent >= 85);

  // 3. Fractional weekly set accounting: 8 primary sets + 4*0.5 secondary sets = 10 effective mid_chest sets
  assert.equal(report.muscles.mid_chest.volume.weeklyEffectiveSets, 10);
  // Triceps got 0.5 * (8 + 4) = 6 fractional sets (not 12!)
  assert.equal(report.muscles.triceps.volume.weeklyEffectiveSets, 6);

  // 4. Antagonist balance audit flags push dominance and recommends pulling muscles
  const pushPull = report.structuralBalance.find(b => b.id === 'push_pull')!;
  assert.equal(pushPull.status, 'imbalanced');
  assert.ok(pushPull.remediationMuscles.includes('upper_back'));
  assert.ok(report.recommendedTargets.some(t => t.muscle === 'upper_back' || t.muscle === 'lats'));

  // 5. Upcoming squat_1rm goal protects quads/glutes/erectors
  assert.equal(report.muscles.quads.protectedForUpcomingGoal, true);
  assert.ok(report.protectedMuscles.some(p => p.muscle === 'quads' && p.reason === 'upcoming_goal'));

  // 6. 96 hours later, mid_chest recovers back to ready/fresh
  const laterReport = buildBodyPhysiologyReport({
    dossier,
    trainingEvents: [recentPush],
    asOf: new Date('2026-11-28T12:00:00Z'),
  });
  assert.ok(laterReport.muscles.mid_chest.recovery.percent >= 80);
});

test('workoutGenerator enforces clinical guardrails, joint sparing, upcoming-goal protection, grounded loads, and strict time physics', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  const dossier = makeTestDossier(now, {benchBwRatio: 1.0});

  // 1. Concerning discomfort ALWAYS returns rest_recommended with 0 sets
  const restPlan = generateAdaptiveWorkout({
    dossier,
    trainingEvents: [],
    request: {
      mode: 'smart_next',
      availableMinutes: 45,
      discomfort: {severity: 'concerning', area: 'shoulder'},
      asOf: now,
    },
  });
  assert.equal(restPlan.status, 'rest_recommended');
  assert.equal(restPlan.totalSets, 0);
  assert.ok(restPlan.safetyGuidance && restPlan.safetyGuidance.includes('clinician'));

  // 2. Upcoming bench_1rm goal protects mid_chest from smart_next generation
  const smartPlan = generateAdaptiveWorkout({
    dossier,
    trainingEvents: [],
    request: {
      mode: 'smart_next',
      availableMinutes: 35,
      upcomingGoalMetricsWithin36h: ['bench_1rm'],
      asOf: now,
    },
  });
  assert.equal(smartPlan.status, 'generated');
  assert.ok(smartPlan.exercises.length >= 2);
  assert.ok(smartPlan.timeBreakdown.totalMinutes <= 35);
  assert.ok(
    smartPlan.exercises.every(
      b => !b.musclesTargeted.some(m => m.muscle === 'mid_chest' && m.role === 'primary'),
    ),
  );

  // 3. Strict time physics invariant across all presets & tight time budgets (15..60 min)
  for (const preset of ['at_home', 'gym', 'cardio', 'travel', 'bodyweight', 'dumbbells_only'] as const) {
    for (const budget of [15, 25, 45]) {
      const gen = generateAdaptiveWorkout({
        dossier,
        trainingEvents: [],
        request: {mode: 'preset', preset, availableMinutes: budget, asOf: now},
      });
      assert.equal(gen.status, 'generated');
      assert.ok(gen.exercises.length >= 1, `preset ${preset} at ${budget}m should produce >= 1 block`);
      assert.ok(
        gen.timeBreakdown.totalMinutes <= budget,
        `preset ${preset} at ${budget}m exceeded time budget: ${gen.timeBreakdown.totalMinutes}`,
      );
    }
  }

  // 4. Grounded loads: unmeasured athlete gets null suggestedLoadKg (never fabricated!)
  const unmeasuredDossier = makeTestDossier(now);
  const targetedBench = generateAdaptiveWorkout({
    dossier: unmeasuredDossier,
    trainingEvents: [],
    request: {
      mode: 'target_muscles',
      targetMuscles: ['mid_chest'],
      availableMinutes: 40,
      asOf: now,
    },
  });
  assert.ok(targetedBench.exercises.every(e => e.suggestedLoadKg === null));
});

test('progressionEngine protects rest days in weekly streaks, caps daily XP gaming, spawns balance quests, and keeps core coaching unlocked', () => {
  const now = new Date('2026-11-24T12:00:00Z'); // Week 48
  const dossier = makeTestDossier(now, {days: 2, benchBwRatio: 1.0});

  // 3 consecutive weeks hitting 2 days/week (with 5 rest days every week) + 3 duplicate workouts on ONE day to test anti-gaming cap!
  const events: TrainingEvent[] = [
    // Week 46 (2 days)
    makeAdHocWorkout(crypto.randomUUID(), '2026-11-09T09:00:00Z', '2026-11-09T09:40:00Z', [
      {name: 'Barbell Bench Press', sets: [{reps: 5, loadKg: 70}, {reps: 5, loadKg: 70}]},
    ]),
    makeAdHocWorkout(crypto.randomUUID(), '2026-11-12T09:00:00Z', '2026-11-12T09:40:00Z', [
      {name: 'Barbell Bench Press', sets: [{reps: 5, loadKg: 70}, {reps: 5, loadKg: 70}]},
    ]),
    // Week 47 (2 days)
    makeAdHocWorkout(crypto.randomUUID(), '2026-11-16T09:00:00Z', '2026-11-16T09:40:00Z', [
      {name: 'Barbell Bench Press', sets: [{reps: 5, loadKg: 70}, {reps: 5, loadKg: 70}]},
    ]),
    makeAdHocWorkout(crypto.randomUUID(), '2026-11-19T09:00:00Z', '2026-11-19T09:40:00Z', [
      {name: 'Barbell Bench Press', sets: [{reps: 5, loadKg: 70}, {reps: 5, loadKg: 70}]},
    ]),
    // Week 48 (2 days, with 3 workouts stacked on Nov 23 to test anti-gaming!)
    makeAdHocWorkout(crypto.randomUUID(), '2026-11-23T08:00:00Z', '2026-11-23T08:35:00Z', [
      {name: 'Barbell Bench Press', sets: Array.from({length: 6}, () => ({reps: 6, loadKg: 70}))},
    ]),
    makeAdHocWorkout(crypto.randomUUID(), '2026-11-23T13:00:00Z', '2026-11-23T13:20:00Z', [
      {name: 'Strict Push-Ups', sets: [{reps: 10}]},
    ]),
    makeAdHocWorkout(crypto.randomUUID(), '2026-11-23T18:00:00Z', '2026-11-23T18:20:00Z', [
      {name: 'Strict Push-Ups', sets: [{reps: 10}]},
    ]),
    makeAdHocWorkout(crypto.randomUUID(), '2026-11-24T08:00:00Z', '2026-11-24T08:40:00Z', [
      {name: 'Barbell Bench Press', sets: [{reps: 5, loadKg: 72.5}]},
    ]),
  ];

  const physiology = buildBodyPhysiologyReport({dossier, trainingEvents: events, asOf: now});
  const prog = buildAthleteProgression({
    dossier,
    trainingEvents: events,
    physiology,
    asOf: now,
    entitlementInput: {
      tier: 'trial_active',
      trialEndsAt: '2026-12-01T12:00:00Z',
      reminderLeadDays: 2,
    },
  });

  // 1. Recovery-safe 3-week streak earned with 5 rest days every week + 1 freeze token!
  assert.equal(prog.streak.weeklyStreakCount, 3);
  assert.equal(prog.streak.restDayProtected, true);
  assert.equal(prog.streak.freezeTokensAvailable, 1);
  assert.equal(prog.streak.status, 'completed_this_week');

  // 2. Anti-gaming daily cap caught the stacked Nov 23 sessions
  assert.equal(prog.level.antiGamingDailyCapAppliedDays, 1);
  assert.equal(prog.streak.sessionsThisWeek, 2); // 2 distinct days, NOT 4 workouts!

  // 3. Dynamic quest spawned for the real push:pull imbalance
  assert.ok(prog.quests.some(q => q.id === 'quest_balance_push_pull'));

  // 4. Clean trial reminder policy (2 days before Dec 01 -> Nov 29) + non-predatory core unlock
  assert.equal(prog.entitlements.reminderScheduledAt, '2026-11-29T12:00:00.000Z');
  assert.equal(prog.entitlements.coreCoachingUnlocked, true);
  assert.equal(prog.entitlements.safetyGuardrailsUnlocked, true);

  const freePolicy = buildEntitlementPolicy({tier: 'free_core'});
  assert.equal(freePolicy.coreCoachingUnlocked, true);
  assert.equal(freePolicy.safetyGuardrailsUnlocked, true);
});

test('optimizePersonalPhysiology learns personal recoveryTauHours and MRV ceiling from logged performance drop-offs and RPE overshoot', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  const dossier = makeTestDossier(now, {benchBwRatio: 1.0});

  const makeNotedWorkout = (
    startedIso: string,
    endedIso: string,
    loadKg: number,
    reps: number,
    setsCount: number,
    notes: string,
  ): TrainingEvent => {
    const base = makeAdHocWorkout(crypto.randomUUID(), startedIso, endedIso, [
      {name: 'Barbell Bench Press', sets: Array.from({length: setsCount}, () => ({reps, loadKg}))},
    ]);
    (base.data as Workout).notes = notes;
    return base;
  };

  // Sequence of heavy short-turnaround (24-36h) bench sessions showing progressive e1RM drop-offs & RPE 9.5+
  const overloadedEvents: TrainingEvent[] = [
    makeNotedWorkout('2026-11-15T08:00:00Z', '2026-11-15T08:45:00Z', 80, 6, 8, 'RPE 8.5'),
    makeNotedWorkout('2026-11-16T14:00:00Z', '2026-11-16T14:45:00Z', 75, 5, 7, 'RPE 9.5 very sore'),
    makeNotedWorkout('2026-11-18T08:00:00Z', '2026-11-18T08:45:00Z', 70, 5, 7, 'RPE 9.5 drained'),
    makeNotedWorkout('2026-11-19T14:00:00Z', '2026-11-19T14:45:00Z', 65, 5, 7, 'RPE 10'),
    makeNotedWorkout('2026-11-21T08:00:00Z', '2026-11-21T08:45:00Z', 60, 5, 7, 'RPE 9.5'),
  ];

  const learned = optimizePersonalPhysiology(dossier, overloadedEvents);
  assert.equal(learned.active, true);
  assert.ok(learned.recoveryPairsObserved >= 3);
  assert.ok(learned.recoveryTauMultiplier > 1.05 && learned.recoveryTauMultiplier <= 1.4);
  assert.ok(learned.mrvMultiplier < 0.95 && learned.mrvMultiplier >= 0.75);

  // Wired directly into body physiology: learned slower recovery & lower MRV reduce effective MRV vs clean baseline
  const baselineReport = buildBodyPhysiologyReport({dossier, trainingEvents: [], asOf: now});
  const learnedReport = buildBodyPhysiologyReport({dossier, trainingEvents: overloadedEvents, asOf: now});
  assert.ok(learnedReport.muscles.mid_chest.volume.mrv < baselineReport.muscles.mid_chest.volume.mrv);
});

test('wearableReadiness enforces RMSSD-only HRV, learns personal watch baselines, and pauses heavy workouts on acute illness/strain', () => {
  // Reject SDNN mixing
  assert.throws(
    () =>
      normalizeWearableSnapshot({
        date: '2026-11-24',
        source: 'apple_watch',
        hrvRmssdMs: 55,
        hrvStatistic: 'sdnn',
      }),
    /RMSSD/,
  );

  // Build 7-day healthy personal baseline (HRV ~68 ms, RHR ~50 bpm, sleep ~460 min) + Day 8 acute strain/illness spike
  const history: WearableDailySnapshot[] = [
    {date: '2026-11-17', source: 'garmin', hrvRmssdMs: 67, hrvStatistic: 'rmssd', restingHeartRateBpm: 50, totalSleepMinutes: 460, cardioLoadTrimp: 60},
    {date: '2026-11-18', source: 'garmin', hrvRmssdMs: 70, hrvStatistic: 'rmssd', restingHeartRateBpm: 49, totalSleepMinutes: 455, cardioLoadTrimp: 70},
    {date: '2026-11-19', source: 'garmin', hrvRmssdMs: 66, hrvStatistic: 'rmssd', restingHeartRateBpm: 51, totalSleepMinutes: 470, cardioLoadTrimp: 55},
    {date: '2026-11-20', source: 'garmin', hrvRmssdMs: 69, hrvStatistic: 'rmssd', restingHeartRateBpm: 50, totalSleepMinutes: 450, cardioLoadTrimp: 65},
    {date: '2026-11-21', source: 'garmin', hrvRmssdMs: 68, hrvStatistic: 'rmssd', restingHeartRateBpm: 50, totalSleepMinutes: 465, cardioLoadTrimp: 60},
    {date: '2026-11-22', source: 'garmin', hrvRmssdMs: 71, hrvStatistic: 'rmssd', restingHeartRateBpm: 49, totalSleepMinutes: 460, cardioLoadTrimp: 70},
    {date: '2026-11-23', source: 'garmin', hrvRmssdMs: 67, hrvStatistic: 'rmssd', restingHeartRateBpm: 50, totalSleepMinutes: 450, cardioLoadTrimp: 65},
    // Day 8: HRV crash + RHR spike + wrist temp +0.7C
    normalizeWearableSnapshot({
      date: '2026-11-24',
      source: 'garmin',
      hrvRmssdMs: 42,
      hrvStatistic: 'rmssd',
      restingHeartRateBpm: 58,
      totalSleepMinutes: 330,
      wristTempDeviationC: 0.7,
      cardioLoadTrimp: 120,
    }),
  ];

  const signal = evaluateWearableReadiness(history, '2026-11-24');
  assert.equal(signal.hasWearableData, true);
  assert.equal(signal.illnessOrOverreachingFlag, true);
  assert.ok((signal.deltas.hrvZScore ?? 0) <= -1.5);
  assert.ok((signal.deltas.rhrDeltaBpm ?? 0) >= 6);
  assert.ok(signal.recoveryTauModifier > 1.15);
  assert.ok(signal.mrvModifier < 0.9);

  // Generator respects smartwatch illness/strain flag automatically
  const now = new Date('2026-11-24T12:00:00Z');
  const dossier = makeTestDossier(now, {benchBwRatio: 1.0});
  const plan = generateAdaptiveWorkout({
    dossier,
    trainingEvents: [],
    wearableHistory: history,
    request: {mode: 'smart_next', availableMinutes: 45, asOf: now},
  });
  assert.equal(plan.status, 'rest_recommended');
  assert.equal(plan.totalSets, 0);
});

test('expanded ontology covers all 19 muscles & 13 equipment buckets and custom exercise inference integrates cleanly', () => {
  assert.ok(EXERCISE_CATALOG.length >= 55);
  for (const muscle of ALL_MUSCLES) {
    assert.ok(
      EXERCISE_CATALOG.some(ex => ex.muscles.some(inv => inv.muscle === muscle && inv.weight >= 0.5)),
      `Missing catalog coverage for muscle ${muscle}`,
    );
  }
  for (const eq of ALL_DETAILED_EQUIPMENT) {
    if (eq === 'none') continue;
    assert.ok(
      EXERCISE_CATALOG.some(ex => ex.requiredAll.includes(eq) || (ex.anyOf?.includes(eq) ?? false)),
      `Missing catalog coverage for equipment ${eq}`,
    );
  }

  // Infer custom exercise fractional muscles + joint stress + time physics
  const custom = inferCustomExerciseProfile({
    name: 'Landmine Single-Arm Press',
    pattern: 'incline_push',
    primaryMuscles: ['upper_chest', 'front_delt'],
    secondaryMuscles: ['triceps'],
    requiredAll: ['bars_plates'],
  });
  assert.equal(custom.muscles.find(m => m.muscle === 'upper_chest')?.weight, 1.0);
  assert.equal(custom.muscles.find(m => m.muscle === 'triceps')?.weight, 0.5);
  assert.ok((custom.jointStress.shoulder ?? 0) >= 1);
  assert.equal(matchExerciseByName('Landmine Single-Arm Press', [custom])?.id, custom.id);

  const subs = findBiomechanicalSubstitutes(custom.id, {
    availableEquipment: ['small_weights', 'benches_racks'],
    customExercises: [custom],
  });
  assert.ok(subs.some(s => s.exercise.id === 'incline_dumbbell_press'));
});
