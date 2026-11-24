import assert from 'node:assert/strict';
import test from 'node:test';
import {activePlan, buildProgram, makeWorkout, workoutId} from './adaptiveProgram';
import {buildAthleteDossier} from './athleteDossier';
import {applyDayAvailabilityOverride, selectNextSessionDecision} from './coachDecision';
import {datedProgram} from './datedProgram';
import {
  emptyWorkspace,
  normalizeTrainingContext,
  type PersonalWorkspace,
  type StoredCoachDecision,
} from './personalWorkspace';
import {planGoalPortfolio} from './programPortfolio';
import {
  DEFAULT_POPULATION_PARAMS,
  optimizePersonalPolicy,
  runSelfOptimizationCycle,
  type ProspectiveCohortRecord,
} from './selfOptimization';
import {appendTraining, type TrainingEvent} from './training';

function makeDecisionRecord(
  id: string,
  day: string,
  action: 'shorten' | 'move' | 'substitute',
): StoredCoachDecision {
  return {
    id,
    modelVersion: 'coach-decision-v1',
    decidedAt: `${day}T07:00:00Z`,
    day,
    metric: 'bench_1rm',
    action,
    reasonCode: 'time_constraint',
    triggerInput: '20 min',
    scope: 'today',
    summary: 'Historical adapted session',
    before: {
      exercise: 'Barbell bench press',
      sets: 4,
      amount: 5,
      mode: 'reps',
      loadKg: 70,
      minutes: 45,
      date: day,
    },
    after: {
      exercise: 'Barbell bench press',
      sets: action === 'shorten' ? 2 : 4,
      amount: 5,
      mode: 'reps',
      loadKg: 70,
      minutes: action === 'shorten' ? 20 : 45,
      date: day,
    },
  };
}

async function setupPlanAndEvents(
  entries: Array<{action: 'shorten' | 'move'; status: 'completed' | 'abandoned'}>,
) {
  const startDay = '2026-11-02';
  const now = new Date('2026-12-01T08:00:00Z');
  const workspace: PersonalWorkspace = {
    ...emptyWorkspace(),
    context: normalizeTrainingContext({
      experience: 'one_to_three',
      days: 2,
      minutes: 45,
      equipment: ['barbell', 'outdoor'],
      timezone: 'UTC',
      pinnedMetrics: ['bench_1rm'],
    }),
  };

  const portfolio = planGoalPortfolio({
    goals: [{metric: 'bench_1rm', unit: 'kg', current: 80, target: 100, bodyWeightKg: 80}],
    startDay,
    timeZone: 'UTC',
    context: workspace.context,
    observations: [],
    now: new Date('2026-11-02T07:00:00Z'),
  });

  const programId = crypto.randomUUID();
  let events: TrainingEvent[] = [];
  events = appendTraining(
    events,
    {
      version: 1,
      id: programId,
      requestId: crypto.randomUUID(),
      kind: 'program',
      expectedRevision: 0,
      epoch: 0,
      data: buildProgram({...portfolio.items[0].config, minutes: 45, days: 2}, 'UTC'),
      deleted: false,
      reason: '',
    },
    0,
    Date.parse('2026-11-02T07:00:00Z'),
  );
  const plan = activePlan(events)!;
  const scheduledDays = datedProgram(plan)
    .weeks.flatMap(w => w.sessions)
    .filter(s => s.kind === 'training')
    .map(s => s.date);

  const decisions: StoredCoachDecision[] = [];
  for (let i = 0; i < entries.length; i++) {
    const day = scheduledDays[i];
    const {action, status} = entries[i];
    decisions.push(makeDecisionRecord(`d-${i + 1}`, day, action));
    const at = new Date(`${day}T09:30:00Z`);
    const base = makeWorkout(
      plan,
      day,
      status === 'completed'
        ? {
            sets: plan.prescription.sets,
            amount: plan.prescription.amount,
            loadKg: plan.prescription.loadKg,
            minutes: 35,
          }
        : null,
      at,
      status === 'completed' ? undefined : 'time',
    );
    const wid = await workoutId(plan.event.id, day);
    events = appendTraining(
      events,
      {
        version: 1,
        id: wid,
        requestId: crypto.randomUUID(),
        kind: 'workout',
        expectedRevision: 0,
        epoch: 0,
        data: base,
        deleted: false,
        reason: '',
      },
      0,
      at.getTime(),
    );
  }
  workspace.context.coachDecisions = decisions;
  const nextScheduledDay = scheduledDays[entries.length];
  return {workspace, plan, events, now, nextScheduledDay};
}

test('optimizePersonalPolicy stays inactive under 3 matched outcomes and activates with bounded deltas once learned', async () => {
  const few = await setupPlanAndEvents([
    {action: 'shorten', status: 'abandoned'},
    {action: 'move', status: 'completed'},
  ]);
  const dossierFew = buildAthleteDossier({
    owner: 'guest',
    profile: {sex: 'male', age: 34, weight: 80},
    values: {bench_1rm: 1},
    details: {},
    workspace: few.workspace,
    trainingEvents: few.events,
    observations: [],
    asOf: few.now,
  });
  const policyFew = optimizePersonalPolicy(dossierFew, few.events);
  assert.equal(policyFew.active, false);
  assert.equal(policyFew.observationsUsed, 2);
  assert.equal(policyFew.actions.shorten.scoreDelta, 0);
  assert.equal(policyFew.actions.move.scoreDelta, 0);

  // 6 matched outcomes: shorten skipped 3/3 times, move completed 3/3 times
  const many = await setupPlanAndEvents([
    {action: 'shorten', status: 'abandoned'},
    {action: 'shorten', status: 'abandoned'},
    {action: 'shorten', status: 'abandoned'},
    {action: 'move', status: 'completed'},
    {action: 'move', status: 'completed'},
    {action: 'move', status: 'completed'},
  ]);
  const dossierMany = buildAthleteDossier({
    owner: 'guest',
    profile: {sex: 'male', age: 34, weight: 80},
    values: {bench_1rm: 1},
    details: {},
    workspace: many.workspace,
    trainingEvents: many.events,
    observations: [],
    asOf: many.now,
  });
  const policyMany = optimizePersonalPolicy(dossierMany, many.events);
  assert.equal(policyMany.active, true);
  assert.equal(policyMany.observationsUsed, 6);
  assert.equal(policyMany.preferredTimeAction, 'move');
  assert.ok(policyMany.actions.move.scoreDelta > 0 && policyMany.actions.move.scoreDelta <= 8);
  assert.ok(policyMany.actions.shorten.scoreDelta < 0 && policyMany.actions.shorten.scoreDelta >= -8);

  // Safety invariant: even with learned policy active, concerning discomfort ALWAYS routes to rest
  const checkNow = new Date(`${many.nextScheduledDay}T08:00:00Z`);
  const wsDiscomfort = applyDayAvailabilityOverride(many.workspace, {
    date: many.nextScheduledDay,
    discomfort: {severity: 'concerning', area: 'shoulder'},
    reason: 'Sharp pain',
    now: checkNow,
  });
  const dossierDiscomfort = buildAthleteDossier({
    owner: 'guest',
    profile: {sex: 'male', age: 34, weight: 80},
    values: {bench_1rm: 1},
    details: {},
    workspace: wsDiscomfort,
    trainingEvents: many.events,
    observations: [],
    asOf: checkNow,
  });
  const concerningDecision = selectNextSessionDecision(dossierDiscomfort, {
    plan: many.plan,
    targetDay: many.nextScheduledDay,
  });
  assert.equal(concerningDecision.action, 'rest');
});

test('runSelfOptimizationCycle promotes calibrated shift on independent holdout, holds on small sample, and rolls back degraded shift', () => {
  // 1. Small sample -> hold
  const tiny: ProspectiveCohortRecord[] = Array.from({length: 12}, (_, i) => ({
    athleteId: `ath-${i}`,
    metric: 'bench_1rm',
    modelVersion: 'goal-paths-v3',
    issuedAt: `2026-01-${String(i + 1).padStart(2, '0')}T08:00:00Z`,
    predictedProbability: 0.75,
    baselineProbability: 0.75,
    reachedOnTime: i % 2 === 0,
  }));
  const holdResult = runSelfOptimizationCycle({records: tiny, minHoldoutOutcomes: 20});
  assert.equal(holdResult.decision, 'hold');

  // 2. Consistent over-prediction (+25pp bias) across 60 independent athletes -> promote negative shift
  const biased: ProspectiveCohortRecord[] = Array.from({length: 60}, (_, i) => {
    const month = i < 30 ? '01' : '02';
    const day = String((i % 28) + 1).padStart(2, '0');
    return {
      athleteId: `ath-${i}`,
      metric: 'bench_1rm',
      modelVersion: 'goal-paths-v3',
      issuedAt: `2026-${month}-${day}T08:00:00Z`,
      predictedProbability: 0.75,
      baselineProbability: 0.75,
      reachedOnTime: i % 2 === 0,
    };
  });
  const promoteResult = runSelfOptimizationCycle({records: biased, minHoldoutOutcomes: 20});
  assert.equal(promoteResult.decision, 'promote');
  assert.ok(promoteResult.candidateParams.calibrationShift < -0.05);
  assert.ok((promoteResult.holdoutReport.brierImprovement ?? 0) >= 0.002);

  // 3. Previously shifted active model (+0.15) now facing well-calibrated holdout data -> rollback
  const drifted: ProspectiveCohortRecord[] = Array.from({length: 50}, (_, i) => {
    const isFit = i < 25;
    const month = isFit ? '01' : '03';
    const day = String((i % 25) + 1).padStart(2, '0');
    return {
      athleteId: `drift-${i}`,
      metric: 'run_5k',
      modelVersion: 'goal-paths-v3-opt',
      issuedAt: `2026-${month}-${day}T08:00:00Z`,
      predictedProbability: 0.5,
      baselineProbability: 0.5,
      reachedOnTime: isFit ? i % 5 !== 0 : i % 2 === 0,
    };
  });
  const rollbackResult = runSelfOptimizationCycle({
    records: drifted,
    activeParams: {...DEFAULT_POPULATION_PARAMS, calibrationShift: 0.15},
    minHoldoutOutcomes: 20,
  });
  assert.equal(rollbackResult.decision, 'rollback');
  assert.deepEqual(rollbackResult.rollbackTarget, DEFAULT_POPULATION_PARAMS);
});
