// The model version changes whenever scoring semantics or eligible inputs change.
export const MODEL_VERSION = '6.3-focused16-experimental';
// Prior V2-signed snapshots remain dated historical calculations, never current reassessments.
export const SUPPORTED_SUMMARY_VERSIONS = new Set([MODEL_VERSION, '6.2-friend2022-experimental', '6.1-source-gated-experimental', '6.0-capacity-experimental', '5.1-protocol-experimental','5.0-triad-experimental']);
export const TRACKING_ONLY_METRICS = new Set([
  'apob','lpa','fasting_insulin','hscrp','hba1c','homocysteine','cystatin_c','ggt',
  'waist_height_ratio','fasting_glucose','sauna_minutes','cold_plunge_minutes','thermal_hrv_rebound','reaction_time','rhr','hrv','bp_systolic','pefr','body_fat','visceral_fat',
  'total_sleep','sleep_efficiency','circadian_regularity','zone2_power','hrr_1min','grip_combined','sprint_10m',
]);
export const MODEL_SCORE_MIN = -3;
export const MODEL_SCORE_MAX = 3;
export const MODEL_POINTS_MIN = 50 + 15 * MODEL_SCORE_MIN;
export const MODEL_POINTS_MAX = 50 + 15 * MODEL_SCORE_MAX;
