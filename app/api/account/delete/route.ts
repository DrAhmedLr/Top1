import {currentAccount} from '@/lib/accountSession';
import {NextResponse,type NextRequest} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {getSupabaseAdmin} from '@/lib/supabaseAdmin';
import {deleteOwnAccount} from '@/lib/accountLifecycle';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return reply({error:'Invalid origin.'},403);
 const client=await getSupabaseServer();if(!client)return reply({error:'Account storage unavailable.'},503);
 const user=await currentAccount(client);if(!user||user.is_anonymous)return reply({error:'Sign in to delete your account.'},401);
 if(req.headers.get('x-profile-user')!==user.id)return reply({error:'Your account changed.'},409);
 const admin=getSupabaseAdmin();if(!admin){try{const text=await req.text();if(text.length>1024)return reply({error:'Request too large.'},413);const body=JSON.parse(text);if(body.confirmation!=='DELETE MY ACCOUNT')return reply({error:'Type DELETE MY ACCOUNT to confirm.'},400);const result=await client.functions.invoke('delete-own-account',{body:{confirmation:body.confirmation}});if(result.error)return reply({error:'Deletion did not finish. Sign in again and retry.'},503);return reply(result.data);}catch{return reply({error:'Unable to delete the account. Nothing has been confirmed deleted.'},400);}}
 try{const text=await req.text();if(text.length>1024)return reply({error:'Request too large.'},413);const body=JSON.parse(text);
 await deleteOwnAccount(user.id,body.confirmation,{
  recentSession:async()=>{const {data,error}=await client.rpc('recent_account_session');return !error&&data===true;},
  revoke:async()=>{const {data:{session}}=await client.auth.getSession();if(!session||session.user.id!==user.id)throw new Error('Your session changed.');const {error}=await admin.auth.admin.signOut(session.access_token,'global');if(error)throw new Error('Unable to revoke account sessions. Your account has not been deleted.');const revoked=await admin.from('profiles').update({is_public:false,public_summary:{}}).eq('id',user.id);if(revoked.error)throw new Error('Sessions revoked, but privacy cleanup did not finish. Sign in again to retry deletion.');},
  remove:async id=>{const {error}=await admin.auth.admin.deleteUser(id);if(error)throw new Error('Deletion did not finish. Sessions were revoked; sign in again to retry.');},
 });return reply({deleted:true});
 }catch(e){return reply({error:e instanceof Error?e.message:'Unable to delete the account.'},400);}
}
