'use client';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { migrateLocalProfile } from '../authMigration';
import { captureEvent } from '../analytics';
import type { ProfileState } from '../profile';
export function useAuthMigration(userId: string | undefined) {
  const [state,setState]=useState<{userId?:string;profile:ProfileState|null;error:string;loading:boolean}>({profile:null,error:'',loading:false});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!userId){setState({profile:null,error:'',loading:false});return;}
    let active=true;
    setState({userId,profile:null,error:'',loading:true});
    // This effect runs outside onAuthStateChange to avoid the auth-lock deadlock.
    async function load(){
      try{
        const client=getSupabaseClient();
        if(!client) throw new Error('Cloud storage is not configured.');
        const migrated=await migrateLocalProfile(client,localStorage,async raw=>{
          const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
          return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
        });
        if(migrated)captureEvent('profile_migrated');
        const response=await fetch('/api/profile',{cache:'no-store'});
        const body=await response.json();
        if(!response.ok)throw new Error(body.error||'Unable to load your cloud profile.');
        if(active)setState({userId,profile:body.profile,error:'',loading:false});
      }catch(error){if(active)setState({userId,profile:null,error:error instanceof Error?error.message:'Unable to sync profile.',loading:false});}
    }
    void load();
    return()=>{active=false;};
  },[userId,attempt]);
  return {...state,retry:()=>setAttempt(value=>value+1)};
}
