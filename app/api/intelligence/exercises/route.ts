import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {readUserCustomExercises} from '@/lib/customExercisesServer';
import {
  ALL_DETAILED_EQUIPMENT,
  ALL_MUSCLES,
  EXERCISE_ONTOLOGY_VERSION,
  findBiomechanicalSubstitutes,
  queryExercises,
  type DetailedEquipmentId,
  type ExerciseDefinition,
  type MovementPattern,
  type MuscleId,
} from '@/lib/exerciseOntology';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

const EQUIP_SET = new Set<string>(ALL_DETAILED_EQUIPMENT);
const MUSCLE_SET = new Set<string>(ALL_MUSCLES);

/**
 * Filterable biomechanical exercise ontology & substitution engine.
 * GET /api/intelligence/exercises?q=press&equipment=small_weights,benches_racks&muscle=mid_chest&substituteFor=barbell_bench_press&discomfortArea=shoulder
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('q') ?? undefined;
  const rawEquip = url.searchParams.get('equipment');
  const rawMuscle = url.searchParams.get('muscle');
  const pattern = (url.searchParams.get('pattern') ?? undefined) as MovementPattern | undefined;
  const discomfortArea = url.searchParams.get('discomfortArea') ?? undefined;
  const travelOnly = url.searchParams.get('travelOnly') === 'true';
  const substituteFor = url.searchParams.get('substituteFor');

  const equipment = rawEquip
    ? (rawEquip
        .split(',')
        .map(s => s.trim())
        .filter(s => EQUIP_SET.has(s)) as DetailedEquipmentId[])
    : undefined;

  const muscles = rawMuscle
    ? (rawMuscle
        .split(',')
        .map(s => s.trim())
        .filter(s => MUSCLE_SET.has(s)) as MuscleId[])
    : undefined;

  // Include signed-in user's custom exercises automatically when authenticated
  let customExercises: ExerciseDefinition[] = [];
  const client = await getSupabaseServer();
  if (client) {
    const user = await currentAccount(client, request).catch(() => null);
    if (user) {
      customExercises = await readUserCustomExercises(client, user.id);
    }
  }

  if (substituteFor) {
    const substitutes = findBiomechanicalSubstitutes(substituteFor, {
      availableEquipment: equipment,
      discomfortArea,
      limit: 6,
      customExercises,
    });
    return reply({
      version: EXERCISE_ONTOLOGY_VERSION,
      sourceExerciseId: substituteFor,
      count: substitutes.length,
      substitutes,
    });
  }

  const exercises = queryExercises({
    search,
    equipment,
    muscles,
    pattern,
    discomfortArea,
    travelOnly,
    customExercises,
  });

  return reply({
    version: EXERCISE_ONTOLOGY_VERSION,
    count: exercises.length,
    customCount: customExercises.length,
    equipmentTaxonomy: ALL_DETAILED_EQUIPMENT,
    muscleTaxonomy: ALL_MUSCLES,
    exercises,
  });
}
