'use client';
import {useEffect,useMemo,useState} from 'react';
import {accountReadOptions} from '../accountSession';
import {historySummary,type Observation} from '../history';

export function useRetests(owner:string,metric:string|undefined,guest:Observation[],revision:number){
  const [remote,setRemote]=useState<{key:string;latest?:Observation;comparison?:Observation[];failed?:boolean}>();
  const key=owner+':'+metric+':'+revision;
  useEffect(()=>{
    if(owner==='guest'||!metric)return;
    let active=true;const c=new AbortController();
    void fetch('/api/history?metric='+encodeURIComponent(metric),accountReadOptions(owner,c.signal)).then(async res=>{
      if(!res.ok)throw Error('history');const body=await res.json();
      if(active)setRemote({key,latest:body.latest,comparison:body.comparison??[]});
    }).catch(()=>{if(active)setRemote({key,failed:true});});return ()=>{active=false;c.abort();};
  },[owner,metric,key]);
  const local=useMemo(()=>historySummary(guest.filter(e=>e.metricId===metric)),[metric,guest]);
  if(owner==='guest')return {...local,failed:false,pending:false};
  return remote?.key===key?{...remote,pending:false}:{latest:undefined,comparison:undefined,failed:false,pending:true};
}
