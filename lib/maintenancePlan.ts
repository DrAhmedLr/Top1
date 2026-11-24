import {addDays, goalMetrics, type AdaptivePlan, type Dose, type GoalUnit} from './adaptiveProgram';
import type {AthleteDossier} from './athleteDossier';
import {programFamilies, type ProgramLabel} from './guidedSchedule';
import type {GoalAttempt} from './goalAttempts';

export const MAINTENANCE_ENGINE_VERSION = 'maintenance-plan-v1';

export type MaintenanceDomain = 'strength' | 'endurance' | 'bodyweight' | 'skill';

export type MaintenanceRetentionStatus =
  | 'maintained' // Latest comparable retest is within measurement noise of achieved target
  | 'below-achieved' // Single lower comparable retest; preserves original achievement without forcing escalation
  | 'retest-due'; // Periodic maintenance retest date has arrived

export type MaintenancePlan = {
  version: typeof MAINTENANCE_ENGINE_VERSION;
  planId: string;
  metric: string;
  goalUnit: GoalUnit;
  domain: MaintenanceDomain;
  achievedTarget: number;
  achievedOn: string;
  latestComparableValue: number | null;
  latestComparableOn: string | null;
  retentionStatus: MaintenanceRetentionStatus;
  /** Low-burden weekly schedule derived from Bickel et al. (2011) & Spiering et al. (2021). */
  sessionsPerWeek: number;
  estimatedMinutesPerSession: number;
  weeklyMinutes: number;
  exercise: ProgramLabel;
  dose: Dose;
  restSeconds: number;
  retestIntervalDays: number;
  nextRetestDate: string;
  /** Age- and domain-specific scientific rationale (evidence register IDs). */
  evidenceIds: string[];
  minimumDoseNote: [string, string, string];
  summary: [string, string, string];
  /** True only when the athlete explicitly chooses to escalate — never pushed automatically. */
  promptsEscalation: false;
  /** Retention efficiency: retained target level per weekly training minute (for Phase 3 reporting). */
  retainedPerWeeklyMinute: number;
};

function domainForMetric(metric: string): MaintenanceDomain {
  const fam = programFamilies[metric];
  if (fam === 'lift') return 'strength';
  if (fam === 'aerobic' || fam === 'stride') return 'endurance';
  if (fam === 'repetition') return 'bodyweight';
  return 'skill';
}

/**
 * Measurement-noise tolerance so normal day-to-day test fluctuation (e.g. ~2.5% on a lift
 * or ~1.5% on a 5 km run) is distinguished from a meaningful drop.
 */
function noiseTolerance(metric: string, target: number): number {
  const domain = domainForMetric(metric);
  if (domain === 'strength') return Math.max(2, Math.abs(target) * 0.025);
  if (domain === 'endurance') return Math.max(0.25, Math.abs(target) * 0.015);
  if (domain === 'bodyweight') return Math.max(1, Math.round(Math.abs(target) * 0.05));
  return Math.max(1, Math.abs(target) * 0.03);
}

/**
 * Automatically converts a comparable target-reaching goal into a low-burden maintenance plan.
 * - Preserves the original achievement date and achieved target.
 * - Uses age-aware strength retention (Bickel, Cross & Bamman 2011) and intensity-preserving
 *   endurance/strength maintenance (Spiering et al. 2021).
 * - Treats minimum effective dose as an individual estimate to verify on periodic retests.
 * - A single lower post-achievement retest updates live status without erasing the achievement
 *   or forcing escalation.
 */
export type MaintenanceAttemptInput = Pick<
  GoalAttempt,
  | 'planId'
  | 'metric'
  | 'goalUnit'
  | 'target'
  | 'deadline'
  | 'status'
  | 'reachedOn'
  | 'observedOn'
  | 'observedValue'
  | 'latestComparableOn'
  | 'latestComparableValue'
>;

export function buildMaintenancePlan(input: {
  attempt: MaintenanceAttemptInput;
  plan: AdaptivePlan;
  dossier: AthleteDossier;
  today: string;
}): MaintenancePlan | null {
  const {attempt, plan, dossier, today} = input;
  if (attempt.status !== 'reached' || !attempt.reachedOn) return null;

  const {config} = plan;
  const metricObj = goalMetrics.find(m => m.id === config.metric);
  if (!metricObj) return null;

  const domain = domainForMetric(config.metric);
  const age = dossier.identity.profile.age?.value;
  const olderAdult = age !== undefined && age >= 60;

  // Domain- & age-specific low-burden starting maintenance dose
  let sessionsPerWeek: number;
  let sets: number;
  let amount: number;
  let loadKg = config.dose.loadKg;
  let restSeconds = domain === 'strength' ? 120 : 60;
  let retestIntervalDays: number;
  let estimatedMinutesPerSession: number;
  let evidenceIds: string[];

  if (domain === 'strength') {
    // Bickel et al. (2011) + Spiering et al. (2021):
    // Younger adults (<60): 1 brief session/wk preserving intensity/load (~15-20 min).
    // Older adults (60+): 2 brief sessions/wk (1/3 volume) to better preserve strength & lean mass.
    sessionsPerWeek = olderAdult ? 2 : 1;
    sets = olderAdult ? 2 : Math.max(1, Math.min(2, config.dose.sets - 1));
    amount = config.dose.amount;
    if (loadKg > 0) {
      // Preserve intensity/load around ~70% of achieved target when kg target is known,
      // or retain the trained working load so stimulus remains high while total volume drops.
      const intensityAnchor =
        config.goalUnit === 'kg' ? Math.floor((attempt.target * 0.7) * 2) / 2 : loadKg;
      loadKg = Math.max(loadKg, Math.min(attempt.target * 0.75, intensityAnchor));
    }
    estimatedMinutesPerSession = olderAdult ? 20 : 18;
    retestIntervalDays = 28;
    evidenceIds = ['bickel-cross-bamman-2011', 'spiering-2021'];
  } else if (domain === 'endurance') {
    // Spiering et al. (2021): preserve intensity across 2 shorter weekly sessions (~40% less volume).
    sessionsPerWeek = 2;
    sets = Math.max(1, config.dose.sets);
    amount = Math.max(60, Math.round((config.dose.amount * 0.65) / 15) * 15);
    estimatedMinutesPerSession = Math.max(15, Math.min(25, Math.round(config.minutes * 0.6)));
    retestIntervalDays = 28;
    evidenceIds = ['spiering-2021'];
  } else if (domain === 'bodyweight') {
    sessionsPerWeek = olderAdult ? 2 : 1;
    sets = Math.max(1, Math.min(2, config.dose.sets - 1));
    amount = config.dose.amount;
    estimatedMinutesPerSession = 12;
    retestIntervalDays = 21;
    evidenceIds = ['bickel-cross-bamman-2011', 'kotarsky-2018'];
  } else {
    sessionsPerWeek = 1;
    sets = Math.max(1, Math.min(2, config.dose.sets));
    amount = config.dose.amount;
    estimatedMinutesPerSession = 12;
    retestIntervalDays = 21;
    evidenceIds = ['spiering-2021'];
  }

  const anchorDay = attempt.latestComparableOn && attempt.latestComparableOn > attempt.reachedOn
    ? attempt.latestComparableOn
    : attempt.reachedOn;
  const nextRetestDate = addDays(anchorDay, retestIntervalDays);

  // Evaluate retention against measurement noise without erasing the prior achievement!
  const latestVal = attempt.latestComparableValue ?? attempt.observedValue ?? attempt.target;
  const latestOn = attempt.latestComparableOn ?? attempt.observedOn ?? attempt.reachedOn;
  const tolerance = noiseTolerance(config.metric, attempt.target);
  const signedDiff = (latestVal - attempt.target) * metricObj.polarity;

  let retentionStatus: MaintenanceRetentionStatus = 'maintained';
  if (signedDiff < -tolerance) {
    retentionStatus = 'below-achieved';
  } else if (today >= nextRetestDate) {
    retentionStatus = 'retest-due';
  }

  const exercise: ProgramLabel =
    config.exerciseLabels ?? [config.exercise, config.exercise, config.exercise];
  const weeklyMinutes = sessionsPerWeek * estimatedMinutesPerSession;
  const unitText = config.goalUnit === 'kg' ? 'kg' : metricObj.unit;

  const minimumDoseNote: [string, string, string] = olderAdult && domain === 'strength'
    ? [
        'Starting estimate: 2 brief sessions/week preserving load (evidence shows adults 60+ retain strength better with ~1/3 volume). Retests verify whether less is enough for you.',
        'Estimation initiale : 2 séances courtes/semaine à charge maintenue (meilleure rétention à 60+ ans). Les retests vérifieront si un volume moindre suffit.',
        'تقدير مبدئي: حصتان قصيرتان أسبوعيًا مع الحفاظ على الحمل (أفضل للحفاظ على القوة بعد 60 عامًا). تؤكد إعادة الاختبار ما إذا كان حجم أقل يكفيك.',
      ]
    : domain === 'endurance'
      ? [
          'Starting estimate: 2 shorter sessions/week keeping pace quality while trimming volume. Retests confirm retention.',
          'Estimation initiale : 2 séances plus courtes/semaine en gardant l’allure tout en réduisant le volume. Les retests confirment le maintien.',
          'تقدير مبدئي: حصتان أقصر أسبوعيًا مع الحفاظ على جودة الوتيرة وتقليل الحجم. تؤكد إعادة الاختبار استمرار المستوى.',
        ]
      : [
          'Starting estimate: 1 brief weekly session preserving intensity (~18 min/week). Retests test whether this minimum dose keeps your level.',
          'Estimation initiale : 1 séance courte/semaine en conservant l’intensité (~18 min/sem.). Les retests vérifient que cette dose minimale suffit.',
          'تقدير مبدئي: حصة قصيرة واحدة أسبوعيًا مع الحفاظ على الشدة (~18 دقيقة أسبوعيًا). تتحقق إعادة الاختبار من كفاية هذه الجرعة الدنيا.',
        ];

  const summary: [string, string, string] =
    retentionStatus === 'below-achieved'
      ? [
          `Goal achieved on ${attempt.reachedOn} (${attempt.target} ${unitText}). Latest test (${latestVal} ${unitText}) dipped below your achieved level — your achievement stays preserved; keep the light maintenance dose and retest on ${nextRetestDate}.`,
          `Objectif atteint le ${attempt.reachedOn} (${attempt.target} ${unitText}). Le dernier test (${latestVal} ${unitText}) est légèrement en dessous — ton accomplissement reste acquis ; maintiens la dose légère et reteste le ${nextRetestDate}.`,
          `تحقق الهدف في ${attempt.reachedOn} (${attempt.target} ${unitText}). انخفض أحدث اختبار (${latestVal} ${unitText}) قليلًا — يبقى إنجازك محفوظًا؛ استمر على جرعة الصيانة الخفيفة وأعد الاختبار في ${nextRetestDate}.`,
        ]
      : [
          `Maintained at ${attempt.target} ${unitText} (achieved ${attempt.reachedOn}): ${sessionsPerWeek}×/week · ${estimatedMinutesPerSession} min · next check on ${nextRetestDate}.`,
          `Niveau maintenu à ${attempt.target} ${unitText} (atteint le ${attempt.reachedOn}) : ${sessionsPerWeek}×/sem. · ${estimatedMinutesPerSession} min · prochain contrôle le ${nextRetestDate}.`,
          `الحفاظ على مستوى ${attempt.target} ${unitText} (تحقق في ${attempt.reachedOn}): ${sessionsPerWeek}× أسبوعيًا · ${estimatedMinutesPerSession} د · الفحص القادم في ${nextRetestDate}.`,
        ];

  return {
    version: MAINTENANCE_ENGINE_VERSION,
    planId: attempt.planId,
    metric: config.metric,
    goalUnit: config.goalUnit,
    domain,
    achievedTarget: attempt.target,
    achievedOn: attempt.reachedOn,
    latestComparableValue: latestVal,
    latestComparableOn: latestOn,
    retentionStatus,
    sessionsPerWeek,
    estimatedMinutesPerSession,
    weeklyMinutes,
    exercise,
    dose: {sets, amount, mode: config.dose.mode, loadKg},
    restSeconds,
    retestIntervalDays,
    nextRetestDate,
    evidenceIds,
    minimumDoseNote,
    summary,
    promptsEscalation: false,
    retainedPerWeeklyMinute: Number((Math.abs(attempt.target) / Math.max(1, weeklyMinutes)).toFixed(3)),
  };
}

/**
 * Computes maintenance state across all active goals so that:
 * - Achieved goals automatically run in maintenance mode while other pinned goals keep progressing.
 * - Once ALL chosen active goals are achieved, Home switches cleanly to maintenance mode without
 *   pushing the athlete to escalate.
 */
export function portfolioMaintenanceSummary(input: {
  plans: readonly AdaptivePlan[];
  attempts: readonly MaintenanceAttemptInput[];
  dossier: AthleteDossier;
  today: string;
}) {
  const maintenancePlans: MaintenancePlan[] = [];
  const continuingPlans: AdaptivePlan[] = [];

  for (const plan of input.plans) {
    const attempt = input.attempts.find(
      a =>
        a.planId === plan.event.id &&
        a.status === 'reached' &&
        a.target === plan.config.target &&
        a.deadline === plan.config.deadline,
    );
    const maint = attempt
      ? buildMaintenancePlan({attempt, plan, dossier: input.dossier, today: input.today})
      : null;
    if (maint) maintenancePlans.push(maint);
    else continuingPlans.push(plan);
  }

  return {
    maintenancePlans,
    continuingPlans,
    allGoalsMaintained: input.plans.length > 0 && continuingPlans.length === 0 && maintenancePlans.length > 0,
    totalMaintenanceWeeklyMinutes: maintenancePlans.reduce((sum, m) => sum + m.weeklyMinutes, 0),
  };
}
