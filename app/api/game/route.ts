import {validApiOrigin} from '@/lib/nativeApi';
import {currentAccount} from '@/lib/accountSession';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {NextResponse,type NextRequest} from 'next/server';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
 if(!validApiOrigin(req))return reply({error:'Invalid origin.'},403);
 const client=await getSupabaseServer();if(!client)return reply({error:'Account storage unavailable.'},503);
 const user=await currentAccount(client);if(!user||user.is_anonymous)return reply({error:'Sign in to sync game progress.'},401);
 if(req.headers.get('x-profile-user')!==user.id)return reply({error:'Your account changed.'},409);
 try{const raw=await req.text();if(raw.length>262144)return reply({error:'Progress too large.'},413);const body=JSON.parse(raw);if(body?.version!==1||!body.days||typeof body.days!=='object'||Array.isArray(body.days))return reply({error:'Invalid progress.'},400);
 const {data,error}=await client.rpc('sync_game_progress',{p_days:body.days});return error?reply({error:'Progress could not sync. Your device copy is retained.'},503):reply(data);
 }catch{return reply({error:'Invalid progress.'},400);}
}
