import type {WearableSource} from './adapters/healthSync';

export const WEARABLE_READINESS_VERSION = 'wearable-readiness-v1';

export type WearableDailySnapshot = {
  /** Local YYYY-MM-DD calendar date of the morning/daily summary. */
  date: string;
  source: WearableSource;
  /** Strictly nocturnal or morning RMSSD in milliseconds (SDNN is rejected). */
  hrvRmssdMs?: number;
  hrvStatistic?: 'rmssd' | 'sdnn';
  /** Resting heart rate in beats per minute. */
  restingHeartRateBpm?: number;
  /** Total sleep duration in minutes. */
  totalSleepMinutes?: number;
  /** Sleep efficiency 0–100%. */
  sleepEfficiencyPercent?: number;
  /** Skin/wrist temperature deviation vs personal baseline in Celsius (e.g., +0.7°C). */
  wristTempDeviationC?: number;
  /** Sleeping respiratory rate in breaths/min. */
  respiratoryRateBpm?: number;
  /** Daily cardiovascular strain / TRIMP score (0–400) or derived from active minutes & HR. */
  cardioLoadTrimp?: number;
  /** Optional smartwatch-estimated VO2 max (ml/kg/min). */
  vo2Max?: number;
  /** Optional GPS-verified 5 km run time in minutes. */
  gpsRun5kMinutes?: number;
};

export type WearableReadinessSignal = {
  version: typeof WEARABLE_READINESS_VERSION;
  hasWearableData: boolean;
  latestDate: string | null;
  source: WearableSource | null;
  baselineDaysUsed: number;
  personalBaselines: {
    hrvRmssdMean: number | null;
    hrvRmssdSd: number | null;
    rhrMeanBpm: number | null;
  };
  deltas: {
    /** Standardized z-score vs athlete's own rolling HRV baseline (negative = autonomic stress). */
    hrvZScore: number | null;
    /** Beats/min above or below athlete's own rolling RHR baseline (positive = elevated strain). */
    rhrDeltaBpm: number | null;
    /** Trailing 3-day sleep debt relative to 450 min/night target. */
    sleepDebtMinutes3d: number | null;
    /** Acute (7d) to Chronic (28d) cardiovascular workload ratio. */
    cardioAcwr: number | null;
    wristTempDeviationC: number | null;
  };
  /** Multiplier applied to systemic readiness (0.70..1.10). */
  readinessMultiplier: number;
  /** Multiplier applied to muscle recovery tau hours (0.85..1.35; >1 means slower recovery). */
  recoveryTauModifier: number;
  /** Multiplier applied to effective MRV ceiling (0.80..1.05). */
  mrvModifier: number;
  /** True when biomarkers indicate acute illness, fever, or significant autonomic overreaching. */
  illnessOrOverreachingFlag: boolean;
  signals: string[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates and sanitizes an incoming smartwatch daily snapshot.
 * Enforces RMSSD-only HRV semantics and physiological range bounds so corrupt watch packets never poison readiness.
 */
export function normalizeWearableSnapshot(raw: unknown): WearableDailySnapshot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RangeError('Invalid smartwatch payload.');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.date !== 'string' || !DATE_RE.test(r.date)) {
    throw new RangeError('Smartwatch snapshot requires a valid YYYY-MM-DD date.');
  }
  const validSources = new Set<string>([
    'apple_health',
    'apple_watch',
    'health_connect',
    'google_health',
    'garmin',
    'oura',
    'whoop',
    'polar',
    'coros',
    'fitbit',
    'quest_diagnostics',
  ]);
  if (typeof r.source !== 'string' || !validSources.has(r.source)) {
    throw new RangeError('Unsupported smartwatch data source.');
  }

  const out: WearableDailySnapshot = {
    date: r.date,
    source: r.source as WearableSource,
  };

  if (r.hrvRmssdMs !== undefined) {
    if (r.hrvStatistic === 'sdnn') {
      throw new RangeError('HRV requires RMSSD; SDNN cannot be mixed into RMSSD readiness.');
    }
    const v = Number(r.hrvRmssdMs);
    if (!Number.isFinite(v) || v < 5 || v > 300) {
      throw new RangeError('Invalid HRV RMSSD value (expected 5–300 ms).');
    }
    out.hrvRmssdMs = Number(v.toFixed(1));
    out.hrvStatistic = 'rmssd';
  }
  if (r.restingHeartRateBpm !== undefined) {
    const v = Number(r.restingHeartRateBpm);
    if (!Number.isFinite(v) || v < 28 || v > 130) {
      throw new RangeError('Invalid resting heart rate (expected 28–130 bpm).');
    }
    out.restingHeartRateBpm = Number(v.toFixed(1));
  }
  if (r.totalSleepMinutes !== undefined) {
    const v = Number(r.totalSleepMinutes);
    if (!Number.isFinite(v) || v < 60 || v > 960) {
      throw new RangeError('Invalid sleep duration (expected 60–960 min).');
    }
    out.totalSleepMinutes = Math.round(v);
  }
  if (r.sleepEfficiencyPercent !== undefined) {
    const v = Number(r.sleepEfficiencyPercent);
    if (!Number.isFinite(v) || v < 30 || v > 100) {
      throw new RangeError('Invalid sleep efficiency (expected 30–100%).');
    }
    out.sleepEfficiencyPercent = Number(v.toFixed(1));
  }
  if (r.wristTempDeviationC !== undefined) {
    const v = Number(r.wristTempDeviationC);
    if (!Number.isFinite(v) || v < -3 || v > 4) {
      throw new RangeError('Invalid wrist temperature deviation (expected -3..+4 °C).');
    }
    out.wristTempDeviationC = Number(v.toFixed(2));
  }
  if (r.respiratoryRateBpm !== undefined) {
    const v = Number(r.respiratoryRateBpm);
    if (!Number.isFinite(v) || v < 6 || v > 35) {
      throw new RangeError('Invalid respiratory rate (expected 6–35 brpm).');
    }
    out.respiratoryRateBpm = Number(v.toFixed(1));
  }
  if (r.cardioLoadTrimp !== undefined) {
    const v = Number(r.cardioLoadTrimp);
    if (!Number.isFinite(v) || v < 0 || v > 600) {
      throw new RangeError('Invalid cardio load TRIMP (expected 0–600).');
    }
    out.cardioLoadTrimp = Number(v.toFixed(1));
  }
  if (r.vo2Max !== undefined) {
    const v = Number(r.vo2Max);
    if (!Number.isFinite(v) || v < 15 || v > 95) {
      throw new RangeError('Invalid VO2 max estimate (expected 15–95).');
    }
    out.vo2Max = Number(v.toFixed(1));
  }
  if (r.gpsRun5kMinutes !== undefined) {
    const v = Number(r.gpsRun5kMinutes);
    if (!Number.isFinite(v) || v < 12 || v > 90) {
      throw new RangeError('Invalid GPS 5 km run duration (expected 12–90 min).');
    }
    out.gpsRun5kMinutes = Number(v.toFixed(2));
  }

  return out;
}

function meanAndSd(values: number[]): {mean: number; sd: number} | null {
  if (values.length === 0) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / Math.max(1, values.length);
  return {mean, sd: Math.sqrt(variance)};
}

/**
 * Evaluates smartwatch biometric streams relative to the athlete's OWN rolling 28-day baseline
 * (never relying on misleading population cutoffs for RHR or HRV).
 */
export function evaluateWearableReadiness(
  snapshots: readonly WearableDailySnapshot[],
  asOfDay?: string,
): WearableReadinessSignal {
  // Deduplicate by date (latest entry wins), filter future dates, sort chronologically
  const byDate = new Map<string, WearableDailySnapshot>();
  for (const s of snapshots) {
    if (asOfDay && s.date > asOfDay) continue;
    byDate.set(s.date, s);
  }
  const ordered = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const recent = ordered.slice(-28);

  if (recent.length === 0) {
    return {
      version: WEARABLE_READINESS_VERSION,
      hasWearableData: false,
      latestDate: null,
      source: null,
      baselineDaysUsed: 0,
      personalBaselines: {hrvRmssdMean: null, hrvRmssdSd: null, rhrMeanBpm: null},
      deltas: {
        hrvZScore: null,
        rhrDeltaBpm: null,
        sleepDebtMinutes3d: null,
        cardioAcwr: null,
        wristTempDeviationC: null,
      },
      readinessMultiplier: 1.0,
      recoveryTauModifier: 1.0,
      mrvModifier: 1.0,
      illnessOrOverreachingFlag: false,
      signals: [],
    };
  }

  const latest = recent[recent.length - 1];
  const prior = recent.slice(0, -1);

  const priorHrvs = prior
    .map(s => s.hrvRmssdMs)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const priorRhrs = prior
    .map(s => s.restingHeartRateBpm)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  const hrvBase = priorHrvs.length >= 5 ? meanAndSd(priorHrvs) : null;
  const rhrBase = priorRhrs.length >= 5 ? meanAndSd(priorRhrs) : null;

  const hrvZScore =
    hrvBase && latest.hrvRmssdMs !== undefined
      ? Number(((latest.hrvRmssdMs - hrvBase.mean) / Math.max(3, hrvBase.sd)).toFixed(2))
      : null;

  const rhrDeltaBpm =
    rhrBase && latest.restingHeartRateBpm !== undefined
      ? Number((latest.restingHeartRateBpm - rhrBase.mean).toFixed(1))
      : null;

  // Trailing 3-day sleep debt relative to 450 min (7.5h)
  const last3Sleep = recent
    .slice(-3)
    .map(s => s.totalSleepMinutes)
    .filter((v): v is number => typeof v === 'number');
  const sleepDebtMinutes3d =
    last3Sleep.length > 0
      ? Math.max(0, last3Sleep.reduce((debt, mins) => debt + Math.max(0, 450 - mins), 0))
      : null;

  // Acute (7d) : Chronic (28d) cardio TRIMP ratio
  const trimpSeries = recent
    .map(s => s.cardioLoadTrimp)
    .filter((v): v is number => typeof v === 'number');
  let cardioAcwr: number | null = null;
  if (trimpSeries.length >= 7) {
    const acute = trimpSeries.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const chronic = trimpSeries.reduce((a, b) => a + b, 0) / trimpSeries.length;
    if (chronic >= 10) {
      cardioAcwr = Number((acute / chronic).toFixed(2));
    }
  }

  const wristTempDeviationC = latest.wristTempDeviationC ?? null;

  let readinessMult = 1.0;
  let tauMod = 1.0;
  let mrvMod = 1.0;
  const signals: string[] = [];

  // 1. Personal HRV z-score modulation
  if (hrvZScore !== null) {
    if (hrvZScore <= -1.5) {
      readinessMult -= 0.14;
      tauMod += 0.18;
      mrvMod -= 0.1;
      signals.push(`HRV RMSSD suppressed (${hrvZScore} SD below your personal baseline).`);
    } else if (hrvZScore <= -0.75) {
      readinessMult -= 0.06;
      tauMod += 0.08;
      signals.push(`HRV RMSSD slightly below personal baseline (${hrvZScore} SD).`);
    } else if (hrvZScore >= 0.75) {
      readinessMult += 0.05;
      tauMod -= 0.07;
      mrvMod += 0.03;
      signals.push(`HRV RMSSD elevated (+${hrvZScore} SD above personal baseline) — strong parasympathetic readiness.`);
    }
  }

  // 2. Personal RHR delta modulation
  if (rhrDeltaBpm !== null) {
    if (rhrDeltaBpm >= 5) {
      readinessMult -= 0.12;
      tauMod += 0.15;
      mrvMod -= 0.08;
      signals.push(`Resting HR elevated +${rhrDeltaBpm} bpm above your rolling baseline.`);
    } else if (rhrDeltaBpm >= 3) {
      readinessMult -= 0.05;
      tauMod += 0.06;
      signals.push(`Resting HR slightly elevated (+${rhrDeltaBpm} bpm).`);
    } else if (rhrDeltaBpm <= -2) {
      readinessMult += 0.03;
      tauMod -= 0.04;
    }
  }

  // 3. Sleep duration + efficiency modulation
  if (latest.totalSleepMinutes !== undefined) {
    if (latest.totalSleepMinutes < 360) {
      readinessMult -= 0.1;
      tauMod += 0.12;
      mrvMod -= 0.06;
      signals.push(`Short sleep (${latest.totalSleepMinutes} min) reduces recovery rate today.`);
    } else if (latest.totalSleepMinutes < 420) {
      readinessMult -= 0.04;
      tauMod += 0.05;
    } else if (latest.totalSleepMinutes >= 450 && (latest.sleepEfficiencyPercent ?? 88) >= 85) {
      readinessMult += 0.04;
      tauMod -= 0.05;
    }
  }
  if (sleepDebtMinutes3d !== null && sleepDebtMinutes3d >= 180) {
    readinessMult -= 0.06;
    tauMod += 0.08;
    signals.push(`Accumulated 3-day sleep debt (${sleepDebtMinutes3d} min).`);
  }

  // 4. Wrist temperature spike (illness / systemic inflammation guard)
  if (wristTempDeviationC !== null && wristTempDeviationC >= 0.5) {
    readinessMult -= 0.16;
    tauMod += 0.2;
    mrvMod -= 0.12;
    signals.push(`Elevated wrist temperature (+${wristTempDeviationC}°C) — possible illness or acute strain.`);
  }

  // 5. Smartwatch cardio ACWR spike
  if (cardioAcwr !== null && cardioAcwr > 1.35) {
    readinessMult -= 0.08;
    tauMod += 0.1;
    mrvMod -= 0.08;
    signals.push(`Acute smartwatch cardio load spike (ACWR ${cardioAcwr}) — trimming lifting MRV ceiling to avoid overreaching.`);
  }

  const illnessOrOverreachingFlag = Boolean(
    (wristTempDeviationC !== null && wristTempDeviationC >= 0.6) ||
      (rhrDeltaBpm !== null && rhrDeltaBpm >= 6 && hrvZScore !== null && hrvZScore <= -1.5),
  );

  return {
    version: WEARABLE_READINESS_VERSION,
    hasWearableData: true,
    latestDate: latest.date,
    source: latest.source,
    baselineDaysUsed: prior.length,
    personalBaselines: {
      hrvRmssdMean: hrvBase ? Number(hrvBase.mean.toFixed(1)) : null,
      hrvRmssdSd: hrvBase ? Number(hrvBase.sd.toFixed(1)) : null,
      rhrMeanBpm: rhrBase ? Number(rhrBase.mean.toFixed(1)) : null,
    },
    deltas: {
      hrvZScore,
      rhrDeltaBpm,
      sleepDebtMinutes3d,
      cardioAcwr,
      wristTempDeviationC,
    },
    readinessMultiplier: Number(Math.max(0.7, Math.min(1.1, readinessMult)).toFixed(3)),
    recoveryTauModifier: Number(Math.max(0.85, Math.min(1.35, tauMod)).toFixed(3)),
    mrvModifier: Number(Math.max(0.8, Math.min(1.05, mrvMod)).toFixed(3)),
    illnessOrOverreachingFlag,
    signals,
  };
}
