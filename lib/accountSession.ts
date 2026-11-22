import type {SupabaseClient} from '@supabase/supabase-js';
import {bearerToken,usesBearerAuth} from './nativeApi';
export function accountReadOptions(owner:string,signal?:AbortSignal):RequestInit{
 return {cache:'no-store',headers:{'X-Profile-User':owner},signal};
}
export async function currentAccount(client:SupabaseClient,request?:Request){
 const {data:{user},error}=await client.auth.getUser();if(error||!user||user.is_anonymous)return null;
 // Older clients omit this hint. Always authorize using the verified user.
 const expectedOwner=request?.headers.get('x-profile-user');
 if(expectedOwner!=null&&expectedOwner!==user.id)return null;
 const active=await client.rpc('active_account_session');return !active.error&&active.data===true?user:null;
}

export async function verifiedRevocationToken(client:SupabaseClient,headers:Headers,owner:string){
 const token=usesBearerAuth(headers)
  ? bearerToken(headers)
  : (await client.auth.getSession()).data.session?.access_token;
 if(!token)throw new Error('Your session changed.');
 const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user||user.is_anonymous||user.id!==owner)throw new Error('Your session changed.');
 return token;
}
