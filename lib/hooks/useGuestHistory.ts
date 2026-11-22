'use client';
import {useEffect,useRef,useState} from 'react';
import {captureEvent} from '../analytics';
import {historyChanges,type Observation} from '../history';
import {commitGuestHistory,readStoredGuestHistory} from '../guestProfileStorage';
import type {Demographics,Values} from '../registry';
import type {MeasurementMetadata} from '../measurementMetadata';

export function useGuestHistory(values:Values,details:MeasurementMetadata,owner:string,ready:boolean,editing:boolean,demographics?:Demographics){
 const [entries,setEntries]=useState<Observation[]>([]),[error,setError]=useState('');
 const baseline=useRef<{values:Values;details:MeasurementMetadata}|undefined>(undefined);
 function reload() {
  try { setEntries(readStoredGuestHistory(localStorage).entries);setError(''); }
  catch { setEntries([]);setError('Stored history could not be read. Your records have been retained.'); }
 }
 function saveWithProfile(nextValues:Values,nextDetails:MeasurementMetadata,person?:Demographics,writeProfile?:()=>void) {
  const before=baseline.current??{values,details};
  const changes=historyChanges(before.values,nextValues,before.details,nextDetails,new Date().toISOString());
  try {
   const next=commitGuestHistory(localStorage,changes,person,writeProfile);
   baseline.current={values:nextValues,details:nextDetails};
   setEntries(next);setError('');
  } catch(reason) {
   setError('History could not be saved in this browser. Keep the page open.');
   throw reason;
  }
  for(const entry of changes)captureEvent(entry.cleared?'measurement_cleared':'measurement_saved',{metric_id:entry.metricId});
 }
 useEffect(()=>{
  if(owner!=='guest'){baseline.current=undefined;setEntries([]);setError('');return;}
  if(!ready||editing)return;
  if(!baseline.current){baseline.current={values,details};reload();return;}
  if(baseline.current.values===values&&baseline.current.details===details)return;
  // Changes made outside the focused entry form (for example, during onboarding).
  try { saveWithProfile(values,details,demographics); } catch { /* The error remains visible. */ }
 },[values,details,owner,ready,editing,demographics]);
 useEffect(()=>{
  if(owner!=='guest'||!ready)return;
  function changed(event:StorageEvent){if(event.key==='top1-history-guest'||event.key===null)reload();}
  window.addEventListener('storage',changed);
  return ()=>window.removeEventListener('storage',changed);
 },[owner,ready]);
 function resetBaseline(nextValues:Values={},nextDetails:MeasurementMetadata={}){
  baseline.current=owner==='guest'?{values:nextValues,details:nextDetails}:undefined;
  if(owner==='guest')reload();
 }
 return {entries,error:owner==='guest'?error:'',resetBaseline,saveWithProfile};
}
