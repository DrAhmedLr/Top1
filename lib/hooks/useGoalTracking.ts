'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {accountReadOptions} from '../accountSession';
import {replayGoalAttempts} from '../goalAttempts';
import type {GoalTracking} from '../goalTrackingTypes';
import type {Observation} from '../history';
import type {TrainingLedger} from '../trainingStorage';

export const goalSharingChanged='top1-goal-sharing-changed';

export function useGoalTracking(owner:string,ledger:TrainingLedger,entries:Observation[],revision:number,today:string,ready:boolean){
 const [refresh,setRefresh]=useState(0);
 const [remote,setRemote]=useState<{key:string;data?:GoalTracking}>();
 const [preference,setPreference]=useState<{owner:string;sharing:boolean;available:boolean}>();
 const [requested,setRequested]=useState<{owner:string;sharing:boolean}>();
 const [saving,setSaving]=useState(false),[saveFailed,setSaveFailed]=useState(false);
 const pending=useRef<AbortController|null>(null);
 const preferenceVersion=useRef(0);
 const key=JSON.stringify([owner,ledger.epoch,ledger.counter,revision,today,refresh]);

 useEffect(()=>{
  setSaving(false);setSaveFailed(false);setRequested(undefined);
  return ()=>{pending.current?.abort();pending.current=null;};
 },[owner]);

 useEffect(()=>{
  if(!ready||owner==='guest')return;
  const controller=new AbortController();
  const version=preferenceVersion.current;
  async function load(){
   const options=accountReadOptions(owner,controller.signal);
   let response=await fetch('/api/goal-tracking',options);
   if(response.status===409)response=await fetch('/api/goal-tracking',options);
   if(!response.ok)throw Error('Goal tracking unavailable');
   const data=await response.json() as GoalTracking;
   if(data.owner!==owner||!Array.isArray(data.attempts)||typeof data.sharing!=='boolean')throw Error('Invalid goal tracking');
   if(!controller.signal.aborted&&version===preferenceVersion.current){setRemote({key,data});setPreference({owner,sharing:data.sharing,available:data.sharingAvailable!==false});}
  }
  void load().catch(()=>{if(!controller.signal.aborted)setRemote({key});});
  return ()=>controller.abort();
 },[owner,ready,key]);
 const local=useMemo(()=>owner==='guest'&&ready?replayGoalAttempts(ledger.events,entries,Date.now()):undefined,[owner,ready,ledger.events,entries,today,refresh]);
 const current=ready&&remote?.key===key?remote:undefined;

 async function setSharing(sharing:boolean){
  if(owner==='guest'||pending.current||preference?.owner!==owner||!preference.available)return;
  const controller=new AbortController();
  preferenceVersion.current++;
  pending.current=controller;setRequested({owner,sharing});setSaving(true);setSaveFailed(false);
  try{
   const response=await fetch('/api/goal-tracking',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Profile-User':owner},body:JSON.stringify({sharing}),signal:controller.signal});
   if(!response.ok)throw Error('Preference not saved');
   const result=await response.json();
   if(result.owner!==owner||result.sharing!==sharing)throw Error('Preference not confirmed');
   if(!controller.signal.aborted){
    setPreference({owner,sharing,available:true});
    window.dispatchEvent(new Event(goalSharingChanged));
    setRefresh(n=>n+1);
   }
  }catch{if(!controller.signal.aborted){setSaveFailed(true);setRefresh(n=>n+1);}}
  finally{if(pending.current===controller){pending.current=null;setSaving(false);setRequested(undefined);}}
 }
 const selection=requested?.owner===owner?requested:preference;
 return {attempts:owner==='guest'?local:current?.data?.attempts,sharing:preference?.available&&selection?.owner===owner?selection.sharing:undefined,calibration:current?.data?.calibration,
  calibrations:current?.data?.calibrations ?? (current?.data?.calibration?[current.data.calibration]:[]),
  loading:ready&&owner!=='guest'&&!current,failed:!!current&&!current.data,saving,saveFailed,setSharing,
  retry:()=>{setSaveFailed(false);setRefresh(n=>n+1);}};
}
