'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {emptyTraining,trainingHttp,trainingKey,trainingRepository,type TrainingLedger} from './trainingStorage';
import type {TrainingMutation} from './training';

type Repository=ReturnType<typeof trainingRepository>;
type Binding={owner:string;repo:Repository;ledger:TrainingLedger;ready:boolean;busy:boolean;error:string};
const empty=emptyTraining();
export function useAdaptiveTraining(owner:string,enabled=true){
  const [binding,setBinding]=useState<Binding>();
  const current=useRef<Repository|undefined>(undefined);
  const run=useCallback(async(repo:Repository,op:()=>Promise<TrainingLedger>)=>{
    if(current.current!==repo||repo.isBusy())return false;
    setBinding(state=>state?.repo===repo?{...state,busy:true,error:''}:state);
    try {
      const ledger=await op();
      if(current.current!==repo)return false;
      setBinding(state=>state?.repo===repo?{...state,ledger,ready:true,busy:false,error:''}:state);
      return true;
    } catch(reason){
      if(current.current!==repo)return false;
      let ledger:TrainingLedger|undefined;
      try{ledger=repo.read();}catch{/* The unreadable envelope stays in storage. */}
      setBinding(state=>state?.repo===repo?{...state,ledger:ledger??state.ledger,busy:false,error:reason instanceof Error?reason.message:'Training could not be loaded.'}:state);
      return false;
    }
  },[]);
  useEffect(()=>{
    if(!enabled)return;
    const storage={getItem:(k:string)=>localStorage.getItem(k),setItem:(k:string,v:string)=>localStorage.setItem(k,v),removeItem:(k:string)=>localStorage.removeItem(k)};
    const repo=trainingRepository(storage,owner,owner==='guest'?undefined:trainingHttp(owner));
    current.current=repo;
    setBinding({owner,repo,ledger:emptyTraining(),busy:true,ready:false,error:''});
    function refresh(){void run(repo,()=>repo.refresh());}
    function reconnect(){void run(repo,()=>repo.read().pending.length?repo.retry():repo.refresh());}
    function changed(e:StorageEvent){if(e.key===trainingKey(owner)||e.key===null)refresh();}
    refresh();
    window.addEventListener('online',reconnect);window.addEventListener('focus',refresh);window.addEventListener('storage',changed);window.addEventListener('top1-training-reset',refresh);window.addEventListener('top1-workspace-reset',refresh);
    return ()=>{current.current=undefined;repo.dispose();window.removeEventListener('online',reconnect);window.removeEventListener('focus',refresh);window.removeEventListener('storage',changed);window.removeEventListener('top1-training-reset',refresh);window.removeEventListener('top1-workspace-reset',refresh);};
  },[owner,enabled,run]);
  const b=enabled&&binding?.owner===owner?binding:undefined;
  return {ledger:b?.ledger??empty,ready:!!b?.ready,busy:!b||b.busy,error:b?.error??'',
    put:(m:TrainingMutation)=>b?run(b.repo,()=>b.repo.put(m)):Promise.resolve(false),
    refresh:()=>b?run(b.repo,()=>b.repo.refresh()):Promise.resolve(false),
    retry:()=>b?run(b.repo,()=>b.repo.retry()):Promise.resolve(false),
    discard:()=>b?run(b.repo,async()=>{b.repo.discardPending();return b.repo.refresh();}):Promise.resolve(false),
  };
}
export type AdaptiveTrainingState=ReturnType<typeof useAdaptiveTraining>;
