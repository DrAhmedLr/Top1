'use client';
import {useEffect,useRef,useState} from 'react';
import type {WorkspaceState} from './usePersonalWorkspace';
import {readWorkspace,type PersonalWorkspace} from '../personalWorkspace';
export const workspaceFormKey=(owner:string,scope:string)=>`top1-workspace-form-v1:${owner}:${scope}`;
type FormDraft<T>={values:T;data:PersonalWorkspace;revision:number};
/** Raw inputs are separate from validated save drafts, so incomplete edits survive refresh/navigation. */
export function useWorkspaceEditor<T>(s:WorkspaceState,scope:'goal'|'context',defaults:T){
 const [draft,setDraft]=useState<FormDraft<T>|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[corrupt,setCorrupt]=useState(false);
 const key=workspaceFormKey(s.owner,scope),settled=useRef(s.settled);
 useEffect(()=>{
  setLoaded(false);setDraft(null);setError('');setCorrupt(false);
  try{const raw=localStorage.getItem(key);if(raw){const d=JSON.parse(raw);if(!Number.isSafeInteger(d.revision)||d.revision<0||!d.values||typeof d.values!=='object')throw Error('Unreadable form draft. Export it before editing.');if(Object.entries(defaults as Record<string,unknown>).some(([k,v])=>Array.isArray(v)?!Array.isArray(d.values[k])||d.values[k].some((x:unknown)=>typeof x!=='string'):typeof d.values[k]!==typeof v))throw Error('Unreadable form draft. Export it before editing.');setDraft({...d,data:readWorkspace(d.data)});}}
  catch(e){setCorrupt(true);setError(e instanceof Error?e.message:'Unable to restore your draft.');}finally{setLoaded(true);}
 },[key]);
 const clear=()=>{try{localStorage.removeItem(key);setDraft(null);setError('');setCorrupt(false);}catch{setError('Unable to remove the draft.');}};
 useEffect(()=>{if(s.settled!==settled.current){settled.current=s.settled;if(s.settled&&['all',scope].includes(s.settled.scope))clear();}},[s.settled,scope,key]); // A successful retry or explicit discard also clears the raw form.
 const update=(values:T)=>{const next={values,data:draft?.data??s.data,revision:draft?.revision??s.revision};setDraft(next);try{localStorage.setItem(key,JSON.stringify(next));setError('');}catch{setError('Your draft is open here but could not be saved on this device. Keep this page open.');}};
 return {values:draft?.values??defaults,data:draft?.data??s.data,revision:draft?.revision??s.revision,dirty:!!draft||corrupt,loaded:loaded&&!corrupt,error,update,clear};
}
