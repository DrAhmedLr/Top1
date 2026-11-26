import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {validApiOrigin} from '@/lib/nativeApi';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {status, headers: {'Cache-Control': 'private, no-store'}});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEAL_SLOTS = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'post_workout']);
const SOURCES = new Set(['manual', 'barcode', 'quick_preset']);

export async function GET(request: Request) {
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to view your nutrition logs.'}, 401);

  const date = new URL(request.url).searchParams.get('date');
  let query = client
    .from('nutrition_logs')
    .select('id,logged_date,meal_slot,source,barcode,product_name,brand,serving_size,calories,protein_g,carbs_g,fat_g,created_at')
    .eq('user_id', user.id)
    .order('created_at', {ascending: false})
    .limit(100);

  if (date && DATE_RE.test(date)) {
    query = query.eq('logged_date', date);
  }

  const {data, error} = await query;
  if (error) return reply({error: 'Could not load nutrition logs.'}, 503);
  return reply({entries: data ?? []});
}

export async function POST(request: Request) {
  if (!validApiOrigin(request)) return reply({error: 'Invalid origin.'}, 403);
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to save nutrition entries.'}, 401);

  try {
    const raw = await request.text();
    if (raw.length > 4096) return reply({error: 'Payload too large.'}, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;

    const productName = typeof body.productName === 'string' ? body.productName.trim().slice(0, 120) : '';
    if (!productName) return reply({error: 'Product name is required.'}, 400);

    const loggedDate =
      typeof body.loggedDate === 'string' && DATE_RE.test(body.loggedDate)
        ? body.loggedDate
        : new Date().toISOString().slice(0, 10);
    const mealSlot =
      typeof body.mealSlot === 'string' && MEAL_SLOTS.has(body.mealSlot) ? body.mealSlot : 'snack';
    const source =
      typeof body.source === 'string' && SOURCES.has(body.source) ? body.source : 'manual';
    const barcode =
      typeof body.barcode === 'string' && /^[0-9A-Za-z-]{4,32}$/.test(body.barcode.trim())
        ? body.barcode.trim()
        : null;
    const brand = typeof body.brand === 'string' && body.brand.trim() ? body.brand.trim().slice(0, 80) : null;
    const servingSize =
      typeof body.servingSize === 'string' && body.servingSize.trim() ? body.servingSize.trim().slice(0, 60) : null;

    const calories = Math.max(0, Math.min(8000, Math.round(Number(body.calories) || 0)));
    const proteinG = Math.max(0, Math.min(600, Math.round((Number(body.proteinG) || 0) * 10) / 10));
    const carbsG = Math.max(0, Math.min(1200, Math.round((Number(body.carbsG) || 0) * 10) / 10));
    const fatG = Math.max(0, Math.min(500, Math.round((Number(body.fatG) || 0) * 10) / 10));

    const {data, error} = await client
      .from('nutrition_logs')
      .insert({
        user_id: user.id,
        logged_date: loggedDate,
        meal_slot: mealSlot,
        source,
        barcode,
        product_name: productName,
        brand,
        serving_size: servingSize,
        calories,
        protein_g: proteinG,
        carbs_g: carbsG,
        fat_g: fatG,
      })
      .select('id,logged_date,meal_slot,source,barcode,product_name,brand,serving_size,calories,protein_g,carbs_g,fat_g,created_at')
      .single();

    if (error) return reply({error: 'Could not save nutrition entry.'}, 503);
    return reply({entry: data}, 201);
  } catch {
    return reply({error: 'Invalid nutrition payload.'}, 400);
  }
}

export async function DELETE(request: Request) {
  if (!validApiOrigin(request)) return reply({error: 'Invalid origin.'}, 403);
  const client = await getSupabaseServer();
  if (!client) return reply({error: 'Account storage unavailable.'}, 503);
  const user = await currentAccount(client, request);
  if (!user) return reply({error: 'Sign in to delete nutrition entries.'}, 401);

  const id = new URL(request.url).searchParams.get('id');
  if (!id || !UUID_RE.test(id)) return reply({error: 'Valid nutrition entry ID required.'}, 400);

  const {error} = await client.from('nutrition_logs').delete().eq('id', id).eq('user_id', user.id);
  if (error) return reply({error: 'Could not delete nutrition entry.'}, 503);
  return reply({deleted: true, id});
}
