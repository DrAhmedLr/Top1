'use client';
import {useEffect,useState} from 'react';
import type {Observation} from '../history';
import {readRankHistory} from '../rankExplorer';

const empty:Observation[]=[];
export function usePrivateMetricHistory(owner:string,metric:string,revision:number,guest:Observation[],enabled:boolean) {
  const [attempt,setAttempt]=useState(0);
  const key=JSON.stringify([owner,metric,revision,attempt]);
  const [remote,setRemote]=useState<{key:string;rows:Observation[];failed:boolean}>();
  useEffect(()=>{
    if(owner==='guest'||!enabled)return;
    const controller=new AbortController();
    void readRankHistory(owner,metric,controller.signal).then(rows=>{
      if(!controller.signal.aborted)setRemote({key,rows,failed:false});
    }).catch(()=>{
      if(!controller.signal.aborted)setRemote({key,rows:empty,failed:true});
    });
    return ()=>controller.abort();
  },[owner,metric,key,enabled]);
  const current=remote?.key===key?remote:undefined;
  return {
    rows:owner==='guest'?guest:current?.rows??empty,
    loading:enabled&&owner!=='guest'&&!current,
    failed:enabled&&owner!=='guest'&&!!current?.failed,
    retry:()=>setAttempt(n=>n+1),
  };
}
