import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {getSupabaseConfig} from './supabaseConfig';
// This module is imported by server route handlers only. The key has no public
// prefix and is never serialized into responses, logs or client components.
export function getSupabaseAdmin(){
 if(typeof window!=='undefined')throw new Error('Server-only account administration.');
 const config=getSupabaseConfig(),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 return config&&key?createClient(config.url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
}
