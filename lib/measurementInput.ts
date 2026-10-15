/** Normalize decimal input only; persisted values remain ordinary numbers. */
export function normalizeNumericInput(raw:string):string{return raw.trim().replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0)).replace(/[٫,]/g,'.').replace(/−/g,'-');}
/** Parse a human-entered decimal without treating blank or malformed text as zero. */
export function parseMeasurementInput(raw: string, multiplier = 1): string {
  const text = normalizeNumericInput(raw);
  if (!text) return '';
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return 'NaN';
  const value = Number(text) * multiplier;
  return Number.isFinite(value) ? String(value) : 'NaN';
}
