import { cdf, clamp } from './engine';

/** Illustrative placement in an assumed standard-normal model, never a real cohort rank. */
export function illustrativeTopPercent(z: number): number {
  if (!Number.isFinite(z)) throw new RangeError('Ranking requires finite model units.');
  return Math.round((1 - cdf(clamp(z, -3, 3))) * 1000) / 10;
}
export function rankingLabel(z: number): string {
  return `Top ${illustrativeTopPercent(z).toFixed(1).replace(/\.0$/, '')}%`;
}
