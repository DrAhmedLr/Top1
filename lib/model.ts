// The model version changes whenever scoring semantics or eligible inputs change.
export const MODEL_VERSION = '5.0-triad-experimental';
export const TRACKING_ONLY_METRICS = new Set([
  'apob','lpa','fasting_insulin','hscrp','hba1c','homocysteine','cystatin_c','ggt',
  'waist_height_ratio','fasting_glucose','sauna_minutes','cold_plunge_minutes','thermal_hrv_rebound','reaction_time','rhr','hrv','bp_systolic','pefr','body_fat','visceral_fat',
]);
export const MODEL_SCORE_MIN = -3;
export const MODEL_SCORE_MAX = 3;
