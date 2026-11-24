import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {readUserWearableSnapshots} from '@/lib/customExercisesServer';
import {validApiOrigin} from '@/lib/nativeApi';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  evaluateWearableReadiness,
  normalizeWearableSnapshot,
  type WearableDailySnapshot,
} from '@/lib/wearableReadiness';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

/**
 * GET: Returns the athlete's trailing 28-day smartwatch snapshots + personal baseline readiness signal.
 */
export async function GET(request: Request) {
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to view smartwatch readiness.'}, 401);

  const snapshots = await readUserWearableSnapshots(client, user.id);
  const readiness = evaluateWearableReadiness(snapshots);
  return reply({count: snapshots.length, snapshots, readiness});
}

/**
 * POST: Ingests 1..30 normalized smartwatch daily snapshots (Apple Watch / HealthKit,
 * Wear OS / Health Connect, Google Health, Garmin, Oura, WHOOP, Polar, Coros, Fitbit),
 * enforces RMSSD-only HRV + physiological bounds, persists to Supabase, and returns
 * the updated personal rolling baseline & autonomic readiness signal.
 */
export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply({error: 'Invalid origin.'}, 403);
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to sync smartwatch data.'}, 401);

  try {
    const raw = await request.text();
    if (raw.length > 32768) return reply({error: 'Payload too large.'}, 413);
    const body = JSON.parse(raw) as {snapshots?: unknown[]; snapshot?: unknown};
    const list = Array.isArray(body.snapshots)
      ? body.snapshots
      : body.snapshot
        ? [body.snapshot]
        : [];
    if (list.length === 0 || list.length > 30) {
      return reply({error: 'Provide between 1 and 30 smartwatch daily snapshots.'}, 400);
    }

    const normalized: WearableDailySnapshot[] = list.map(normalizeWearableSnapshot);
    const rows = normalized.map(s => ({
      user_id: user.id,
      snapshot_date: s.date,
      source: s.source,
      hrv_rmssd_ms: s.hrvRmssdMs ?? null,
      resting_hr_bpm: s.restingHeartRateBpm ?? null,
      total_sleep_minutes: s.totalSleepMinutes ?? null,
      sleep_efficiency_percent: s.sleepEfficiencyPercent ?? null,
      wrist_temp_deviation_c: s.wristTempDeviationC ?? null,
      respiratory_rate_bpm: s.respiratoryRateBpm ?? null,
      cardio_load_trimp: s.cardioLoadTrimp ?? null,
      vo2_max: s.vo2Max ?? null,
      gps_run_5k_minutes: s.gpsRun5kMinutes ?? null,
    }));

    const {error} = await client
      .from('wearable_daily_snapshots')
      .upsert(rows, {onConflict: 'user_id,snapshot_date'});

    if (error) {
      return reply({error: 'Could not save smartwatch snapshots.'}, 503);
    }

    const updatedHistory = await readUserWearableSnapshots(client, user.id);
    const readiness = evaluateWearableReadiness(updatedHistory);
    return reply({
      synced: normalized.length,
      readiness,
    });
  } catch (error) {
    return reply(
      {error: error instanceof Error ? error.message : 'Invalid smartwatch snapshot payload.'},
      400,
    );
  }
}
