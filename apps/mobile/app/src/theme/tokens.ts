export const TEXT_SIZES = {
  xxsm: 10.5,
  xsm: 12,
  sm: 14,
  md: 16,
  reg: 17,
  lg: 20,
  xl: 24,
  xxl: 28,
  xlg: 32,
  hero: 36,
  xxlg: 42,
} as const;

export type TextSizeKey = keyof typeof TEXT_SIZES;

export const SPACING = {
  quarter: 4,
  half: 8,
  std: 16,
  top: 24,
  double: 32,
  quad: 64,
} as const;

export const RADII = {
  sm: 10,
  input: 12,
  card: 16,
  cardLarge: 24,
  sheet: 32,
  pill: 9999,
} as const;

export const LAYOUT = {
  navbarHeight: 62,
  headerHeight: 56,
  postMediaLimit: 8,
  postCaptionMaxLength: 120,
} as const;

export function getInnerRadius(outerRadius: number, padding: number): number {
  return Math.max(0, outerRadius - padding);
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(89, 185, 249, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
