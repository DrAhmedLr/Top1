import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';
const reply=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});

export async function POST(req:Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin) return reply({error:'Invalid origin.'},403);
  if (!req.headers.get('content-type')?.startsWith('application/json')) return reply({error:'JSON is required.'},415);
  const client=await getSupabaseServer();
  if (!client) return reply({error:'Analytics storage unavailable.'},503);
  const user=await currentAccount(client,req);
  if (!user) return reply({error:'Sign in again.'},401);
  if (req.headers.get('x-profile-user')!==user.id) return reply({error:'Your account changed. Reload this page.'},409);
  let body;
  try {
    const text=await req.text();
    if (text.length>256) return reply({error:'Request too large.'},413);
    body=JSON.parse(text);
  } catch {return reply({error:'Invalid request.'},400);}
  if (typeof body?.enabled!=='boolean' || !Number.isSafeInteger(body.revision) || body.revision<0 || body.revision>2147483647)
    return reply({error:'Invalid collection setting.'},400);
  const {data,error}=await client.rpc('set_usage_collection',{p_enabled:body.enabled,p_revision:body.revision});
  if (error?.code==='42501') return reply({error:'Operator access required.'},403);
  if (error?.code==='PT409') return reply({error:'Another operator changed the setting. Reload before trying again.'},409);
  if (error) return reply({error:'Unable to change collection. Reload to verify its status.'},503);
  return reply(data,200);
}
