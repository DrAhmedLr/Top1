/** Parse a human-entered decimal without treating blank or malformed text as zero. */
export function parseMeasurementInput(raw: string, multiplier = 1): string {
  const text = raw.trim().replace(',', '.');
  if (!text) return '';
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return 'NaN';
  const value = Number(text) * multiplier;
  return Number.isFinite(value) ? String(value) : 'NaN';
}
