import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {journeyInput, journeyRequestIp, journeyWriteProof} from '@/lib/customerJourneyInput';
import {validApiOrigin} from '@/lib/nativeApi';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const unavailable=()=>reply({error:'Journey settings are temporarily unavailable.'},503);

async function account(request:Request) {
  const client=await getSupabaseServer();
  if (!client) return {error:unavailable()};
  const user=await currentAccount(client);
  if (!user) return {error:reply({error:'Sign in again.'},401)};
  if (request.headers.get('x-profile-user')!==user.id) return {error:reply({error:'Your account changed.'},409)};
  return {client,owner:user.id};
}

export async function GET(request:Request) {
  const session=await account(request);
  if ('error' in session) return session.error;
  const {data,error}=await session.client.rpc('customer_journey_preference',{p_owner:session.owner,p_enabled:null});
  return error ? unavailable() : reply(data);
}

export async function POST(request:Request) {
  if (!validApiOrigin(request)) return reply({error:'Invalid origin.'},403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({error:'JSON is required.'},415);
  const session=await account(request);
  if ('error' in session) return session.error;
  if (Number(request.headers.get('content-length'))>16384) return reply({error:'Request too large.'},413);
  let input;
  try {
    const raw=await request.text();
    if (raw.length>16384) return reply({error:'Request too large.'},413);
    input=journeyInput(JSON.parse(raw));
  } catch {return reply({error:'Invalid request.'},400);}
  if (!input) return reply({error:'Invalid journey data.'},400);
  const proof=journeyWriteProof(process.env.TOP1_GOAL_TRACKING_KEY);
  if ('enabled' in input) {
    if (input.enabled && !proof) return unavailable();
    const {data,error}=await session.client.rpc('customer_journey_preference',{p_owner:session.owner,p_enabled:input.enabled});
    return error ? unavailable() : reply(data);
  }
  if (!proof) return unavailable();
  const {data,error}=await session.client.rpc('record_customer_journey',{p_owner:session.owner,p_consent:input.consentId,
    p_events:input.events,p_ip:journeyRequestIp(request.headers,process.env.VERCEL==='1'),p_proof:proof});
  return error ? unavailable() : reply({accepted:data});
}
