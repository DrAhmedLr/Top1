import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/accountSession';
import { nativeCorsHeaders, validApiOrigin } from '@/lib/nativeApi';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIBILITY = new Set(['public', 'friends', 'private']);

function isSafeHttpsUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function reply(request: Request, body: unknown, status = 200) {
  const cors = nativeCorsHeaders(request.headers.get('origin'));
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      ...(cors
        ? { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' }
        : {}),
    },
  });
}

export async function OPTIONS(request: Request) {
  const cors = nativeCorsHeaders(request.headers.get('origin'));
  return new NextResponse(null, {
    status: 204,
    headers: cors
      ? { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS' }
      : {},
  });
}

export async function GET(request: Request) {
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to view workout posts.' }, 401);

  const scope = new URL(request.url).searchParams.get('scope');
  let query = client
    .from('workout_posts')
    .select(
      'id,user_id,preset_id,title,caption,notes,duration_seconds,total_volume_kg,total_sets,visibility,exercises_json,muscle_heatmap_json,media_urls,tagged_user_ids,strava_activity_id,xp_earned,started_at,completed_at,created_at,updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (scope === 'mine') {
    query = query.eq('user_id', user.id);
  }

  const { data: posts, error } = await query;
  if (error) return reply(request, { error: 'Could not load workout posts.' }, 503);

  const postIds = (posts ?? []).map((p) => p.id);
  const [reactionsRes, commentsRes] = postIds.length
    ? await Promise.all([
        client.from('post_reactions').select('post_id,user_id,reaction_key').in('post_id', postIds),
        client
          .from('post_comments')
          .select('id,post_id,user_id,body,created_at')
          .in('post_id', postIds)
          .order('created_at', { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  const reactionsByPost = new Map<string, Array<{ userId: string; key: string }>>();
  for (const r of reactionsRes.data ?? []) {
    const list = reactionsByPost.get(r.post_id) ?? [];
    list.push({ userId: r.user_id, key: r.reaction_key });
    reactionsByPost.set(r.post_id, list);
  }

  const commentsByPost = new Map<string, Array<{ id: string; userId: string; body: string; createdAt: string }>>();
  for (const c of commentsRes.data ?? []) {
    const list = commentsByPost.get(c.post_id) ?? [];
    list.push({ id: c.id, userId: c.user_id, body: c.body, createdAt: c.created_at });
    commentsByPost.set(c.post_id, list);
  }

  return reply(request, {
    posts: (posts ?? []).map((p) => ({
      ...p,
      reactions: reactionsByPost.get(p.id) ?? [],
      comments: commentsByPost.get(p.id) ?? [],
    })),
  });
}

export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply(request, { error: 'Invalid origin.' }, 403);
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to publish workout posts.' }, 401);

  try {
    const raw = await request.text();
    if (raw.length > 140000) return reply(request, { error: 'Payload too large.' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;

    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    if (!title) return reply(request, { error: 'Workout title is required.' }, 400);

    const caption = typeof body.caption === 'string' ? body.caption.trim().slice(0, 500) : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : '';
    const visibility =
      typeof body.visibility === 'string' && VISIBILITY.has(body.visibility) ? body.visibility : 'friends';
    const presetId =
      typeof body.presetId === 'string' && UUID_RE.test(body.presetId) ? body.presetId : null;
    const durationSeconds = Math.max(0, Math.min(86400, Math.round(Number(body.durationSeconds) || 0)));
    const totalVolumeKg = Math.max(0, Math.min(500000, Math.round((Number(body.totalVolumeKg) || 0) * 10) / 10));
    const totalSets = Math.max(0, Math.min(500, Math.round(Number(body.totalSets) || 0)));
    const exercisesJson = Array.isArray(body.exercises) ? body.exercises : [];
    const muscleHeatmapJson =
      body.muscleHeatmap && typeof body.muscleHeatmap === 'object' && !Array.isArray(body.muscleHeatmap)
        ? body.muscleHeatmap
        : {};
    const mediaUrls = Array.isArray(body.mediaUrls)
      ? body.mediaUrls.filter(isSafeHttpsUrl).slice(0, 8)
      : [];
    const taggedUserIds = Array.isArray(body.taggedUserIds)
      ? body.taggedUserIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id)).slice(0, 12)
      : [];
    const stravaActivityId =
      typeof body.stravaActivityId === 'string' && body.stravaActivityId.trim()
        ? body.stravaActivityId.trim().slice(0, 64)
        : null;
    const { data, error } = await client
      .from('workout_posts')
      .insert({
        user_id: user.id,
        preset_id: presetId,
        title,
        caption,
        notes,
        duration_seconds: durationSeconds,
        total_volume_kg: totalVolumeKg,
        total_sets: totalSets,
        visibility,
        exercises_json: exercisesJson,
        muscle_heatmap_json: muscleHeatmapJson,
        media_urls: mediaUrls,
        tagged_user_ids: taggedUserIds,
        strava_activity_id: stravaActivityId,
      })
      .select('*')
      .single();

    if (error || !data) return reply(request, { error: 'Could not save workout post.' }, 503);

    const xpEarned = Number(data.xp_earned ?? 0);
    return reply(request, { post: data, xpEarned, creditsEarned: Math.round(xpEarned / 5) }, 201);
  } catch {
    return reply(request, { error: 'Invalid workout post payload.' }, 400);
  }
}

export async function PATCH(request: Request) {
  if (!validApiOrigin(request)) return reply(request, { error: 'Invalid origin.' }, 403);
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to edit workout posts.' }, 401);

  try {
    const raw = await request.text();
    if (raw.length > 140000) return reply(request, { error: 'Payload too large.' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id : '';
    if (!UUID_RE.test(id)) return reply(request, { error: 'Valid workout post ID required.' }, 400);

    const patch: Record<string, unknown> = {};
    if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 120);
    if (typeof body.caption === 'string') patch.caption = body.caption.trim().slice(0, 500);
    if (typeof body.notes === 'string') patch.notes = body.notes.trim().slice(0, 2000);
    if (typeof body.visibility === 'string' && VISIBILITY.has(body.visibility)) patch.visibility = body.visibility;
    if (Array.isArray(body.exercises)) patch.exercises_json = body.exercises;
    if (body.muscleHeatmap && typeof body.muscleHeatmap === 'object' && !Array.isArray(body.muscleHeatmap)) {
      patch.muscle_heatmap_json = body.muscleHeatmap;
    }
    if (Array.isArray(body.taggedUserIds)) {
      patch.tagged_user_ids = body.taggedUserIds
        .filter((uid): uid is string => typeof uid === 'string' && UUID_RE.test(uid))
        .slice(0, 12);
    }
    if (typeof body.stravaActivityId === 'string' || body.stravaActivityId === null) {
      patch.strava_activity_id = body.stravaActivityId ? body.stravaActivityId.slice(0, 64) : null;
    }

    if (Object.keys(patch).length === 0) {
      return reply(request, { error: 'No valid fields to update.' }, 400);
    }

    const { data, error } = await client
      .from('workout_posts')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle();

    if (error) return reply(request, { error: 'Could not update workout post.' }, 503);
    if (!data) return reply(request, { error: 'Workout post not found.' }, 404);
    return reply(request, { post: data });
  } catch {
    return reply(request, { error: 'Invalid edit payload.' }, 400);
  }
}

export async function DELETE(request: Request) {
  if (!validApiOrigin(request)) return reply(request, { error: 'Invalid origin.' }, 403);
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to delete workout posts.' }, 401);

  const id = new URL(request.url).searchParams.get('id');
  if (!id || !UUID_RE.test(id)) return reply(request, { error: 'Valid post ID required.' }, 400);

  const { error } = await client.from('workout_posts').delete().eq('id', id).eq('user_id', user.id);
  if (error) return reply(request, { error: 'Could not delete workout post.' }, 503);
  return reply(request, { deleted: true, id });
}
