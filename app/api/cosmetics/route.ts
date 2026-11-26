import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/accountSession';
import { validApiOrigin } from '@/lib/nativeApi';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

const BORDERS = new Set([
  'obsidian',
  'bronze_crest',
  'silver_edge',
  'gold_aura',
  'platinum_pulse',
  'diamond_prism',
  'top1_apex',
]);
const FREE_BORDERS = new Set(['obsidian']);
const THEMES = new Set(['midnight', 'cobalt', 'emerald', 'solar', 'crimson']);
const ICONS = new Set(['classic', 'apex_front', 'apex_side', 'star_emblem']);

const DEFAULT_COSMETICS = {
  profile_border: 'obsidian',
  card_theme: 'midnight',
  app_icon: 'classic',
  claimed_quests: [] as string[],
  daily_calorie_target: 2400,
  daily_protein_target: 160,
};

export async function GET(request: Request) {
  const client = await getSupabaseServer();
  if (!client) return reply({ error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({ error: 'Sign in to load your cosmetics.' }, 401);

  const { data, error } = await client
    .from('athlete_cosmetics')
    .select('profile_border,card_theme,app_icon,claimed_quests,daily_calorie_target,daily_protein_target,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return reply({ error: 'Could not load cosmetics.' }, 503);
  return reply({ cosmetics: data ?? DEFAULT_COSMETICS });
}

export async function PUT(request: Request) {
  if (!validApiOrigin(request)) return reply({ error: 'Invalid origin.' }, 403);
  const client = await getSupabaseServer();
  if (!client) return reply({ error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({ error: 'Sign in to update cosmetics.' }, 401);

  const claimedUser = request.headers.get('x-profile-user');
  if (claimedUser && claimedUser !== user.id) {
    return reply({ error: 'Account changed in another tab. Refresh and try again.' }, 409);
  }

  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: 'Payload too large.' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;

    const [existingRes, gamificationRes] = await Promise.all([
      client
        .from('athlete_cosmetics')
        .select('profile_border,card_theme,app_icon,claimed_quests,daily_calorie_target,daily_protein_target')
        .eq('user_id', user.id)
        .maybeSingle(),
      client
        .from('athlete_gamification')
        .select('owned_cosmetics')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (existingRes.error) return reply({ error: 'Could not load existing cosmetics.' }, 503);
    const current = existingRes.data ?? DEFAULT_COSMETICS;
    const ownedSet = new Set<string>(
      Array.isArray(gamificationRes.data?.owned_cosmetics)
        ? (gamificationRes.data.owned_cosmetics as string[])
        : []
    );

    let profile_border = current.profile_border;
    if (body.profile_border !== undefined) {
      if (typeof body.profile_border !== 'string' || !BORDERS.has(body.profile_border)) {
        return reply({ error: 'Invalid profile border.' }, 400);
      }
      if (!FREE_BORDERS.has(body.profile_border) && !ownedSet.has(body.profile_border)) {
        return reply({ error: 'Profile border must be unlocked before equipping.' }, 403);
      }
      profile_border = body.profile_border;
    }

    const card_theme =
      typeof body.card_theme === 'string' && THEMES.has(body.card_theme)
        ? body.card_theme
        : current.card_theme;
    const app_icon =
      typeof body.app_icon === 'string' && ICONS.has(body.app_icon)
        ? body.app_icon
        : current.app_icon;
    // Preserve server-stored claimed_quests; never allow arbitrary client overwrite
    const claimed_quests = Array.isArray(current.claimed_quests) ? current.claimed_quests : [];
    const daily_calorie_target =
      body.daily_calorie_target !== undefined
        ? Math.max(
            1000,
            Math.min(7500, Math.round(Number(body.daily_calorie_target) || current.daily_calorie_target))
          )
        : current.daily_calorie_target;
    const daily_protein_target =
      body.daily_protein_target !== undefined
        ? Math.max(
            40,
            Math.min(450, Math.round(Number(body.daily_protein_target) || current.daily_protein_target))
          )
        : current.daily_protein_target;

    const { data, error } = await client
      .from('athlete_cosmetics')
      .upsert(
        {
          user_id: user.id,
          profile_border,
          card_theme,
          app_icon,
          claimed_quests,
          daily_calorie_target,
          daily_protein_target,
        },
        { onConflict: 'user_id' }
      )
      .select('profile_border,card_theme,app_icon,claimed_quests,daily_calorie_target,daily_protein_target,updated_at')
      .single();

    if (error) return reply({ error: 'Could not save cosmetics.' }, 503);
    return reply({ cosmetics: data });
  } catch {
    return reply({ error: 'Invalid cosmetics payload.' }, 400);
  }
}
