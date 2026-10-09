import { verifySummary } from './summarySignature';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabaseConfig';
import { normalizeUsername,parsePublicSummary, type PublicSummary } from './profile';
import type { Demographics } from './registry';
export interface SharedProfile { username:string; demographics:Demographics; summary:PublicSummary; updatedAt:string; signedAt:string }
export async function getPublicProfile(username:string):Promise<SharedProfile|null>{
  const config=getSupabaseConfig();if(!config)return null;
  let slug:string;try{slug=normalizeUsername(username);}catch{return null;}
  if(!slug)return null;
  // Anonymous, request-local client: public visibility is enforced even when an
  // owner is signed in. No service-role key or raw metric reads are involved.
  const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,cache:'no-store'})}});
  const {data,error}=await client.from('profiles').select('id,username,age,sex,weight_kg,height_cm,public_summary,updated_at').eq('username',slug).eq('is_public',true).maybeSingle();
  if(error)throw new Error('Unable to load public profile.');
  const summary=parsePublicSummary(data?.public_summary);
  if(!data||!summary)return null;
  const demographics:Demographics={age:data.age,sex:data.sex,weight:Number(data.weight_kg),height:Number(data.height_cm)};
  const signedAt=await verifySummary(summary,data.public_summary,data.id,demographics);
  return signedAt?{username:data.username,demographics,summary,updatedAt:data.updated_at,signedAt}:null;
}
