import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {
  CoachGoalNotFound,
  CoachSnapshotChanged,
  commitAccountCoachAction,
  readAccountCoachDecision,
  type CoachActionPayload,
} from '@/lib/coachServer';
import {DOSSIER_VERSION} from '@/lib/athleteDossier';
import {COACH_ENGINE_VERSION} from '@/lib/coachDecision';
import {validApiOrigin} from '@/lib/nativeApi';
import {goalDate} from '@/lib/personalGoal';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {trainingId} from '@/lib/training';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

export async function GET(request: Request) {
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to view coaching decisions.'}, 401);

  const url = new URL(request.url);
  const rawPlan = url.searchParams.get('plan');
  const rawDay = url.searchParams.get('day');
  let planId: string | undefined;
  if (rawPlan !== null) {
    try {
      planId = trainingId(rawPlan);
    } catch {
      return reply({error: 'Invalid goal selection.'}, 400);
    }
  }
  if (rawDay !== null && !goalDate(rawDay)) {
    return reply({error: 'Invalid target date.'}, 400);
  }

  try {
    const snapshot = await readAccountCoachDecision(client, user.id, {
      planId,
      targetDay: rawDay ?? undefined,
    });
    return reply({
      owner: user.id,
      dossierVersion: DOSSIER_VERSION,
      modelVersion: COACH_ENGINE_VERSION,
      workspaceRevision: snapshot.workspaceRevision,
      profileRevision: snapshot.profileRevision,
      trainingCounter: snapshot.trainingCounter,
      targetDay: snapshot.targetDay,
      decision: snapshot.decision,
      dossierSummary: {
        today: snapshot.dossier.today,
        pinnedMetrics: snapshot.dossier.pinnedMetrics,
        attendanceRate: snapshot.dossier.trainingLedger.attendanceRate,
        activeOverrides: snapshot.dossier.temporaryState.activeOverrides.length,
        recurringShortWeekdays: snapshot.dossier.inferredPatterns.recurringShortWeekdays,
      },
    });
  } catch (error) {
    if (error instanceof CoachGoalNotFound) return reply({error: 'This goal is no longer active.'}, 404);
    if (error instanceof CoachSnapshotChanged) {
      return reply({error: 'Your training data changed during calculation. Retry.'}, 409);
    }
    return reply({error: 'Unable to calculate coaching decision.'}, 503);
  }
}

export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply({error: 'Invalid origin.'}, 403);
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to update coaching decisions.'}, 401);
  if (request.headers.get('x-profile-user') !== user.id) {
    return reply({error: 'Account changed. Reload.'}, 409);
  }

  try {
    const raw = await request.text();
    if (raw.length > 16384) return reply({error: 'Request too large.'}, 413);
    const body = JSON.parse(raw) as {
      action?: CoachActionPayload;
      expectedWorkspaceRevision?: number;
      planId?: string;
    };
    if (
      !body.action ||
      !goalDate(body.action.day) ||
      !Number.isSafeInteger(body.expectedWorkspaceRevision) ||
      (body.expectedWorkspaceRevision as number) < 0
    ) {
      return reply({error: 'Invalid coaching adjustment.'}, 400);
    }
    const planId = body.planId ? trainingId(body.planId) : undefined;
    const result = await commitAccountCoachAction(client, user.id, {
      action: body.action,
      expectedWorkspaceRevision: body.expectedWorkspaceRevision!,
      planId,
    });
    return reply(result);
  } catch (error) {
    if (error instanceof CoachGoalNotFound) return reply({error: 'This goal is no longer active.'}, 404);
    if (error instanceof CoachSnapshotChanged) {
      return reply({error: 'Saved elsewhere. Reload before applying this adjustment.'}, 409);
    }
    return reply({error: error instanceof Error ? error.message : 'Invalid coaching adjustment.'}, 400);
  }
}
