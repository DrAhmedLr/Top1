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
    headers: { 'Cache-Control': 'private, no-store', ...(cors ?? {}) },
  });
}

export async function OPTIONS(request: Request) {
  const cors = nativeCorsHeaders(request.headers.get('origin'));
  return new NextResponse(null, { status: 204, headers: cors ?? {} });
}

export async function GET(request: Request) {
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to access social & community features.' }, 401);

  const [friendsRes, requestsRes] = await Promise.all([
    client
      .from('friend_links')
      .select('id,user_id,friend_user_id,status,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(100),
    client
      .from('feature_requests')
      .select('id,user_id,title,description,status,votes_count,created_at')
      .order('votes_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (friendsRes.error || requestsRes.error) {
    return reply(request, { error: 'Could not load social data.' }, 503);
  }

  return reply(request, {
    friends: friendsRes.data ?? [],
    featureRequests: requestsRes.data ?? [],
  });
}

export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply(request, { error: 'Invalid origin.' }, 403);
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to perform social actions.' }, 401);

  try {
    const raw = await request.text();
    if (raw.length > 8192) return reply(request, { error: 'Payload too large.' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'react') {
      const postId = typeof body.postId === 'string' ? body.postId : '';
      const reactionKey = typeof body.reactionKey === 'string' ? body.reactionKey.trim().slice(0, 16) : '';
      if (!UUID_RE.test(postId) || !reactionKey) {
        return reply(request, { error: 'Valid postId and reactionKey required.' }, 400);
      }
      const { data: existing } = await client
        .from('post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('reaction_key', reactionKey)
        .maybeSingle();

      if (existing?.id) {
        const { error: delError } = await client
          .from('post_reactions')
          .delete()
          .eq('id', existing.id)
          .eq('user_id', user.id);
        if (delError) return reply(request, { error: 'Could not remove reaction.' }, 503);
        return reply(request, { toggled: false, postId, reactionKey });
      }
      const { error } = await client
        .from('post_reactions')
        .insert({ post_id: postId, user_id: user.id, reaction_key: reactionKey });
      if (error) return reply(request, { error: 'Could not add reaction.' }, 503);
      return reply(request, { toggled: true, postId, reactionKey }, 201);
    }

    if (action === 'comment') {
      const postId = typeof body.postId === 'string' ? body.postId : '';
      const commentBody = typeof body.body === 'string' ? body.body.trim().slice(0, 500) : '';
      if (!UUID_RE.test(postId) || !commentBody) {
        return reply(request, { error: 'Valid postId and comment text required.' }, 400);
      }
      const { data, error } = await client
        .from('post_comments')
        .insert({ post_id: postId, user_id: user.id, body: commentBody })
        .select('id,post_id,user_id,body,created_at')
        .single();
      if (error) return reply(request, { error: 'Could not post comment.' }, 503);
      return reply(request, { comment: data }, 201);
    }

    if (action === 'friend_request') {
      const friendUserId = typeof body.friendUserId === 'string' ? body.friendUserId : '';
      if (!UUID_RE.test(friendUserId) || friendUserId === user.id) {
        return reply(request, { error: 'Valid friendUserId required.' }, 400);
      }
      const { data, error } = await client
        .from('friend_links')
        .insert({ user_id: user.id, friend_user_id: friendUserId, status: 'pending' })
        .select('*')
        .single();
      if (error) return reply(request, { error: 'Could not send friend request.' }, 503);
      return reply(request, { link: data }, 201);
    }

    if (action === 'friend_accept') {
      const linkId = typeof body.linkId === 'string' ? body.linkId : '';
      if (!UUID_RE.test(linkId)) return reply(request, { error: 'Valid linkId required.' }, 400);
      const { data, error } = await client
        .from('friend_links')
        .update({ status: 'accepted' })
        .eq('id', linkId)
        .eq('friend_user_id', user.id)
        .eq('status', 'pending')
        .select('*')
        .maybeSingle();
      if (error) return reply(request, { error: 'Could not accept friend request.' }, 503);
      if (!data) return reply(request, { error: 'Pending friend request not found.' }, 404);
      return reply(request, { link: data });
    }

    if (action === 'feature_request') {
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
      const description = typeof body.description === 'string' ? body.description.trim().slice(0, 600) : '';
      if (title.length < 3) return reply(request, { error: 'Title must be at least 3 characters.' }, 400);
      const { data, error } = await client
        .from('feature_requests')
        .insert({ user_id: user.id, title, description })
        .select('*')
        .single();
      if (error) return reply(request, { error: 'Could not submit feature request.' }, 503);
      return reply(request, { featureRequest: data }, 201);
    }

    return reply(request, { error: 'Unsupported social action.' }, 400);
  } catch {
    return reply(request, { error: 'Invalid social payload.' }, 400);
  }
}
