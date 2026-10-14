import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {deleteOwnAccount} from './accountLifecycle.ts';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
// Platform-injected secrets remain inside this runtime. No credential is
// retrieved, exported, printed or copied into the Next.js environment.
Deno.serve(async(request:Request)=>{
 const url=Deno.env.get('SUPABASE_URL');
 const injected=(name:string)=>{try{return JSON.parse(Deno.env.get(name)??'{}').default;}catch{return undefined;}};
 const publicKey=injected('SUPABASE_PUBLISHABLE_KEYS')??Deno.env.get('SUPABASE_ANON_KEY');
 const adminKey=injected('SUPABASE_SECRET_KEYS')??Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!publicKey||!adminKey)return reply({error:'Account deletion is unavailable.'},503);
 const authorization=request.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in.'},401);
 const token=authorization.slice(7),owner=createClient(url,publicKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await owner.auth.getUser(token);
 if(error||!user||user.is_anonymous)return reply({error:'Sign in.'},401);
 const active=await owner.rpc('active_account_session');if(active.error||active.data!==true)return reply({error:'Sign in again.'},401);
 if(request.method==='GET')return reply({accountDeletionConfigured:true});
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  if(Number(request.headers.get('content-length')??0)>1024)return reply({error:'Request too large.'},413);
  const text=await request.text();if(text.length>1024)return reply({error:'Request too large.'},413);
  const body=JSON.parse(text);
  await deleteOwnAccount(user.id,body.confirmation,{
   recentSession:async()=>{const r=await owner.rpc('recent_account_session');return !r.error&&r.data===true;},
   revoke:async()=>{const r=await admin.auth.admin.signOut(token,'global');if(r.error)throw new Error('Session revocation failed. Nothing was deleted.');const p=await admin.from('profiles').update({is_public:false,public_summary:{}}).eq('id',user.id);if(p.error)throw new Error('Privacy cleanup failed. Sign in again to retry.');},
   remove:async id=>{const r=await admin.auth.admin.deleteUser(id);if(r.error)throw new Error('Deletion did not finish. Sign in again to retry.');},
  });return reply({deleted:true});
 }catch(e){return reply({error:e instanceof Error?e.message:'Deletion failed.'},400);}
});
