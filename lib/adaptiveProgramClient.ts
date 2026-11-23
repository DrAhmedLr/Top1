'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {emptyTraining,trainingHttp,trainingKey,trainingRepository,type TrainingLedger} from './trainingStorage';
import type {TrainingMutation} from './training';
import {watchWorkspace} from './workspaceSync';

type Repository=ReturnType<typeof trainingRepository>;
type Binding={owner:string;repo:Repository;ledger:TrainingLedger;ready:boolean;busy:boolean;error:string};
const empty=emptyTraining();
export function useAdaptiveTraining(owner:string,enabled=true){
  const [binding,setBinding]=useState<Binding>();
  const current=useRef<Repository|undefined>(undefined);
  const lastRead=useRef<{repo:Repository;ledger:TrainingLedger}|undefined>(undefined);
  const run=useCallback(async(repo:Repository,op:()=>Promise<TrainingLedger>)=>{
    if(current.current!==repo||repo.isBusy())return false;
    setBinding(state=>state?.repo===repo?{...state,busy:true,error:''}:state);
    try {
      const ledger=await op();
      if(current.current!==repo)return false;
      lastRead.current={repo,ledger};
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
    const transport=owner==='guest'?undefined:trainingHttp(owner);
    const repo=trainingRepository(storage,owner,transport);
    current.current=repo;
    setBinding({owner,repo,ledger:emptyTraining(),busy:true,ready:false,error:''});
    function refresh(){void run(repo,()=>repo.refresh());}
    function reconnect(){void run(repo,()=>repo.read().pending.length?repo.retry():repo.refresh());}
    function changed(e:StorageEvent){if(e.key===trainingKey(owner)||e.key===null)refresh();}
    let checking=false;
    async function checkUpdates(){
      if(checking||repo.isBusy()||current.current!==repo||!transport)return;
      const known=lastRead.current;
      if(known?.repo!==repo){refresh();return;}
      checking=true;
      try{
        // Immutable event sequences are global. The counter and purge epoch are per account.
        const page=await transport.read(known.ledger.events.at(-1)?.sequence??0);
        if(current.current===repo&&!repo.isBusy()&&(page.epoch!==known.ledger.epoch||page.counter!==known.ledger.counter))refresh();
      }catch{/* Retain the last loaded ledger through a temporary connection failure. */}
      finally{checking=false;}
    }
    refresh();
    // Reconnect must flush a retained offline command before a read claims the repository.
    window.addEventListener('online',reconnect);
    const stop=transport?watchWorkspace(checkUpdates,window,document,30000):undefined;
    if(!transport)window.addEventListener('focus',refresh);
    window.addEventListener('storage',changed);window.addEventListener('top1-training-reset',refresh);window.addEventListener('top1-workspace-reset',refresh);
    return ()=>{current.current=undefined;lastRead.current=undefined;repo.dispose();stop?.();window.removeEventListener('online',reconnect);window.removeEventListener('focus',refresh);window.removeEventListener('storage',changed);window.removeEventListener('top1-training-reset',refresh);window.removeEventListener('top1-workspace-reset',refresh);};
  },[owner,enabled,run]);
  const b=enabled&&binding?.owner===owner?binding:undefined;
  return {ledger:b?.ledger??empty,ready:!!b?.ready,busy:!b||b.busy,error:b?.error??'',
    put:(m:TrainingMutation)=>b?run(b.repo,()=>b.repo.put(m)):Promise.resolve(false),
    putMany:(changes:TrainingMutation[])=>b?run(b.repo,()=>b.repo.putMany(changes)):Promise.resolve(false),
    refresh:()=>b?run(b.repo,()=>b.repo.refresh()):Promise.resolve(false),
    retry:()=>b?run(b.repo,()=>b.repo.retry()):Promise.resolve(false),
    discard:()=>b?run(b.repo,async()=>{b.repo.discardPending();return b.repo.refresh();}):Promise.resolve(false),
  };
}
export type AdaptiveTrainingState=ReturnType<typeof useAdaptiveTraining>;
