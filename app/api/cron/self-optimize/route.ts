import {NextResponse} from 'next/server';
import {
  DEFAULT_POPULATION_PARAMS,
  runSelfOptimizationCycle,
  SELF_OPTIMIZATION_VERSION,
  type ProspectiveCohortRecord,
} from '@/lib/selfOptimization';
import {getSupabaseAdmin} from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

/**
 * Weekly self-optimization evaluation endpoint (triggered by Vercel Cron with CRON_SECRET).
 * Reads matured consenting prospective goal forecasts, runs chronological fit/holdout Brier
 * evaluation, and reports whether parameters should promote, hold, or roll back.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return reply({error: 'Unauthorized cron request.'}, 401);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return reply({
      version: SELF_OPTIMIZATION_VERSION,
      status: 'skipped',
      reason: 'Service role client not configured in this environment.',
    });
  }

  try {
    const {data, error} = await admin
      .from('goal_forecast_receipts')
      .select('user_id,metric_id,model_version,issued_at,unadjusted_probability,outcome_status')
      .eq('shared', true)
      .order('issued_at', {ascending: true})
      .limit(2000);

    if (error) {
      return reply({
        version: SELF_OPTIMIZATION_VERSION,
        status: 'unavailable',
        reason: 'Could not read prospective forecast receipts.',
      }, 503);
    }

    const records: ProspectiveCohortRecord[] = (data ?? []).map(row => ({
      athleteId: String(row.user_id),
      metric: String(row.metric_id),
      modelVersion: String(row.model_version ?? DEFAULT_POPULATION_PARAMS.modelVersion),
      issuedAt: String(row.issued_at),
      predictedProbability: Number(row.unadjusted_probability ?? 0.5),
      baselineProbability: Number(row.unadjusted_probability ?? 0.5),
      reachedOnTime:
        row.outcome_status === 'reached'
          ? true
          : row.outcome_status === 'missed'
            ? false
            : null,
    }));

    const result = runSelfOptimizationCycle({records});
    return reply(result);
  } catch {
    return reply({error: 'Self-optimization cycle failed.'}, 500);
  }
}
