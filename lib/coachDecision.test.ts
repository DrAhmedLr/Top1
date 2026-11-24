import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activePlan,
  addDays,
  buildProgram,
  correctWorkout,
  deterministicRequestId,
  makeWorkout,
  sessionResult,
  workoutId,
  type AdaptivePlan,
} from './adaptiveProgram';
import {buildAthleteDossier, DOSSIER_VERSION, isoWeekdayForDay} from './athleteDossier';
import {
  applyDayAvailabilityOverride,
  applyWeekdayMinutesRule,
  COACH_ENGINE_VERSION,
  selectNextSessionDecision,
  toStoredDecision,
  undoCoachAdjustment,
} from './coachDecision';
import {datedProgram} from './datedProgram';
import {replayGoalAttempts} from './goalAttempts';
import type {Observation} from './history';
import {performanceInsights} from './performanceInsights';
import {emptyWorkspace, normalizeTrainingContext, readWorkspace, type PersonalWorkspace} from './personalWorkspace';
import {planGoalPortfolio} from './programPortfolio';
import {appendTraining, latestTraining, type TrainingEvent, type Workout} from './training';
import {trainingRepository} from './trainingStorage';

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

/**
 * Sets up the canonical example athlete from TOP1_COACH_BUILD_PROMPT.md:
 * - Saved 80 kg bench press (1.0x BW at 80 kg), target 100 kg
 * - Also cares about 5 km run (25:00 -> 23:00)
 * - Two hours/week training budget; Tuesday bench session scheduled for 45 minutes
 * - Barbell + outdoor access
 */
function setupExampleAthlete(owner: string, equipment: ('none' | 'dumbbells' | 'barbell' | 'machines' | 'pullup_bar' | 'outdoor')[] = ['barbell', 'outdoor']) {
  const startDay = '2026-11-24'; // Tuesday!
  assert.equal(isoWeekdayForDay(startDay), '2');
  const now = new Date('2026-11-24T08:00:00Z');
  const workspace: PersonalWorkspace = {
    version: 1,
    goal: null,
    context: normalizeTrainingContext({
      experience: 'one_to_three',
      days: 3,
      minutes: 45,
      equipment,
      timezone: 'UTC',
      pinnedMetrics: ['bench_1rm', 'run_5k'],
    }),
  };

  const benchObs: Observation = {
    id: `obs-bench-${owner}`,
    metricId: 'bench_1rm',
    value: 1,
    method: 'manual',
    protocol: {id: 'bench_paused_v1', bodyWeightKg: 80},
    derivation: {formula: 'epley_ratio_v1', inputs: [80, 1], bodyWeightKg: 80},
    measuredAt: '2026-11-20T10:00:00Z',
    recordedAt: '2026-11-20T10:05:00Z',
    cleared: false,
  };
  const runObs: Observation = {
    id: `obs-run-${owner}`,
    metricId: 'run_5k',
    value: 25,
    method: 'manual',
    protocol: {id: 'run5k_outdoor_gps_v1'},
    measuredAt: '2026-11-21T09:00:00Z',
    recordedAt: '2026-11-21T09:05:00Z',
    cleared: false,
  };

  const portfolio = planGoalPortfolio({
    goals: [
      {metric: 'bench_1rm', unit: 'kg', current: 80, target: 100, bodyWeightKg: 80},
      {metric: 'run_5k', unit: 'metric', current: 25, target: 23},
    ],
    startDay,
    timeZone: 'UTC',
    context: workspace.context,
    observations: [benchObs, runObs],
    now,
  });

  // Give bench its 45-minute Tuesday slot cleanly (matching the 2-hour/week 45-min Tuesday scenario)
  const benchConfig = {
    ...portfolio.items[0].config,
    minutes: 45,
    rotation: undefined,
    days: 2,
  };
  const runConfig = portfolio.items[1].config;

  const benchId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  let events: TrainingEvent[] = [];
  events = appendTraining(
    events,
    {
      version: 1,
      id: benchId,
      requestId: crypto.randomUUID(),
      kind: 'program',
      expectedRevision: 0,
      epoch: 0,
      data: buildProgram(benchConfig, 'UTC'),
      deleted: false,
      reason: '',
    },
    0,
    now.getTime(),
  );
  events = appendTraining(
    events,
    {
      version: 1,
      id: runId,
      requestId: crypto.randomUUID(),
      kind: 'program',
      expectedRevision: 0,
      epoch: 0,
      data: buildProgram({...runConfig, groupId: undefined}, 'UTC'),
      deleted: false,
      reason: '',
    },
    0,
    now.getTime() + 1000,
  );

  // Use the single-goal bench plan with 45-min Tuesday sessions + run goal tracked in dossier
  const benchEvents = [events[0]];
  const benchPlan = activePlan(benchEvents)!;

  return {
    owner,
    startDay,
    now,
    workspace,
    observations: [benchObs, runObs],
    values: {bench_1rm: 1, run_5k: 25},
    details: {
      bench_1rm: {
        measuredAt: benchObs.measuredAt,
        method: benchObs.method,
        protocol: benchObs.protocol,
        derivation: benchObs.derivation,
      },
      run_5k: {measuredAt: runObs.measuredAt, method: runObs.method, protocol: runObs.protocol},
    },
    events: benchEvents,
    benchPlan,
  };
}

test('Step 1: athlete dossier is reproducible at asOf, separates declared/measured/inferred facts, enforces 2-pin max, and isolates accounts', () => {
  const a = setupExampleAthlete('athlete-a');
  const b = setupExampleAthlete('athlete-b', ['dumbbells']);

  const dossierA1 = buildAthleteDossier({
    owner: a.owner,
    values: a.values,
    details: a.details,
    observations: a.observations,
    workspace: a.workspace,
    trainingEvents: a.events,
    asOf: a.now,
  });
  const dossierA2 = buildAthleteDossier({
    owner: a.owner,
    values: a.values,
    details: a.details,
    observations: a.observations,
    workspace: a.workspace,
    trainingEvents: a.events,
    asOf: a.now,
  });

  // Deterministic replay
  assert.equal(dossierA1.version, DOSSIER_VERSION);
  assert.equal(JSON.stringify(dossierA1), JSON.stringify(dossierA2));
  assert.equal(dossierA1.measuredResults.bench_1rm.value, 80);
  assert.equal(dossierA1.measuredResults.bench_1rm.source, 'measured');
  assert.equal(dossierA1.measuredResults.bench_1rm.unit, 'kg');
  assert.equal(dossierA1.constraints.defaultMinutes.source, 'declared');
  assert.equal(dossierA1.constraints.defaultMinutes.value, 45);
  assert.equal(dossierA1.constraints.equipment.source, 'declared');
  assert.deepEqual(dossierA1.constraints.equipment.value, ['barbell', 'outdoor']);

  // Account isolation: Athlete B's workspace cannot affect Athlete A
  const dossierB = buildAthleteDossier({
    owner: b.owner,
    values: b.values,
    details: b.details,
    observations: b.observations,
    workspace: b.workspace,
    trainingEvents: b.events,
    asOf: b.now,
  });
  assert.notEqual(dossierA1.identity.owner, dossierB.identity.owner);
  assert.deepEqual(dossierB.constraints.equipment.value, ['dumbbells']);
  assert.deepEqual(dossierA1.constraints.equipment.value, ['barbell', 'outdoor']);

  // Enforce at most 2 pinned main goals
  assert.throws(
    () => normalizeTrainingContext({pinnedMetrics: ['bench_1rm', 'run_5k', 'pushups']}),
    /Pin at most two main goals/,
  );
});

test('Acceptance Row 1 & Row 2: 20 minutes today adapts ONLY this Tuesday; confirming all Tuesdays adapts future Tuesdays while preserving original plan & Undo', () => {
  const athleteA = setupExampleAthlete('athlete-a');
  const athleteB = setupExampleAthlete('athlete-b');
  const thisTuesday = athleteA.startDay; // 2026-11-24
  const nextTuesday = addDays(thisTuesday, 7); // 2026-12-01
  assert.equal(isoWeekdayForDay(nextTuesday), '2');

  // Baseline: Athlete B (no time change) keeps the 45-minute session
  const dossierB = buildAthleteDossier({
    owner: athleteB.owner,
    values: athleteB.values,
    details: athleteB.details,
    observations: athleteB.observations,
    workspace: athleteB.workspace,
    trainingEvents: athleteB.events,
    asOf: athleteB.now,
  });
  const decisionB = selectNextSessionDecision(dossierB, {
    plan: athleteB.benchPlan,
    targetDay: thisTuesday,
  });
  assert.equal(decisionB.action, 'keep');
  assert.equal(decisionB.scheduled.slotMinutes, 45);
  assert.equal(decisionB.recommended?.sets, decisionB.scheduled.sets);

  // Row 1: Athlete A reports 20 minutes for TODAY ONLY
  const wsTodayOnly = applyDayAvailabilityOverride(athleteA.workspace, {
    date: thisTuesday,
    minutes: 20,
    reason: 'Only 20 minutes this Tuesday',
    now: athleteA.now,
  });
  const dossierAToday = buildAthleteDossier({
    owner: athleteA.owner,
    values: athleteA.values,
    details: athleteA.details,
    observations: athleteA.observations,
    workspace: wsTodayOnly,
    trainingEvents: athleteA.events,
    asOf: athleteA.now,
  });
  const decisionAThisTuesday = selectNextSessionDecision(dossierAToday, {
    plan: athleteA.benchPlan,
    targetDay: thisTuesday,
  });
  assert.equal(decisionAThisTuesday.modelVersion, COACH_ENGINE_VERSION);
  assert.equal(decisionAThisTuesday.action, 'shorten');
  assert.ok(decisionAThisTuesday.recommended !== null);
  assert.ok(decisionAThisTuesday.recommended.totalMinutes <= 20);
  assert.ok(decisionAThisTuesday.recommended.sets < decisionAThisTuesday.scheduled.sets);
  assert.equal(decisionAThisTuesday.affectedGoal.baseline, 80);
  assert.equal(decisionAThisTuesday.affectedGoal.target, 100);
  assert.equal(decisionAThisTuesday.affectedGoal.deadline, athleteA.benchPlan.config.deadline);
  assert.equal(decisionAThisTuesday.scope, 'today');
  assert.equal(decisionAThisTuesday.expiresOn, thisTuesday);
  assert.match(decisionAThisTuesday.athleteSentence[0], /20-min/);

  // Next Tuesday: today-only override has EXPIRED -> retains normal 45-minute availability!
  const dossierANextWeek = buildAthleteDossier({
    owner: athleteA.owner,
    values: athleteA.values,
    details: athleteA.details,
    observations: athleteA.observations,
    workspace: wsTodayOnly,
    trainingEvents: athleteA.events,
    asOf: new Date(nextTuesday + 'T08:00:00Z'),
  });
  assert.equal(dossierANextWeek.temporaryState.activeOverrides.length, 0);
  assert.equal(dossierANextWeek.temporaryState.expiredOverrides.length, 1);
  const decisionANextTuesday = selectNextSessionDecision(dossierANextWeek, {
    plan: athleteA.benchPlan,
    targetDay: nextTuesday,
  });
  assert.equal(decisionANextTuesday.action, 'keep');
  assert.equal(decisionANextTuesday.scheduled.slotMinutes, 45);

  // Row 2: Athlete A confirms ALL TUESDAYS are now 20 minutes
  const storedBeforeRecurring = toStoredDecision(decisionAThisTuesday, 'en');
  const wsEveryTuesday = applyWeekdayMinutesRule(wsTodayOnly, {
    weekday: '2',
    minutes: 20,
    clearDateOverride: thisTuesday,
    decision: storedBeforeRecurring,
  });
  const dossierRecurring = buildAthleteDossier({
    owner: athleteA.owner,
    values: athleteA.values,
    details: athleteA.details,
    observations: athleteA.observations,
    workspace: wsEveryTuesday,
    trainingEvents: athleteA.events,
    asOf: new Date(nextTuesday + 'T08:00:00Z'),
  });
  const decisionRecurringNextTuesday = selectNextSessionDecision(dossierRecurring, {
    plan: athleteA.benchPlan,
    targetDay: nextTuesday,
  });
  assert.equal(decisionRecurringNextTuesday.action, 'shorten');
  assert.equal(decisionRecurringNextTuesday.scope, 'weekday');
  assert.ok(decisionRecurringNextTuesday.recommended!.totalMinutes <= 20);
  assert.equal(decisionRecurringNextTuesday.scheduled.slotMinutes, 45);
  assert.equal(dossierRecurring.decisionHistory.length, 1);
  assert.equal(dossierRecurring.decisionHistory[0].before.minutes, decisionAThisTuesday.scheduled.totalMinutes);

  // Undo restores normal 45-minute Tuesdays while retaining auditable history
  const wsUndone = undoCoachAdjustment(wsEveryTuesday, {
    day: nextTuesday,
    scope: 'weekday',
    decisionId: storedBeforeRecurring.id,
    now: new Date(nextTuesday + 'T09:00:00Z'),
  });
  const dossierUndone = buildAthleteDossier({
    owner: athleteA.owner,
    values: athleteA.values,
    details: athleteA.details,
    observations: athleteA.observations,
    workspace: wsUndone,
    trainingEvents: athleteA.events,
    asOf: new Date(nextTuesday + 'T09:00:00Z'),
  });
  const decisionAfterUndo = selectNextSessionDecision(dossierUndone, {
    plan: athleteA.benchPlan,
    targetDay: nextTuesday,
  });
  assert.equal(decisionAfterUndo.action, 'keep');
  assert.ok(dossierUndone.decisionHistory[0].undoneAt);

  // When time is too short for a safe barbell session (e.g. 10 min), coach chooses MOVE over rushing
  const wsTooShort = applyDayAvailabilityOverride(athleteA.workspace, {
    date: thisTuesday,
    minutes: 10,
    now: athleteA.now,
  });
  const dossierTooShort = buildAthleteDossier({
    owner: athleteA.owner,
    values: athleteA.values,
    details: athleteA.details,
    observations: athleteA.observations,
    workspace: wsTooShort,
    trainingEvents: athleteA.events,
    asOf: athleteA.now,
  });
  const moveDecision = selectNextSessionDecision(dossierTooShort, {
    plan: athleteA.benchPlan,
    targetDay: thisTuesday,
  });
  assert.equal(moveDecision.action, 'move');
  assert.ok(moveDecision.movedTo && moveDecision.movedTo > thisTuesday);
  assert.match(moveDecision.athleteSentence[0], /Rescheduling beats rushing/);
});

test('Acceptance Row 3: skips because work ran late, then corrects it to completed — attendance and forecast recalculate once, measured 80 kg bench stays unchanged', async () => {
  const athlete = setupExampleAthlete('athlete-correct');
  const day = athlete.startDay;
  const skipAt = new Date(day + 'T18:00:00Z');
  const wid = await workoutId(athlete.benchPlan.event.id, day);

  // Step A: Log skipped workout because work ran late
  const skippedWorkout = makeWorkout(athlete.benchPlan, day, null, skipAt, 'time');
  let events = appendTraining(
    athlete.events,
    {
      version: 1,
      id: wid,
      requestId: await deterministicRequestId(['checkin', athlete.benchPlan.event.id, day, '0', 'skip']),
      kind: 'workout',
      expectedRevision: 0,
      epoch: 0,
      data: skippedWorkout,
      deleted: false,
      reason: '',
    },
    0,
    skipAt.getTime(),
  );

  const attemptAfterSkip = replayGoalAttempts(events, athlete.observations, skipAt.getTime() + 1000)[0];
  assert.equal(attemptAfterSkip.adherence.skipped, 1);
  assert.equal(attemptAfterSkip.adherence.completed, 0);

  // Step B: Correct the skipped workout to completed (as prescribed)
  const correctAt = new Date(day + 'T18:05:00Z');
  const priorEvent = latestTraining(events).find(e => e.id === wid)!;
  const planAfterSkip = activePlan(events)!;
  const scheduled = datedProgram(athlete.benchPlan).weeks.flatMap(w => w.sessions).find(s => s.date === day)!;
  assert.equal(scheduled.kind, 'training');
  const corrected = correctWorkout(
    priorEvent,
    planAfterSkip,
    {
      sets: scheduled.sets,
      amount: scheduled.amount,
      loadKg: scheduled.loadKg,
      minutes: scheduled.estimatedMinutes,
      endedAt: correctAt.toISOString(),
    },
    'Completed workout after work finished',
    correctAt,
  );
  events = appendTraining(
    events,
    {
      version: 1,
      id: wid,
      requestId: await deterministicRequestId(['correct', wid, day, String(priorEvent.revision), 'done']),
      kind: 'workout',
      expectedRevision: priorEvent.revision,
      epoch: 0,
      data: corrected,
      deleted: false,
      reason: 'Completed workout after work finished',
    },
    0,
    correctAt.getTime(),
  );

  const attemptAfterFix = replayGoalAttempts(events, athlete.observations, correctAt.getTime() + 1000)[0];
  assert.equal(attemptAfterFix.adherence.skipped, 0);
  assert.equal(attemptAfterFix.adherence.completed, 1);
  assert.equal(attemptAfterFix.adherence.percent, 100);

  // Forecast recalculates cleanly and measured bench result remains 80 kg
  const planAfterFix = activePlan(events)!;
  const insights = performanceInsights({
    values: athlete.values,
    details: athlete.details,
    plan: planAfterFix,
    entries: athlete.observations,
    today: day,
    now: correctAt.getTime() + 1000,
  });
  assert.equal(insights.goal?.current, 80);
  const dossierAfterFix = buildAthleteDossier({
    owner: athlete.owner,
    values: athlete.values,
    details: athlete.details,
    observations: athlete.observations,
    workspace: athlete.workspace,
    trainingEvents: events,
    asOf: new Date(correctAt.getTime() + 1000),
  });
  assert.equal(dossierAfterFix.measuredResults.bench_1rm.value, 80);
  assert.equal(dossierAfterFix.trainingLedger.skipped, 0);
  assert.equal(dossierAfterFix.trainingLedger.completed, 1);
});

test('Acceptance Row 4: reloads or submits the same offline check-in twice — same decision survives reload with one workout and one effective revision', async () => {
  const athlete = setupExampleAthlete('athlete-offline');
  const storage = makeMemoryStorage();
  const repo = trainingRepository(storage, 'guest');

  // Persist initial program into guest storage
  await repo.put({
    version: 1,
    id: athlete.benchPlan.event.id,
    requestId: crypto.randomUUID(),
    kind: 'program',
    expectedRevision: 0,
    epoch: 0,
    data: athlete.benchPlan.event.data,
    deleted: false,
    reason: '',
  });

  // Save today's 20-min decision to workspace and verify round-trip serialization (simulating reload)
  const wsWithOverride = applyDayAvailabilityOverride(athlete.workspace, {
    date: athlete.startDay,
    minutes: 20,
    now: athlete.now,
  });
  const persistedWs = readWorkspace(JSON.parse(JSON.stringify(wsWithOverride)));
  const plan = activePlan(repo.read().events)!;
  const beforeReload = selectNextSessionDecision(
    buildAthleteDossier({
      owner: 'guest',
      values: athlete.values,
      details: athlete.details,
      observations: athlete.observations,
      workspace: wsWithOverride,
      trainingEvents: repo.read().events,
      asOf: athlete.now,
    }),
    {plan, targetDay: athlete.startDay},
  );
  const afterReload = selectNextSessionDecision(
    buildAthleteDossier({
      owner: 'guest',
      values: athlete.values,
      details: athlete.details,
      observations: athlete.observations,
      workspace: persistedWs,
      trainingEvents: trainingRepository(storage, 'guest').read().events,
      asOf: athlete.now,
    }),
    {plan: activePlan(trainingRepository(storage, 'guest').read().events)!, targetDay: athlete.startDay},
  );
  assert.deepEqual(afterReload, beforeReload);

  // Submit the exact same offline check-in twice with deterministic requestId
  const wid = await workoutId(plan.event.id, athlete.startDay);
  const reqId = await deterministicRequestId(['checkin', plan.event.id, athlete.startDay, '0', '2x5@40/15']);
  const checkInAt = new Date(athlete.startDay + 'T09:00:00Z');
  const workoutDoc = makeWorkout(
    plan,
    athlete.startDay,
    {sets: 2, amount: 5, loadKg: 40, minutes: 15, endedAt: checkInAt.toISOString()},
    checkInAt,
  );
  const mutation = {
    version: 1 as const,
    id: wid,
    requestId: reqId,
    kind: 'workout' as const,
    expectedRevision: 0,
    epoch: 0,
    data: workoutDoc,
    deleted: false,
    reason: '',
  };

  await repo.put(mutation);
  await repo.put(mutation); // Duplicate submission!

  const reloadedLedger = trainingRepository(storage, 'guest').read();
  const workoutEvents = reloadedLedger.events.filter(e => e.kind === 'workout');
  assert.equal(workoutEvents.length, 1);
  assert.equal(workoutEvents[0].revision, 1);
  assert.equal(sessionResult(workoutEvents[0].data as Workout)?.minutes, 15);
});

test('Acceptance Row 5 & Discomfort Routing: same 80 kg bench with different equipment gets feasible prescriptions, and concerning discomfort routes to rest + professional guidance', () => {
  const barbellAthlete = setupExampleAthlete('athlete-barbell', ['barbell']);
  const dumbbellAthlete = setupExampleAthlete('athlete-dumbbells', ['dumbbells']);
  const bodyweightAthlete = setupExampleAthlete('athlete-bw', ['none']);

  // Barbell athlete keeps Barbell bench press
  const dBarbell = selectNextSessionDecision(
    buildAthleteDossier({
      owner: barbellAthlete.owner,
      values: barbellAthlete.values,
      details: barbellAthlete.details,
      observations: barbellAthlete.observations,
      workspace: barbellAthlete.workspace,
      trainingEvents: barbellAthlete.events,
      asOf: barbellAthlete.now,
    }),
    {plan: barbellAthlete.benchPlan, targetDay: barbellAthlete.startDay},
  );
  assert.equal(dBarbell.action, 'keep');
  assert.match(dBarbell.recommended!.exercise[0], /Bench press/i);

  // Even starting from a barbell plan, an athlete who only has dumbbells gets Dumbbell floor press
  const dDumbbells = selectNextSessionDecision(
    buildAthleteDossier({
      owner: dumbbellAthlete.owner,
      values: dumbbellAthlete.values,
      details: dumbbellAthlete.details,
      observations: dumbbellAthlete.observations,
      workspace: dumbbellAthlete.workspace,
      trainingEvents: barbellAthlete.events, // barbell template on a dumbbell-only athlete
      asOf: dumbbellAthlete.now,
    }),
    {plan: barbellAthlete.benchPlan, targetDay: barbellAthlete.startDay},
  );
  assert.equal(dDumbbells.action, 'substitute');
  assert.match(dDumbbells.recommended!.exercise[0], /Dumbbell floor press/i);

  // Bodyweight-only athlete gets Strict push-ups
  const dBodyweight = selectNextSessionDecision(
    buildAthleteDossier({
      owner: bodyweightAthlete.owner,
      values: bodyweightAthlete.values,
      details: bodyweightAthlete.details,
      observations: bodyweightAthlete.observations,
      workspace: bodyweightAthlete.workspace,
      trainingEvents: barbellAthlete.events,
      asOf: bodyweightAthlete.now,
    }),
    {plan: barbellAthlete.benchPlan, targetDay: barbellAthlete.startDay},
  );
  assert.equal(dBodyweight.action, 'substitute');
  assert.match(dBodyweight.recommended!.exercise[0], /push-ups/i);

  // Concerning discomfort routes explicitly to REST + qualified health professional guidance
  const wsPain = applyDayAvailabilityOverride(barbellAthlete.workspace, {
    date: barbellAthlete.startDay,
    discomfort: {severity: 'concerning', area: 'left shoulder'},
    reason: 'Sharp pain during warm-up',
    now: barbellAthlete.now,
  });
  const dPain = selectNextSessionDecision(
    buildAthleteDossier({
      owner: barbellAthlete.owner,
      values: barbellAthlete.values,
      details: barbellAthlete.details,
      observations: barbellAthlete.observations,
      workspace: wsPain,
      trainingEvents: barbellAthlete.events,
      asOf: barbellAthlete.now,
    }),
    {plan: barbellAthlete.benchPlan, targetDay: barbellAthlete.startDay},
  );
  assert.equal(dPain.action, 'rest');
  assert.equal(dPain.recommended, null);
  assert.ok(dPain.clinicalNotice);
  assert.match(dPain.clinicalNotice[0], /qualified health professional/i);

  // Workspace stays well below PostgreSQL 16 KB personal_workspaces JSONB limit
  assert.ok(Buffer.byteLength(JSON.stringify(emptyWorkspace())) < 16384);
  assert.ok(Buffer.byteLength(JSON.stringify(wsPain)) < 16384);
});
