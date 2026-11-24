import assert from 'node:assert/strict';
import test from 'node:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {buildProgram} from './adaptiveProgram';
import {
  ASSESSMENT_GRAPH_VERSION,
  evaluateAssessmentStep,
  QUESTION_CATALOGUE,
  type AssessmentAnswers,
} from './assessmentGraph';
import {buildAthleteDossier} from './athleteDossier';
import {CoachSnapshotChanged, commitAccountCoachAction, readAccountCoachDecision} from './coachServer';
import {createGuidedConfig} from './datedProgram';
import type {Observation} from './history';
import {normalizeTrainingContext, type PersonalWorkspace} from './personalWorkspace';
import {appendTraining, type TrainingEvent} from './training';

const TODAY = '2026-11-24'; // Tuesday

test('question catalogue documents every node with decision impact, staleness, unknown handling, and evidence basis', () => {
  assert.ok(QUESTION_CATALOGUE.length >= 13);
  for (const node of QUESTION_CATALOGUE) {
    assert.ok(node.id && node.stage);
    assert.equal(node.title.length, 3);
    assert.equal(node.prompt.length, 3);
    assert.ok(node.whoSeesIt.length > 5);
    assert.ok(node.decisionAffected.length > 5);
    assert.ok(node.unknownHandling.length > 5);
    assert.ok(node.evidenceBasis.length > 5);
  }
});

test('bench assessment distinguishes recent tested max vs old test vs estimate, barbell access, one-week override, body mass ratio, and forecast-neutral preferences', () => {
  const baseBench: AssessmentAnswers = {
    referenceSex: 'male',
    age: 34,
    recency: 'regular',
    restrictionStatus: 'confirmed_none',
    bodyWeightKg: 80,
    goalDirection: 'strength',
    primaryMetric: 'bench_1rm',
    secondaryMetric: 'run_5k',
    baselineValue: 80,
    baselineUnit: 'kg',
    baselineMethod: 'recent_tested_max',
    commitmentMode: 'fixed_target',
    targetValue: 100,
    daysPerWeek: 2,
    minutesPerSession: 45,
    equipment: ['barbell', 'outdoor'],
    coachingStyle: 'direct',
  };

  // 1. Recent tested 80 kg max with barbell
  const recentEval = evaluateAssessmentStep(baseBench, {today: TODAY, timeZone: 'UTC'});
  assert.equal(recentEval.graphVersion, ASSESSMENT_GRAPH_VERSION);
  assert.equal(recentEval.reveal.standing.measuredValue, 80);
  assert.equal(recentEval.reveal.standing.bodyweightRatio, 1);
  assert.equal(recentEval.reveal.standing.confidence, 'measured');
  assert.equal(recentEval.reveal.nextAction.decision?.action, 'keep');
  assert.match(recentEval.reveal.nextAction.decision!.recommended!.exercise[0], /Bench press/i);
  assert.ok(!recentEval.activeNodes.includes('recent_working_set'));
  assert.ok(!recentEval.activeNodes.includes('barbell_access'));

  // 2. Old test triggers recent_working_set branch and lowers confidence to provisional
  const oldTestEval = evaluateAssessmentStep(
    {...baseBench, baselineMethod: 'old_test'},
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.ok(oldTestEval.activeNodes.includes('recent_working_set'));
  assert.equal(oldTestEval.reveal.standing.confidence, 'provisional');

  // 3. Answer changing CONFIDENCE ONLY: estimate vs recent_tested_max keeps 80 kg baseline and same forecast
  const estimateEval = evaluateAssessmentStep(
    {...baseBench, baselineMethod: 'estimate'},
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.equal(estimateEval.reveal.standing.measuredValue, 80);
  assert.equal(estimateEval.reveal.standing.confidence, 'provisional');
  assert.equal(estimateEval.reveal.achievable.dayOneProbability, recentEval.reveal.achievable.dayOneProbability);
  assert.equal(estimateEval.reveal.achievable.suggestedDate, recentEval.reveal.achievable.suggestedDate);

  // 4. Answer 1 CHANGING RECOMMENDATION: lack of barbell triggers barbell_access & switches to Dumbbell floor press
  const noBarbellEval = evaluateAssessmentStep(
    {...baseBench, equipment: ['dumbbells'], barbellAccess: 'absent'},
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.ok(noBarbellEval.activeNodes.includes('barbell_access'));
  assert.equal(noBarbellEval.reveal.nextAction.decision?.action, 'keep'); // plan itself was created with dumbbells -> Dumbbell floor press!
  assert.match(noBarbellEval.reveal.nextAction.decision!.recommended!.exercise[0], /Dumbbell floor press/i);
  assert.match(noBarbellEval.reveal.achievable.feasibilityNote ?? '', /No barbell access/i);

  // 5. Answer 2 CHANGING RECOMMENDATION: one-week 20-min restriction shortens ONLY that day
  const oneWeekShortEval = evaluateAssessmentStep(
    {...baseBench, oneWeekMinutesOverride: {date: TODAY, minutes: 20}},
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.equal(oneWeekShortEval.reveal.nextAction.decision?.action, 'shorten');
  assert.equal(oneWeekShortEval.reveal.nextAction.decision?.scope, 'today');
  assert.equal(oneWeekShortEval.reveal.nextAction.decision?.expiresOn, TODAY);
  assert.ok(oneWeekShortEval.reveal.nextAction.decision!.recommended!.totalMinutes <= 20);

  // 6. Changing body mass updates displayed × BW ratio WITHOUT changing the historical 80 kg lift or forecast
  const heavierEval = evaluateAssessmentStep(
    {...baseBench, bodyWeightKg: 85},
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.equal(heavierEval.reveal.standing.measuredValue, 80);
  assert.equal(heavierEval.reveal.standing.bodyweightRatio, 0.94);
  assert.equal(heavierEval.reveal.achievable.dayOneProbability, recentEval.reveal.achievable.dayOneProbability);

  // 7. Answer LEAVING FORECAST ALONE: coaching style change leaves forecast untouched
  const supportiveEval = evaluateAssessmentStep(
    {...baseBench, coachingStyle: 'supportive'},
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.equal(supportiveEval.reveal.achievable.dayOneProbability, recentEval.reveal.achievable.dayOneProbability);
  assert.equal(supportiveEval.reveal.achievable.suggestedDate, recentEval.reveal.achievable.suggestedDate);
});

test('runner branch, explorer with no baseline, under-18 scope, skipped sex, back-navigation pruning, and returning athlete reuse', () => {
  // Runner gets running_volume branch (no barbell_access)
  const runnerEval = evaluateAssessmentStep(
    {
      referenceSex: 'female',
      age: 29,
      recency: 'occasional',
      bodyWeightKg: null,
      goalDirection: 'running',
      primaryMetric: 'run_5k',
      baselineValue: 25,
      baselineMethod: 'recent_tested_max',
      runningVolume: '10k_to_25k',
      commitmentMode: 'fixed_time',
      daysPerWeek: 3,
      minutesPerSession: 30,
      equipment: ['outdoor'],
      coachingStyle: 'direct',
    },
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.ok(runnerEval.activeNodes.includes('running_volume'));
  assert.ok(!runnerEval.activeNodes.includes('barbell_access'));
  assert.equal(runnerEval.reveal.standing.measuredValue, 25);
  assert.equal(runnerEval.reveal.standing.unit, 'min');

  // Explorer with no baseline keeps standing visibly unmeasured and proposes a baseline test
  const explorerEval = evaluateAssessmentStep(
    {
      referenceSex: 'skip',
      age: 31,
      recency: 'new',
      restrictionStatus: 'unknown',
      bodyWeightKg: null,
      goalDirection: 'explore',
      primaryMetric: 'pushups',
      baselineMethod: 'none_yet',
      baselineValue: null,
      commitmentMode: 'fixed_time',
      daysPerWeek: 2,
      minutesPerSession: 20,
      equipment: ['none'],
      coachingStyle: 'minimal',
    },
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.equal(explorerEval.reveal.standing.measuredValue, null);
  assert.equal(explorerEval.reveal.standing.confidence, 'unmeasured');
  assert.equal(explorerEval.reveal.standing.referenceAvailable, false);
  assert.equal(explorerEval.reveal.nextAction.kind, 'baseline_test');

  // Under 18 triggers adult_scope_notice and blocks adult prescriptions
  const minorEval = evaluateAssessmentStep(
    {referenceSex: 'skip', age: 16},
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.ok(minorEval.activeNodes.includes('adult_scope_notice'));
  assert.equal(minorEval.currentNode, 'adult_scope_notice');
  assert.equal(minorEval.reveal.nextAction.kind, 'explore_only');

  // Changing an earlier answer (bench -> running) prunes & archives stale barbellAccess
  const changedEarlier = evaluateAssessmentStep(
    {
      goalDirection: 'running',
      primaryMetric: 'run_5k',
      barbellAccess: 'absent',
      recentWorkingLoadKg: 50,
    },
    {today: TODAY, timeZone: 'UTC'},
  );
  assert.equal(changedEarlier.prunedAnswers.barbellAccess, undefined);
  assert.equal(changedEarlier.prunedAnswers.recentWorkingLoadKg, undefined);
  assert.ok(changedEarlier.staleInvalidatedKeys.includes('barbellAccess'));
  assert.equal(changedEarlier.prunedAnswers.archivedAnswers?.barbellAccess, 'absent');

  // Returning athlete with confirmed fresh dossier skips confirmed nodes
  const benchObs: Observation = {
    id: 'ret-1',
    metricId: 'bench_1rm',
    value: 1,
    method: 'manual',
    protocol: {id: 'bench_paused_v1', bodyWeightKg: 80},
    derivation: {formula: 'epley_ratio_v1', inputs: [80, 1], bodyWeightKg: 80},
    measuredAt: '2026-11-20T10:00:00Z',
    recordedAt: '2026-11-20T10:05:00Z',
    cleared: false,
  };
  const cfg = createGuidedConfig({
    metric: 'bench_1rm',
    baseline: 80,
    target: 100,
    startDay: TODAY,
    deadline: '2027-04-01',
    timeZone: 'UTC',
    goalUnit: 'kg',
    context: {experience: 'one_to_three', days: 2, minutes: 45, equipment: ['barbell']},
    bodyWeightKg: 80,
    now: new Date(TODAY + 'T08:00:00Z'),
  });
  const events: TrainingEvent[] = appendTraining(
    [],
    {
      version: 1,
      id: '20000000-0000-4000-8000-000000000001',
      requestId: '20000000-0000-4000-8000-000000000002',
      kind: 'program',
      expectedRevision: 0,
      epoch: 0,
      data: buildProgram(cfg, 'UTC'),
      deleted: false,
      reason: '',
    },
    0,
    Date.parse(TODAY + 'T08:00:00Z'),
  );
  const returningDossier = buildAthleteDossier({
    owner: 'returning-user',
    profile: {age: 34, sex: 'male', weight: 80, height: 180},
    values: {bench_1rm: 1},
    details: {bench_1rm: {measuredAt: benchObs.measuredAt, method: 'manual', protocol: benchObs.protocol, derivation: benchObs.derivation}},
    observations: [benchObs],
    workspace: {
      version: 1,
      goal: null,
      context: normalizeTrainingContext({experience: 'one_to_three', days: 2, minutes: 45, equipment: ['barbell'], timezone: 'UTC'}),
    },
    trainingEvents: events,
    asOf: new Date(TODAY + 'T08:00:00Z'),
  });
  const returningEval = evaluateAssessmentStep({}, {existingDossier: returningDossier, today: TODAY, timeZone: 'UTC'});
  assert.ok(returningEval.reveal.returningSkippedNodes.includes('reference_sex'));
  assert.ok(returningEval.reveal.returningSkippedNodes.includes('age'));
  assert.ok(returningEval.reveal.returningSkippedNodes.includes('baseline_evidence'));
  assert.ok(returningEval.reveal.returningSkippedNodes.includes('real_commitment'));
});

test('server-authoritative coaching engine reads account snapshot, commits 20-min Tuesday decision, and rejects stale revisions', async () => {
  const owner = '30000000-0000-4000-8000-000000000001';
  const now = new Date('2026-11-24T08:00:00Z');
  const cfg = createGuidedConfig({
    metric: 'bench_1rm',
    baseline: 80,
    target: 100,
    startDay: TODAY,
    deadline: '2027-04-01',
    timeZone: 'UTC',
    goalUnit: 'kg',
    context: {experience: 'one_to_three', days: 2, minutes: 45, equipment: ['barbell']},
    bodyWeightKg: 80,
    now,
  });
  const events: TrainingEvent[] = appendTraining(
    [],
    {
      version: 1,
      id: '30000000-0000-4000-8000-000000000010',
      requestId: '30000000-0000-4000-8000-000000000011',
      kind: 'program',
      expectedRevision: 0,
      epoch: 0,
      data: buildProgram(cfg, 'UTC'),
      deleted: false,
      reason: '',
    },
    0,
    now.getTime(),
  );

  let workspaceState: {data: PersonalWorkspace; revision: number} = {
    data: {
      version: 1,
      goal: null,
      context: normalizeTrainingContext({
        experience: 'one_to_three',
        days: 2,
        minutes: 45,
        equipment: ['barbell'],
        timezone: 'UTC',
      }),
    },
    revision: 1,
  };

  // Minimal in-memory Supabase client stub matching the RPC & table queries used by lib/coachServer.ts
  const stubClient = {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: async () => ({data: [], error: null}),
        maybeSingle: async () => {
          if (table === 'profiles') {
            return {data: {age: 34, sex: 'male', weight_kg: 80, height_cm: 180, revision: 1}, error: null};
          }
          if (table === 'personal_workspaces') {
            return {data: workspaceState, error: null};
          }
          if (table === 'training_state') {
            return {data: {epoch: 0, counter: events.length}, error: null};
          }
          return {data: null, error: null};
        },
      };
      return chain;
    },
    async rpc(fn: string, params?: Record<string, unknown>) {
      if (fn === 'read_training_page') {
        return {data: {epoch: 0, counter: events.length, events, next: null}, error: null};
      }
      if (fn === 'read_current_measurements') {
        return {
          data: {
            values: {bench_1rm: 1},
            details: {
              bench_1rm: {
                measuredAt: '2026-11-20T10:00:00Z',
                method: 'manual',
                protocol: {id: 'bench_paused_v1', bodyWeightKg: 80},
                derivation: {formula: 'epley_ratio_v1', inputs: [80, 1], bodyWeightKg: 80},
              },
            },
          },
          error: null,
        };
      }
      if (fn === 'save_personal_workspace') {
        if (params?.p_revision !== workspaceState.revision) {
          return {data: null, error: {code: 'PT409', message: 'Workspace changed elsewhere'}};
        }
        workspaceState = {
          data: params.p_data as PersonalWorkspace,
          revision: workspaceState.revision + 1,
        };
        return {data: workspaceState, error: null};
      }
      throw Error(`Unexpected RPC ${fn}`);
    },
  } as unknown as SupabaseClient;

  // 1. Server read returns unchanged 45-min Tuesday session
  const before = await readAccountCoachDecision(stubClient, owner, {targetDay: TODAY, now});
  assert.equal(before.decision?.action, 'keep');
  assert.equal(before.workspaceRevision, 1);

  // 2. Server commit adapts Tuesday to 20 min and increments workspaceRevision
  const committed = await commitAccountCoachAction(stubClient, owner, {
    action: {kind: 'today-minutes', day: TODAY, minutes: 20},
    expectedWorkspaceRevision: 1,
    now,
  });
  assert.equal(committed.decision.action, 'shorten');
  assert.ok(committed.decision.recommended!.totalMinutes <= 20);
  assert.equal(committed.workspaceRevision, 2);
  assert.equal(committed.workspace.context.coachDecisions?.length, 1);

  // 3. Stale revision from another device is rejected with CoachSnapshotChanged (409)
  await assert.rejects(
    () =>
      commitAccountCoachAction(stubClient, owner, {
        action: {kind: 'today-minutes', day: TODAY, minutes: 15},
        expectedWorkspaceRevision: 1, // stale! server is now at 2
        now,
      }),
    CoachSnapshotChanged,
  );
});
