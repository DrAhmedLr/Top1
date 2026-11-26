import type {SupabaseClient} from '@supabase/supabase-js';
import {
  addDays,
  currentAdaptivePlans,
  dayInZone,
  sessionResult,
  type AdaptivePlan,
} from './adaptiveProgram';
import {
  buildAthleteDossier,
  DOSSIER_VERSION,
  isoWeekdayForDay,
  type AthleteDossier,
} from './athleteDossier';
import {
  applyDayAvailabilityOverride,
  applyWeekdayMinutesRule,
  COACH_ENGINE_VERSION,
  selectNextSessionDecision,
  toStoredDecision,
  undoCoachAdjustment,
  type CoachDecision,
} from './coachDecision';
import {datedProgram} from './datedProgram';
import {historyFields, toEntries} from './metricLogRows';
import type {Observation} from './history';
import {normalizeMeasurementMetadata, type MeasurementMetadata} from './measurementMetadata';
import {
  emptyWorkspace,
  readWorkspace,
  type DiscomfortReport,
  type EquipmentOption,
  type PersonalWorkspace,
} from './personalWorkspace';
import {normalizeDemographics, normalizeValues} from './profile';
import type {Demographics, Values} from './registry';
import type {TrainingEvent, Workout} from './training';

export class CoachSnapshotChanged extends Error {}
export class CoachGoalNotFound extends Error {}

export type CoachActionPayload =
  | {kind: 'today-minutes'; day: string; minutes: number; reason?: string; locale?: 'en' | 'fr' | 'ar'}
  | {kind: 'weekday-minutes'; day: string; minutes: number; locale?: 'en' | 'fr' | 'ar'}
  | {kind: 'today-equipment'; day: string; equipment: EquipmentOption[]; reason?: string; locale?: 'en' | 'fr' | 'ar'}
  | {kind: 'today-discomfort'; day: string; discomfort: DiscomfortReport; reason?: string; locale?: 'en' | 'fr' | 'ar'}
  | {kind: 'undo'; day: string; scope: 'today' | 'weekday'; decisionId?: string};

export type AccountCoachSnapshot = {
  owner: string;
  profile?: Demographics;
  values: Values;
  details: MeasurementMetadata;
  observations: Observation[];
  dossier: AthleteDossier;
  workspace: PersonalWorkspace;
  workspaceRevision: number;
  profileRevision: number;
  trainingEpoch: number;
  trainingCounter: number;
  trainingEvents: TrainingEvent[];
  plans: AdaptivePlan[];
  selectedPlan: AdaptivePlan | null;
  targetDay: string | null;
  decision: CoachDecision | null;
};

async function readAllTrainingEvents(client: SupabaseClient) {
  let cursor = 0;
  let epoch: number | undefined;
  let counter: number | undefined;
  const events: TrainingEvent[] = [];
  while (true) {
    const {data, error} = await client.rpc('read_training_page', {p_after: cursor});
    if (error || !Array.isArray(data?.events)) throw Error('Training unavailable');
    if (epoch !== undefined && (epoch !== data.epoch || counter !== data.counter)) {
      throw new CoachSnapshotChanged();
    }
    epoch = Number(data.epoch);
    counter = Number(data.counter);
    events.push(...(data.events as TrainingEvent[]));
    if (data.next === null) break;
    if (!Number.isSafeInteger(data.next) || data.next <= cursor) throw Error('Invalid training cursor');
    cursor = data.next;
  }
  return {events, plans: currentAdaptivePlans(events), epoch: epoch ?? 0, counter: counter ?? 0};
}

async function readRecentMetricHistory(client: SupabaseClient, owner: string, metrics: string[]) {
  if (!metrics.length) return [] as Observation[];
  const results = await Promise.all(
    metrics.map(async metric => {
      const {data, error} = await client
        .from('metric_logs')
        .select(historyFields)
        .eq('user_id', owner)
        .eq('metric_id', metric)
        .order('sequence', {ascending: false})
        .limit(100);
      if (error) throw Error('History unavailable');
      return toEntries(data ?? []);
    }),
  );
  return results.flat();
}

function resolveNextDayForPlan(plan: AdaptivePlan, today: string): string {
  if (plan.config.guidedVersion === 1) {
    const loggedToday = plan.sessions.some(
      event => sessionResult(event.data as Workout)?.day === today,
    );
    const sessions = datedProgram(plan).weeks.flatMap(w => w.sessions);
    const next = sessions.find(
      row => row.date > today || (row.date === today && (!loggedToday || row.kind === 'retest')),
    );
    return next?.date ?? today;
  }
  const loggedToday = plan.sessions.some(
    event => sessionResult(event.data as Workout)?.day === today,
  );
  return loggedToday ? addDays(today, 1) : today;
}

/**
 * Reads a revision-consistent account snapshot from Supabase and executes the
 * dossier reconstruction and coaching decision algorithm authoritatively on the server.
 */
export async function readAccountCoachDecision(
  client: SupabaseClient,
  owner: string,
  options: {planId?: string; targetDay?: string; now?: Date} = {},
): Promise<AccountCoachSnapshot> {
  const now = options.now ?? new Date();
  const profileQuery = () =>
    client.from('profiles').select('age,sex,weight_kg,height_cm,revision').eq('id', owner).maybeSingle();
  const workspaceQuery = () =>
    client.from('personal_workspaces').select('data,revision').eq('user_id', owner).maybeSingle();

  const [profileRow, workspaceRow, ledger, measurements] = await Promise.all([
    profileQuery(),
    workspaceQuery(),
    readAllTrainingEvents(client),
    client.rpc('read_current_measurements'),
  ]);

  if (profileRow.error || workspaceRow.error || measurements.error) {
    throw Error('Account data unavailable');
  }

  const selectedPlan = options.planId
    ? ledger.plans.find(p => p.event.id === options.planId) ?? null
    : ledger.plans[0] ?? null;
  if (options.planId && !selectedPlan) throw new CoachGoalNotFound();

  const activeMetrics = [...new Set(ledger.plans.map(p => p.config.metric))];
  const observations = await readRecentMetricHistory(client, owner, activeMetrics);

  // Double-read consistency check: prevent computing a decision from a stale revision.
  const [profileCheck, workspaceCheck, trainingCheck] = await Promise.all([
    profileQuery(),
    workspaceQuery(),
    client.from('training_state').select('epoch,counter').eq('user_id', owner).maybeSingle(),
  ]);
  if (profileCheck.error || workspaceCheck.error || trainingCheck.error) {
    throw Error('Consistency check unavailable');
  }
  if (
    profileCheck.data?.revision !== profileRow.data?.revision ||
    workspaceCheck.data?.revision !== workspaceRow.data?.revision ||
    Number(trainingCheck.data?.epoch ?? 0) !== ledger.epoch ||
    Number(trainingCheck.data?.counter ?? 0) !== ledger.counter
  ) {
    throw new CoachSnapshotChanged();
  }

  const workspace = workspaceRow.data ? readWorkspace(workspaceRow.data.data) : emptyWorkspace();
  const workspaceRevision = Number(workspaceRow.data?.revision ?? 0);
  const row = profileRow.data;
  const values = normalizeValues(row ? measurements.data?.values ?? {} : {});
  const details = normalizeMeasurementMetadata(measurements.data?.details, {legacy: true});
  const hasProfile = Boolean(row && (Number(row.revision) > 0 || Object.keys(values).length > 0));
  const profile = hasProfile && row
    ? normalizeDemographics({
        age: row.age,
        sex: row.sex,
        weight: row.weight_kg == null ? undefined : Number(row.weight_kg),
        height: row.height_cm == null ? undefined : Number(row.height_cm),
      })
    : undefined;

  const zone = selectedPlan?.event.data.timeZone || workspace.context.timezone || 'UTC';
  const dossier = buildAthleteDossier({
    owner,
    profile,
    values,
    details,
    observations,
    workspace,
    trainingEvents: ledger.events,
    asOf: now,
    timeZone: zone,
  });

  if (!selectedPlan) {
    return {
      owner,
      profile,
      values,
      details,
      observations,
      dossier,
      workspace,
      workspaceRevision,
      profileRevision: Number(row?.revision ?? 0),
      trainingEpoch: ledger.epoch,
      trainingCounter: ledger.counter,
      trainingEvents: ledger.events,
      plans: ledger.plans,
      selectedPlan: null,
      targetDay: null,
      decision: null,
    };
  }

  const today = dayInZone(now, zone);
  const targetDay = options.targetDay ?? resolveNextDayForPlan(selectedPlan, today);
  const calendar = selectedPlan.config.guidedVersion === 1 ? datedProgram(selectedPlan) : undefined;
  const decision = selectNextSessionDecision(dossier, {
    plan: selectedPlan,
    targetDay,
    calendar,
    allPlans: ledger.plans,
  });

  return {
    owner,
    profile,
    values,
    details,
    observations,
    dossier,
    workspace,
    workspaceRevision,
    profileRevision: Number(row?.revision ?? 0),
    trainingEpoch: ledger.epoch,
    trainingCounter: ledger.counter,
    trainingEvents: ledger.events,
    plans: ledger.plans,
    selectedPlan,
    targetDay,
    decision,
  };
}

/**
 * Commits a coaching adjustment server-side against `expectedWorkspaceRevision`
 * (serializing concurrent devices via `save_personal_workspace` PT409 check) and
 * returns the authoritative recomputed decision, versions, and updated workspace.
 */
export async function commitAccountCoachAction(
  client: SupabaseClient,
  owner: string,
  input: {
    action: CoachActionPayload;
    expectedWorkspaceRevision: number;
    planId?: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const current = await readAccountCoachDecision(client, owner, {
    planId: input.planId,
    targetDay: input.action.day,
    now,
  });
  if (current.workspaceRevision !== input.expectedWorkspaceRevision) {
    throw new CoachSnapshotChanged();
  }
  if (!current.selectedPlan) throw new CoachGoalNotFound();

  const locale = 'locale' in input.action && input.action.locale ? input.action.locale : 'en';
  const calendar =
    current.selectedPlan.config.guidedVersion === 1
      ? datedProgram(current.selectedPlan)
      : undefined;

  const computeWith = (nextWorkspace: PersonalWorkspace) => {
    const nextDossier = buildAthleteDossier({
      owner,
      profile: current.profile,
      values: current.values,
      details: current.details,
      observations: current.observations,
      workspace: nextWorkspace,
      trainingEvents: current.trainingEvents,
      asOf: now,
      timeZone: current.dossier.identity.timeZone,
    });
    return selectNextSessionDecision(nextDossier, {
      plan: current.selectedPlan!,
      targetDay: input.action.day,
      calendar,
      allPlans: current.plans,
    });
  };

  let nextWorkspace: PersonalWorkspace;
  let finalDecision: CoachDecision;

  if (input.action.kind === 'undo') {
    nextWorkspace = undoCoachAdjustment(current.workspace, {
      day: input.action.day,
      scope: input.action.scope,
      decisionId: input.action.decisionId,
      now,
    });
    finalDecision = computeWith(nextWorkspace);
  } else if (input.action.kind === 'today-minutes') {
    const draft = applyDayAvailabilityOverride(current.workspace, {
      date: input.action.day,
      minutes: input.action.minutes,
      reason: input.action.reason ?? `${input.action.minutes} min available on ${input.action.day}`,
      now,
    });
    finalDecision = computeWith(draft);
    nextWorkspace = applyDayAvailabilityOverride(current.workspace, {
      date: input.action.day,
      minutes: input.action.minutes,
      reason: input.action.reason ?? `${input.action.minutes} min available on ${input.action.day}`,
      now,
      decision: toStoredDecision(finalDecision, locale),
    });
  } else if (input.action.kind === 'weekday-minutes') {
    const weekday = isoWeekdayForDay(input.action.day);
    const draft = applyWeekdayMinutesRule(current.workspace, {
      weekday,
      minutes: input.action.minutes,
      clearDateOverride: input.action.day,
    });
    finalDecision = computeWith(draft);
    nextWorkspace = applyWeekdayMinutesRule(current.workspace, {
      weekday,
      minutes: input.action.minutes,
      clearDateOverride: input.action.day,
      decision: toStoredDecision(finalDecision, locale),
    });
  } else if (input.action.kind === 'today-equipment') {
    const draft = applyDayAvailabilityOverride(current.workspace, {
      date: input.action.day,
      equipment: input.action.equipment,
      reason: input.action.reason ?? 'Equipment adjusted for session',
      now,
    });
    finalDecision = computeWith(draft);
    nextWorkspace = applyDayAvailabilityOverride(current.workspace, {
      date: input.action.day,
      equipment: input.action.equipment,
      reason: input.action.reason ?? 'Equipment adjusted for session',
      now,
      decision: toStoredDecision(finalDecision, locale),
    });
  } else {
    const draft = applyDayAvailabilityOverride(current.workspace, {
      date: input.action.day,
      discomfort: input.action.discomfort,
      reason: input.action.reason ?? 'Discomfort reported',
      now,
    });
    finalDecision = computeWith(draft);
    nextWorkspace = applyDayAvailabilityOverride(current.workspace, {
      date: input.action.day,
      discomfort: input.action.discomfort,
      reason: input.action.reason ?? 'Discomfort reported',
      now,
      decision: toStoredDecision(finalDecision, locale),
    });
  }

  const saved = await client.rpc('save_personal_workspace', {
    p_data: nextWorkspace,
    p_revision: input.expectedWorkspaceRevision,
  });
  if (saved.error) {
    if (saved.error.code === 'PT409') throw new CoachSnapshotChanged();
    throw Error('Unable to save coaching decision');
  }

  return {
    owner,
    dossierVersion: DOSSIER_VERSION,
    modelVersion: COACH_ENGINE_VERSION,
    decidedAt: now.toISOString(),
    workspace: readWorkspace(saved.data.data),
    workspaceRevision: Number(saved.data.revision),
    decision: finalDecision,
  };
}
