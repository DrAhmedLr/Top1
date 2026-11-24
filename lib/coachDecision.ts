import {
  addDays,
  dayInZone,
  goalMetrics,
  sessionResult,
  type AdaptivePlan,
  type Dose,
  type GoalUnit,
} from './adaptiveProgram';
import {
  isoWeekdayForDay,
  type AthleteDossier,
  type EffectiveDayAvailability,
  type FactScope,
  type FactSource,
} from './athleteDossier';
import {datedProgram, expectedRetestMinutes, type DatedProgram, type DatedSession} from './datedProgram';
import {
  daysBetween,
  isGuidedRetestDay,
  isGuidedTrainingDay,
  programFamilies,
  type ProgramLabel,
} from './guidedSchedule';
import {
  normalizeTrainingContext,
  type DayAvailabilityOverride,
  type DiscomfortReport,
  type EquipmentOption,
  type IsoWeekday,
  type PersonalWorkspace,
  type StoredCoachDecision,
  type StoredDecisionSnapshot,
} from './personalWorkspace';
import type {Workout} from './training';
import {optimizePersonalPolicy, type PersonalPolicyUpdate} from './selfOptimization';

export const COACH_ENGINE_VERSION = 'coach-decision-v1';

export type CoachAction = 'keep' | 'shorten' | 'substitute' | 'move' | 'rest' | 'retest';

/**
 * Deterministic tie-breaking policy when multiple feasible candidates achieve the same score:
 * 1. Keep the planned session unchanged if no constraint is violated.
 * 2. Shorten the planned movement in place to keep weekly rhythm and specificity.
 * 3. Substitute a compatible exercise when equipment or mild discomfort blocks the planned one.
 * 4. Move the session to the next open day when safe warm-up + work (or a retest) cannot fit.
 * 5. Rest when concerning discomfort is present or no valid shift day exists.
 * 6. Retest when scheduled and feasible.
 */
export const TIE_BREAK_ORDER: readonly CoachAction[] = [
  'keep',
  'shorten',
  'substitute',
  'move',
  'rest',
  'retest',
];

export type SessionBreakdown = {
  date: string;
  exercise: ProgramLabel;
  sets: number;
  amount: number;
  mode: 'reps' | 'seconds';
  loadKg: number;
  restSeconds: number;
  warmupMinutes: number;
  transitionMinutes: number;
  cooldownMinutes: number;
  totalMinutes: number;
  slotMinutes: number;
};

export type EvaluatedCandidate = {
  action: CoachAction;
  feasible: boolean;
  eliminatedReason?: string;
  score: number;
  summary: string;
};

export type CoachTriggerKind =
  | 'none'
  | 'today-time'
  | 'weekday-time'
  | 'equipment'
  | 'discomfort'
  | 'recovery'
  | 'retest';

export type CoachDecision = {
  id: string;
  modelVersion: typeof COACH_ENGINE_VERSION;
  decidedAt: string;
  targetDay: string;
  action: CoachAction;
  reasonCode: string;
  affectedGoal: {
    planId: string;
    metric: string;
    goalUnit: GoalUnit;
    baseline: number;
    target: number;
    deadline: string;
    pinned: boolean;
    priorityRank: number;
  };
  scheduled: SessionBreakdown;
  recommended: SessionBreakdown | null;
  movedTo?: string;
  clinicalNotice?: ProgramLabel;
  candidatesEvaluated: EvaluatedCandidate[];
  trigger: {
    kind: CoachTriggerKind;
    inputSummary: string;
    source: FactSource;
    scope: FactScope;
    expiresOn?: string;
  };
  athleteSentence: ProgramLabel;
  scope: 'today' | 'weekday' | 'standing';
  expiresOn?: string;
  delegation: {
    withinAuthority: boolean;
    scopeUsed: 'none' | 'dose' | 'exercise' | 'schedule';
    canUndo: boolean;
  };
};

type SubstituteSpec = {
  exercise: ProgramLabel;
  mode: 'reps' | 'seconds';
  amountFactor: number;
  loadKg: number;
  transitionMinutes: number;
  warmupMinutes: number;
  restSeconds: number;
  reasonTag: string;
};

const BARBELL_METRICS = new Set(['bench_1rm', 'squat_1rm', 'deadlift_1rm']);
const BAR_METRICS = new Set(['pullups', 'pullup_1rm', 'dead_hang']);
const WEEKDAY_NAMES_EN: Record<IsoWeekday, string> = {
  '1': 'Monday',
  '2': 'Tuesday',
  '3': 'Wednesday',
  '4': 'Thursday',
  '5': 'Friday',
  '6': 'Saturday',
  '7': 'Sunday',
};
const WEEKDAY_NAMES_FR: Record<IsoWeekday, string> = {
  '1': 'lundi',
  '2': 'mardi',
  '3': 'mercredi',
  '4': 'jeudi',
  '5': 'vendredi',
  '6': 'samedi',
  '7': 'dimanche',
};
const WEEKDAY_NAMES_AR: Record<IsoWeekday, string> = {
  '1': 'الإثنين',
  '2': 'الثلاثاء',
  '3': 'الأربعاء',
  '4': 'الخميس',
  '5': 'الجمعة',
  '6': 'السبت',
  '7': 'الأحد',
};

function isBarbellExercise(metric: string, exerciseEn: string): boolean {
  if (!BARBELL_METRICS.has(metric)) return false;
  return /bench press|barbell|deadlift/i.test(exerciseEn) && !/dumbbell|push-up|bodyweight|goblet|hip hinge|machine/i.test(exerciseEn);
}

function isPullupBarExercise(metric: string, exerciseEn: string): boolean {
  if (!BAR_METRICS.has(metric)) return false;
  return /pull-up|hang/i.test(exerciseEn) && !/row|towel|prone/i.test(exerciseEn);
}

export function requiredEquipmentFor(metric: string, exerciseEn: string): EquipmentOption | null {
  if (isBarbellExercise(metric, exerciseEn)) return 'barbell';
  if (isPullupBarExercise(metric, exerciseEn)) return 'pullup_bar';
  if (/dumbbell/i.test(exerciseEn)) return 'dumbbells';
  if (/machine|leg press/i.test(exerciseEn)) return 'machines';
  return null;
}

function compatibleSubstitute(
  metric: string,
  equipment: EquipmentOption[],
  gentle = false,
): SubstituteSpec {
  const hasDumbbells = equipment.includes('dumbbells');
  const hasMachines = equipment.includes('machines');
  const hasBar = equipment.includes('pullup_bar');

  if (metric === 'bench_1rm' || metric === 'pushups' || metric === 'dips') {
    if (gentle) {
      return {
        exercise: ['Incline push-ups (controlled)', 'Pompes inclinées contrôlées', 'تمارين ضغط مائل مضبوطة'],
        mode: 'reps',
        amountFactor: 1.2,
        loadKg: 0,
        transitionMinutes: 1,
        warmupMinutes: 3,
        restSeconds: 60,
        reasonTag: 'gentle-press',
      };
    }
    if (hasDumbbells) {
      return {
        exercise: ['Dumbbell floor press', 'Développé au sol avec haltères', 'ضغط الدمبل على الأرض'],
        mode: 'reps',
        amountFactor: 1.4,
        loadKg: 0,
        transitionMinutes: 2,
        warmupMinutes: 4,
        restSeconds: 75,
        reasonTag: 'dumbbell-press',
      };
    }
    if (hasMachines) {
      return {
        exercise: ['Machine chest press', 'Presse pectorale guidée', 'ضغط الصدر على الجهاز'],
        mode: 'reps',
        amountFactor: 1.2,
        loadKg: 0,
        transitionMinutes: 2,
        warmupMinutes: 4,
        restSeconds: 75,
        reasonTag: 'machine-press',
      };
    }
    return {
      exercise: ['Strict push-ups', 'Pompes strictes', 'تمارين ضغط كاملة'],
      mode: 'reps',
      amountFactor: 1.6,
      loadKg: 0,
      transitionMinutes: 1,
      warmupMinutes: 3,
      restSeconds: 60,
      reasonTag: 'bodyweight-press',
    };
  }

  if (metric === 'squat_1rm' || metric === 'cmj' || metric === 'broad_jump') {
    if (!gentle && hasDumbbells) {
      return {
        exercise: ['Goblet squat', 'Goblet squat', 'قرفصاء بالدمبل'],
        mode: 'reps',
        amountFactor: 1.4,
        loadKg: 0,
        transitionMinutes: 2,
        warmupMinutes: 4,
        restSeconds: 75,
        reasonTag: 'dumbbell-squat',
      };
    }
    return {
      exercise: ['Controlled bodyweight squats', 'Squats contrôlés au poids du corps', 'قرفصاء مضبوطة بوزن الجسم'],
      mode: 'reps',
      amountFactor: 1.6,
      loadKg: 0,
      transitionMinutes: 1,
      warmupMinutes: 3,
      restSeconds: 60,
      reasonTag: 'bodyweight-squat',
    };
  }

  if (metric === 'deadlift_1rm') {
    if (!gentle && hasDumbbells) {
      return {
        exercise: ['Dumbbell deadlift', 'Soulevé de terre avec haltères', 'رفعة ميتة بالدمبل'],
        mode: 'reps',
        amountFactor: 1.4,
        loadKg: 0,
        transitionMinutes: 2,
        warmupMinutes: 4,
        restSeconds: 75,
        reasonTag: 'dumbbell-hinge',
      };
    }
    return {
      exercise: ['Unloaded hip hinges', 'Flexions de hanches sans charge', 'ثني الورك دون حمل'],
      mode: 'reps',
      amountFactor: 1.6,
      loadKg: 0,
      transitionMinutes: 1,
      warmupMinutes: 3,
      restSeconds: 60,
      reasonTag: 'bodyweight-hinge',
    };
  }

  if (metric === 'pullups' || metric === 'pullup_1rm' || metric === 'dead_hang') {
    if (metric === 'dead_hang' || (!hasBar && !hasDumbbells)) {
      return {
        exercise: ['Comfortable towel squeezes', 'Pressions modérées sur une serviette', 'عصر منشفة بقبضة مريحة'],
        mode: 'seconds',
        amountFactor: 1,
        loadKg: 0,
        transitionMinutes: 1,
        warmupMinutes: 2,
        restSeconds: 45,
        reasonTag: 'grip-substitute',
      };
    }
    if (hasDumbbells) {
      return {
        exercise: ['Dumbbell row', 'Tirage avec haltère', 'تجديف بالدمبل'],
        mode: 'reps',
        amountFactor: 1.4,
        loadKg: 0,
        transitionMinutes: 2,
        warmupMinutes: 3,
        restSeconds: 60,
        reasonTag: 'dumbbell-row',
      };
    }
    return {
      exercise: ['Prone arm pulls', 'Tirages des bras au sol', 'سحب الذراعين من وضع الانبطاح'],
      mode: 'reps',
      amountFactor: 1.4,
      loadKg: 0,
      transitionMinutes: 1,
      warmupMinutes: 3,
      restSeconds: 60,
      reasonTag: 'bodyweight-pull',
    };
  }

  if (metric === 'run_5k' || metric === 'sprint_400m' || metric === 'zone2_power') {
    return {
      exercise: ['Easy walk–jog intervals', 'Alternance marche–course facile', 'فترات مشي وجري خفيف'],
      mode: 'seconds',
      amountFactor: 0.7,
      loadKg: 0,
      transitionMinutes: 1,
      warmupMinutes: 3,
      restSeconds: 60,
      reasonTag: 'low-impact-aerobic',
    };
  }

  return {
    exercise: ['Controlled mobility and light rehearsal', 'Mobilité contrôlée et répétition légère', 'مرونة مضبوطة وتمرين خفيف'],
    mode: 'reps',
    amountFactor: 1,
    loadKg: 0,
    transitionMinutes: 1,
    warmupMinutes: 3,
    restSeconds: 60,
    reasonTag: 'controlled-fallback',
  };
}

/**
 * Full realistic time accounting: warm-up (including ramp-up sets for barbell lifts),
 * equipment transitions/setup, working sets, rest intervals, and cool-down.
 */
export function computeSessionBreakdown(
  metric: string,
  date: string,
  exercise: ProgramLabel,
  dose: Dose,
  opts: {
    slotMinutes: number;
    warmupMinutes: number;
    transitionMinutes: number;
    restSeconds: number;
    cooldownMinutes: number;
  },
): SessionBreakdown {
  const secondsPerUnit =
    (dose.mode === 'reps' ? 3 : 1) * (programFamilies[metric] === 'balance' ? 2 : 1);
  const workSeconds = dose.sets * dose.amount * secondsPerUnit;
  const totalRestSeconds = opts.restSeconds * Math.max(0, dose.sets - 1);
  const workAndRestMinutes = Math.ceil((workSeconds + totalRestSeconds) / 60);
  const totalMinutes =
    opts.warmupMinutes + opts.transitionMinutes + opts.cooldownMinutes + workAndRestMinutes;
  return {
    date,
    exercise,
    sets: dose.sets,
    amount: dose.amount,
    mode: dose.mode,
    loadKg: dose.loadKg,
    restSeconds: opts.restSeconds,
    warmupMinutes: opts.warmupMinutes,
    transitionMinutes: opts.transitionMinutes,
    cooldownMinutes: opts.cooldownMinutes,
    totalMinutes,
    slotMinutes: opts.slotMinutes,
  };
}

function scheduledBreakdownFor(plan: AdaptivePlan, session: DatedSession): SessionBreakdown {
  const {config} = plan;
  if (session.kind === 'retest') {
    const mins = expectedRetestMinutes(config);
    return {
      date: session.date,
      exercise: session.exercise,
      sets: 1,
      amount: 1,
      mode: 'reps',
      loadKg: 0,
      restSeconds: 0,
      warmupMinutes: 5,
      transitionMinutes: 2,
      cooldownMinutes: 2,
      totalMinutes: mins,
      slotMinutes: mins,
    };
  }
  const barbell = isBarbellExercise(config.metric, session.exercise[0]);
  const dumbbell = /dumbbell/i.test(session.exercise[0]);
  // Include progressive ramp-up sets in warm-up and rack/plate setup in transitions for lifts.
  const rampMinutes = barbell && config.minutes >= 30 ? 4 : 0;
  const transitionMinutes = barbell ? 3 : dumbbell ? 2 : 1;
  const warmupMinutes = session.warmupMinutes + rampMinutes;
  const restSeconds = barbell && config.minutes >= 30 ? Math.max(session.restSeconds, 150) : session.restSeconds;
  return computeSessionBreakdown(config.metric, session.date, session.exercise, session, {
    slotMinutes: Math.max(config.minutes, session.estimatedMinutes),
    warmupMinutes,
    transitionMinutes,
    restSeconds,
    cooldownMinutes: session.cooldownMinutes,
  });
}

function fitDoseToBudget(
  metric: string,
  date: string,
  exercise: ProgramLabel,
  baseDose: Dose,
  availableMinutes: number,
  opts: {
    barbell: boolean;
    preferredRestSeconds?: number;
    reduceSetsByOne?: boolean;
  },
): SessionBreakdown | null {
  const minSafe = opts.barbell && baseDose.loadKg > 0 ? 15 : 10;
  if (availableMinutes < minSafe) return null;

  const warmupMinutes = opts.barbell
    ? availableMinutes <= 20
      ? 5
      : 7
    : availableMinutes < 15
      ? 2
      : 3;
  const transitionMinutes = opts.barbell ? 2 : 1;
  const cooldownMinutes = 1;
  const restSeconds =
    opts.preferredRestSeconds ??
    (opts.barbell ? 90 : programFamilies[metric] === 'balance' ? 30 : 45);
  const overhead = warmupMinutes + transitionMinutes + cooldownMinutes;
  const workBudgetSec = (availableMinutes - overhead) * 60;
  if (workBudgetSec < 60) return null;

  const secondsPerUnit =
    (baseDose.mode === 'reps' ? 3 : 1) * (programFamilies[metric] === 'balance' ? 2 : 1);

  let sets = opts.reduceSetsByOne && baseDose.sets > 1 ? baseDose.sets - 1 : baseDose.sets;
  let amount = baseDose.amount;

  // Shrink sets first if needed, then shrink duration/amount for timed intervals so total <= availableMinutes.
  while (sets > 1) {
    const needed = sets * amount * secondsPerUnit + restSeconds * (sets - 1);
    if (needed <= workBudgetSec) break;
    sets--;
  }

  if (baseDose.mode === 'seconds') {
    const maxAmount = Math.floor((workBudgetSec - restSeconds * Math.max(0, sets - 1)) / Math.max(1, sets) / secondsPerUnit);
    if (maxAmount < 15) return null;
    // Keep clean 15-second steps for aerobic/timed work, or exact seconds for short holds.
    amount = Math.min(amount, amount >= 60 ? Math.max(30, Math.floor(maxAmount / 15) * 15) : maxAmount);
  } else {
    const maxReps = Math.floor((workBudgetSec - restSeconds * Math.max(0, sets - 1)) / Math.max(1, sets) / secondsPerUnit);
    if (maxReps < 1) return null;
    amount = Math.min(amount, maxReps);
  }

  const candidate = computeSessionBreakdown(
    metric,
    date,
    exercise,
    {...baseDose, sets, amount},
    {
      slotMinutes: availableMinutes,
      warmupMinutes,
      transitionMinutes,
      restSeconds,
      cooldownMinutes,
    },
  );
  return candidate.totalMinutes <= availableMinutes ? candidate : null;
}

function findNextOpenDay(
  plan: AdaptivePlan,
  fromDay: string,
  maxShiftDays: number,
  dossier: AthleteDossier,
  requiredMinutes: number,
  allPlans: AdaptivePlan[],
): string | null {
  const {config} = plan;
  const loggedDays = new Set(
    plan.sessions
      .map(e => sessionResult(e.data as Workout)?.day)
      .filter((d): d is string => Boolean(d)),
  );
  const limit = Math.min(maxShiftDays, Math.max(0, daysBetween(fromDay, config.deadline) - 1));
  for (let offset = 1; offset <= limit; offset++) {
    const candidateDay = addDays(fromDay, offset);
    if (candidateDay >= config.deadline) break;
    if (loggedDays.has(candidateDay)) continue;
    if (config.guidedVersion === 1) {
      if (isGuidedTrainingDay(config, candidateDay) || isGuidedRetestDay(config, candidateDay)) continue;
      if (isGuidedRetestDay(config, addDays(candidateDay, 1)) || isGuidedRetestDay(config, addDays(candidateDay, -1))) {
        continue;
      }
    }
    const otherRetest = allPlans.some(
      other =>
        other.event.id !== plan.event.id &&
        other.config.guidedVersion === 1 &&
        isGuidedRetestDay(other.config, candidateDay),
    );
    if (otherRetest) continue;
    const avail = dossier.effectiveAvailability(candidateDay, config.minutes);
    if (avail.discomfort.value?.severity === 'concerning') continue;
    if (avail.minutes.value >= requiredMinutes) return candidateDay;
  }
  return null;
}

function formatDoseEn(s: SessionBreakdown): string {
  const unit = s.mode === 'seconds' ? 's' : 'reps';
  return `${s.sets} × ${s.amount} ${unit}${s.loadKg > 0 ? ` at ${s.loadKg} kg` : ''}`;
}
function formatDoseFr(s: SessionBreakdown): string {
  const unit = s.mode === 'seconds' ? 's' : 'rép.';
  return `${s.sets} × ${s.amount} ${unit}${s.loadKg > 0 ? ` à ${s.loadKg} kg` : ''}`;
}
function formatDoseAr(s: SessionBreakdown): string {
  const unit = s.mode === 'seconds' ? 'ث' : 'تكرارات';
  return `${s.sets} × ${s.amount} ${unit}${s.loadKg > 0 ? ` بوزن ${s.loadKg} كغ` : ''}`;
}

export function selectNextSessionDecision(
  dossier: AthleteDossier,
  options: {
    plan: AdaptivePlan;
    targetDay: string;
    calendar?: DatedProgram;
    allPlans?: AdaptivePlan[];
  },
): CoachDecision {
  const {plan, targetDay} = options;
  const {config} = plan;
  const allPlans = options.allPlans ?? dossier.goals.map(g => g.plan);
  const goalRecord = dossier.goals.find(g => g.planId === plan.event.id);
  const pinned = goalRecord?.pinned ?? true;
  const priorityRank = goalRecord?.priorityRank ?? 1;

  const cal = options.calendar ?? (config.guidedVersion === 1 ? datedProgram(plan) : undefined);
  const datedSession: DatedSession =
    cal?.weeks.flatMap(w => w.sessions).find(s => s.date === targetDay) ?? {
      date: targetDay,
      kind: 'training',
      exercise: config.exerciseLabels ?? [config.exercise, config.exercise, config.exercise],
      ...plan.prescription,
      effort: 'submaximal',
      restSeconds: 90,
      warmupMinutes: 5,
      cooldownMinutes: 2,
      estimatedMinutes: config.minutes,
    };

  const scheduled = scheduledBreakdownFor(plan, datedSession);
  const availability: EffectiveDayAvailability = dossier.effectiveAvailability(targetDay, config.minutes);
  const availableMinutes = availability.minutes.value;
  const delegation = dossier.constraints.delegation.value;
  const maxShift = delegation.maxSessionShiftDays ?? 3;
  const weekday = availability.weekday;
  const wdEn = WEEKDAY_NAMES_EN[weekday];
  const wdFr = WEEKDAY_NAMES_FR[weekday];
  const wdAr = WEEKDAY_NAMES_AR[weekday];

  const isRetest = datedSession.kind === 'retest';
  const discomfort = availability.discomfort.value;
  const reqEquip = isRetest ? null : requiredEquipmentFor(config.metric, scheduled.exercise[0]);
  const declaredEquip = availability.equipment.value;
  const equipmentMissing = Boolean(reqEquip && declaredEquip.length > 0 && !declaredEquip.includes(reqEquip));

  // Detect whether a time constraint actively reduces today's available window below the scheduled slot.
  const hasExplicitTimeReduction =
    (availability.minutes.scope === 'today' || availability.weekdayRuleApplied) &&
    availableMinutes < scheduled.slotMinutes;
  const timeViolated = availableMinutes < scheduled.totalMinutes || hasExplicitTimeReduction;

  const candidates: EvaluatedCandidate[] = [];
  const decisionId = `${plan.event.id.slice(0, 8)}:${targetDay}:${availableMinutes}:${discomfort?.severity ?? 'n'}:${declaredEquip.length}:${COACH_ENGINE_VERSION}`;

  const affectedGoal = {
    planId: plan.event.id,
    metric: config.metric,
    goalUnit: config.goalUnit,
    baseline: config.baseline,
    target: config.target,
    deadline: config.deadline,
    pinned,
    priorityRank,
  };

  const scope: CoachDecision['scope'] =
    availability.overrideApplied ? 'today' : availability.weekdayRuleApplied ? 'weekday' : 'standing';
  const expiresOn = availability.overrideApplied?.expiresOn;

  // 1. Evaluate CONCERNING DISCOMFORT -> REST immediately (clinical escalation)
  if (discomfort?.severity === 'concerning') {
    candidates.push(
      {action: 'keep', feasible: false, eliminatedReason: 'concerning-discomfort', score: -1, summary: 'Eliminated due to concerning discomfort.'},
      {action: 'shorten', feasible: false, eliminatedReason: 'concerning-discomfort', score: -1, summary: 'Eliminated due to concerning discomfort.'},
      {action: 'substitute', feasible: false, eliminatedReason: 'concerning-discomfort', score: -1, summary: 'Eliminated due to concerning discomfort.'},
      {action: 'move', feasible: false, eliminatedReason: 'concerning-discomfort', score: -1, summary: 'Do not auto-reschedule until symptoms are evaluated.'},
      {action: 'rest', feasible: true, score: 100, summary: 'Pause training today and seek qualified health guidance.'},
    );
    const clinicalNotice: ProgramLabel = [
      'Pause training for this movement. Because you reported sharp pain, swelling, dizziness, or concerning symptoms, check with a qualified health professional before returning to loaded sessions.',
      'Mets cette séance en pause. Comme tu as signalé une douleur vive, un gonflement, un vertige ou un symptôme préoccupant, consulte un professionnel de santé qualifié avant de reprendre.',
      'أوقف هذه الحصة مؤقتًا. نظرًا للإبلاغ عن ألم حاد أو تورّم أو دوار أو أعراض مقلقة، استشر مختصًا صحيًا مؤهلًا قبل استئناف التدريب.',
    ];
    return {
      id: decisionId,
      modelVersion: COACH_ENGINE_VERSION,
      decidedAt: dossier.asOf,
      targetDay,
      action: 'rest',
      reasonCode: 'discomfort-concerning',
      affectedGoal,
      scheduled,
      recommended: null,
      clinicalNotice,
      candidatesEvaluated: candidates,
      trigger: {
        kind: 'discomfort',
        inputSummary: discomfort.area ? `Concerning discomfort (${discomfort.area})` : 'Concerning discomfort reported',
        source: 'declared',
        scope: 'today',
        expiresOn,
      },
      athleteSentence: [
        'Paused today’s session because you reported concerning discomfort — rest today and check with a qualified health professional before resuming.',
        'Séance mise en pause suite à une gêne préoccupante — repose-toi aujourd’hui et consulte un professionnel de santé avant de reprendre.',
        'تم إيقاف حصة اليوم مؤقتًا بسبب انزعاج مقلق — استرح اليوم واستشر مختصًا صحيًا قبل العودة.',
      ],
      scope: 'today',
      expiresOn,
      delegation: {withinAuthority: true, scopeUsed: 'schedule', canUndo: true},
    };
  }

  // 2. Evaluate RETEST day
  if (isRetest) {
    if (!timeViolated && !discomfort) {
      candidates.push({action: 'retest', feasible: true, score: 100, summary: 'Scheduled retest fits available time.'});
      return {
        id: decisionId,
        modelVersion: COACH_ENGINE_VERSION,
        decidedAt: dossier.asOf,
        targetDay,
        action: 'retest',
        reasonCode: 'scheduled-retest',
        affectedGoal,
        scheduled,
        recommended: scheduled,
        candidatesEvaluated: candidates,
        trigger: {kind: 'retest', inputSummary: 'Scheduled retest day', source: 'inferred', scope: 'standing'},
        athleteSentence: [
          `Today is your scheduled retest (${scheduled.totalMinutes} min) using your original test protocol.`,
          `Aujourd’hui est ton retest prévu (${scheduled.totalMinutes} min) selon ton protocole initial.`,
          `اليوم هو موعد إعادة الاختبار المقرّر (${scheduled.totalMinutes} د) وفق طريقتك الأصلية.`,
        ],
        scope: 'standing',
        delegation: {withinAuthority: true, scopeUsed: 'none', canUndo: false},
      };
    }
    const moveDay = findNextOpenDay(plan, targetDay, maxShift, dossier, scheduled.totalMinutes, allPlans);
    candidates.push(
      {action: 'retest', feasible: false, eliminatedReason: 'insufficient-time-for-retest', score: -1, summary: 'A comparable retest needs its full warm-up and test time.'},
      {action: 'shorten', feasible: false, eliminatedReason: 'cannot-shorten-retest', score: -1, summary: 'Shortening would invalidate test comparability.'},
      {action: 'move', feasible: Boolean(moveDay), eliminatedReason: moveDay ? undefined : 'no-open-day', score: moveDay ? 90 : -1, summary: moveDay ? `Move retest to ${moveDay}.` : 'No open day within shift limit.'},
      {action: 'rest', feasible: true, score: 40, summary: 'Hold retest until full time is available.'},
    );
    const chosen: CoachAction = moveDay ? 'move' : 'rest';
    return {
      id: decisionId,
      modelVersion: COACH_ENGINE_VERSION,
      decidedAt: dossier.asOf,
      targetDay,
      action: chosen,
      reasonCode: moveDay ? 'retest-moved-time' : 'retest-rest-time',
      affectedGoal,
      scheduled,
      recommended: moveDay ? {...scheduled, date: moveDay} : null,
      movedTo: moveDay ?? undefined,
      candidatesEvaluated: candidates,
      trigger: {
        kind: availability.weekdayRuleApplied ? 'weekday-time' : 'today-time',
        inputSummary: `${availableMinutes} min available vs ${scheduled.totalMinutes} min needed for retest`,
        source: availability.minutes.source,
        scope: availability.minutes.scope,
        expiresOn,
      },
      athleteSentence: moveDay
        ? [
            `Moved your retest to ${moveDay} because a comparable test needs ${scheduled.totalMinutes} min rather than ${availableMinutes} min.`,
            `Retest déplacé au ${moveDay} car un test comparable demande ${scheduled.totalMinutes} min plutôt que ${availableMinutes} min.`,
            `تم نقل إعادة الاختبار إلى ${moveDay} لأن الاختبار القابل للمقارنة يحتاج ${scheduled.totalMinutes} دقيقة بدلًا من ${availableMinutes} دقيقة.`,
          ]
        : [
            `Hold your retest today — ${availableMinutes} min is too short for a comparable test (${scheduled.totalMinutes} min needed).`,
            `Reporte ton retest aujourd’hui — ${availableMinutes} min ne suffisent pas pour un test comparable (${scheduled.totalMinutes} min nécessaires).`,
            `أجّل إعادة الاختبار اليوم — ${availableMinutes} دقيقة لا تكفي لاختبار قابل للمقارنة (تحتاج ${scheduled.totalMinutes} دقيقة).`,
          ],
      scope,
      expiresOn,
      delegation: {withinAuthority: delegation.schedule, scopeUsed: 'schedule', canUndo: true},
    };
  }

  // 3. Evaluate KEEP (valid only if time, equipment, and discomfort are all clean)
  const keepFeasible = !timeViolated && !equipmentMissing && !discomfort;
  candidates.push({
    action: 'keep',
    feasible: keepFeasible,
    eliminatedReason: discomfort
      ? 'mild-discomfort'
      : equipmentMissing
        ? `missing-${reqEquip}`
        : timeViolated
          ? `exceeds-${availableMinutes}min-budget`
          : undefined,
    score: keepFeasible ? 100 : -1,
    summary: keepFeasible
      ? `Keep scheduled ${scheduled.exercise[0]} (${scheduled.slotMinutes} min slot).`
      : 'Eliminated by active constraint.',
  });

  if (keepFeasible) {
    return {
      id: decisionId,
      modelVersion: COACH_ENGINE_VERSION,
      decidedAt: dossier.asOf,
      targetDay,
      action: 'keep',
      reasonCode: 'plan-feasible',
      affectedGoal,
      scheduled,
      recommended: scheduled,
      candidatesEvaluated: candidates,
      trigger: {
        kind: 'none',
        inputSummary: `Normal ${scheduled.slotMinutes} min session fits current availability and equipment`,
        source: availability.minutes.source,
        scope: 'standing',
      },
      athleteSentence: [
        `Keeping your scheduled ${scheduled.exercise[0]} (${formatDoseEn(scheduled)}, ${scheduled.slotMinutes} min slot) — no changes needed.`,
        `Séance maintenue : ${scheduled.exercise[1]} (${formatDoseFr(scheduled)}, créneau de ${scheduled.slotMinutes} min) — aucun ajustement nécessaire.`,
        `الإبقاء على حصتك المقررة: ${scheduled.exercise[2]} (${formatDoseAr(scheduled)}، مدة ${scheduled.slotMinutes} د) — لا حاجة لتعديل.`,
      ],
      scope: 'standing',
      delegation: {withinAuthority: true, scopeUsed: 'none', canUndo: false},
    };
  }

  // 4-6. Compute per-athlete learned policy nudges (bounded ±8; never overrides safety or feasibility)
  const policy: PersonalPolicyUpdate = optimizePersonalPolicy(
    dossier,
    allPlans.flatMap(p => p.sessions),
  );
  const scoreBoost = (act: 'shorten' | 'move' | 'substitute') =>
    policy.active ? policy.actions[act].scoreDelta : 0;

  // 4. Evaluate SUBSTITUTE (when equipment is missing OR mild discomfort reported)
  let substituteSession: SessionBreakdown | null = null;
  if (equipmentMissing || discomfort?.severity === 'mild') {
    const subSpec = compatibleSubstitute(
      config.metric,
      declaredEquip,
      discomfort?.severity === 'mild',
    );
    const baseSets = discomfort?.severity === 'mild' ? Math.max(1, scheduled.sets - 1) : scheduled.sets;
    const baseAmount =
      subSpec.mode === 'reps'
        ? Math.max(3, Math.min(15, Math.round(scheduled.amount * subSpec.amountFactor)))
        : Math.max(15, Math.round(scheduled.amount * subSpec.amountFactor));
    const subDose: Dose = {sets: baseSets, amount: baseAmount, mode: subSpec.mode, loadKg: subSpec.loadKg};
    substituteSession = fitDoseToBudget(
      config.metric,
      targetDay,
      subSpec.exercise,
      subDose,
      availableMinutes,
      {
        barbell: false,
        preferredRestSeconds: subSpec.restSeconds,
        reduceSetsByOne: timeViolated && baseSets > 1,
      },
    );
    candidates.push({
      action: 'substitute',
      feasible: Boolean(substituteSession),
      eliminatedReason: substituteSession ? undefined : 'substitute-exceeds-time',
      score: substituteSession ? 92 + scoreBoost('substitute') : -1,
      summary: substituteSession
        ? `Substitute ${substituteSession.exercise[0]} (${formatDoseEn(substituteSession)}, ${substituteSession.totalMinutes} min).`
        : 'Substitute does not fit available minutes.',
    });
  } else {
    candidates.push({
      action: 'substitute',
      feasible: false,
      eliminatedReason: 'not-needed',
      score: -1,
      summary: 'Planned movement matches available equipment.',
    });
  }

  // 5. Evaluate SHORTEN (valid when equipment is available and no mild discomfort requires a gentler movement)
  let shortenedSession: SessionBreakdown | null = null;
  if (!equipmentMissing && discomfort?.severity !== 'mild') {
    const barbell = isBarbellExercise(config.metric, scheduled.exercise[0]);
    shortenedSession = fitDoseToBudget(
      config.metric,
      targetDay,
      scheduled.exercise,
      {sets: scheduled.sets, amount: scheduled.amount, mode: scheduled.mode, loadKg: scheduled.loadKg},
      availableMinutes,
      {
        barbell,
        reduceSetsByOne: scheduled.sets > 1,
      },
    );
    candidates.push({
      action: 'shorten',
      feasible: Boolean(shortenedSession),
      eliminatedReason: shortenedSession
        ? undefined
        : `below-minimum-safe-time-${barbell && scheduled.loadKg > 0 ? 15 : 10}min`,
      score: shortenedSession ? 95 + scoreBoost('shorten') : -1,
      summary: shortenedSession
        ? `Shorten ${shortenedSession.exercise[0]} to ${formatDoseEn(shortenedSession)} (${shortenedSession.totalMinutes} min ≤ ${availableMinutes} min).`
        : `${availableMinutes} min is too short for safe warm-up and working sets.`,
    });
  } else {
    candidates.push({
      action: 'shorten',
      feasible: false,
      eliminatedReason: equipmentMissing ? `missing-${reqEquip}` : 'mild-discomfort',
      score: -1,
      summary: 'Cannot keep original movement under current constraint.',
    });
  }

  // 6. Evaluate MOVE (reschedule to next open day with normal availability)
  const moveDay = findNextOpenDay(plan, targetDay, maxShift, dossier, scheduled.totalMinutes, allPlans);
  const moveFeasible = Boolean(moveDay && !equipmentMissing);
  candidates.push({
    action: 'move',
    feasible: moveFeasible,
    eliminatedReason: equipmentMissing
      ? `standing-missing-${reqEquip}`
      : moveDay
        ? undefined
        : 'no-open-day-before-deadline',
    score: moveFeasible ? 82 + scoreBoost('move') : -1,
    summary: moveFeasible
      ? `Move full ${scheduled.slotMinutes} min session to ${moveDay}.`
      : 'No open replacement day fits.',
  });

  // 7. Evaluate REST (always feasible fallback)
  candidates.push({
    action: 'rest',
    feasible: true,
    score: 40,
    summary: 'Take a recovery day and resume on the next scheduled session.',
  });

  // Deterministic winner selection using score + TIE_BREAK_ORDER
  const feasible = candidates.filter(c => c.feasible);
  feasible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return TIE_BREAK_ORDER.indexOf(a.action) - TIE_BREAK_ORDER.indexOf(b.action);
  });
  const winner = feasible[0].action;

  // Build exact explanation, trigger, and recommendation for the winning action
  const targetLabel =
    config.goalUnit === 'kg'
      ? `${config.target} kg`
      : `${config.target} ${goalMetrics.find(m => m.id === config.metric)?.unit ?? ''}`.trim();

  if (winner === 'shorten' && shortenedSession) {
    const isRecurring = availability.weekdayRuleApplied;
    const triggerKind: CoachTriggerKind = isRecurring ? 'weekday-time' : 'today-time';
    const inputSummary = isRecurring
      ? `Every ${wdEn} limited to ${availableMinutes} min (normal session: ${scheduled.slotMinutes} min)`
      : `${availableMinutes} min available on ${targetDay} (normal session: ${scheduled.slotMinutes} min)`;
    const sentence: ProgramLabel = isRecurring
      ? [
          `Shortened ${wdEn}’s ${shortenedSession.exercise[0]} to ${formatDoseEn(shortenedSession)} (${shortenedSession.totalMinutes} min incl. warm-up & rest) to fit your recurring ${availableMinutes}-min ${wdEn} limit while keeping your ${targetLabel} goal intact.`,
          `${shortenedSession.exercise[1]} du ${wdFr} raccourci à ${formatDoseFr(shortenedSession)} (${shortenedSession.totalMinutes} min avec échauffement et repos) pour respecter ta limite de ${availableMinutes} min tout en gardant ton objectif de ${targetLabel}.`,
          `تم تقليص ${shortenedSession.exercise[2]} ليوم ${wdAr} إلى ${formatDoseAr(shortenedSession)} (${shortenedSession.totalMinutes} د مع الإحماء والراحة) ليتناسب مع حد ${availableMinutes} دقيقة المتكرر مع الحفاظ على هدفك (${targetLabel}).`,
        ]
      : [
          `Shortened today’s ${shortenedSession.exercise[0]} to ${formatDoseEn(shortenedSession)} (${shortenedSession.totalMinutes} min incl. warm-up & rest) to fit your ${availableMinutes}-min window — next ${wdEn} stays at ${scheduled.slotMinutes} min.`,
          `${shortenedSession.exercise[1]} d’aujourd’hui raccourci à ${formatDoseFr(shortenedSession)} (${shortenedSession.totalMinutes} min avec échauffement et repos) pour tenir en ${availableMinutes} min — ${wdFr} prochain reste à ${scheduled.slotMinutes} min.`,
          `تم تقليص ${shortenedSession.exercise[2]} لليوم إلى ${formatDoseAr(shortenedSession)} (${shortenedSession.totalMinutes} د مع الإحماء والراحة) ليناسب نافذة ${availableMinutes} دقيقة — ويبقى ${wdAr} القادم عند ${scheduled.slotMinutes} دقيقة.`,
        ];
    return {
      id: decisionId,
      modelVersion: COACH_ENGINE_VERSION,
      decidedAt: dossier.asOf,
      targetDay,
      action: 'shorten',
      reasonCode: isRecurring ? 'weekday-time-shortened' : 'today-time-shortened',
      affectedGoal,
      scheduled,
      recommended: shortenedSession,
      candidatesEvaluated: candidates,
      trigger: {
        kind: triggerKind,
        inputSummary,
        source: availability.minutes.source,
        scope: availability.minutes.scope,
        expiresOn,
      },
      athleteSentence: sentence,
      scope,
      expiresOn,
      delegation: {withinAuthority: delegation.schedule, scopeUsed: 'dose', canUndo: true},
    };
  }

  if (winner === 'substitute' && substituteSession) {
    const mild = discomfort?.severity === 'mild';
    const triggerKind: CoachTriggerKind = mild ? 'discomfort' : 'equipment';
    const inputSummary = mild
      ? `Mild discomfort reported${discomfort?.area ? ` (${discomfort.area})` : ''}${timeViolated ? ` + ${availableMinutes} min window` : ''}`
      : `Available equipment (${declaredEquip.join(', ')}) excludes ${reqEquip}${timeViolated ? ` + ${availableMinutes} min window` : ''}`;
    const sentence: ProgramLabel = mild
      ? [
          `Switched to ${substituteSession.exercise[0]} (${formatDoseEn(substituteSession)}, ${substituteSession.totalMinutes} min) for mild discomfort — stop immediately if pain increases.`,
          `Remplacé par ${substituteSession.exercise[1]} (${formatDoseFr(substituteSession)}, ${substituteSession.totalMinutes} min) suite à une gêne légère — arrête immédiatement si la douleur augmente.`,
          `تم الاستبدال بـ ${substituteSession.exercise[2]} (${formatDoseAr(substituteSession)}، ${substituteSession.totalMinutes} د) بسبب انزعاج خفيف — توقف فورًا إذا زاد الألم.`,
        ]
      : [
          `Switched to ${substituteSession.exercise[0]} (${formatDoseEn(substituteSession)}, ${substituteSession.totalMinutes} min) to match your available equipment while keeping your ${targetLabel} goal and measured baseline intact.`,
          `Remplacé par ${substituteSession.exercise[1]} (${formatDoseFr(substituteSession)}, ${substituteSession.totalMinutes} min) selon ton matériel disponible tout en conservant ton objectif de ${targetLabel}.`,
          `تم الاستبدال بـ ${substituteSession.exercise[2]} (${formatDoseAr(substituteSession)}، ${substituteSession.totalMinutes} د) وفق معداتك المتاحة مع الحفاظ على هدفك (${targetLabel}).`,
        ];
    return {
      id: decisionId,
      modelVersion: COACH_ENGINE_VERSION,
      decidedAt: dossier.asOf,
      targetDay,
      action: 'substitute',
      reasonCode: mild ? 'mild-discomfort-substitute' : 'equipment-substitute',
      affectedGoal,
      scheduled,
      recommended: substituteSession,
      candidatesEvaluated: candidates,
      trigger: {
        kind: triggerKind,
        inputSummary,
        source: mild ? 'declared' : availability.equipment.source,
        scope: mild ? 'today' : availability.equipment.scope,
        expiresOn,
      },
      athleteSentence: sentence,
      scope: mild ? 'today' : scope,
      expiresOn,
      delegation: {withinAuthority: delegation.exercises, scopeUsed: 'exercise', canUndo: true},
    };
  }

  if (winner === 'move' && moveDay) {
    const movedSession: SessionBreakdown = {...scheduled, date: moveDay};
    return {
      id: decisionId,
      modelVersion: COACH_ENGINE_VERSION,
      decidedAt: dossier.asOf,
      targetDay,
      action: 'move',
      reasonCode: 'time-too-short-moved',
      affectedGoal,
      scheduled,
      recommended: movedSession,
      movedTo: moveDay,
      candidatesEvaluated: candidates,
      trigger: {
        kind: availability.weekdayRuleApplied ? 'weekday-time' : 'today-time',
        inputSummary: `${availableMinutes} min is too short for a safe ${scheduled.exercise[0]} session — moved to ${moveDay}`,
        source: availability.minutes.source,
        scope: availability.minutes.scope,
        expiresOn,
      },
      athleteSentence: [
        `Rescheduling beats rushing: ${availableMinutes} min is too short for a safe warm-up and working sets of ${scheduled.exercise[0]}, so moved the full session to ${moveDay}.`,
        `Mieux vaut déplacer que précipiter : ${availableMinutes} min ne suffisent pas pour un échauffement et des séries sûres de ${scheduled.exercise[1]}, séance complète déplacée au ${moveDay}.`,
        `إعادة الجدولة أفضل من الاستعجال: ${availableMinutes} دقيقة لا تكفي لإحماء ومجموعات آمنة لـ ${scheduled.exercise[2]}، لذا نُقلت الحصة الكاملة إلى ${moveDay}.`,
      ],
      scope,
      expiresOn,
      delegation: {withinAuthority: delegation.schedule, scopeUsed: 'schedule', canUndo: true},
    };
  }

  // Fallback: REST
  return {
    id: decisionId,
    modelVersion: COACH_ENGINE_VERSION,
    decidedAt: dossier.asOf,
    targetDay,
    action: 'rest',
    reasonCode: 'insufficient-time-rest',
    affectedGoal,
    scheduled,
    recommended: null,
    candidatesEvaluated: candidates,
    trigger: {
      kind: availability.weekdayRuleApplied ? 'weekday-time' : 'today-time',
      inputSummary: `${availableMinutes} min available and no open reschedule slot before deadline`,
      source: availability.minutes.source,
      scope: availability.minutes.scope,
      expiresOn,
    },
    athleteSentence: [
      `Take a rest day today: ${availableMinutes} min is too short for safe working sets and no open reschedule day fits before your next session.`,
      `Prends un jour de repos aujourd’hui : ${availableMinutes} min ne suffisent pas pour des séries sûres et aucun créneau libre ne convient avant la prochaine séance.`,
      `خذ يوم راحة اليوم: ${availableMinutes} دقيقة لا تكفي لمجموعات آمنة ولا يوجد يوم بديل متاح قبل الحصة التالية.`,
    ],
    scope,
    expiresOn,
    delegation: {withinAuthority: delegation.schedule, scopeUsed: 'schedule', canUndo: true},
  };
}

function toSnapshot(s: SessionBreakdown): StoredDecisionSnapshot {
  return {
    exercise: s.exercise[0],
    sets: s.sets,
    amount: s.amount,
    mode: s.mode,
    loadKg: s.loadKg,
    minutes: s.totalMinutes,
    date: s.date,
  };
}

export function toStoredDecision(decision: CoachDecision, locale: 'en' | 'fr' | 'ar' = 'en'): StoredCoachDecision {
  const idx = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  return {
    id: decision.id,
    modelVersion: decision.modelVersion,
    decidedAt: decision.decidedAt,
    day: decision.targetDay,
    metric: decision.affectedGoal.metric,
    action: decision.action,
    reasonCode: decision.reasonCode,
    triggerInput: decision.trigger.inputSummary,
    scope: decision.scope,
    ...(decision.expiresOn ? {expiresOn: decision.expiresOn} : {}),
    summary: decision.athleteSentence[idx].slice(0, 300),
    before: toSnapshot(decision.scheduled),
    after: decision.recommended ? toSnapshot(decision.recommended) : null,
  };
}

export function applyDayAvailabilityOverride(
  workspace: PersonalWorkspace,
  input: {
    date: string;
    minutes?: number;
    equipment?: EquipmentOption[];
    discomfort?: DiscomfortReport;
    reason?: string;
    now?: Date;
    decision?: StoredCoachDecision;
  },
): PersonalWorkspace {
  const now = (input.now ?? new Date()).toISOString();
  const prevOverrides = (workspace.context.dayOverrides ?? []).filter(o => o.date !== input.date);
  const nextOverride: DayAvailabilityOverride = {
    date: input.date,
    expiresOn: input.date,
    recordedAt: now,
    ...(input.minutes !== undefined ? {minutes: input.minutes} : {}),
    ...(input.equipment !== undefined ? {equipment: input.equipment} : {}),
    ...(input.discomfort !== undefined ? {discomfort: input.discomfort} : {}),
    ...(input.reason?.trim() ? {reason: input.reason.trim()} : {}),
  };
  const nextOverrides = [...prevOverrides, nextOverride].slice(-14);
  const prevDecisions = workspace.context.coachDecisions ?? [];
  const nextDecisions = input.decision
    ? [...prevDecisions.filter(d => d.id !== input.decision!.id), input.decision].slice(-12)
    : prevDecisions;

  return {
    ...workspace,
    context: normalizeTrainingContext({
      ...workspace.context,
      dayOverrides: nextOverrides,
      ...(nextDecisions.length ? {coachDecisions: nextDecisions} : {}),
    }),
  };
}

export function applyWeekdayMinutesRule(
  workspace: PersonalWorkspace,
  input: {
    weekday: IsoWeekday;
    minutes: number;
    clearDateOverride?: string;
    decision?: StoredCoachDecision;
  },
): PersonalWorkspace {
  const weekdayMinutes = {
    ...(workspace.context.weekdayMinutes ?? {}),
    [input.weekday]: input.minutes,
  };
  const dayOverrides = input.clearDateOverride
    ? (workspace.context.dayOverrides ?? []).filter(o => o.date !== input.clearDateOverride)
    : workspace.context.dayOverrides;
  const prevDecisions = workspace.context.coachDecisions ?? [];
  const nextDecisions = input.decision
    ? [...prevDecisions.filter(d => d.id !== input.decision!.id), input.decision].slice(-12)
    : prevDecisions;

  return {
    ...workspace,
    context: normalizeTrainingContext({
      ...workspace.context,
      weekdayMinutes,
      dayOverrides: dayOverrides?.length ? dayOverrides : undefined,
      ...(nextDecisions.length ? {coachDecisions: nextDecisions} : {}),
    }),
  };
}

export function undoCoachAdjustment(
  workspace: PersonalWorkspace,
  target: {day: string; scope: 'today' | 'weekday'; decisionId?: string; now?: Date},
): PersonalWorkspace {
  const now = (target.now ?? new Date()).toISOString();
  const nextOverrides =
    target.scope === 'today'
      ? (workspace.context.dayOverrides ?? []).filter(o => o.date !== target.day)
      : workspace.context.dayOverrides;
  let nextWeekdayMinutes = workspace.context.weekdayMinutes ? {...workspace.context.weekdayMinutes} : undefined;
  if (target.scope === 'weekday' && nextWeekdayMinutes) {
    const wd = isoWeekdayForDay(target.day);
    delete nextWeekdayMinutes[wd];
    if (!Object.keys(nextWeekdayMinutes).length) nextWeekdayMinutes = undefined;
  }
  const nextDecisions = (workspace.context.coachDecisions ?? []).map(d =>
    (target.decisionId && d.id === target.decisionId) ||
    (!target.decisionId && d.day === target.day && d.scope === target.scope && !d.undoneAt)
      ? {...d, undoneAt: now}
      : d,
  );
  return {
    ...workspace,
    context: normalizeTrainingContext({
      ...workspace.context,
      dayOverrides: nextOverrides?.length ? nextOverrides : undefined,
      weekdayMinutes: nextWeekdayMinutes,
      coachDecisions: nextDecisions.length ? nextDecisions : undefined,
    }),
  };
}

export function weekdayLabel(day: string, locale: 'en' | 'fr' | 'ar'): string {
  const wd = isoWeekdayForDay(day);
  return locale === 'fr' ? WEEKDAY_NAMES_FR[wd] : locale === 'ar' ? WEEKDAY_NAMES_AR[wd] : WEEKDAY_NAMES_EN[wd];
}
