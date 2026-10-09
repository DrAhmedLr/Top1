import type { getSupabaseConfig } from './supabaseConfig';
export async function checkGoogleProvider(config:NonNullable<ReturnType<typeof getSupabaseConfig>>,request:typeof fetch=fetch){
  const response=await request(`${config.url}/auth/v1/settings`,{headers:{apikey:config.key},cache:'no-store'});
  if(!response.ok)throw new Error('Sign-in is temporarily unavailable. Please try again.');
  const settings=await response.json();
  if(settings.external?.google!==true)throw new Error('Google sign-in is temporarily unavailable. Your local measurements are safe.');
}
