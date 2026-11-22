import { createServerClient } from '@supabase/ssr';
import {cookies,headers} from 'next/headers';
import {createClient} from '@supabase/supabase-js';
import {bearerToken,usesBearerAuth} from './nativeApi';
import { getSupabaseConfig } from './supabaseConfig';
export async function getSupabaseServer() {
  const config = getSupabaseConfig();
  if (!config) return null;
  const incoming=await headers(),token=bearerToken(incoming);
  // Never fall back to a cookie identity when a native request supplies invalid/missing credentials.
  if(usesBearerAuth(incoming)){

    return createClient(config.url,config.key,{global:{headers:token?{Authorization:`Bearer ${token}`} : {}},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  }
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(items) {
        try { items.forEach(({name,value,options}) => store.set(name,value,options)); }
        catch { /* Server Components are read-only; middleware refreshes cookies. */ }
      },
    },
  });
}
