import type {SupabaseClient} from '@supabase/supabase-js';
import type {WearableSource} from './adapters/healthSync';
import {
  inferCustomExerciseProfile,
  type DetailedEquipmentId,
  type ExerciseDefinition,
  type MovementPattern,
  type MuscleId,
} from './exerciseOntology';
import type {WearableDailySnapshot} from './wearableReadiness';

export type StoredCustomExerciseRow = {
  id: string;
  slug: string;
  name: string;
  pattern: MovementPattern;
  is_compound: boolean;
  primary_muscles: MuscleId[];
  secondary_muscles: MuscleId[];
  required_equipment: DetailedEquipmentId[];
  mode: 'reps' | 'seconds';
  default_amount: number;
  default_rest_seconds: number;
  inferred_profile?: Partial<ExerciseDefinition> | null;
};

export function customRowToDefinition(row: StoredCustomExerciseRow): ExerciseDefinition {
  return inferCustomExerciseProfile({
    id: row.slug,
    name: row.name,
    pattern: row.pattern,
    isCompound: row.is_compound,
    primaryMuscles: row.primary_muscles,
    secondaryMuscles: row.secondary_muscles,
    requiredAll: row.required_equipment,
    mode: row.mode,
    defaultAmount: row.default_amount,
    defaultRestSeconds: row.default_rest_seconds,
  });
}

/** Loads the signed-in athlete's custom exercises safely (degrades gracefully if migration not yet applied in hosted DB). */
export async function readUserCustomExercises(
  client: SupabaseClient,
  userId: string,
): Promise<ExerciseDefinition[]> {
  try {
    const {data, error} = await client
      .from('custom_exercises')
      .select(
        'id,slug,name,pattern,is_compound,primary_muscles,secondary_muscles,required_equipment,mode,default_amount,default_rest_seconds,inferred_profile',
      )
      .eq('user_id', userId)
      .order('created_at', {ascending: false})
      .limit(100);
    if (error || !Array.isArray(data)) return [];
    return (data as StoredCustomExerciseRow[]).map(customRowToDefinition);
  } catch {
    return [];
  }
}

/** Loads the trailing 28 days of smartwatch biometric snapshots for personal baseline & readiness fusion. */
export async function readUserWearableSnapshots(
  client: SupabaseClient,
  userId: string,
): Promise<WearableDailySnapshot[]> {
  try {
    const {data, error} = await client
      .from('wearable_daily_snapshots')
      .select(
        'snapshot_date,source,hrv_rmssd_ms,resting_hr_bpm,total_sleep_minutes,sleep_efficiency_percent,wrist_temp_deviation_c,respiratory_rate_bpm,cardio_load_trimp,vo2_max,gps_run_5k_minutes',
      )
      .eq('user_id', userId)
      .order('snapshot_date', {ascending: false})
      .limit(30);
    if (error || !Array.isArray(data)) return [];
    return data
      .map(row => ({
        date: String(row.snapshot_date),
        source: String(row.source) as WearableSource,
        hrvRmssdMs: row.hrv_rmssd_ms == null ? undefined : Number(row.hrv_rmssd_ms),
        hrvStatistic: row.hrv_rmssd_ms == null ? undefined : ('rmssd' as const),
        restingHeartRateBpm: row.resting_hr_bpm == null ? undefined : Number(row.resting_hr_bpm),
        totalSleepMinutes:
          row.total_sleep_minutes == null ? undefined : Number(row.total_sleep_minutes),
        sleepEfficiencyPercent:
          row.sleep_efficiency_percent == null ? undefined : Number(row.sleep_efficiency_percent),
        wristTempDeviationC:
          row.wrist_temp_deviation_c == null ? undefined : Number(row.wrist_temp_deviation_c),
        respiratoryRateBpm:
          row.respiratory_rate_bpm == null ? undefined : Number(row.respiratory_rate_bpm),
        cardioLoadTrimp:
          row.cardio_load_trimp == null ? undefined : Number(row.cardio_load_trimp),
        vo2Max: row.vo2_max == null ? undefined : Number(row.vo2_max),
        gpsRun5kMinutes:
          row.gps_run_5k_minutes == null ? undefined : Number(row.gps_run_5k_minutes),
      }))
      .reverse();
  } catch {
    return [];
  }
}
