import {validApiOrigin} from './nativeApi';
import type {SupabaseClient} from '@supabase/supabase-js';
import {currentAccount} from './accountSession';
import {emptyWorkspace,readWorkspace} from './personalWorkspace';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export function personalWorkspaceHandlers(getClient:()=>Promise<SupabaseClient|null>){
async function GET(req:Request){
 const client=await getClient();if(!client)return reply({error:'Account storage unavailable.'},503);
 const user=await currentAccount(client,req);if(!user)return reply({error:'Sign in required.'},401);
 const {data,error}=await client.from('personal_workspaces').select('data,revision').eq('user_id',user.id).maybeSingle();
 if(error)return reply({error:'Unable to load your goals and preferences.'},500);
 try{return reply({owner:user.id,data:data?readWorkspace(data.data):emptyWorkspace(),revision:data?.revision??0});}catch{return reply({error:'Stored workspace needs review. Export your account data before editing.'},422);}
}
async function POST(req:Request){
 if(!validApiOrigin(req))return reply({error:'Invalid origin.'},403);
 const client=await getClient();if(!client)return reply({error:'Account storage unavailable.'},503);
 const user=await currentAccount(client);if(!user)return reply({error:'Sign in required.'},401);
 if(req.headers.get('x-profile-user')!==user.id)return reply({error:'Account changed. Reload.'},409);
 try{
  const raw=await req.text();if(raw.length>16384)return reply({error:'Request too large.'},413);
  const input=JSON.parse(raw);if(!Number.isSafeInteger(input.revision)||input.revision<0)throw Error('Invalid revision.');
  const data=readWorkspace(input.data);
  const result=await client.rpc('save_personal_workspace',{p_data:data,p_revision:input.revision});
  if(result.error)return reply({error:result.error.code==='PT409'?'Saved elsewhere. Review both versions before replacing.':'Unable to save. Your draft is retained.'},result.error.code==='PT409'?409:500);
  return reply({owner:user.id,data:readWorkspace(result.data.data),revision:result.data.revision});
 }catch{return reply({error:'Check your goal and training preferences.'},400);}
}

return {GET,POST};
}
