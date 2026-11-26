import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  DEFAULT_POPULATION_PARAMS,
  runSelfOptimizationCycle,
  SELF_OPTIMIZATION_VERSION,
  type ProspectiveCohortRecord,
} from '@/lib/selfOptimization';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

function secretsMatch(expected: string, provided: string | null): boolean {
  if (!expected || !provided) return false;
  const expectedDigest = crypto.createHash('sha256').update(`Bearer ${expected}`).digest();
  const providedDigest = crypto.createHash('sha256').update(provided).digest();
  return crypto.timingSafeEqual(expectedDigest, providedDigest);
}

/**
 * Weekly self-optimization evaluation endpoint (triggered by Vercel Cron with CRON_SECRET).
 * Reads matured consenting prospective goal forecasts via the service-only RPC, runs
 * chronological fit/holdout Brier evaluation, and persists the evaluation audit record.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  const authHeader = request.headers.get('authorization');
  if (!secretsMatch(secret, authHeader)) {
    return reply({ error: 'Unauthorized cron request.' }, 401);
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
    const { data, error } = await admin.rpc('read_self_optimization_records', {
      p_limit: 2000,
    });

    if (error) {
      return reply(
        {
          version: SELF_OPTIMIZATION_VERSION,
          status: 'unavailable',
          reason: 'Could not read prospective forecast receipts.',
        },
        503
      );
    }

    const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    const records: ProspectiveCohortRecord[] = rows.map((row) => ({
      athleteId: String(row.user_id),
      metric: String(row.metric),
      modelVersion: String(row.model_version ?? DEFAULT_POPULATION_PARAMS.modelVersion),
      issuedAt: String(row.issued_at),
      predictedProbability: Number(row.issued_probability ?? row.probability ?? 0.5),
      baselineProbability: Number(row.probability ?? row.issued_probability ?? 0.5),
      reachedOnTime:
        typeof row.reached === 'boolean' ? row.reached : null,
    }));

    const result = runSelfOptimizationCycle({ records });

    await admin.rpc('record_self_optimization_run', {
      p_version: SELF_OPTIMIZATION_VERSION,
      p_decision: result.decision,
      p_sample_size: records.length,
      p_result_json: result,
    });

    return reply(result);
  } catch {
    return reply({ error: 'Self-optimization cycle failed.' }, 500);
  }
}
