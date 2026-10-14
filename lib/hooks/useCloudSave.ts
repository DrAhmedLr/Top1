'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/components/providers/AuthProvider';
import {captureEvent} from '../analytics';
import {historyChanges} from '../history';
import {normalizeValues,type ProfileState} from '../profile';
import {draftKey,parseDraft,profileFingerprint,serializeDraft} from '../drafts';
import {ProfileSaveQueue,SupersededSave} from '../profileSaveQueue';
export function useCloudSave(profile:ProfileState,enabled:boolean,editing=false){
 const auth=useAuth(),owner=auth.user?.id;
 const [status,setStatus]=useState<'local'|'saving'|'saved'|'error'>('local'),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
 const [draft,setDraft]=useState<ProfileState|null>(null),[reviewing,setReviewing]=useState(false),[checkedOwner,setCheckedOwner]=useState<string>();
 const [saved,setSaved]=useState<{owner:string;profile:ProfileState}|null>(null);
 const latestDraftFingerprint=useRef<string|null>(null);
 const lastStored=useRef<ProfileState|null>(null);
 const queue=useRef(new ProfileSaveQueue()),timer=useRef<ReturnType<typeof setTimeout>|null>(null),currentOwner=useRef(owner);currentOwner.current=owner;
 const cancelPending=useCallback(()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;},[]);
 useEffect(()=>{cancelPending();queue.current.invalidate();setError('');setConflict(false);setStatus('local');setDraft(null);setReviewing(false);setCheckedOwner(undefined);},[owner,cancelPending]);
 useEffect(()=>{
  if(auth.loading){cancelPending();queue.current.invalidate();setStatus('local');return;}
  if(!owner||!auth.cloud)return;
  if(!queue.current.adopt(owner,auth.cloud.revision??0))return;
  lastStored.current=auth.cloud;setSaved(null);setStatus('local');setConflict(false);
  try{const found=parseDraft(localStorage.getItem(draftKey(owner)),owner);setDraft(found&&profileFingerprint(found)!==profileFingerprint(auth.cloud)?found:null);}catch{setError('Unsaved-draft storage is unavailable. Keep this page open.');}
  setCheckedOwner(owner);
 },[owner,auth.cloud,auth.loading,cancelPending]);
 const baseline=saved&&saved.owner===owner?saved.profile:auth.cloud;
 const unsaved=!!owner&&!!baseline&&profileFingerprint(profile)!==profileFingerprint(baseline);
 const save=useCallback((next:ProfileState,options?:{visibilityIntent:boolean})=>{
  latestDraftFingerprint.current=profileFingerprint(next);const userId=owner;if(!userId)return Promise.reject(new Error('Sign in to save.'));
  return queue.current.enqueue(userId,next,async payload=>{
   if(currentOwner.current!==userId)throw new SupersededSave();
   setStatus('saving');setError('');
   try{if(latestDraftFingerprint.current===profileFingerprint(next))localStorage.setItem(draftKey(userId),serializeDraft(payload,userId));}catch{throw new Error('Draft storage is unavailable. Keep this page open and retry.');}
   const response=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json','X-Profile-User':userId},body:JSON.stringify({...payload,visibilityIntent:options?.visibilityIntent,values:normalizeValues(payload.values)})});
   const body=await response.json();if(!response.ok){const failure=new Error(body.error||'Unable to save. Your draft is retained.');Object.assign(failure,{conflict:!!body.conflict});throw failure;}
   return body.profile as ProfileState;
  }).then(storedProfile=>{
   if(currentOwner.current!==userId)throw new SupersededSave();
   if(lastStored.current)for(const e of historyChanges(lastStored.current.values,storedProfile.values,lastStored.current.measurementDetails??{},storedProfile.measurementDetails??{},new Date().toISOString()))captureEvent(e.cleared?'measurement_cleared':'measurement_saved',{metric_id:e.metricId});
   lastStored.current=storedProfile;setSaved({owner:userId,profile:storedProfile});setStatus('saved');setConflict(false);setReviewing(false);setDraft(null);
   // Cleanup failure must not turn an acknowledged cloud save into a failed save.
   try{const stored=parseDraft(localStorage.getItem(draftKey(userId)),userId);if(stored&&profileFingerprint(stored)===profileFingerprint(next))localStorage.removeItem(draftKey(userId));}catch{setError('Profile saved. Local draft cleanup is unavailable.');}
   return storedProfile;
  }).catch(e=>{if(currentOwner.current===userId&&!(e instanceof SupersededSave)){setConflict(!!e.conflict);setError(e instanceof Error?e.message:'Sync failed. Your draft is retained.');setStatus('error');}throw e;});
 },[owner]);
 useEffect(()=>{
  if(!enabled||!owner||!auth.cloud||checkedOwner!==owner||draft)return;
  if(!unsaved)return;
  try{latestDraftFingerprint.current=profileFingerprint(profile);localStorage.setItem(draftKey(owner),serializeDraft({...profile,revision:queue.current.currentRevision(owner)},owner));}catch{setError('Draft storage is unavailable. Keep this page open.');setStatus('error');return;}
  if(editing||reviewing||conflict)return;
  setStatus('saving');timer.current=setTimeout(()=>void save(profile).catch(()=>{}),700);return cancelPending;
 },[profile,enabled,editing,owner,auth.cloud,checkedOwner,draft,reviewing,conflict,unsaved,save,cancelPending]);
 function restoreDraft(){if(!draft||!auth.cloud)return null;cancelPending();setReviewing(true);setDraft(null);return {...draft,isPublic:auth.cloud.isPublic,revision:auth.cloud.revision};}
 function discardDraft(){cancelPending();queue.current.invalidate();try{if(owner)localStorage.removeItem(draftKey(owner));}catch{setError('Local draft cleanup is unavailable.');return;}setDraft(null);setReviewing(false);setConflict(false);setStatus('saved');setError('');}
 return {draftReady:!owner||checkedOwner===owner,status,error,conflict,unsaved,draft:checkedOwner===owner?draft:null,reviewing:checkedOwner===owner&&reviewing,restoreDraft,discardDraft,saved:saved&&saved.owner===owner?saved.profile:null,save,cancelPending};
}
