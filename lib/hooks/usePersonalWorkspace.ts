'use client';
import {useEffect,useState} from 'react';
import {emptyWorkspace,workspaceDraftKey,type PersonalWorkspace} from '../personalWorkspace';
import {WorkspaceSync,type WorkspaceScope,type WorkspaceSyncState} from '../workspaceSync';
import {watchWorkspace} from '../workspaceSync';
const initial:WorkspaceSyncState={draft:null,guest:null,busy:true,error:'',conflict:false,saved:false};
export function usePersonalWorkspace(owner:string){
 const [binding,setBinding]=useState<{sync:WorkspaceSync;state:WorkspaceSyncState}>();
 useEffect(()=>{
  // Defer browser storage access until mount; each account has its own controller.
  const storage={getItem:(key:string)=>localStorage.getItem(key),setItem:(key:string,value:string)=>localStorage.setItem(key,value),removeItem:(key:string)=>localStorage.removeItem(key)};
  const sync=new WorkspaceSync(owner,storage);
  const update=()=>setBinding({sync,state:sync.getSnapshot()});const unsubscribe=sync.subscribe(update);update();void sync.refresh();
  const stop=watchWorkspace(sync.refresh,window,document);
  return()=>{stop();unsubscribe();sync.dispose();};
 },[owner]);
 const sync=binding?.sync.owner===owner?binding.sync:undefined,state=sync?binding!.state:initial,current=state.snapshot;
 function exportData(){const raw={saved:current,draft:state.draft,retained:localStorage.getItem(workspaceDraftKey(owner)),forms:['goal','context'].map(scope=>localStorage.getItem(`top1-workspace-form-v1:${owner}:${scope}`)),legacy:localStorage.getItem(`top1-potential-v1:${owner}`)};const url=URL.createObjectURL(new Blob([JSON.stringify(raw,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='TOP1-goal-and-preferences.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return {...state,owner,data:current?.data??emptyWorkspace(),revision:current?.revision??0,ready:!!current,saved:!!current&&state.saved,save:(data:PersonalWorkspace,revision=current?.revision,scope:WorkspaceScope='all')=>sync?.save(data,revision,scope)??Promise.resolve(false),retry:()=>sync?.retry(),refresh:()=>sync?.refresh(),discard:()=>sync?.discard(),exportData,editable:!!current&&!state.busy&&!state.draft&&!state.error};
}
export type WorkspaceState=ReturnType<typeof usePersonalWorkspace>;
