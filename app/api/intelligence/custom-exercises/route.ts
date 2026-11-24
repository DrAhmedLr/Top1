import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {readUserCustomExercises} from '@/lib/customExercisesServer';
import {
  inferCustomExerciseProfile,
  slugifyCustomExercise,
  type CustomExerciseInput,
} from '@/lib/exerciseOntology';
import {validApiOrigin} from '@/lib/nativeApi';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to view your custom exercises.'}, 401);

  const exercises = await readUserCustomExercises(client, user.id);
  return reply({count: exercises.length, exercises});
}

export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply({error: 'Invalid origin.'}, 403);
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to create custom exercises.'}, 401);

  try {
    const raw = await request.text();
    if (raw.length > 8192) return reply({error: 'Request too large.'}, 413);
    const body = JSON.parse(raw) as CustomExerciseInput;
    const slug = slugifyCustomExercise(body.name ?? '');
    const inferred = inferCustomExerciseProfile({...body, id: slug});

    const {data, error} = await client
      .from('custom_exercises')
      .upsert(
        {
          user_id: user.id,
          slug,
          name: inferred.name,
          pattern: inferred.pattern,
          is_compound: inferred.isCompound,
          primary_muscles: inferred.muscles.filter(m => m.role === 'primary').map(m => m.muscle),
          secondary_muscles: inferred.muscles.filter(m => m.role === 'secondary').map(m => m.muscle),
          required_equipment: [...inferred.requiredAll],
          mode: inferred.timePhysics.mode,
          default_amount: inferred.timePhysics.defaultRepsOrSeconds,
          default_rest_seconds: inferred.timePhysics.defaultRestSeconds,
          inferred_profile: {
            muscles: inferred.muscles,
            jointStress: inferred.jointStress,
            systemicFatigue: inferred.systemicFatigue,
            timePhysics: inferred.timePhysics,
            travelFriendly: inferred.travelFriendly,
            jointFriendly: inferred.jointFriendly,
          },
        },
        {onConflict: 'user_id,slug'},
      )
      .select('id,slug,created_at,updated_at')
      .single();

    if (error) {
      return reply({error: 'Could not save custom exercise.'}, 503);
    }

    return reply({
      id: data.id,
      slug: data.slug,
      exercise: inferred,
    }, 201);
  } catch (error) {
    return reply(
      {error: error instanceof Error ? error.message : 'Invalid custom exercise payload.'},
      400,
    );
  }
}

export async function DELETE(request: Request) {
  if (!validApiOrigin(request)) return reply({error: 'Invalid origin.'}, 403);
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to delete custom exercises.'}, 401);

  const id = new URL(request.url).searchParams.get('id');
  if (!id || !UUID_RE.test(id)) return reply({error: 'Valid custom exercise ID required.'}, 400);

  const {error} = await client
    .from('custom_exercises')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return reply({error: 'Could not delete custom exercise.'}, 503);
  return reply({deleted: true, id});
}
