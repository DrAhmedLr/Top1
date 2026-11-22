'use client';
import {useEffect,useState} from 'react';
import {WorkspaceSync,watchWorkspace} from '@/lib/workspaceSync';
import {emptyWorkspace} from '@/lib/personalWorkspace';
import type {WorkspaceState} from '@/lib/hooks/usePersonalWorkspace';
import TrainingPreferences from '@/components/TrainingPreferences';
import PotentialWorkspace from '@/components/PotentialWorkspace';
let record={owner:'fixture',data:emptyWorkspace(),revision:0};
const request=(async(_url:unknown,init?:RequestInit)=>{await new Promise(r=>setTimeout(r,50));if(init?.method==='POST'){const next=JSON.parse(init.body as string);if(next.revision!==record.revision)return Response.json({error:'Saved elsewhere. Review both versions before replacing.'},{status:409});record={...record,data:next.data,revision:record.revision+1};}return Response.json(record);}) as typeof fetch;
function Device({name}:{name:string}){
 const [sync]=useState(()=>new WorkspaceSync('fixture',{getItem:k=>localStorage.getItem(name+k),setItem:(k,v)=>localStorage.setItem(name+k,v),removeItem:k=>localStorage.removeItem(name+k)},request)),[state,setState]=useState(sync.getSnapshot());
 useEffect(()=>{const unsub=sync.subscribe(()=>setState(sync.getSnapshot()));void sync.refresh();const stop=watchWorkspace(sync.refresh,window,document,1000);return()=>{unsub();stop();};},[sync]);
 const s:WorkspaceState={...state,owner:'fixture',data:state.snapshot?.data??emptyWorkspace(),revision:state.snapshot?.revision??0,ready:!!state.snapshot,save:sync.save,retry:sync.retry,refresh:sync.refresh,discard:sync.discard,exportData:()=>{},editable:!!state.snapshot&&!state.busy&&!state.draft&&!state.error};
 return <section aria-label={`Device ${name}`}><h1>Device {name}</h1><p>Revision {s.revision}</p><TrainingPreferences state={s}/><PotentialWorkspace state={s} values={{pushups:20}} details={{}} onRecord={()=>{}}/></section>;
}
export default function WorkspaceHarness(){return <main style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,padding:20}}><Device name="A"/><Device name="B"/></main>;}
