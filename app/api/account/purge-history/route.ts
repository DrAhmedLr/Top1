import {currentAccount} from '@/lib/accountSession';
import {NextResponse,type NextRequest} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {metrics} from '@/lib/registry';
import {DELETE_HISTORY_CONFIRMATION,validateDestructiveRequest} from '@/lib/accountLifecycle';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return reply({error:'Invalid origin.'},403);
 const client=await getSupabaseServer();if(!client)return reply({error:'Account storage unavailable.'},503);
 const user=await currentAccount(client);if(!user||user.is_anonymous)return reply({error:'Sign in before deleting history.'},401);
 if(req.headers.get('x-profile-user')!==user.id)return reply({error:'Your account changed.'},409);
 try{const text=await req.text();if(text.length>1024)return reply({error:'Request too large.'},413);const input=JSON.parse(text);validateDestructiveRequest(input,DELETE_HISTORY_CONFIRMATION);
 if(input.metricId!==null&&!metrics.some(m=>m.id===input.metricId))throw new Error('Choose a measurement or all history.');if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new Error('Reload the saved profile before deleting history.');
 const {data,error}=await client.rpc('purge_own_history',{p_metric:input.metricId,p_expected_revision:input.revision});
 if(error)return reply({error:error.code==='PT409'?'Your profile changed. Reload it before deleting history.':error.code==='42501'?'Sign in again before deleting history.':'Unable to delete history.',conflict:error.code==='PT409'},error.code==='PT409'?409:error.code==='42501'?401:500);
 return reply({deleted:true,revision:Number(data),publicSharingDisabled:true});
 }catch(e){return reply({error:e instanceof Error?e.message:'Invalid request.'},400);}
}
