import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/accountSession';
import { addDays, dayInZone } from '@/lib/adaptiveProgram';
import { CoachSnapshotChanged, readAccountCoachDecision } from '@/lib/coachServer';
import { readUserCustomExercises, readUserWearableSnapshots } from '@/lib/customExercisesServer';
import { datedProgram } from '@/lib/datedProgram';
import { evaluate } from '@/lib/engine';
import { buildBodyPhysiologyReport } from '@/lib/musclePhysiology';
import { nativeCorsHeaders } from '@/lib/nativeApi';
import { overallPerformance } from '@/lib/overallPerformance';
import { normalizeMeasurementMetadata } from '@/lib/measurementMetadata';
import { emptyProfile, normalizeValues } from '@/lib/profile';
import { buildAthleteProgression } from '@/lib/progressionEngine';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

function reply(request: Request, body: unknown, status = 200) {
  const cors = nativeCorsHeaders(request.headers.get('origin'));
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store', ...(cors ?? {}) },
  });
}

export async function OPTIONS(request: Request) {
  const cors = nativeCorsHeaders(request.headers.get('origin'));
  return new NextResponse(null, { status: 204, headers: cors ?? {} });
}

/**
 * Single round-trip mobile hydration endpoint combining Top1.Fit's scientific
 * scoring, 19-muscle physiology, adaptive coach decision, operator flag,
 * public share link, and mobile gamification state.
 */
export async function GET(request: Request) {
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to load your TOP1% dashboard.' }, 401);

  try {
    const now = new Date();
    const [profileRes, measurementsRes, operatorRes, gamificationRes, snapshot, customExercises, wearableHistory] =
      await Promise.all([
        client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        client.rpc('read_current_measurements'),
        client.rpc('is_usage_operator', { p_owner: user.id }),
        client.from('athlete_gamification').select('*').eq('user_id', user.id).maybeSingle(),
        readAccountCoachDecision(client, user.id, { now }),
        readUserCustomExercises(client, user.id),
        readUserWearableSnapshots(client, user.id),
      ]);

    if (profileRes.error || measurementsRes.error || gamificationRes.error) {
      return reply(request, { error: 'Unable to load unified mobile overview.' }, 503);
    }

    const profileRow = profileRes.data;
    const demographics = profileRow
      ? {
          age: Number(profileRow.age) || 23,
          sex: (profileRow.sex as 'male' | 'female' | 'unselected') || 'unselected',
          ...(profileRow.weight_kg != null ? { weight: Number(profileRow.weight_kg) } : {}),
          ...(profileRow.height_cm != null ? { height: Number(profileRow.height_cm) } : {}),
        }
      : emptyProfile.demographics;

    const values = measurementsRes.data?.values ? normalizeValues(measurementsRes.data.values) : {};
    const measurementDetails = measurementsRes.data?.details
      ? normalizeMeasurementMetadata(measurementsRes.data.details, { legacy: true })
      : {};

    const scores = evaluate(values, demographics, measurementDetails);
    const overall = overallPerformance(values, measurementDetails, demographics, now.getTime());

    const tz = snapshot.dossier.identity.timeZone || 'UTC';
    const today = dayInZone(now, tz);
    const tomorrow = addDays(today, 1);

    const upcomingGoalMetricsWithin36h: string[] = [];
    for (const plan of snapshot.plans) {
      if (plan.config.guidedVersion === 1) {
        const hasSoon = datedProgram(plan)
          .weeks.flatMap((w) => w.sessions)
          .some((s) => s.date === today || s.date === tomorrow);
        if (hasSoon) upcomingGoalMetricsWithin36h.push(plan.config.metric);
      }
    }

    const physiology = buildBodyPhysiologyReport({
      dossier: snapshot.dossier,
      trainingEvents: snapshot.trainingEvents,
      asOf: now,
      upcomingGoalMetricsWithin36h,
      wearableHistory,
      customExercises,
    });

    const progression = buildAthleteProgression({
      dossier: snapshot.dossier,
      trainingEvents: snapshot.trainingEvents,
      physiology,
      asOf: now,
    });

    const username = typeof profileRow?.username === 'string' ? profileRow.username : '';
    const isPublic = Boolean(profileRow?.is_public);
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://top1.fit').replace(/\/$/, '');

    return reply(request, {
      owner: user.id,
      email: user.email ?? '',
      username,
      isPublic,
      isOperator: !operatorRes.error && operatorRes.data === true,
      shareUrl: username && isPublic ? `${siteUrl}/share/${encodeURIComponent(username)}` : null,
      ogImageUrl: username && isPublic ? `${siteUrl}/api/og?username=${encodeURIComponent(username)}` : null,
      adminUrl: !operatorRes.error && operatorRes.data === true ? `${siteUrl}/admin?tab=backend` : null,
      revision: Number(profileRow?.revision ?? 0),
      demographics,
      values,
      measurementDetails,
      scores,
      overall,
      coach: {
        decision: snapshot.decision,
        targetDay: snapshot.targetDay,
        workspaceRevision: snapshot.workspaceRevision,
        trainingCounter: snapshot.trainingCounter,
        plansCount: snapshot.plans.length,
      },
      physiology,
      progression,
      wearableSnapshotsCount: wearableHistory.length,
      gamification: gamificationRes.data ?? {
        user_id: user.id,
        xp: progression.level.totalXp,
        credits: 250,
        streak_days: progression.streak.weeklyStreakCount,
        longest_streak: progression.streak.weeklyStreakCount,
        owned_cosmetics: [],
        claimed_levels: [],
        daily_deals_json: [],
        strava_connected: false,
      },
    });
  } catch (error) {
    if (error instanceof CoachSnapshotChanged) {
      return reply(request, { error: 'Training state changed during hydration. Retry.' }, 409);
    }
    return reply(request, { error: 'Unable to load unified mobile overview.' }, 503);
  }
}
