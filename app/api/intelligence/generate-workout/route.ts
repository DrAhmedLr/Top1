import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {addDays, dayInZone} from '@/lib/adaptiveProgram';
import {CoachSnapshotChanged, readAccountCoachDecision} from '@/lib/coachServer';
import {
  readUserCustomExercises,
  readUserWearableSnapshots,
} from '@/lib/customExercisesServer';
import {datedProgram} from '@/lib/datedProgram';
import {
  ALL_DETAILED_EQUIPMENT,
  ALL_MUSCLES,
  type DetailedEquipmentId,
  type MuscleId,
} from '@/lib/exerciseOntology';
import {validApiOrigin} from '@/lib/nativeApi';
import type {DiscomfortReport} from '@/lib/personalWorkspace';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {
  generateAdaptiveWorkout,
  type GeneratorMode,
  type GeneratorPreset,
} from '@/lib/workoutGenerator';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

const MODES = new Set<GeneratorMode>(['smart_next', 'target_muscles', 'preset']);
const PRESETS = new Set<GeneratorPreset>([
  'at_home',
  'gym',
  'cardio',
  'travel',
  'bodyweight',
  'dumbbells_only',
]);
const MUSCLE_SET = new Set<string>(ALL_MUSCLES);
const EQUIP_SET = new Set<string>(ALL_DETAILED_EQUIPMENT);

/**
 * Generates an adaptive, recovery-aware, goal-protecting, time-bounded workout
 * grounded in the signed-in athlete's live Supabase dossier & training ledger.
 */
export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply({error: 'Invalid origin.'}, 403);
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to generate an adaptive workout.'}, 401);

  try {
    const raw = await request.text();
    if (raw.length > 8192) return reply({error: 'Request too large.'}, 413);
    const body = (raw ? JSON.parse(raw) : {}) as {
      mode?: GeneratorMode;
      preset?: GeneratorPreset;
      targetMuscles?: string[];
      availableMinutes?: number;
      equipmentOverride?: string[];
      discomfort?: DiscomfortReport;
    };

    const mode: GeneratorMode = body.mode && MODES.has(body.mode) ? body.mode : 'smart_next';
    const preset: GeneratorPreset | undefined =
      body.preset && PRESETS.has(body.preset) ? body.preset : undefined;
    const availableMinutes =
      typeof body.availableMinutes === 'number' && Number.isFinite(body.availableMinutes)
        ? Math.max(10, Math.min(120, Math.round(body.availableMinutes)))
        : 45;
    const targetMuscles = Array.isArray(body.targetMuscles)
      ? (body.targetMuscles.filter(m => MUSCLE_SET.has(m)) as MuscleId[])
      : undefined;
    const equipmentOverride = Array.isArray(body.equipmentOverride)
      ? (body.equipmentOverride.filter(e => EQUIP_SET.has(e)) as DetailedEquipmentId[])
      : undefined;
    const discomfort: DiscomfortReport | undefined =
      body.discomfort &&
      ['none', 'mild', 'concerning'].includes(body.discomfort.severity)
        ? {
            severity: body.discomfort.severity,
            area: typeof body.discomfort.area === 'string' ? body.discomfort.area.slice(0, 80) : undefined,
            note: typeof body.discomfort.note === 'string' ? body.discomfort.note.slice(0, 200) : undefined,
          }
        : undefined;

    const now = new Date();
    const [snapshot, customExercises, wearableHistory] = await Promise.all([
      readAccountCoachDecision(client, user.id, {now}),
      readUserCustomExercises(client, user.id),
      readUserWearableSnapshots(client, user.id),
    ]);
    const tz = snapshot.dossier.identity.timeZone || 'UTC';
    const today = dayInZone(now, tz);
    const tomorrow = addDays(today, 1);

    const upcomingGoalMetricsWithin36h: string[] = [];
    for (const plan of snapshot.plans) {
      if (plan.config.guidedVersion === 1) {
        const hasSoon = datedProgram(plan)
          .weeks.flatMap(w => w.sessions)
          .some(s => s.date === today || s.date === tomorrow);
        if (hasSoon) upcomingGoalMetricsWithin36h.push(plan.config.metric);
      }
    }

    const generated = generateAdaptiveWorkout({
      dossier: snapshot.dossier,
      trainingEvents: snapshot.trainingEvents,
      wearableHistory,
      customExercises,
      request: {
        mode,
        preset,
        targetMuscles,
        availableMinutes,
        equipmentOverride,
        discomfort,
        upcomingGoalMetricsWithin36h,
        asOf: now,
      },
    });

    return reply({
      owner: user.id,
      workspaceRevision: snapshot.workspaceRevision,
      workout: generated,
    });
  } catch (error) {
    if (error instanceof CoachSnapshotChanged) {
      return reply({error: 'Your training data changed during calculation. Retry.'}, 409);
    }
    return reply({error: 'Invalid workout generation request.'}, 400);
  }
}
