import {validApiOrigin} from '@/lib/nativeApi';
import {NextResponse,type NextRequest} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {currentAccount} from '@/lib/accountSession';
import {trainingMutation} from '@/lib/training';
import {reconcileAfterGoalWrite} from '@/lib/goalTrackingServer';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){const client=await getSupabaseServer();if(!client)return reply({error:'Account storage unavailable.'},503);const user=await currentAccount(client,req);if(!user)return reply({error:'Sign in to view training.'},401);const after=Number(req.nextUrl.searchParams.get('after')??0);if(!Number.isSafeInteger(after)||after<0)return reply({error:'Invalid training cursor.'},400);const {data,error}=await client.rpc('read_training_page',{p_after:after});return error?reply({error:'Unable to load training.'},500):reply({...data,owner:user.id});}
export async function POST(req:NextRequest){
 if(!validApiOrigin(req))return reply({error:'Invalid origin.'},403);
 const client=await getSupabaseServer();if(!client)return reply({error:'Account storage unavailable.'},503);const user=await currentAccount(client);if(!user)return reply({error:'Sign in to save training.'},401);if(req.headers.get('x-profile-user')!==user.id)return reply({error:'Your account changed.'},409);
 try{const raw=await req.text();if(raw.length>2097152)return reply({error:'Training request too large.'},413);const input=JSON.parse(raw);
  let result;if(input.import!==undefined){if(input.version!==1||!Array.isArray(input.import)||input.import.length>20||!Number.isSafeInteger(input.epoch)||input.epoch<0)throw new Error('Invalid training import.');const changes=input.import.map((item:unknown)=>trainingMutation(item));if(changes.some((m:ReturnType<typeof trainingMutation>)=>m.epoch!==input.epoch))throw new Error('Import epoch mismatch.');result=await client.rpc('import_training',{changes,p_epoch:input.epoch});}
  else if (input.batch!==undefined) {
    if(input.version!==1||!Array.isArray(input.batch)||!input.batch.length||!Number.isSafeInteger(input.expectedCounter)||input.expectedCounter<0) throw Error('Invalid training batch.');
    const changes=input.batch.map((item:unknown)=>trainingMutation(item));
    result=await client.rpc('write_training_batch',{changes,p_counter:input.expectedCounter});
  } else result=await client.rpc('write_training',{m:trainingMutation(input)});
  if(result.error)return reply({error:result.error.code==='PT409'?'Training changed elsewhere. Reload before saving.':result.error.code==='22023'?result.error.message:'Unable to save training.'},result.error.code==='PT409'?409:result.error.code==='22023'?400:500);
  await reconcileAfterGoalWrite(client,user.id);
  return reply(input.import!==undefined?{imported:true,owner:user.id}:input.batch!==undefined?{events:result.data,owner:user.id}:{event:result.data,owner:user.id});
 }catch(e){return reply({error:e instanceof Error?e.message:'Invalid training change.'},400);}
}
