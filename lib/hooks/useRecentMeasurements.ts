'use client';
import {useEffect,useState} from 'react';
import {accountReadOptions} from '../accountSession';
import type {Observation} from '../history';

export function useRecentMeasurements(owner:string|undefined,enabled:boolean,revision?:number) {
  const [result,setResult]=useState<{owner:string;revision?:number;entries:Observation[];error:boolean}>();
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!owner||!enabled)return;
    const controller=new AbortController();
    async function load(account:string) {
      try {
        const response=await fetch('/api/history?recent=1',accountReadOptions(account,controller.signal));
        if(!response.ok)throw new Error();
        const body=await response.json();
        if(body.owner!==account||!Array.isArray(body.entries))throw new Error();
        if(!controller.signal.aborted)setResult({owner:account,revision,entries:body.entries,error:false});
      } catch {
        if(!controller.signal.aborted)setResult({owner:account,revision,entries:[],error:true});
      }
    }
    void load(owner);
    return ()=>controller.abort();
  },[owner,enabled,revision,attempt]);
  const current=owner&&result?.owner===owner&&result.revision===revision?result:undefined;
  return {entries:current?.entries??[],error:!!current?.error,retry:()=>setAttempt(n=>n+1)};
}
