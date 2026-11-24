import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activePlan,
  addDays,
  buildProgram,
  currentAdaptivePlans,
  makeWorkout,
  workoutId,
} from './adaptiveProgram';
import {buildAthleteDossier} from './athleteDossier';
import {EVIDENCE_REGISTER, EVIDENCE_REGISTER_VERSION, evidenceById} from './evidenceRegister';
import {replayGoalAttempts} from './goalAttempts';
import type {Observation} from './history';
import {
  buildMaintenancePlan,
  MAINTENANCE_ENGINE_VERSION,
  portfolioMaintenanceSummary,
} from './maintenancePlan';
import {
  evaluateCohortCalibration,
  evaluatePersonalLearning,
  shrinkPersonalGain,
  type ProspectiveCohortRecord,
} from './outcomeLearning';
import {performanceInsights} from './performanceInsights';
import {normalizeTrainingContext, type PersonalWorkspace} from './personalWorkspace';
import {planGoalPortfolio} from './programPortfolio';
import {suggestSupportingWins} from './supportingWins';
import {appendTraining, type TrainingEvent} from './training';

const START = '2026-11-24'; // Tuesday

test('evidence register documents primary sources, populations, limitations, and falsification criteria', () => {
  assert.equal(EVIDENCE_REGISTER_VERSION, 'evidence-register-v1');
  assert.ok(EVIDENCE_REGISTER.length >= 6);
  for (const entry of EVIDENCE_REGISTER) {
    assert.ok(entry.url.startsWith('https://'));
    assert.ok(entry.studiedPopulation.length > 10);
    assert.ok(entry.limitations.length > 10);
    assert.ok(entry.falsificationOutcome.length > 10);
  }
  assert.ok(evidenceById('kikuchi-nakazato-2017'));
  assert.ok(evidenceById('bickel-cross-bamman-2011'));
  assert.ok(evidenceById('spiering-2021'));
});

test('Step 4: supporting wins fit the same budget without displacing 2 pinned main goals, and preview forecast matches saved plan', () => {
  const now = new Date(START + 'T08:00:00Z');
  const workspace: PersonalWorkspace = {
    version: 1,
    goal: null,
    context: normalizeTrainingContext({
      experience: 'one_to_three',
      days: 2,
      minutes: 45,
      equipment: ['barbell', 'outdoor'],
      timezone: 'UTC',
      pinnedMetrics: ['bench_1rm', 'run_5k'],
    }),
  };
  const benchObs: Observation = {
    id: 'p2-b0',
    metricId: 'bench_1rm',
    value: 1,
    method: 'manual',
    protocol: {id: 'bench_paused_v1', bodyWeightKg: 80},
    derivation: {formula: 'epley_ratio_v1', inputs: [80, 1], bodyWeightKg: 80},
    measuredAt: '2026-11-24T07:00:00Z',
    recordedAt: '2026-11-24T07:05:00Z',
    cleared: false,
  };

  // Preview date option forecast vs saved plan forecast MUST match identically!
  const portfolio = planGoalPortfolio({
    goals: [{metric: 'bench_1rm', unit: 'kg', current: 80, target: 100, bodyWeightKg: 80}],
    startDay: START,
    timeZone: 'UTC',
    context: workspace.context,
    observations: [benchObs],
    now,
  });
  const previewItem = portfolio.items[0];
  const selectedOption = previewItem.dateOptions.find(o => o.date === previewItem.suggestedDate)!;

  const events: TrainingEvent[] = appendTraining(
    [],
    {
      version: 1,
      id: '40000000-0000-4000-8000-000000000001',
      requestId: '40000000-0000-4000-8000-000000000002',
      kind: 'program',
      expectedRevision: 0,
      epoch: 0,
      data: buildProgram(previewItem.config, 'UTC'),
      deleted: false,
      reason: '',
    },
    0,
    now.getTime(),
  );
  const savedPlan = activePlan(events)!;
  const savedInsights = performanceInsights({
    values: {bench_1rm: 1},
    details: {bench_1rm: {measuredAt: benchObs.measuredAt, method: 'manual', protocol: benchObs.protocol, derivation: benchObs.derivation}},
    plan: savedPlan,
    entries: [benchObs],
    today: START,
    now: now.getTime() + 1000,
  });
  assert.equal(savedInsights.goal?.adherence?.probability, selectedOption.probability);

  // Supporting wins suggest strict push-ups alongside bench_1rm + run_5k with zero extra minutes
  const dossier = buildAthleteDossier({
    owner: 'p2-athlete',
    profile: {age: 34, sex: 'male', weight: 80, height: 180},
    values: {bench_1rm: 1, run_5k: 25},
    observations: [benchObs],
    workspace,
    trainingEvents: events,
    asOf: now,
  });
  const wins = suggestSupportingWins({dossier, activeGoalMetrics: ['bench_1rm', 'run_5k']});
  const pushupsWin = wins.find(w => w.metric === 'pushups');
  assert.ok(pushupsWin);
  assert.equal(pushupsWin.pairedWithMainGoal, 'bench_1rm');
  assert.equal(pushupsWin.extraWeeklyMinutes, 0);
  assert.equal(pushupsWin.canDisplaceMainGoal, false);
  assert.equal(pushupsWin.separateTestRequired, true);
  assert.equal(pushupsWin.evidenceId, 'kikuchi-nakazato-2017');
});

test('Step 5: outcome learning separates attendance from response, suggests recurring weekday change, applies Bayesian shrinkage, and gates cohort promotion', async () => {
  const now = new Date(START + 'T08:00:00Z');
  const workspace: PersonalWorkspace = {
    version: 1,
    goal: null,
    context: normalizeTrainingContext({
      experience: 'one_to_three',
      days: 2,
      minutes: 45,
      equipment: ['barbell'],
      timezone: 'UTC',
    }),
  };
  const portfolio = planGoalPortfolio({
    goals: [{metric: 'bench_1rm', unit: 'kg', current: 80, target: 100, bodyWeightKg: 80}],
    startDay: START,
    timeZone: 'UTC',
    context: workspace.context,
    now,
  });
  const planId = '50000000-0000-4000-8000-000000000001';
  let events: TrainingEvent[] = appendTraining(
    [],
    {
      version: 1,
      id: planId,
      requestId: crypto.randomUUID(),
      kind: 'program',
      expectedRevision: 0,
      epoch: 0,
      data: buildProgram(portfolio.items[0].config, 'UTC'),
      deleted: false,
      reason: '',
    },
    0,
    now.getTime(),
  );

  // Log two Tuesday time-related skips (START and START + 7)
  for (const offset of [0, 7]) {
    const day = addDays(START, offset);
    const at = new Date(day + 'T18:00:00Z');
    const plan = activePlan(events)!;
    const w = makeWorkout(plan, day, null, at, 'time');
    events = appendTraining(
      events,
      {
        version: 1,
        id: await workoutId(planId, day),
        requestId: crypto.randomUUID(),
        kind: 'workout',
        expectedRevision: 0,
        epoch: 0,
        data: w,
        deleted: false,
        reason: '',
      },
      0,
      at.getTime(),
    );
  }

  const checkDate = new Date(addDays(START, 8) + 'T10:00:00Z');
  const dossier = buildAthleteDossier({
    owner: 'p2-learner',
    workspace,
    trainingEvents: events,
    asOf: checkDate,
  });
  const learning = evaluatePersonalLearning({
    dossier,
    plan: activePlan(events)!,
    observations: [],
    priorGainPerSession: 1,
    now: checkDate,
  });
  assert.equal(learning.attendance.skipped, 2);
  assert.equal(learning.physicalResponse.crossExerciseTransferApplied, false);
  assert.ok(learning.calendarSuggestion);
  assert.equal(learning.calendarSuggestion.weekday, '2'); // Tuesday!
  assert.match(learning.calendarSuggestion.prompt[0], /Tuesday/i);

  // Bayesian shrinkage smoothly blends prior with observed gains as intervals accumulate
  const oneObs = shrinkPersonalGain(1.0, [2.0], 3);
  const threeObs = shrinkPersonalGain(1.0, [2.0, 2.0, 2.0], 3);
  assert.equal(oneObs.weight, 0.25);
  assert.equal(oneObs.shrunkGain, 1.25);
  assert.equal(threeObs.weight, 0.5);
  assert.equal(threeObs.shrunkGain, 1.5);

  // Held-out prospective cohort calibration gate
  const goodCohort: ProspectiveCohortRecord[] = Array.from({length: 25}, (_, i) => {
    const reached = i < 15;
    return {
      athleteId: `a-${i}`,
      metric: 'bench_1rm',
      modelVersion: 'goal-paths-v4',
      issuedAt: `2026-10-${String((i % 20) + 1).padStart(2, '0')}T10:00:00Z`,
      predictedProbability: reached ? 0.78 : 0.25,
      baselineProbability: 0.5,
      reachedOnTime: reached,
      finishWindow: {early: '2026-12-01', late: '2026-12-20'},
      actualAchievedOn: reached ? '2026-12-10' : null,
    };
  });
  const promoted = evaluateCohortCalibration(goodCohort);
  assert.equal(promoted.shouldPromote, true);
  assert.equal(promoted.measuredOutcomes, 25);
  assert.equal(promoted.finishWindowCoverage, 1);
  assert.ok((promoted.brierImprovement ?? 0) > 0.1);

  // Too much missing follow-up blocks promotion even if measured subset looks good
  const highMissingCohort: ProspectiveCohortRecord[] = [
    ...goodCohort.slice(0, 20),
    ...Array.from({length: 15}, (_, i) => ({
      athleteId: `missing-${i}`,
      metric: 'bench_1rm',
      modelVersion: 'goal-paths-v4',
      issuedAt: '2026-10-05T10:00:00Z',
      predictedProbability: 0.7,
      baselineProbability: 0.5,
      reachedOnTime: null,
    })),
  ];
  const blocked = evaluateCohortCalibration(highMissingCohort);
  assert.equal(blocked.shouldPromote, false);
  assert.match(blocked.promotionReason, /Missing follow-up/);
});

test('Step 6: comparable 100 kg bench retest switches bench to age-aware maintenance while 5 km continues; lower later retest preserves achievement; all-achieved switches Home to maintenance without escalation', () => {
  const startAt = new Date(START + 'T08:00:00Z');
  const workspace: PersonalWorkspace = {
    version: 1,
    goal: null,
    context: normalizeTrainingContext({
      experience: 'one_to_three',
      days: 3,
      minutes: 45,
      equipment: ['barbell', 'outdoor'],
      timezone: 'UTC',
      pinnedMetrics: ['bench_1rm', 'run_5k'],
    }),
  };

  const benchBase: Observation = {
    id: 'm-b0',
    sequence: 1,
    metricId: 'bench_1rm',
    value: 1,
    method: 'manual',
    protocol: {id: 'bench_paused_v1', bodyWeightKg: 80},
    derivation: {formula: 'epley_ratio_v1', inputs: [80, 1], bodyWeightKg: 80},
    measuredAt: '2026-11-24T07:00:00Z',
    recordedAt: '2026-11-24T07:05:00Z',
    cleared: false,
  };
  const runBase: Observation = {
    id: 'm-r0',
    sequence: 2,
    metricId: 'run_5k',
    value: 25,
    method: 'manual',
    protocol: {id: 'run5k_outdoor_gps_v1'},
    measuredAt: '2026-11-24T07:10:00Z',
    recordedAt: '2026-11-24T07:15:00Z',
    cleared: false,
  };

  const groupId = '60000000-0000-4000-8000-000000000099';
  const portfolio = planGoalPortfolio({
    goals: [
      {metric: 'bench_1rm', unit: 'kg', current: 80, target: 100, bodyWeightKg: 80},
      {metric: 'run_5k', unit: 'metric', current: 25, target: 23},
    ],
    startDay: START,
    timeZone: 'UTC',
    context: workspace.context,
    observations: [benchBase, runBase],
    now: startAt,
  });

  let events: TrainingEvent[] = [];
  for (const [idx, item] of portfolio.items.entries()) {
    events = appendTraining(
      events,
      {
        version: 1,
        id: `60000000-0000-4000-8000-00000000000${idx + 1}`,
        requestId: crypto.randomUUID(),
        kind: 'program',
        expectedRevision: 0,
        epoch: 0,
        data: buildProgram({...item.config, groupId}, 'UTC'),
        deleted: false,
        reason: '',
      },
      0,
      startAt.getTime() + idx * 1000,
    );
  }

  // Comparable 100 kg bench retest on 2027-02-20 closes bench while 5 km continues
  const benchHitDay = '2027-02-20';
  const benchHit: Observation = {
    id: 'm-b1',
    sequence: 3,
    metricId: 'bench_1rm',
    value: 1.25,
    method: 'manual',
    protocol: {id: 'bench_paused_v1', bodyWeightKg: 80},
    derivation: {formula: 'epley_ratio_v1', inputs: [100, 1], bodyWeightKg: 80},
    measuredAt: benchHitDay + 'T12:00:00Z',
    recordedAt: benchHitDay + 'T12:05:00Z',
    cleared: false,
  };

  const checkMs = Date.parse('2027-02-21T10:00:00Z');
  const plans = currentAdaptivePlans(events);
  const attemptsAfterBenchHit = replayGoalAttempts(events, [benchBase, runBase, benchHit], checkMs);
  const youngDossier = buildAthleteDossier({
    owner: 'young-athlete',
    profile: {age: 34, sex: 'male', weight: 80, height: 180},
    observations: [benchBase, runBase, benchHit],
    workspace,
    trainingEvents: events,
    asOf: new Date(checkMs),
  });

  const summary = portfolioMaintenanceSummary({
    plans,
    attempts: attemptsAfterBenchHit,
    dossier: youngDossier,
    today: '2027-02-21',
  });
  assert.equal(summary.maintenancePlans.length, 1);
  assert.equal(summary.continuingPlans.length, 1);
  assert.equal(summary.allGoalsMaintained, false);
  const benchMaint = summary.maintenancePlans[0];
  assert.equal(benchMaint.version, MAINTENANCE_ENGINE_VERSION);
  assert.equal(benchMaint.metric, 'bench_1rm');
  assert.equal(benchMaint.achievedOn, benchHitDay);
  assert.equal(benchMaint.sessionsPerWeek, 1); // Under 60: 1 brief session/wk (Bickel et al. 2011)
  assert.equal(benchMaint.promptsEscalation, false);
  assert.equal(summary.continuingPlans[0].config.metric, 'run_5k');

  // Older adult (64 y) gets higher conservative maintenance volume (2 sessions/wk per Bickel et al. 2011)
  const olderDossier = buildAthleteDossier({
    owner: 'older-athlete',
    profile: {age: 64, sex: 'male', weight: 80, height: 180},
    observations: [benchBase, runBase, benchHit],
    workspace,
    trainingEvents: events,
    asOf: new Date(checkMs),
  });
  const olderMaint = buildMaintenancePlan({
    attempt: attemptsAfterBenchHit.find(a => a.metric === 'bench_1rm')!,
    plan: plans.find(p => p.config.metric === 'bench_1rm')!,
    dossier: olderDossier,
    today: '2027-02-21',
  })!;
  assert.equal(olderMaint.sessionsPerWeek, 2);

  // One lower post-achievement retest (94 kg) updates status WITHOUT erasing the 100 kg achievement
  const benchDip: Observation = {
    id: 'm-b2',
    sequence: 4,
    metricId: 'bench_1rm',
    value: 1.175,
    method: 'manual',
    protocol: {id: 'bench_paused_v1', bodyWeightKg: 80},
    derivation: {formula: 'epley_ratio_v1', inputs: [94, 1], bodyWeightKg: 80},
    measuredAt: '2027-03-20T12:00:00Z',
    recordedAt: '2027-03-20T12:05:00Z',
    cleared: false,
  };
  const dipAttempts = replayGoalAttempts(
    events,
    [benchBase, runBase, benchHit, benchDip],
    Date.parse('2027-03-21T10:00:00Z'),
  );
  const dippedMaint = buildMaintenancePlan({
    attempt: dipAttempts.find(a => a.metric === 'bench_1rm')!,
    plan: plans.find(p => p.config.metric === 'bench_1rm')!,
    dossier: youngDossier,
    today: '2027-03-21',
  })!;
  assert.equal(dippedMaint.achievedOn, benchHitDay);
  assert.equal(dippedMaint.achievedTarget, 100);
  assert.equal(dippedMaint.latestComparableValue, 94);
  assert.equal(dippedMaint.retentionStatus, 'below-achieved');
  assert.equal(dippedMaint.promptsEscalation, false);

  // Once 5 km also hits 23:00 on or before its deadline, ALL chosen goals switch to maintenance
  const runPlan = plans.find(p => p.config.metric === 'run_5k')!;
  const runHitDay = runPlan.config.deadline;
  const runHit: Observation = {
    id: 'm-r1',
    sequence: 5,
    metricId: 'run_5k',
    value: 22.8,
    method: 'manual',
    protocol: {id: 'run5k_outdoor_gps_v1'},
    measuredAt: runHitDay + 'T10:00:00Z',
    recordedAt: runHitDay + 'T10:05:00Z',
    cleared: false,
  };
  const bothCheckDay = addDays(runHitDay > benchHitDay ? runHitDay : benchHitDay, 1);
  const bothAttempts = replayGoalAttempts(
    events,
    [benchBase, runBase, benchHit, runHit],
    Date.parse(bothCheckDay + 'T10:00:00Z'),
  );
  const allMaint = portfolioMaintenanceSummary({
    plans,
    attempts: bothAttempts,
    dossier: youngDossier,
    today: bothCheckDay,
  });
  assert.equal(allMaint.allGoalsMaintained, true);
  assert.equal(allMaint.maintenancePlans.length, 2);
  assert.ok(allMaint.maintenancePlans.every(m => m.promptsEscalation === false));
});
