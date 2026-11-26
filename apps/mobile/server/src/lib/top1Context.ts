import { asc, eq } from 'drizzle-orm';
import {
  buildAthleteDossier,
  currentAdaptivePlans,
  datedProgram,
  dayInZone,
  evaluate,
  overallPerformance,
  type AthleteDossier,
  type Demographics,
  type ExerciseDefinition,
  type MeasurementDetails,
  type MeasurementMetadata,
  type Observation,
  type PersonalWorkspace,
  type TrainingEvent,
  type Values,
  type WearableDailySnapshot,
  type WearableSource,
} from '@top1/engine';
import { topPercentToBadge, topPercentToRating } from '@apexlift/shared';
import type { AppDatabase } from '../db/index.js';
import {
  coachDecisions,
  customExerciseOntology,
  metricObservations,
  personalWorkspaces,
  trainingLedgerEvents,
  users,
  wearableSnapshots,
} from '../db/schema.js';

export type UserRow = typeof users.$inferSelect;

export interface UserTop1Context {
  profile: Demographics;
  timeZone: string;
  today: string;
  observations: Observation[];
  values: Values;
  details: MeasurementMetadata;
  workspace: PersonalWorkspace;
  trainingEvents: TrainingEvent[];
  wearableHistory: WearableDailySnapshot[];
  customExercises: ExerciseDefinition[];
  dossier: AthleteDossier;
  upcomingGoalMetricsWithin36h: string[];
}

export function userToDemographics(user: UserRow): Demographics {
  return {
    age: Math.max(18, Math.min(120, Math.round(user.age || 25))),
    sex: user.rankingSex === 'Female' ? 'female' : 'male',
    weight: user.bodyweightKg > 25 ? user.bodyweightKg : 75,
    height: user.heightCm >= 100 ? user.heightCm : 175,
  };
}

export function defaultWorkspaceForUser(user: UserRow): PersonalWorkspace {
  const expMap: Record<string, NonNullable<PersonalWorkspace['context']['experience']>> = {
    beginner: 'under_year',
    intermediate: 'one_to_three',
    advanced: 'over_three',
  };
  return {
    version: 1,
    goal: null,
    context: {
      experience: expMap[user.experienceLevel] ?? 'one_to_three',
      days: Math.max(1, Math.min(7, user.weeklyWorkoutGoal || 4)),
      minutes: 45,
      equipment: ['barbell', 'dumbbells', 'pullup_bar', 'machines', 'outdoor'],
      timezone: user.timeZone || 'UTC',
      pinnedMetrics: [],
      preferences: {
        style: 'direct',
      },
      delegation: {
        exercises: true,
        schedule: true,
        target: false,
        deadline: false,
        priority: false,
        commitment: false,
        maxSessionShiftDays: 3,
      },
      dayOverrides: [],
      coachDecisions: [],
    },
  };
}

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadUserTop1Context(
  db: AppDatabase,
  user: UserRow,
  asOf = new Date()
): Promise<UserTop1Context> {
  const profile = userToDemographics(user);
  const timeZone = user.timeZone || 'UTC';
  const today = dayInZone(asOf, timeZone);

  const [obsRows, wsRows, ledgerRows, wearRows, customRows, decRows] = await Promise.all([
    db
      .select()
      .from(metricObservations)
      .where(eq(metricObservations.userId, user.id))
      .orderBy(asc(metricObservations.sequence), asc(metricObservations.recordedAt)),
    db
      .select()
      .from(personalWorkspaces)
      .where(eq(personalWorkspaces.userId, user.id))
      .limit(1),
    db
      .select()
      .from(trainingLedgerEvents)
      .where(eq(trainingLedgerEvents.userId, user.id))
      .orderBy(asc(trainingLedgerEvents.sequence), asc(trainingLedgerEvents.recordedAt)),
    db
      .select()
      .from(wearableSnapshots)
      .where(eq(wearableSnapshots.userId, user.id))
      .orderBy(asc(wearableSnapshots.dateIso)),
    db
      .select()
      .from(customExerciseOntology)
      .where(eq(customExerciseOntology.userId, user.id)),
    db
      .select()
      .from(coachDecisions)
      .where(eq(coachDecisions.userId, user.id))
      .orderBy(asc(coachDecisions.createdAt)),
  ]);

  const observations: Observation[] = obsRows.map((row) => ({
    id: row.id,
    sequence: row.sequence,
    metricId: row.metricId,
    value: row.cleared ? null : row.value,
    cleared: row.cleared,
    recordedAt: row.recordedAt,
    measuredAt: row.measuredAt ?? undefined,
    method: (row.method ?? undefined) as Observation['method'],
    exerciseMode: (row.exerciseMode ?? undefined) as Observation['exerciseMode'],
    protocol: safeJson(row.protocolJson, undefined),
    window: safeJson(row.windowJson, undefined),
    derivation: safeJson(row.derivationJson, undefined),
    ageAtMeasurement: row.ageAtMeasurement ?? undefined,
    source: row.source,
  }));

  // Derive latest values + details map per metric (respecting cleared markers)
  const values: Values = {};
  const details: MeasurementMetadata = {};
  for (const obs of observations) {
    if (obs.cleared || obs.value === null) {
      delete values[obs.metricId];
      delete details[obs.metricId];
    } else {
      values[obs.metricId] = obs.value;
      const d: MeasurementDetails = {};
      if (obs.method) d.method = obs.method;
      if (obs.measuredAt) d.measuredAt = obs.measuredAt;
      if (obs.source) d.source = obs.source;
      if (obs.ageAtMeasurement !== undefined) d.ageAtMeasurement = obs.ageAtMeasurement;
      if (obs.exerciseMode) d.exerciseMode = obs.exerciseMode;
      if (obs.protocol) d.protocol = obs.protocol;
      if (obs.window) d.window = obs.window;
      if (obs.derivation) d.derivation = obs.derivation;
      details[obs.metricId] = d;
    }
  }

  const baseWs = defaultWorkspaceForUser(user);
  const storedWs = wsRows[0] ? safeJson<Partial<PersonalWorkspace>>(wsRows[0].workspaceJson, {}) : {};
  const decisionHistory = decRows
    .map((r) => {
      const parsed = safeJson<{
        id: string;
        modelVersion?: string;
        targetDay: string;
        action: 'keep' | 'shorten' | 'substitute' | 'move' | 'rest' | 'retest';
        reasonCode: string;
        scope?: 'today' | 'weekday' | 'standing';
        affectedGoal?: { planId: string; metric: string };
        scheduled?: { date: string; exercise: [string, string, string]; sets: number; amount: number; mode: 'reps' | 'seconds'; loadKg: number; totalMinutes?: number };
        recommended?: { date: string; exercise: [string, string, string]; sets: number; amount: number; mode: 'reps' | 'seconds'; loadKg: number; totalMinutes?: number } | null;
        trigger?: { inputSummary?: string };
        athleteSentence?: [string, string, string];
      } | null>(r.decisionJson, null);
      if (!parsed || !parsed.scheduled) return null;
      return {
        id: r.id,
        modelVersion: parsed.modelVersion ?? 'coach-decision-v1',
        decidedAt: r.createdAt,
        day: r.targetDay,
        metric: parsed.affectedGoal?.metric ?? 'pushups',
        action: r.action as 'keep' | 'shorten' | 'substitute' | 'move' | 'rest' | 'retest',
        reasonCode: r.reasonCode,
        triggerInput: parsed.trigger?.inputSummary ?? '',
        scope: parsed.scope ?? ('today' as const),
        summary: parsed.athleteSentence?.[0] ?? r.reasonCode,
        before: {
          date: parsed.scheduled.date,
          exercise: parsed.scheduled.exercise[0],
          sets: parsed.scheduled.sets,
          amount: parsed.scheduled.amount,
          mode: parsed.scheduled.mode,
          loadKg: parsed.scheduled.loadKg,
          minutes: parsed.scheduled.totalMinutes ?? 30,
        },
        after: parsed.recommended
          ? {
              date: parsed.recommended.date,
              exercise: parsed.recommended.exercise[0],
              sets: parsed.recommended.sets,
              amount: parsed.recommended.amount,
              mode: parsed.recommended.mode,
              loadKg: parsed.recommended.loadKg,
              minutes: parsed.recommended.totalMinutes ?? 20,
            }
          : null,
        undoneAt: r.undoneAt ?? undefined,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const workspace: PersonalWorkspace = {
    version: 1,
    goal: storedWs.goal ?? baseWs.goal,
    context: {
      ...baseWs.context,
      ...(storedWs.context ?? {}),
      coachDecisions:
        decisionHistory.length > 0 ? decisionHistory : (storedWs.context?.coachDecisions ?? []),
    },
  };

  const trainingEvents: TrainingEvent[] = ledgerRows.map((r) => ({
    version: 1,
    id: r.entityId,
    requestId: r.id,
    kind: r.kind as 'program' | 'workout',
    sequence: r.sequence,
    revision: r.revision,
    epoch: 1,
    source: (r.source === 'guest-import' ? 'guest-import' : 'personal') as 'personal' | 'guest-import',
    deleted: r.deleted,
    reason: '',
    recordedAt: r.recordedAt,
    data: safeJson(r.dataJson, {} as TrainingEvent['data']),
  }));

  const wearableHistory: WearableDailySnapshot[] = wearRows.map((w) => ({
    date: w.dateIso,
    source: w.source as WearableSource,
    hrvRmssdMs: w.hrvRmssdMs ?? undefined,
    hrvStatistic: w.hrvRmssdMs != null ? 'rmssd' : undefined,
    restingHeartRateBpm: w.restingHeartRateBpm ?? undefined,
    totalSleepMinutes: w.totalSleepMinutes ?? undefined,
    sleepEfficiencyPercent: w.sleepEfficiencyPercent ?? undefined,
    wristTempDeviationC: w.wristTempDeviationC ?? undefined,
    respiratoryRateBpm: w.respiratoryRateBpm ?? undefined,
    cardioLoadTrimp: w.cardioLoadTrimp ?? undefined,
    vo2Max: w.vo2Max ?? undefined,
    gpsRun5kMinutes: w.gpsRun5kMinutes ?? undefined,
  }));

  const customExercises: ExerciseDefinition[] = customRows
    .map((r) => safeJson<ExerciseDefinition | null>(r.definitionJson, null))
    .filter((x): x is ExerciseDefinition => x !== null);

  const dossier = buildAthleteDossier({
    owner: user.id,
    profile,
    values,
    details,
    observations,
    workspace,
    trainingEvents,
    asOf,
    timeZone,
  });

  // Identify pinned goal metrics with scheduled sessions within 36 hours (today or tomorrow)
  const tomorrow = dayInZone(new Date(asOf.getTime() + 86400000), timeZone);
  const plans = currentAdaptivePlans(trainingEvents);
  const upcomingGoalMetricsWithin36h: string[] = [];
  for (const plan of plans) {
    if (plan.config.guidedVersion === 1) {
      const cal = datedProgram(plan);
      const hasSoon = cal.weeks.some((w) =>
        w.sessions.some((s) => s.date === today || s.date === tomorrow)
      );
      if (hasSoon) upcomingGoalMetricsWithin36h.push(plan.config.metric);
    }
  }

  return {
    profile,
    timeZone,
    today,
    observations,
    values,
    details,
    workspace,
    trainingEvents,
    wearableHistory,
    customExercises,
    dossier,
    upcomingGoalMetricsWithin36h,
  };
}

export async function syncUserTop1Standings(db: AppDatabase, user: UserRow) {
  const ctx = await loadUserTop1Context(db, user);
  const overall = overallPerformance(ctx.values, ctx.details, ctx.profile);
  const scientific = evaluate(ctx.values, ctx.profile, ctx.details);
  const pct = overall.overall?.percent ?? null;
  const badge = topPercentToBadge(pct);

  await db
    .update(users)
    .set({
      overallTopPercent: pct,
      overallTierLabel: badge.topLabel,
      scientificModelScore: scientific.ready ? Number(scientific.modelScore.toFixed(1)) : null,
      peakAverageRank: badge.topLabel,
      peakAverageRating: Math.max(user.peakAverageRating, topPercentToRating(pct)),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, user.id));

  return { overall, scientific, badge };
}

export async function nextObservationSequence(db: AppDatabase, userId: string): Promise<number> {
  const rows = await db
    .select({ seq: metricObservations.sequence })
    .from(metricObservations)
    .where(eq(metricObservations.userId, userId));
  return rows.reduce((max, r) => Math.max(max, r.seq), 0) + 1;
}

export async function nextLedgerSequence(db: AppDatabase, userId: string): Promise<number> {
  const rows = await db
    .select({ seq: trainingLedgerEvents.sequence })
    .from(trainingLedgerEvents)
    .where(eq(trainingLedgerEvents.userId, userId));
  return rows.reduce((max, r) => Math.max(max, r.seq), 0) + 1;
}
