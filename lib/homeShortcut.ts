'use client';
import {useEffect,useState} from 'react';
import {activeMetrics} from './registry';

export const shortcutActions=['log','program','rank','history'] as const;
export type ShortcutAction=typeof shortcutActions[number];
export type HomeChoice={mode:ShortcutAction|'auto';metric?:string;last?:ShortcutAction};
const automatic:HomeChoice={mode:'auto'};
export const homeShortcutKey=(owner:string)=>'top1-home-shortcut-v1:'+owner;

function read(key:string):HomeChoice {
  const raw=localStorage.getItem(key);
  if(raw===null)return automatic;
  const data=JSON.parse(raw);
  if(!data||(!shortcutActions.includes(data.mode)&&data.mode!=='auto'))return automatic;
  return {mode:data.mode,metric:activeMetrics.some(m=>m.id===data.metric)?data.metric:undefined,
    last:shortcutActions.includes(data.last)?data.last:undefined};
}

export function useHomeShortcut(owner:string) {
  const key=homeShortcutKey(owner);
  const [snapshot,setSnapshot]=useState<{key:string;choice:HomeChoice;error?:boolean}>();
  useEffect(()=>{
    function reload() {
      try { setSnapshot({key,choice:read(key)}); }
      catch { setSnapshot({key,choice:automatic,error:true}); }
    }
    reload();
    function changed(event:StorageEvent){if(event.key===key||event.key===null)reload();}
    window.addEventListener('storage',changed);
    window.addEventListener('top1-workspace-reset',reload);
    return ()=>{window.removeEventListener('storage',changed);window.removeEventListener('top1-workspace-reset',reload);};
  },[key]);
  const choice=snapshot?.key===key?snapshot.choice:automatic;
  function update(patch:Partial<HomeChoice>) {
    try {
      const next={...read(key),...patch};
      localStorage.setItem(key,JSON.stringify(next));setSnapshot({key,choice:next});
    } catch { setSnapshot({key,choice:{...choice,...patch},error:true}); }
  }
  const action=choice.mode==='auto'?(choice.last??(choice.metric?'log':undefined)):choice.mode;
  return {choice,shortcut:action?{action,metric:choice.metric}:undefined,update,error:snapshot?.key===key&&snapshot.error};
}
