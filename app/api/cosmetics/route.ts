import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {validApiOrigin} from '@/lib/nativeApi';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

const BORDERS = new Set([
  'obsidian',
  'bronze_crest',
  'silver_edge',
  'gold_aura',
  'platinum_pulse',
  'diamond_prism',
  'top1_apex',
]);
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
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to load your cosmetics.'}, 401);

  const {data, error} = await client
    .from('athlete_cosmetics')
    .select('profile_border,card_theme,app_icon,claimed_quests,daily_calorie_target,daily_protein_target,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return reply({error: 'Could not load cosmetics.'}, 503);
  return reply({cosmetics: data ?? DEFAULT_COSMETICS});
}

export async function PUT(request: Request) {
  if (!validApiOrigin(request)) return reply({error: 'Invalid origin.'}, 403);
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to update cosmetics.'}, 401);

  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({error: 'Payload too large.'}, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;

    const profile_border =
      typeof body.profile_border === 'string' && BORDERS.has(body.profile_border)
        ? body.profile_border
        : DEFAULT_COSMETICS.profile_border;
    const card_theme =
      typeof body.card_theme === 'string' && THEMES.has(body.card_theme)
        ? body.card_theme
        : DEFAULT_COSMETICS.card_theme;
    const app_icon =
      typeof body.app_icon === 'string' && ICONS.has(body.app_icon)
        ? body.app_icon
        : DEFAULT_COSMETICS.app_icon;
    const claimed_quests = Array.isArray(body.claimed_quests)
      ? Array.from(
          new Set(
            body.claimed_quests
              .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
              .map(q => q.trim().slice(0, 64)),
          ),
        ).slice(0, 64)
      : [];
    const daily_calorie_target = Math.max(
      1000,
      Math.min(7500, Math.round(Number(body.daily_calorie_target) || DEFAULT_COSMETICS.daily_calorie_target)),
    );
    const daily_protein_target = Math.max(
      40,
      Math.min(450, Math.round(Number(body.daily_protein_target) || DEFAULT_COSMETICS.daily_protein_target)),
    );

    const {data, error} = await client
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
        {onConflict: 'user_id'},
      )
      .select('profile_border,card_theme,app_icon,claimed_quests,daily_calorie_target,daily_protein_target,updated_at')
      .single();

    if (error) return reply({error: 'Could not save cosmetics.'}, 503);
    return reply({cosmetics: data});
  } catch {
    return reply({error: 'Invalid cosmetics payload.'}, 400);
  }
}
