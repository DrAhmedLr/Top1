'use client';
import {useEffect,useRef,useState} from 'react';
import {captureEvent} from '../analytics';
import {historyChanges,readGuestHistory,validGuestHistory,type Observation} from '../history';
import type {Values} from '../registry';import type {MeasurementMetadata} from '../measurementMetadata';
export function useGuestHistory(values:Values,details:MeasurementMetadata,owner:string,ready:boolean,editing:boolean){
 const [entries,setEntries]=useState<Observation[]>([]),[error,setError]=useState('');
 const baseline=useRef<{owner:string;values:Values;details:MeasurementMetadata}|undefined>(undefined);
 useEffect(()=>{if(!ready||owner!=='guest'){baseline.current=undefined;setEntries([]);return;}if(editing)return;
  if(!baseline.current){baseline.current={owner,values,details};try{setEntries(readGuestHistory(localStorage.getItem('top1-history-guest')));}catch{setError('Browser history storage is unavailable.');}return;}
  const changes=historyChanges(baseline.current.values,values,baseline.current.details,details,new Date().toISOString());if(!changes.length)return;
  try{const raw=localStorage.getItem('top1-history-guest');if(!validGuestHistory(raw))throw new Error('Stored history could not be read; it has been retained.');const existing=readGuestHistory(raw),next=[...existing,...changes.map(e=>({...e,id:crypto.randomUUID()}))];localStorage.setItem('top1-history-guest',JSON.stringify({version:1,entries:next}));setEntries(next);for(const e of changes)captureEvent(e.cleared?'measurement_cleared':'measurement_saved',{metric_id:e.metricId});baseline.current={owner,values,details};setError('');}catch{setError('History could not be saved in this browser. Keep the page open.');}
 },[values,details,owner,ready,editing]);return {entries,error};
}
