import type {SupabaseClient} from '@supabase/supabase-js';
export async function currentAccount(client:SupabaseClient){
 const {data:{user},error}=await client.auth.getUser();if(error||!user||user.is_anonymous)return null;
 const active=await client.rpc('active_account_session');return !active.error&&active.data===true?user:null;
}
