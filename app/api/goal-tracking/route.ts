import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {accountGoalTracking,setGoalSharing} from '@/lib/goalTrackingServer';
import {validApiOrigin} from '@/lib/nativeApi';
import {InsightsChanged} from '@/lib/performanceInsightsServer';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});

export async function GET(request:Request) {
  const client=await getSupabaseServer();
  if (!client) return reply({error:'Account storage unavailable.'},503);
  const user=await currentAccount(client,request);
  if (!user || user.is_anonymous) return reply({error:'Sign in to view your goals.'},401);
  try {return reply(await accountGoalTracking(client,user.id));}
  catch (error) {
    return error instanceof InsightsChanged ? reply({error:'Your plan changed. Reload the results.'},409) :
      reply({error:'Goal tracking is temporarily unavailable.'},503);
  }
}

export async function POST(request:Request) {
  if (!validApiOrigin(request)) return reply({error:'Invalid request origin.'},403);
  const client=await getSupabaseServer();
  if (!client) return reply({error:'Account storage unavailable.'},503);
  const user=await currentAccount(client,request);
  if (!user || user.is_anonymous) return reply({error:'Sign in to change forecast sharing.'},401);
  if (request.headers.get('x-profile-user')!==user.id) return reply({error:'Account changed.'},409);
  const raw=await request.text();
  if (raw.length>128) return reply({error:'Request too large.'},413);
  let input;
  try {input=JSON.parse(raw);} catch {return reply({error:'Invalid sharing preference.'},400);}
  if (typeof input?.sharing!=='boolean') return reply({error:'Choose a sharing preference.'},400);
  try {return reply({owner:user.id,sharing:await setGoalSharing(client,user.id,input.sharing)});}
  catch {return reply({error:'Unable to update forecast sharing.'},503);}
}
