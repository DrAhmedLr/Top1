'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { normalizeValues,type ProfileState } from '../profile';
export function useCloudSave(profile:ProfileState,enabled:boolean){
  const auth=useAuth();
  const [status,setStatus]=useState<'local'|'saving'|'saved'|'error'>('local');
  const [error,setError]=useState('');
  const [conflict,setConflict]=useState(false);
  const revisionRef=useRef<{userId:string;revision:number}|null>(null);
  const [saved,setSaved]=useState<{userId:string;profile:ProfileState}|null>(null);
  const queue=useRef<Promise<unknown>>(Promise.resolve());
  const timerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const cancelPending=useCallback(()=>{if(timerRef.current)clearTimeout(timerRef.current);timerRef.current=null;},[]);
  const currentUser=useRef(auth.user?.id);currentUser.current=auth.user?.id;
  const save=useCallback((next:ProfileState)=>{
    const userId=auth.user?.id;
    if(!userId)return Promise.reject(new Error('Sign in to save your cloud profile.'));
    const job=queue.current.catch(()=>{}).then(async()=>{
      if(currentUser.current!==userId)throw new Error('Your session changed. Please retry.');
      setStatus('saving');setError('');setConflict(false);
      const response=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json','X-Profile-User':userId},body:JSON.stringify({...next,revision:revisionRef.current?.userId===userId?revisionRef.current.revision:auth.cloud?.revision??0,values:normalizeValues(next.values)})});
      const body=await response.json();
      if(!response.ok){if(body.conflict)setConflict(true);throw new Error(body.error||'Unable to save your profile.');}
      if(currentUser.current===userId){revisionRef.current={userId,revision:body.profile.revision};setSaved({userId,profile:body.profile});setStatus('saved');}
      return body.profile as ProfileState;
    }).catch(error=>{if(currentUser.current===userId){setError(error instanceof Error?error.message:'Sync failed.');setStatus('error');}throw error;});
    queue.current=job;
    return job;
  },[auth.user?.id,auth.cloud?.revision]);
  useEffect(()=>{
    if(!enabled||!auth.user||!auth.cloud){setStatus('local');return;}
    setStatus('saving');
    const timer=timerRef.current=setTimeout(()=>{void save(profile).catch(()=>{});},700);
    return()=>clearTimeout(timer);
  },[profile,enabled,auth.user,auth.cloud,save]);
  return {status,error,conflict,saved:saved?.userId===auth.user?.id?saved?.profile??null:null,save,cancelPending};
}
