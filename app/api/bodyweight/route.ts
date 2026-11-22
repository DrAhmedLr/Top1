import {validApiOrigin} from '@/lib/nativeApi';
import {NextResponse,type NextRequest} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {currentAccount} from '@/lib/accountSession';
import {BODYWEIGHT_PAGE_SIZE,validWeightId,weightMutation} from '@/lib/bodyweight';
import {normalizeTimestamp} from '@/lib/timestamp';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const client=await getSupabaseServer();if(!client)return reply({error:'Account storage unavailable.'},503);
 const user=await currentAccount(client,req);if(!user)return reply({error:'Sign in to view weight history.'},401);
 try{
  const before=req.nextUrl.searchParams.get('before'),id=req.nextUrl.searchParams.get('id');
  if((before===null)!==(id===null)||id&&!validWeightId(id))throw new Error('Invalid weight history cursor.');
  const {data,error}=await client.rpc('read_bodyweight_page',{p_before:before?normalizeTimestamp(before):null,p_before_id:id,p_deleted:req.nextUrl.searchParams.get('deleted')==='1',p_limit:BODYWEIGHT_PAGE_SIZE});
  if(error)return reply({error:'Unable to load weight history.'},500);
  return reply(data);
 }catch{return reply({error:'Invalid weight history query.'},400);}
}
export async function POST(req:NextRequest){
 if(!validApiOrigin(req))return reply({error:'Invalid origin.'},403);
 const client=await getSupabaseServer();if(!client)return reply({error:'Account storage unavailable.'},503);
 const user=await currentAccount(client);if(!user)return reply({error:'Sign in to save weight history.'},401);
 if(req.headers.get('x-profile-user')!==user.id)return reply({error:'Your account changed.'},409);
 try{
  const raw=await req.text();if(raw.length>32768)return reply({error:'Request too large.'},413);
  const input=JSON.parse(raw);
  if(input?.entries!==undefined){
   if(!Array.isArray(input.entries)||input.entries.length>50)throw new Error('Import up to 50 weights at once.');
   const entries=input.entries.map((row:Record<string,unknown>)=>weightMutation({...row,requestId:row.id,action:'save',expectedRevision:0}));
   const {data,error}=await client.rpc('import_bodyweight',{p_entries:entries});
   if(error)return reply({error:'Weight import did not finish. Your browser records are retained.'},500);
   return reply({imported:Number(data)});
  }
  const mutation=weightMutation(input);
  const {data,error}=await client.rpc('write_bodyweight',{p_entry:mutation.id,p_request:mutation.requestId,p_revision:mutation.expectedRevision,p_action:mutation.action,p_value:mutation.value??null,p_unit:mutation.unit??null,p_measured_at:mutation.measuredAt??null,p_time_zone:mutation.timeZone??null,p_epoch:mutation.epoch??0});
  if(error)return reply({error:error.code==='PT409'?'This entry changed. Reload it before editing.':'Unable to save this weight change.',conflict:error.code==='PT409'},error.code==='PT409'?409:500);
  return reply({entry:data});
 }catch(error){return reply({error:error instanceof Error?error.message:'Invalid weight entry.'},400);}
}
