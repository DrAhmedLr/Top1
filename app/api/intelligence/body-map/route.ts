import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {addDays, dayInZone} from '@/lib/adaptiveProgram';
import {CoachSnapshotChanged, readAccountCoachDecision} from '@/lib/coachServer';
import {
  readUserCustomExercises,
  readUserWearableSnapshots,
} from '@/lib/customExercisesServer';
import {datedProgram} from '@/lib/datedProgram';
import {buildBodyPhysiologyReport} from '@/lib/musclePhysiology';
import {buildAthleteProgression} from '@/lib/progressionEngine';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

/**
 * Computes the athlete's live 19-muscle physiology report (allometric strength tier,
 * exponential local recovery %, weekly fractional MEV/MAV/MRV sets, antagonist balance,
 * upcoming-goal protection) alongside recovery-safe weekly streaks, anti-gaming XP, and quests.
 */
export async function GET(request: Request) {
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to view your physiology and progression report.'}, 401);

  try {
    const now = new Date();
    const [snapshot, customExercises, wearableHistory] = await Promise.all([
      readAccountCoachDecision(client, user.id, {now}),
      readUserCustomExercises(client, user.id),
      readUserWearableSnapshots(client, user.id),
    ]);
    const tz = snapshot.dossier.identity.timeZone || 'UTC';
    const today = dayInZone(now, tz);
    const tomorrow = addDays(today, 1);

    // Detect pinned TOP1 goal metrics scheduled today or tomorrow so we protect their prime movers
    const upcomingGoalMetricsWithin36h: string[] = [];
    for (const plan of snapshot.plans) {
      if (plan.config.guidedVersion === 1) {
        const hasSoon = datedProgram(plan)
          .weeks.flatMap(w => w.sessions)
          .some(s => s.date === today || s.date === tomorrow);
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

    return reply({
      owner: user.id,
      workspaceRevision: snapshot.workspaceRevision,
      trainingCounter: snapshot.trainingCounter,
      physiology,
      progression,
    });
  } catch (error) {
    if (error instanceof CoachSnapshotChanged) {
      return reply({error: 'Your training data changed during calculation. Retry.'}, 409);
    }
    return reply({error: 'Unable to compute body physiology report.'}, 503);
  }
}
