'use client';
import {useEffect,useRef,useState} from 'react';
import {getSupabaseClient} from '../supabaseClient';
import {migrateLocalProfile} from '../authMigration';
import {captureEvent} from '../analytics';
import {LOCAL_PROFILE_KEYS,parseLocalProfile,type ProfileState} from '../profile';
export function useAuthMigration(userId:string|undefined){
 const [state,setState]=useState<{userId?:string;profile:ProfileState|null;guest:ProfileState|null;error:string;loading:boolean;importing:boolean}>({profile:null,guest:null,error:'',loading:false,importing:false});
 const [attempt,setAttempt]=useState(0),dismissed=useRef<string|undefined>(undefined),current=useRef(userId);current.current=userId;
 useEffect(()=>{
  if(!userId){setState({profile:null,guest:null,error:'',loading:false,importing:false});return;}
  let active=true;setState({userId,profile:null,guest:null,error:'',loading:true,importing:false});
  async function load(){try{
   const response=await fetch('/api/profile',{cache:'no-store'}),body=await response.json();if(!response.ok)throw new Error(body.error||'Unable to load your profile.');
   let guest:ProfileState|null=null;
   if(dismissed.current!==userId)for(const key of LOCAL_PROFILE_KEYS){const raw=localStorage.getItem(key);if(raw){const p=parseLocalProfile(raw);if(p){guest=p;break;}}}
   if(active)setState({userId,profile:body.profile,guest,error:'',loading:false,importing:false});
  }catch(e){if(active)setState({userId,profile:null,guest:null,error:e instanceof Error?e.message:'Unable to load your profile.',loading:false,importing:false});}}
  void load();return()=>{active=false;};
 },[userId,attempt]);
 async function importGuest(){
  const owner=userId,client=getSupabaseClient();if(!owner||!client||current.current!==owner)throw new Error('Your account changed.');
  setState(s=>({...s,importing:true,error:''}));
  try{
   const verified=await client.auth.getUser();if(verified.error||verified.data.user?.id!==owner)throw new Error('Your account changed.');
   const migrated=await migrateLocalProfile({rpc:(_name,args)=>client.rpc('import_guest_profile',{...args,p_expected_user:owner})},localStorage,async raw=>{
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
   });
   if(migrated)captureEvent('profile_migrated');
   const response=await fetch('/api/profile',{cache:'no-store'}),body=await response.json();if(!response.ok)throw new Error(body.error||'Import completed; reload your account to view it.');
   if(current.current!==owner)return null;
   setState({userId:owner,profile:body.profile,guest:null,error:'',loading:false,importing:false});return body.profile as ProfileState;
  }catch(e){if(current.current===owner)setState(s=>({...s,importing:false,error:e instanceof Error?e.message:'Import failed. Guest data is retained.'}));throw e;}
 }
 return {...state,importGuest,dismissGuest:()=>{dismissed.current=userId;setState(s=>({...s,guest:null}));},retry:()=>setAttempt(n=>n+1)};
}
