import {dayInZone, sessionResult} from './adaptiveProgram';
import type {AthleteDossier} from './athleteDossier';
import type {BodyPhysiologyReport} from './musclePhysiology';
import type {TrainingEvent, Workout} from './training';

export const PROGRESSION_ENGINE_VERSION = 'progression-engine-v1';

export type DynamicQuest = {
  id: string;
  category: 'onboarding' | 'consistency' | 'balance' | 'calibration';
  title: string;
  description: string;
  current: number;
  target: number;
  progressPercent: number;
  completed: boolean;
  xpReward: number;
};

export type TrialReminderPolicy = {
  tier: 'free_core' | 'trial_active' | 'pro_active';
  trialEndsAt: string | null;
  reminderLeadDays: 2 | 3;
  reminderScheduledAt: string | null;
  /** Non-predatory invariant: core coaching safety and basic workout logging are NEVER paywalled. */
  coreCoachingUnlocked: true;
  safetyGuardrailsUnlocked: true;
  advancedAnalyticsUnlocked: boolean;
};

export type AthleteProgressionReport = {
  version: typeof PROGRESSION_ENGINE_VERSION;
  asOf: string;
  level: {
    current: number;
    totalXp: number;
    xpIntoLevel: number;
    xpRequiredForNext: number;
    progressPercent: number;
    /** Explicit anti-gaming enforcement summary (max 1 primary session XP credit per calendar day). */
    antiGamingDailyCapAppliedDays: number;
  };
  /** Recovery-safe weekly commitment streak — NEVER breaks on planned rest days! */
  streak: {
    weeklyStreakCount: number;
    declaredDaysPerWeek: number;
    sessionsThisWeek: number;
    restDayProtected: true;
    freezeTokensAvailable: number;
    status: 'on_track' | 'completed_this_week' | 'at_risk' | 'building';
    note: string;
  };
  quests: DynamicQuest[];
  entitlements: TrialReminderPolicy;
};

/** Returns ISO week key "YYYY-Www" for a YYYY-MM-DD local calendar day. */
function isoWeekKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Shifts a YYYY-MM-DD calendar day by deltaDays cleanly in UTC. */
function shiftDay(day: string, deltaDays: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/** Progressive level curve: Lv1->2 = 250 XP, growing smoothly by +100 XP per level. */
function xpToLevel(totalXp: number) {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  let req = 250;
  while (remaining >= req && level < 100) {
    remaining -= req;
    level++;
    req = 250 + (level - 1) * 100;
  }
  return {
    current: level,
    totalXp: Math.max(0, Math.floor(totalXp)),
    xpIntoLevel: remaining,
    xpRequiredForNext: req,
    progressPercent: Math.round((remaining / req) * 100),
  };
}

export function buildEntitlementPolicy(input?: {
  tier?: 'free_core' | 'trial_active' | 'pro_active';
  trialEndsAt?: string | null;
  reminderLeadDays?: 2 | 3;
}): TrialReminderPolicy {
  const tier = input?.tier ?? 'free_core';
  const reminderLeadDays: 2 | 3 = input?.reminderLeadDays === 3 ? 3 : 2;
  const trialEndsAt = tier === 'trial_active' && input?.trialEndsAt ? input.trialEndsAt : null;
  let reminderScheduledAt: string | null = null;
  if (trialEndsAt && Number.isFinite(Date.parse(trialEndsAt))) {
    reminderScheduledAt = new Date(
      Date.parse(trialEndsAt) - reminderLeadDays * 86_400_000,
    ).toISOString();
  }
  return {
    tier,
    trialEndsAt,
    reminderLeadDays,
    reminderScheduledAt,
    coreCoachingUnlocked: true,
    safetyGuardrailsUnlocked: true,
    advancedAnalyticsUnlocked: tier === 'trial_active' || tier === 'pro_active',
  };
}

/**
 * Evaluates recovery-safe weekly streaks, anti-gaming physiological XP, and dynamic dossier-driven quests.
 */
export function buildAthleteProgression(input: {
  dossier: AthleteDossier;
  trainingEvents: readonly TrainingEvent[];
  physiology?: BodyPhysiologyReport;
  asOf?: Date;
  entitlementInput?: Parameters<typeof buildEntitlementPolicy>[0];
}): AthleteProgressionReport {
  const now = input.asOf ?? new Date(input.dossier.asOf);
  const tz = input.dossier.identity.timeZone || 'UTC';
  const today = dayInZone(now, tz);
  const declaredDays = Math.max(1, Math.min(7, input.dossier.constraints.weeklyDays.value ?? 2));

  // Deduplicate latest non-deleted workout revisions
  const latestWorkouts = new Map<string, Workout>();
  for (const ev of input.trainingEvents) {
    if (ev.kind !== 'workout') continue;
    if (ev.deleted) latestWorkouts.delete(ev.id);
    else latestWorkouts.set(ev.id, ev.data as Workout);
  }

  // Group completed workouts by calendar day (anti-gaming: max 1 primary XP credit per calendar day)
  const completedByDay = new Map<string, number>();
  let honestCorrections = 0;

  for (const w of latestWorkouts.values()) {
    const rec = sessionResult(w);
    const day = rec?.day ?? dayInZone(new Date(w.endedAt ?? w.startedAt), w.timeZone || tz);
    if (w.status === 'completed') {
      completedByDay.set(day, (completedByDay.get(day) ?? 0) + 1);
    }
    if (w.notes && /corrected/i.test(w.notes)) {
      honestCorrections++;
    }
  }

  let antiGamingCapDays = 0;
  const distinctCompletedDays = [...completedByDay.keys()].sort();
  for (const count of completedByDay.values()) {
    if (count > 1) antiGamingCapDays++;
  }

  // Count distinct completed training days per ISO week
  const sessionsByWeek = new Map<string, number>();
  for (const day of distinctCompletedDays) {
    const wk = isoWeekKey(day);
    sessionsByWeek.set(wk, (sessionsByWeek.get(wk) ?? 0) + 1);
  }

  const currentWeekKey = isoWeekKey(today);
  const sessionsThisWeek = sessionsByWeek.get(currentWeekKey) ?? 0;

  // Compute consecutive compliant past weeks (recovery-safe: rest days never break streak!)
  let weeklyStreakCount = sessionsThisWeek >= declaredDays ? 1 : 0;
  let cursorDay = shiftDay(today, -7);
  for (let i = 0; i < 52; i++) {
    const wk = isoWeekKey(cursorDay);
    const count = sessionsByWeek.get(wk) ?? 0;
    if (count >= declaredDays) {
      weeklyStreakCount++;
      cursorDay = shiftDay(cursorDay, -7);
    } else {
      break;
    }
  }

  const freezeTokensAvailable = Math.min(2, Math.floor(weeklyStreakCount / 3));
  const status: AthleteProgressionReport['streak']['status'] =
    sessionsThisWeek >= declaredDays
      ? 'completed_this_week'
      : weeklyStreakCount > 0
        ? 'on_track'
        : sessionsThisWeek > 0
          ? 'building'
          : 'at_risk';

  // Compute anti-gaming Mastery XP
  const verifiedMetricsCount = Object.values(input.dossier.measuredResults).filter(
    m => m.freshness !== 'stale' && Number.isFinite(m.rawValue),
  ).length;
  const balancedChecksCount = (input.physiology?.structuralBalance ?? []).filter(
    b => b.status === 'balanced',
  ).length;

  const totalXp =
    distinctCompletedDays.length * 100 +
    verifiedMetricsCount * 150 +
    Math.min(10, honestCorrections) * 25 +
    balancedChecksCount * 60 +
    weeklyStreakCount * 75;

  const level = {
    ...xpToLevel(totalXp),
    antiGamingDailyCapAppliedDays: antiGamingCapDays,
  };

  // Dynamic context-aware quests derived from real athlete dossier & physiology
  const quests: DynamicQuest[] = [];

  // 1. Welcome Calibration Quest (first completed workout + verified baseline)
  const onboardingStepsDone =
    (distinctCompletedDays.length > 0 ? 1 : 0) +
    (verifiedMetricsCount > 0 ? 1 : 0) +
    (input.dossier.goals.length > 0 ? 1 : 0);
  quests.push({
    id: 'quest_welcome_calibration',
    category: 'onboarding',
    title: 'Calibrate Your Engine',
    description: 'Set a goal, log a verified baseline, and complete your first session.',
    current: onboardingStepsDone,
    target: 3,
    progressPercent: Math.round((onboardingStepsDone / 3) * 100),
    completed: onboardingStepsDone >= 3,
    xpReward: 150,
  });

  // 2. Weekly Commitment Quest (matches declared daysPerWeek — never forces daily training)
  const wkProgress = Math.min(declaredDays, sessionsThisWeek);
  quests.push({
    id: 'quest_weekly_commitment',
    category: 'consistency',
    title: `Hit Your ${declaredDays}-Day Week`,
    description: `Complete ${declaredDays} planned or adaptive session(s) this week — rest days stay protected.`,
    current: wkProgress,
    target: declaredDays,
    progressPercent: Math.round((wkProgress / declaredDays) * 100),
    completed: wkProgress >= declaredDays,
    xpReward: 100,
  });

  // 3. Structural Balance Quest (only appears when physiology detects a real antagonist imbalance!)
  const firstImbalance = input.physiology?.structuralBalance.find(b => b.status === 'imbalanced');
  if (firstImbalance) {
    quests.push({
      id: `quest_balance_${firstImbalance.id}`,
      category: 'balance',
      title: `Restore ${firstImbalance.label}`,
      description: firstImbalance.guidance,
      current: 0,
      target: 1,
      progressPercent: 0,
      completed: false,
      xpReward: 120,
    });
  } else {
    quests.push({
      id: 'quest_streak_freeze',
      category: 'consistency',
      title: 'Earn a Travel / Recovery Freeze',
      description: 'Reach 3 consecutive compliant weeks to bank a guilt-free recovery freeze token.',
      current: Math.min(3, weeklyStreakCount),
      target: 3,
      progressPercent: Math.round((Math.min(3, weeklyStreakCount) / 3) * 100),
      completed: weeklyStreakCount >= 3,
      xpReward: 150,
    });
  }

  return {
    version: PROGRESSION_ENGINE_VERSION,
    asOf: now.toISOString(),
    level,
    streak: {
      weeklyStreakCount,
      declaredDaysPerWeek: declaredDays,
      sessionsThisWeek,
      restDayProtected: true,
      freezeTokensAvailable,
      status,
      note:
        status === 'completed_this_week'
          ? `Weekly target hit (${sessionsThisWeek}/${declaredDays} days). Recovery days are protected.`
          : `${sessionsThisWeek}/${declaredDays} sessions logged this week. Planned rest days never break your streak.`,
    },
    quests,
    entitlements: buildEntitlementPolicy(input.entitlementInput),
  };
}
