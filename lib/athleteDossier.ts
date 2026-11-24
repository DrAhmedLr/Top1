import {
  actualDose,
  currentAdaptivePlans,
  dayInZone,
  goalMetrics,
  goalValue,
  sessionResult,
  type AdaptivePlan,
  type GoalUnit,
} from './adaptiveProgram';
import {datedTests, testedValue} from './goalAttempts';
import {daysBetween} from './guidedSchedule';
import {type Observation} from './history';
import type {MeasurementMetadata} from './measurementMetadata';
import {
  DEFAULT_DELEGATION,
  MAX_PINNED_GOALS,
  normalizeTrainingContext,
  type CoachingPreferences,
  type DayAvailabilityOverride,
  type DelegationGrant,
  type DiscomfortReport,
  type EquipmentOption,
  type IsoWeekday,
  type PersonalWorkspace,
  type StoredCoachDecision,
} from './personalWorkspace';
import {programContextFromHistory} from './programTrainingHistory';
import {activeMetrics, type Demographics, type Values} from './registry';
import {latestTraining, type TrainingEvent, type Workout} from './training';

export const DOSSIER_VERSION = 'athlete-dossier-v1';

export type FactSource = 'declared' | 'measured' | 'inferred';
export type FactScope = 'standing' | 'weekday' | 'today' | 'session';
export type Fact<T> = {
  value: T;
  unit?: string;
  source: FactSource;
  observedAt: string | null;
  scope: FactScope;
  expiresOn?: string;
};

export type MeasuredResultFact = Fact<number> & {
  metricId: string;
  goalUnit: GoalUnit;
  rawValue: number;
  bodyWeightKg?: number;
  method?: string;
  protocolId?: string;
  freshness: 'recent' | 'aging' | 'stale' | 'unknown';
};

export type DossierGoal = {
  planId: string;
  revision: number;
  metric: string;
  goalUnit: GoalUnit;
  baseline: number;
  target: number;
  deadline: string;
  pinned: boolean;
  priorityRank: number;
  scheduledDays: number;
  scheduledMinutes: number;
  plan: AdaptivePlan;
};

export type EffectiveDayAvailability = {
  day: string;
  weekday: IsoWeekday;
  minutes: Fact<number>;
  equipment: Fact<EquipmentOption[]>;
  discomfort: Fact<DiscomfortReport | null>;
  overrideApplied: DayAvailabilityOverride | null;
  weekdayRuleApplied: boolean;
};

export type LedgerSummary = {
  completed: number;
  modified: number;
  skipped: number;
  totalLogged: number;
  attendanceRate: number | null;
  lastLoggedDay: string | null;
  lastLoggedStatus: 'completed' | 'skipped' | null;
  skipsByWeekday: Partial<Record<IsoWeekday, number>>;
};

export type AthleteDossier = {
  version: typeof DOSSIER_VERSION;
  asOf: string;
  today: string;
  identity: {
    owner: string;
    timeZone: string;
    loadUnit: 'kg' | 'lb';
    profile: {
      age?: Fact<number>;
      sex?: Fact<'male' | 'female'>;
      weightKg?: Fact<number>;
      heightCm?: Fact<number>;
    };
  };
  measuredResults: Record<string, MeasuredResultFact>;
  goals: DossierGoal[];
  pinnedMetrics: string[];
  constraints: {
    experience?: Fact<NonNullable<PersonalWorkspace['context']['experience']>>;
    weeklyDays: Fact<number>;
    defaultMinutes: Fact<number>;
    weekdayMinutes: Partial<Record<IsoWeekday, Fact<number>>>;
    equipment: Fact<EquipmentOption[]>;
    limitations: Fact<string | null>;
    routine: Fact<string | null>;
    preferences: Fact<CoachingPreferences>;
    delegation: Fact<DelegationGrant>;
  };
  temporaryState: {
    activeOverrides: DayAvailabilityOverride[];
    expiredOverrides: DayAvailabilityOverride[];
  };
  trainingLedger: LedgerSummary;
  inferredPatterns: {
    inferredDays?: Fact<number>;
    inferredMinutes?: Fact<number>;
    recurringShortWeekdays: IsoWeekday[];
  };
  decisionHistory: StoredCoachDecision[];
  effectiveAvailability: (day: string, planMinutes?: number) => EffectiveDayAvailability;
};

export type DossierInput = {
  owner: string;
  profile?: Demographics;
  values?: Values;
  details?: MeasurementMetadata;
  observations?: readonly Observation[];
  workspace?: PersonalWorkspace;
  trainingEvents?: readonly TrainingEvent[];
  asOf?: string | Date;
  timeZone?: string;
};

export function isoWeekdayForDay(day: string): IsoWeekday {
  const utcDay = new Date(day + 'T12:00:00Z').getUTCDay();
  return String(((utcDay + 6) % 7) + 1) as IsoWeekday;
}

function freshnessFor(measuredAt: string | undefined, today: string, zone: string): MeasuredResultFact['freshness'] {
  if (!measuredAt || !Number.isFinite(Date.parse(measuredAt))) return 'unknown';
  const measuredDay = dayInZone(new Date(measuredAt), zone);
  const ageDays = daysBetween(measuredDay, today);
  if (ageDays <= 35) return 'recent';
  if (ageDays <= 90) return 'aging';
  return 'stale';
}

/**
 * Reconstructs one typed, reproducible view of everything TOP1 knows about one athlete
 * as of a given timestamp (`asOf`). Separates declared facts, measured tests, and
 * inferred patterns, and expires temporary day overrides after their `expiresOn` date.
 */
export function buildAthleteDossier(input: DossierInput): AthleteDossier {
  const asOfDate = input.asOf instanceof Date
    ? input.asOf
    : typeof input.asOf === 'string' && Number.isFinite(Date.parse(input.asOf))
      ? new Date(input.asOf)
      : new Date();
  const asOfMs = asOfDate.getTime();
  const asOf = asOfDate.toISOString();

  const rawContext = input.workspace?.context ? normalizeTrainingContext(input.workspace.context) : {};
  const visibleEvents = (input.trainingEvents ?? []).filter(e => Date.parse(e.recordedAt) <= asOfMs);
  const activePlans = currentAdaptivePlans(visibleEvents);

  const timeZone =
    input.timeZone ||
    activePlans[0]?.event.data.timeZone ||
    rawContext.timezone ||
    'UTC';
  const today = dayInZone(asOfDate, timeZone);

  // 1. Identity & physical characteristics (strictly scoped to this account owner)
  const profileFacts: AthleteDossier['identity']['profile'] = {};
  if (input.profile) {
    if (Number.isFinite(input.profile.age)) {
      profileFacts.age = {value: input.profile.age, unit: 'years', source: 'declared', observedAt: null, scope: 'standing'};
    }
    if (input.profile.sex === 'male' || input.profile.sex === 'female') {
      profileFacts.sex = {value: input.profile.sex, source: 'declared', observedAt: null, scope: 'standing'};
    }
    if (typeof input.profile.weight === 'number' && Number.isFinite(input.profile.weight)) {
      profileFacts.weightKg = {value: input.profile.weight, unit: 'kg', source: 'declared', observedAt: null, scope: 'standing'};
    }
    if (typeof input.profile.height === 'number' && Number.isFinite(input.profile.height)) {
      profileFacts.heightCm = {value: input.profile.height, unit: 'cm', source: 'declared', observedAt: null, scope: 'standing'};
    }
  }

  // 2. Measured results (from dated observations as of `asOf`, falling back to saved snapshot values)
  const measuredResults: Record<string, MeasuredResultFact> = {};
  const datedMap = datedTests(input.observations ?? [], asOfMs);
  for (const metric of activeMetrics) {
    const datedList = datedMap.get(metric.id);
    const latestDated = datedList?.at(-1);
    const detail = input.details?.[metric.id];
    const snapValue = input.values?.[metric.id];
    const isLiftMetric = ['bench_1rm', 'squat_1rm', 'deadlift_1rm', 'pullup_1rm'].includes(metric.id);
    const bodyWeightKg =
      latestDated?.entry.derivation?.bodyWeightKg ??
      latestDated?.entry.protocol?.bodyWeightKg ??
      detail?.derivation?.bodyWeightKg ??
      detail?.protocol?.bodyWeightKg;

    if (latestDated) {
      const preferredUnit: GoalUnit = isLiftMetric && bodyWeightKg ? 'kg' : 'metric';
      const tested = testedValue(metric, preferredUnit, latestDated, asOfMs);
      const fallbackVal = tested ?? goalValue(metric, preferredUnit, latestDated.entry.value ?? undefined, latestDated.entry);
      const val = fallbackVal ?? latestDated.entry.value;
      const effectiveUnit: GoalUnit = fallbackVal !== undefined ? preferredUnit : 'metric';
      if (val !== null && val !== undefined && Number.isFinite(val)) {
        measuredResults[metric.id] = {
          metricId: metric.id,
          value: val,
          rawValue: latestDated.entry.value ?? val,
          goalUnit: effectiveUnit,
          unit: effectiveUnit === 'kg' ? 'kg' : metric.unit,
          source: 'measured',
          observedAt: latestDated.entry.measuredAt ?? latestDated.entry.recordedAt,
          scope: 'standing',
          bodyWeightKg,
          method: latestDated.entry.method,
          protocolId: latestDated.entry.protocol?.id,
          freshness: freshnessFor(latestDated.entry.measuredAt, today, timeZone),
        };
        continue;
      }
    }

    if (snapValue !== undefined && Number.isFinite(snapValue)) {
      const preferredUnit: GoalUnit = isLiftMetric && bodyWeightKg ? 'kg' : 'metric';
      const val = goalValue(metric, preferredUnit, snapValue, detail) ?? snapValue;
      measuredResults[metric.id] = {
        metricId: metric.id,
        value: val,
        rawValue: snapValue,
        goalUnit: preferredUnit,
        unit: preferredUnit === 'kg' ? 'kg' : metric.unit,
        source: 'measured',
        observedAt: detail?.measuredAt ?? null,
        scope: 'standing',
        bodyWeightKg,
        method: detail?.method,
        protocolId: detail?.protocol?.id,
        freshness: freshnessFor(detail?.measuredAt, today, timeZone),
      };
    }
  }

  // 3. Active goals and pinned priority (at most 2 pinned main goals; existing goals preserved)
  const declaredPins = (rawContext.pinnedMetrics ?? []).filter(id =>
    isGoalMetricSupported(id) || activePlans.some(p => p.config.metric === id),
  );
  const pinnedMetrics = (
    declaredPins.length > 0
      ? declaredPins
      : activePlans.slice(0, MAX_PINNED_GOALS).map(p => p.config.metric)
  ).slice(0, MAX_PINNED_GOALS);

  const goals: DossierGoal[] = activePlans
    .map((plan, idx) => {
      const pinIndex = pinnedMetrics.indexOf(plan.config.metric);
      return {
        planId: plan.event.id,
        revision: plan.event.revision,
        metric: plan.config.metric,
        goalUnit: plan.config.goalUnit,
        baseline: plan.config.baseline,
        target: plan.config.target,
        deadline: plan.config.deadline,
        pinned: pinIndex >= 0,
        priorityRank: pinIndex >= 0 ? pinIndex + 1 : pinnedMetrics.length + idx + 1,
        scheduledDays: plan.config.days,
        scheduledMinutes: plan.config.minutes,
        plan,
      };
    })
    .sort((a, b) => a.priorityRank - b.priorityRank);

  // 4. Inferred patterns from completed training history
  const inferredCtx = programContextFromHistory(
    {timezone: timeZone},
    visibleEvents,
    asOfDate,
  );

  // 5. Training ledger summary (prescribed vs actual as of `asOf`)
  const latestWorkouts = latestTraining(visibleEvents)
    .filter(e => e.kind === 'workout' && !e.deleted)
    .map(e => e.data as Workout);
  let completed = 0;
  let modified = 0;
  let skipped = 0;
  let lastLoggedDay: string | null = null;
  let lastLoggedStatus: 'completed' | 'skipped' | null = null;
  const skipsByWeekday: Partial<Record<IsoWeekday, number>> = {};

  for (const w of latestWorkouts) {
    const rec = sessionResult(w);
    const day = rec?.day ?? (w.endedAt ? dayInZone(new Date(w.endedAt), w.timeZone) : null);
    if (!day || day > today) continue;
    if (w.status === 'abandoned') {
      skipped++;
      const wd = isoWeekdayForDay(day);
      skipsByWeekday[wd] = (skipsByWeekday[wd] ?? 0) + 1;
      if (!lastLoggedDay || day >= lastLoggedDay) {
        lastLoggedDay = day;
        lastLoggedStatus = 'skipped';
      }
    } else if (w.status === 'completed') {
      const actual = actualDose(w);
      const isExact =
        !!actual &&
        !!rec &&
        !w.exercises[0]?.substitutionReason &&
        w.exercises[0]?.name === w.snapshot.exercises[0]?.name &&
        actual.sets === rec.dose.sets &&
        actual.amount === rec.dose.amount &&
        actual.loadKg === rec.dose.loadKg;
      if (isExact) completed++;
      else modified++;
      if (!lastLoggedDay || day >= lastLoggedDay) {
        lastLoggedDay = day;
        lastLoggedStatus = 'completed';
      }
    }
  }
  const totalLogged = completed + modified + skipped;
  const attendanceRate = totalLogged > 0 ? (completed + modified) / totalLogged : null;

  // 6. Standing constraints vs temporary overrides (with explicit expiry!)
  const allOverrides = rawContext.dayOverrides ?? [];
  const activeOverrides = allOverrides.filter(o => o.expiresOn >= today && Date.parse(o.recordedAt) <= asOfMs);
  const expiredOverrides = allOverrides.filter(o => o.expiresOn < today && Date.parse(o.recordedAt) <= asOfMs);

  const weekdayMinutes: Partial<Record<IsoWeekday, Fact<number>>> = {};
  for (const [wd, mins] of Object.entries(rawContext.weekdayMinutes ?? {})) {
    if (mins !== undefined) {
      weekdayMinutes[wd as IsoWeekday] = {
        value: mins,
        unit: 'min',
        source: 'declared',
        observedAt: null,
        scope: 'weekday',
      };
    }
  }

  const weeklyDays: Fact<number> = rawContext.days !== undefined
    ? {value: rawContext.days, unit: 'days/week', source: 'declared', observedAt: null, scope: 'standing'}
    : inferredCtx.days !== undefined
      ? {value: inferredCtx.days, unit: 'days/week', source: 'inferred', observedAt: asOf, scope: 'standing'}
      : {value: activePlans[0]?.config.days ?? 2, unit: 'days/week', source: 'inferred', observedAt: null, scope: 'standing'};

  const defaultMinutes: Fact<number> = rawContext.minutes !== undefined
    ? {value: rawContext.minutes, unit: 'min', source: 'declared', observedAt: null, scope: 'standing'}
    : inferredCtx.minutes !== undefined
      ? {value: inferredCtx.minutes, unit: 'min', source: 'inferred', observedAt: asOf, scope: 'standing'}
      : {value: activePlans[0]?.config.minutes ?? 30, unit: 'min', source: 'inferred', observedAt: null, scope: 'standing'};

  const equipment: Fact<EquipmentOption[]> = {
    value: rawContext.equipment ?? [],
    source: rawContext.equipment?.length ? 'declared' : 'inferred',
    observedAt: null,
    scope: 'standing',
  };

  const recurringShortWeekdays = (Object.entries(rawContext.weekdayMinutes ?? {})
    .filter(([, mins]) => mins !== undefined && mins < defaultMinutes.value)
    .map(([wd]) => wd) as IsoWeekday[]);

  const decisionHistory = (rawContext.coachDecisions ?? []).filter(
    d => Date.parse(d.decidedAt) <= asOfMs,
  );

  // Strict precedence resolver for any calendar day:
  // 1. Active non-expired date-specific override (manual correction/today override)
  // 2. Standing weekday rule ("every Tuesday = 20 min")
  // 3. Scheduled plan minutes or standing default minutes
  function effectiveAvailability(day: string, planMinutes?: number): EffectiveDayAvailability {
    const weekday = isoWeekdayForDay(day);
    // An override applies to `day` ONLY if `override.date === day` AND it has not expired (`override.expiresOn >= day`).
    // A "today only" override for Tuesday 2026-11-24 (`date: '2026-11-24', expiresOn: '2026-11-24'`)
    // will NOT apply to next Tuesday 2026-12-01!
    const dayOverride = activeOverrides.find(
      o => o.date === day && o.expiresOn >= day,
    ) ?? null;
    const weekdayRule = weekdayMinutes[weekday];

    let minutesFact: Fact<number>;
    let weekdayRuleApplied = false;
    if (dayOverride?.minutes !== undefined) {
      minutesFact = {
        value: dayOverride.minutes,
        unit: 'min',
        source: 'declared',
        observedAt: dayOverride.recordedAt,
        scope: 'today',
        expiresOn: dayOverride.expiresOn,
      };
    } else if (weekdayRule) {
      minutesFact = weekdayRule;
      weekdayRuleApplied = true;
    } else if (planMinutes !== undefined) {
      minutesFact = {
        value: planMinutes,
        unit: 'min',
        source: rawContext.minutes !== undefined ? 'declared' : 'inferred',
        observedAt: null,
        scope: 'standing',
      };
    } else {
      minutesFact = defaultMinutes;
    }

    const equipmentFact: Fact<EquipmentOption[]> = dayOverride?.equipment !== undefined
      ? {
          value: dayOverride.equipment,
          source: 'declared',
          observedAt: dayOverride.recordedAt,
          scope: 'today',
          expiresOn: dayOverride.expiresOn,
        }
      : equipment;

    const discomfortFact: Fact<DiscomfortReport | null> =
      dayOverride?.discomfort && dayOverride.discomfort.severity !== 'none'
        ? {
            value: dayOverride.discomfort,
            source: 'declared',
            observedAt: dayOverride.recordedAt,
            scope: 'today',
            expiresOn: dayOverride.expiresOn,
          }
        : {value: null, source: 'declared', observedAt: null, scope: 'today'};

    return {
      day,
      weekday,
      minutes: minutesFact,
      equipment: equipmentFact,
      discomfort: discomfortFact,
      overrideApplied: dayOverride,
      weekdayRuleApplied,
    };
  }

  return {
    version: DOSSIER_VERSION,
    asOf,
    today,
    identity: {
      owner: input.owner,
      timeZone,
      loadUnit: rawContext.loadUnit ?? 'kg',
      profile: profileFacts,
    },
    measuredResults,
    goals,
    pinnedMetrics,
    constraints: {
      ...(rawContext.experience
        ? {experience: {value: rawContext.experience, source: 'declared' as const, observedAt: null, scope: 'standing' as const}}
        : {}),
      weeklyDays,
      defaultMinutes,
      weekdayMinutes,
      equipment,
      limitations: {
        value: rawContext.limitations ?? null,
        source: 'declared',
        observedAt: null,
        scope: 'standing',
      },
      routine: {
        value: rawContext.routine ?? null,
        source: 'declared',
        observedAt: null,
        scope: 'standing',
      },
      preferences: {
        value: rawContext.preferences ?? {},
        source: 'declared',
        observedAt: null,
        scope: 'standing',
      },
      delegation: {
        value: rawContext.delegation ?? DEFAULT_DELEGATION,
        source: rawContext.delegation ? 'declared' : 'inferred',
        observedAt: rawContext.delegation?.updatedAt ?? null,
        scope: 'standing',
      },
    },
    temporaryState: {
      activeOverrides,
      expiredOverrides,
    },
    trainingLedger: {
      completed,
      modified,
      skipped,
      totalLogged,
      attendanceRate,
      lastLoggedDay,
      lastLoggedStatus,
      skipsByWeekday,
    },
    inferredPatterns: {
      ...(inferredCtx.days !== undefined
        ? {inferredDays: {value: inferredCtx.days, unit: 'days/week', source: 'inferred' as const, observedAt: asOf, scope: 'standing' as const}}
        : {}),
      ...(inferredCtx.minutes !== undefined
        ? {inferredMinutes: {value: inferredCtx.minutes, unit: 'min', source: 'inferred' as const, observedAt: asOf, scope: 'standing' as const}}
        : {}),
      recurringShortWeekdays,
    },
    decisionHistory,
    effectiveAvailability,
  };
}

export function isGoalMetricSupported(metricId: string): boolean {
  return goalMetrics.some(m => m.id === metricId);
}
