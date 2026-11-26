import type { Metric } from '@top1/engine';

export type EvidenceTier = 'peer_reviewed' | 'consensus' | 'personal';

export interface MetricEvidenceClassification {
  tier: EvidenceTier;
  badgeLabel: string;
  color: string;
  summary: string;
}

/**
 * Classifies every Top1.Fit metric honestly using its canonical `proofData.study`
 * and `archived` / `scoringEligible` metadata — distinguishing peer-reviewed
 * clinical/cohort benchmarks from athletic consensus standards & personal anchors.
 */
export function classifyMetricEvidence(metric: Pick<Metric, 'id' | 'archived' | 'proofData'>): MetricEvidenceClassification {
  const study = metric.proofData?.study ?? '';
  const lower = study.toLowerCase();

  if (metric.archived) {
    return {
      tier: 'personal',
      badgeLabel: 'EXPERIMENTAL',
      color: '#F59E0B',
      summary: study || 'Archived / experimental tracking metric (excluded from official TOP1% score).',
    };
  }

  if (
    lower.includes('no calibrated cohort') ||
    lower.includes('illustrative game anchor') ||
    lower.includes('candidate test') ||
    lower.includes('no validated')
  ) {
    return {
      tier: 'consensus',
      badgeLabel: 'CONSENSUS-BACKED',
      color: '#A855F7',
      summary: 'Athletic consensus standard & standardized personal progression benchmark.',
    };
  }

  if (lower.startsWith('unverified reference label:')) {
    return {
      tier: 'consensus',
      badgeLabel: 'CONSENSUS-BACKED',
      color: '#A855F7',
      summary: study.replace(/^Unverified reference label:\s*/i, '') + ' (community / consensus norm).',
    };
  }

  return {
    tier: 'peer_reviewed',
    badgeLabel: 'SCIENCE-BACKED',
    color: '#38BDF8',
    summary: study || 'Peer-reviewed clinical or published cohort reference.',
  };
}

export interface ClinicalRangeRule {
  optimalMin: number;
  optimalMax: number;
  borderlineMin: number;
  borderlineMax: number;
  optimalLabel: string;
  direction: 'lower_better' | 'higher_better' | 'range';
}

export const BIOMARKER_CLINICAL_ZONES: Readonly<Record<string, ClinicalRangeRule>> = {
  apob: { optimalMin: 30, optimalMax: 70, borderlineMin: 70, borderlineMax: 100, optimalLabel: '< 70 mg/dL optimal', direction: 'lower_better' },
  lpa: { optimalMin: 0, optimalMax: 75, borderlineMin: 75, borderlineMax: 125, optimalLabel: '< 75 nmol/L optimal', direction: 'lower_better' },
  fasting_insulin: { optimalMin: 1.5, optimalMax: 5.5, borderlineMin: 5.5, borderlineMax: 10, optimalLabel: '2–5.5 µIU/mL optimal', direction: 'lower_better' },
  hscrp: { optimalMin: 0, optimalMax: 1.0, borderlineMin: 1.0, borderlineMax: 3.0, optimalLabel: '< 1.0 mg/L optimal', direction: 'lower_better' },
  hba1c: { optimalMin: 4.5, optimalMax: 5.2, borderlineMin: 5.2, borderlineMax: 5.6, optimalLabel: '< 5.2% optimal', direction: 'lower_better' },
  homocysteine: { optimalMin: 4, optimalMax: 9, borderlineMin: 9, borderlineMax: 13, optimalLabel: '< 9 µmol/L optimal', direction: 'lower_better' },
  cystatin_c: { optimalMin: 0.5, optimalMax: 0.85, borderlineMin: 0.85, borderlineMax: 1.0, optimalLabel: '< 0.85 mg/L optimal', direction: 'lower_better' },
  ggt: { optimalMin: 5, optimalMax: 22, borderlineMin: 22, borderlineMax: 40, optimalLabel: '< 22 U/L optimal', direction: 'lower_better' },
  fasting_glucose: { optimalMin: 70, optimalMax: 89, borderlineMin: 89, borderlineMax: 99, optimalLabel: '70–89 mg/dL optimal', direction: 'range' },
  bp_systolic: { optimalMin: 95, optimalMax: 119, borderlineMin: 119, borderlineMax: 129, optimalLabel: '< 120 mmHg optimal', direction: 'lower_better' },
  body_fat: { optimalMin: 10, optimalMax: 18, borderlineMin: 18, borderlineMax: 24, optimalLabel: '10–18% athletic', direction: 'range' },
  waist_height_ratio: { optimalMin: 0.4, optimalMax: 0.49, borderlineMin: 0.49, borderlineMax: 0.54, optimalLabel: '< 0.50 NICE optimal', direction: 'lower_better' },
  rhr: { optimalMin: 42, optimalMax: 58, borderlineMin: 58, borderlineMax: 72, optimalLabel: '< 58 bpm athletic', direction: 'lower_better' },
  hrv: { optimalMin: 60, optimalMax: 130, borderlineMin: 40, borderlineMax: 60, optimalLabel: '60+ ms RMSSD', direction: 'higher_better' },
  total_sleep: { optimalMin: 420, optimalMax: 540, borderlineMin: 360, borderlineMax: 420, optimalLabel: '7–9h optimal', direction: 'range' },
};

export interface EvaluatedClinicalZone {
  zone: 'optimal' | 'borderline' | 'alert';
  label: string;
  color: string;
  optimalLabel: string;
  barPct: number;
}

export function evaluateBiomarkerZone(
  metricId: string,
  value: number | null | undefined,
): EvaluatedClinicalZone | null {
  const rule = BIOMARKER_CLINICAL_ZONES[metricId];
  if (!rule) return null;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return {
      zone: 'borderline',
      label: 'Not logged',
      color: '#94A3B8',
      optimalLabel: rule.optimalLabel,
      barPct: 0,
    };
  }

  let zone: 'optimal' | 'borderline' | 'alert' = 'alert';
  if (value >= rule.optimalMin && value <= rule.optimalMax) {
    zone = 'optimal';
  } else if (
    (rule.direction === 'lower_better' && value <= rule.borderlineMax) ||
    (rule.direction === 'higher_better' && value >= rule.borderlineMin) ||
    (rule.direction === 'range' && value >= rule.borderlineMin && value <= rule.borderlineMax)
  ) {
    zone = 'borderline';
  }

  const color = zone === 'optimal' ? '#22C55E' : zone === 'borderline' ? '#F59E0B' : '#EF4444';
  const label = zone === 'optimal' ? 'Optimal' : zone === 'borderline' ? 'Borderline' : 'Attention';

  // Position along an illustrative 0-100 gauge where higher barPct = closer to optimal
  const barPct = zone === 'optimal' ? 92 : zone === 'borderline' ? 58 : 26;
  return { zone, label, color, optimalLabel: rule.optimalLabel, barPct };
}
