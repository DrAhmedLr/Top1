import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/accountSession';
import { nativeCorsHeaders, validApiOrigin } from '@/lib/nativeApi';
import { getSupabaseServer } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

type DailyDeal = {
  id: string;
  name: string;
  category: 'border' | 'card' | 'title' | 'emote';
  originalPrice: number;
  salePrice: number;
  discountPct: number;
  rarity: 'rare' | 'epic' | 'legendary';
};

const DEAL_POOL: DailyDeal[] = [
  { id: 'border_apex_obsidian', name: 'Apex Obsidian Frame', category: 'border', originalPrice: 400, salePrice: 240, discountPct: 40, rarity: 'legendary' },
  { id: 'card_carbon_telemetry', name: 'Carbon Telemetry Card', category: 'card', originalPrice: 320, salePrice: 210, discountPct: 34, rarity: 'epic' },
  { id: 'title_top1_hybrid', name: 'Title: TOP1% Hybrid', category: 'title', originalPrice: 280, salePrice: 180, discountPct: 36, rarity: 'epic' },
  { id: 'border_solar_crest', name: 'Solar Crest Border', category: 'border', originalPrice: 260, salePrice: 175, discountPct: 33, rarity: 'rare' },
  { id: 'card_glacier_pulse', name: 'Glacier Pulse Card', category: 'card', originalPrice: 350, salePrice: 220, discountPct: 37, rarity: 'epic' },
  { id: 'emote_pr_bell', name: 'PR Bell Reaction Pack', category: 'emote', originalPrice: 180, salePrice: 110, discountPct: 39, rarity: 'rare' },
];

function buildDailyDeals(seedOffset = 0): DailyDeal[] {
  const dayIndex = Math.floor(Date.now() / 86_400_000) + seedOffset;
  const start = ((dayIndex % DEAL_POOL.length) + DEAL_POOL.length) % DEAL_POOL.length;
  return [
    DEAL_POOL[start % DEAL_POOL.length],
    DEAL_POOL[(start + 2) % DEAL_POOL.length],
    DEAL_POOL[(start + 4) % DEAL_POOL.length],
  ];
}

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
  if (!user) return reply(request, { error: 'Sign in to access rewards and shop.' }, 401);

  const { data, error } = await client
    .from('athlete_gamification')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return reply(request, { error: 'Could not load gamification state.' }, 503);

  const deals =
    Array.isArray(data?.daily_deals_json) && data.daily_deals_json.length > 0
      ? (data.daily_deals_json as DailyDeal[])
      : buildDailyDeals(0);

  return reply(request, {
    gamification: data ?? {
      user_id: user.id,
      xp: 0,
      credits: 250,
      streak_days: 0,
      longest_streak: 0,
      owned_cosmetics: [],
      claimed_levels: [],
      daily_deals_json: deals,
      strava_connected: false,
    },
    dailyDeals: deals,
    globalEvent: {
      id: 'spring-top1-hybrid-2026',
      title: 'TOP1% Hybrid Strength & Engine Challenge',
      subtitle: 'Log 4 balanced sessions + 1 benchmark retest this month to unlock the Apex Obsidian Frame.',
      targetSessions: 12,
      rewardCredits: 500,
    },
  });
}

export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply(request, { error: 'Invalid origin.' }, 403);
  const client = await getSupabaseServer();
  if (!client) return reply(request, { error: 'Account storage unavailable.' }, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply(request, { error: 'Sign in to update rewards and shop.' }, 401);

  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply(request, { error: 'Payload too large.' }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';

    let rpcArgs: {
      p_action: string;
      p_level?: number | null;
      p_deal_id?: string | null;
      p_strava_connected?: boolean | null;
      p_daily_deals?: DailyDeal[] | null;
    };

    if (action === 'claim_level') {
      const level = Math.round(Number(body.level) || 0);
      if (level < 1 || level > 100) return reply(request, { error: 'Invalid level.' }, 400);
      rpcArgs = { p_action: 'claim_level', p_level: level };
    } else if (action === 'buy_deal') {
      const dealId = typeof body.dealId === 'string' ? body.dealId : '';
      if (!DEAL_POOL.some((d) => d.id === dealId)) {
        return reply(request, { error: 'Deal not found.' }, 404);
      }
      rpcArgs = { p_action: 'buy_deal', p_deal_id: dealId };
    } else if (action === 'reroll_deals') {
      const nextDeals = buildDailyDeals(Math.floor(Math.random() * DEAL_POOL.length) + 1);
      rpcArgs = { p_action: 'reroll_deals', p_daily_deals: nextDeals };
    } else if (action === 'set_strava') {
      rpcArgs = { p_action: 'set_strava', p_strava_connected: Boolean(body.connected) };
    } else {
      return reply(request, { error: 'Unsupported gamification action.' }, 400);
    }

    const { data, error } = await client.rpc('apply_gamification_action', rpcArgs);
    if (error) {
      if (error.code === '23505') return reply(request, { error: error.message || 'Already claimed or owned.' }, 409);
      if (error.code === 'P0002') return reply(request, { error: error.message || 'Not found.' }, 404);
      if (error.code === '22023') return reply(request, { error: error.message || 'Action requirements not met.' }, 400);
      if (error.code === '42501') return reply(request, { error: 'Sign in to update rewards and shop.' }, 401);
      return reply(request, { error: 'Could not update gamification state.' }, 503);
    }

    const gamification = data as Record<string, unknown> | null;
    const dailyDeals =
      Array.isArray(gamification?.daily_deals_json) && gamification.daily_deals_json.length > 0
        ? (gamification.daily_deals_json as DailyDeal[])
        : buildDailyDeals(0);
    return reply(request, { gamification, dailyDeals });
  } catch {
    return reply(request, { error: 'Invalid gamification payload.' }, 400);
  }
}
