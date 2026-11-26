export type WeightUnit = 'lbs' | 'kg';
export type MeasureUnit = 'in' | 'cm';

const KG_TO_LBS = 2.2046226218;
const CM_TO_IN = 0.3937007874;

export function kgToLbs(kg: number): number {
  return Number((kg * KG_TO_LBS).toFixed(1));
}

export function lbsToKg(lbs: number): number {
  return Number((lbs / KG_TO_LBS).toFixed(2));
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  const value = unit === 'lbs' ? kgToLbs(kg) : Number(kg.toFixed(1));
  return `${value} ${unit}`;
}

export function cmToIn(cm: number): number {
  return Number((cm * CM_TO_IN).toFixed(1));
}

export function inToCm(inches: number): number {
  return Number((inches / CM_TO_IN).toFixed(1));
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function xpToLevel(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safeXp / 150)) + 1;
  const floorXp = 150 * Math.pow(level - 1, 2);
  const nextXp = 150 * Math.pow(level, 2);
  const span = Math.max(1, nextXp - floorXp);
  return {
    level,
    currentLevelXp: safeXp - floorXp,
    nextLevelXp: span,
    progress: Number(Math.min(1, (safeXp - floorXp) / span).toFixed(3)),
  };
}
