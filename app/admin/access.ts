import {currentAccount} from '@/lib/accountSession';
import {getSupabaseServer} from '@/lib/supabaseServer';

export async function getOperator() {
  const client = await getSupabaseServer();
  if (!client) return {state:'unavailable'} as const;
  const user = await currentAccount(client);
  if (!user) return {state:'signed-out'} as const;
  const {data, error} = await client.rpc('is_usage_operator', {p_owner:user.id});
  if (error && error.code!=='42501') return {state:'unavailable'} as const;
  if (error || data!==true) return {state:'denied'} as const;
  return {state:'ready', client, owner:user.id} as const;
}
