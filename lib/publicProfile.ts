import { verifySummary, type SharedDemographics } from './summarySignature';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './supabaseConfig';
import { normalizeUsername,parsePublicSummary, type PublicSummary } from './profile';
import type { Demographics } from './registry';
export interface SharedProfile { username:string; demographics:SharedDemographics; summary:PublicSummary; signedAt:string }
export async function getPublicProfile(username:string):Promise<SharedProfile|null>{
  const config=getSupabaseConfig();if(!config)return null;
  let slug:string;try{slug=normalizeUsername(username);}catch{return null;}
  if(!slug)return null;
  // Anonymous, request-local client: public visibility is enforced even when an
  // owner is signed in. No service-role key or raw metric reads are involved.
  const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,cache:'no-store'})}});
  const {data,error}=await client.rpc('read_public_profile',{p_username:slug});
  if(error)throw new Error('Unable to load public profile.');
  const summary=parsePublicSummary(data?.summary);
  if(!data||!summary||data.username!==slug)return null;
  const demographics:SharedDemographics={ageCohort:data.ageCohort,sex:data.sex,...(data.weight==null?{}:{weight:Number(data.weight)}),...(data.height==null?{}:{height:Number(data.height)})};
  const signedAt=await verifySummary(summary,data.summary,slug,demographics);
  return signedAt?{username:slug,demographics,summary,signedAt}:null;
}
