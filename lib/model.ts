// The model version changes whenever scoring semantics or eligible inputs change.
export const MODEL_VERSION = '4.0-audited-experimental';
export const TRACKING_ONLY_METRICS = new Set([
  'apob','lpa','fasting_insulin','hscrp','hba1c','homocysteine','cystatin_c','ggt',
  'rhr','hrv','bp_systolic','pefr','body_fat','visceral_fat',
]);
export const MODEL_SCORE_MIN = -3;
export const MODEL_SCORE_MAX = 3;
