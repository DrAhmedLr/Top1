import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/accountSession';
import { nativeCorsHeaders, validApiOrigin } from '@/lib/nativeApi';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!user) return reply(request, { error: 'Sign in to load workout presets.' }, 401);

  const [foldersRes, presetsRes] = await Promise.all([
    client
      .from('workout_folders')
      .select('id,user_id,name,sort_order,created_at')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    client
      .from('workout_presets')
      .select('id,user_id,folder_id,name,description,is_public,exercises_json,downloads_count,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);

  if (foldersRes.error || presetsRes.error) {
    return reply(request, { error: 'Could not load presets.' }, 503);
  }

  return reply(request, {
    folders: foldersRes.data ?? [],
    presets: presetsRes.data ?? [],
  });
}

export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply(request, { error: 'Invalid origin.' }, 403);
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to create workout presets.' }, 401);

  try {
    const raw = await request.text();
    if (raw.length > 70000) return reply(request, { error: 'Payload too large.' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;

    if (body.kind === 'folder') {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
      if (!name) return reply(request, { error: 'Folder name is required.' }, 400);
      const sortOrder = Math.max(0, Math.min(10000, Math.round(Number(body.sortOrder) || 0)));
      const { data, error } = await client
        .from('workout_folders')
        .insert({ user_id: user.id, name, sort_order: sortOrder })
        .select('*')
        .single();
      if (error) return reply(request, { error: 'Could not create folder.' }, 503);
      return reply(request, { folder: data }, 201);
    }

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    if (!name) return reply(request, { error: 'Preset name is required.' }, 400);
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 400) : '';
    const folderId =
      typeof body.folderId === 'string' && UUID_RE.test(body.folderId) ? body.folderId : null;
    const isPublic = Boolean(body.isPublic);
    const exercisesJson = Array.isArray(body.exercises) ? body.exercises : [];

    const { data, error } = await client
      .from('workout_presets')
      .insert({
        user_id: user.id,
        folder_id: folderId,
        name,
        description,
        is_public: isPublic,
        exercises_json: exercisesJson,
      })
      .select('*')
      .single();

    if (error) return reply(request, { error: 'Could not create preset.' }, 503);
    return reply(request, { preset: data }, 201);
  } catch {
    return reply(request, { error: 'Invalid preset payload.' }, 400);
  }
}

export async function PATCH(request: Request) {
  if (!validApiOrigin(request)) return reply(request, { error: 'Invalid origin.' }, 403);
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to update presets.' }, 401);

  try {
    const raw = await request.text();
    if (raw.length > 70000) return reply(request, { error: 'Payload too large.' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id : '';
    if (!UUID_RE.test(id)) return reply(request, { error: 'Valid ID required.' }, 400);

    if (body.kind === 'folder') {
      const patch: Record<string, unknown> = {};
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 60);
      if (body.sortOrder !== undefined) patch.sort_order = Math.max(0, Math.min(10000, Math.round(Number(body.sortOrder) || 0)));
      if (Object.keys(patch).length === 0) {
        return reply(request, { error: 'No valid folder fields to update.' }, 400);
      }
      const { data, error } = await client
        .from('workout_folders')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle();
      if (error) return reply(request, { error: 'Could not update folder.' }, 503);
      if (!data) return reply(request, { error: 'Folder not found.' }, 404);
      return reply(request, { folder: data });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 100);
    if (typeof body.description === 'string') patch.description = body.description.trim().slice(0, 400);
    if (body.folderId === null || (typeof body.folderId === 'string' && UUID_RE.test(body.folderId))) {
      patch.folder_id = body.folderId;
    }
    if (typeof body.isPublic === 'boolean') patch.is_public = body.isPublic;
    if (Array.isArray(body.exercises)) patch.exercises_json = body.exercises;
    if (Object.keys(patch).length === 0) {
      return reply(request, { error: 'No valid preset fields to update.' }, 400);
    }

    const { data, error } = await client
      .from('workout_presets')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle();
    if (error) return reply(request, { error: 'Could not update preset.' }, 503);
    if (!data) return reply(request, { error: 'Preset not found.' }, 404);
    return reply(request, { preset: data });
  } catch {
    return reply(request, { error: 'Invalid update payload.' }, 400);
  }
}

export async function DELETE(request: Request) {
  if (!validApiOrigin(request)) return reply(request, { error: 'Invalid origin.' }, 403);
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to delete presets.' }, 401);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const kind = url.searchParams.get('kind') === 'folder' ? 'workout_folders' : 'workout_presets';
  if (!id || !UUID_RE.test(id)) return reply(request, { error: 'Valid ID required.' }, 400);

  const { error } = await client.from(kind).delete().eq('id', id).eq('user_id', user.id);
  if (error) return reply(request, { error: 'Could not delete item.' }, 503);
  return reply(request, { deleted: true, id });
}
