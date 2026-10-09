// Legacy experimental coefficients: excluded from the audited production index.
// Raw-measurement correlations supplied in the V2 brief. Cohort validation
// remains pending; the unlisted-pair fallback is a model assumption.
export const pairwiseCorrelations: Readonly<Record<string, number>> = {
  'deadlift_1rm|squat_1rm': .68,
  'vo2_max|zone2_power': .72,
  'apob|lpa': .35,
  'hrv|rhr': -.55,
};
export function getPairwiseCorrelation(metricA: string, metricB: string): number {
  if (metricA === metricB) return 1;
  return pairwiseCorrelations[[metricA, metricB].sort().join('|')] ?? .15;
}

export function getScoredCorrelation(metricA: string, metricB: string, polarityA: 1 | -1, polarityB: 1 | -1): number {
  const key = [metricA, metricB].sort().join('|');
  // Listed coefficients are raw: transform both signs to score orientation.
  // The .15 fallback is already in score space (positive shared performance).
  return key in pairwiseCorrelations ? getPairwiseCorrelation(metricA, metricB) * polarityA * polarityB : getPairwiseCorrelation(metricA, metricB);
}
