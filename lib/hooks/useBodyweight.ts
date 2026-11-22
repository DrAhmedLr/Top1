'use client';
import {accountReadOptions} from '../accountSession';
import {useCallback,useEffect,useRef,useState} from 'react';
import {appendWeight,bodyweightKey,bodyweightQueueKey,latestWeights,readWeightHistory,readWeightQueue,weightEvent,weightMutation,weightPage,type WeightCursor,type WeightEvent,type WeightMutation,type WeightPage} from '../bodyweight';

function failureMessage(reason:unknown,fallback:string){return reason instanceof TypeError||reason instanceof Error&&['TimeoutError','AbortError'].includes(reason.name)?fallback:reason instanceof Error?reason.message:fallback;}
const emptyPage:WeightPage={entries:[],latest:[],total:0,next:null};
const receiptKey=(owner:string)=>`top1-bodyweight-imported-v1:${owner}`;
export const weightBrowserKeys=(owner:string)=>[bodyweightKey(owner),bodyweightQueueKey(owner),receiptKey(owner)];
export function useBodyweight(owner:string,enabled:boolean){
 const [scope,setScope]=useState(''),[events,setEvents]=useState<WeightEvent[]>([]),[page,setPage]=useState<WeightPage>(emptyPage);
 const [pending,setPending]=useState<WeightMutation[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[fresh,setFresh]=useState(false);
 const [guestLimit,setGuestLimit]=useState(30);
 const pageRef=useRef(page);pageRef.current=page;
 const [showDeleted,setShowDeleted]=useState(false),[guest,setGuest]=useState<WeightEvent[]>([]),[imported,setImported]=useState<string[]>([]);
 const current=useRef({owner,enabled});current.current={owner,enabled};
 const storageReadable=useRef(false),epochRef=useRef(0),cache=useRef<WeightEvent[]>([]),queue=useRef<WeightMutation[]>([]),running=useRef(false),requestEpoch=useRef(0);
 const own=()=>current.current.owner===owner&&current.current.enabled;
 function saveCache(next:WeightEvent[]){localStorage.setItem(bodyweightKey(owner),JSON.stringify({version:1,events:next,epoch:epochRef.current}));cache.current=next;setEvents(next);}
 function saveQueue(next:WeightMutation[]){localStorage.setItem(bodyweightQueueKey(owner),JSON.stringify({version:1,pending:next}));queue.current=next;setPending(next);}
 const refresh=useCallback(async(cursor:WeightCursor|null=null)=>{
  if(!enabled||current.current.owner!==owner||owner==='guest')return;
  const epoch=++requestEpoch.current;
  setBusy(true);setError('');
  try{
   const query=new URLSearchParams({deleted:showDeleted?'1':'0'});
   if(cursor){query.set('before',cursor.date);query.set('id',cursor.id);}
   const response=await fetch('/api/bodyweight?'+query,accountReadOptions(owner,AbortSignal.timeout(15000))),body=await response.json();
   if(!response.ok)throw new Error(body.error??'Unable to load weight history.');
   const rows=(body.entries as unknown[]).map(weightEvent),latest=(body.latest as unknown[]).map(weightEvent);
   if(!own()||epoch!==requestEpoch.current)return;
   epochRef.current=body.epoch??0;
   const old=pageRef.current;
   const entries=cursor?[...old.entries.filter(row=>!rows.some(next=>next.id===row.id)),...rows]:rows;
   const next={entries,latest,total:body.total,next:body.next??null,epoch:body.epoch??0};
   pageRef.current=next;setPage(next);
   try{saveCache([...entries,...latest.filter(row=>!entries.some(entry=>entry.id===row.id))]);}catch{setError('History loaded, but this browser could not cache it.');}
   setFresh(true);
  }catch(reason){if(own()&&epoch===requestEpoch.current)setError(failureMessage(reason,'Unable to load weight history.'));}
  finally{if(own()&&epoch===requestEpoch.current)setBusy(false);}
 },[owner,enabled,showDeleted]);
 const flush=useCallback(async()=>{
  if(owner==='guest'||!enabled||!own()||running.current||!queue.current.length)return;
  const activeOwner=owner;running.current=true;setBusy(true);setError('');
  try{
   for(const mutation of [...queue.current]){
    if(!own())return;
    const response=await fetch('/api/bodyweight',{method:'POST',headers:{'Content-Type':'application/json','X-Profile-User':activeOwner},body:JSON.stringify(mutation),signal:AbortSignal.timeout(15000)}),body=await response.json();
    if(!response.ok)throw new Error(body.error??'Weight sync failed. Retry when connected.');
    if(!own())return;
    const event=weightEvent(body.entry);
    saveQueue(queue.current.filter(row=>row.requestId!==mutation.requestId));
    try{saveCache([...cache.current.filter(row=>row.id!==event.id),event]);}catch{setError('Weight saved to your account, but local caching failed.');}
   }
   await refresh();
  }catch(reason){if(own())setError(failureMessage(reason,'Weight sync failed. Retry when connected.'));}
  finally{running.current=false;if(own())setBusy(false);}
 },[owner,enabled,refresh]);
 useEffect(()=>{
  requestEpoch.current++;running.current=false;storageReadable.current=false;cache.current=[];queue.current=[];epochRef.current=0;setScope(owner);setGuestLimit(30);setEvents([]);setPage(emptyPage);setPending([]);setFresh(false);setError('');setBusy(false);
  if(!enabled)return;
  try{
   const raw=localStorage.getItem(bodyweightKey(owner));
   const saved=readWeightHistory(raw),outbox=readWeightQueue(localStorage.getItem(bodyweightQueueKey(owner)));
   epochRef.current=raw?JSON.parse(raw).epoch??0:0;
   storageReadable.current=true;cache.current=saved;queue.current=outbox;setEvents(saved);setPending(outbox);pageRef.current={...weightPage(saved,null,showDeleted),epoch:epochRef.current};setPage(pageRef.current);
   if(owner!=='guest'){
    setGuest(latestWeights(readWeightHistory(localStorage.getItem(bodyweightKey('guest')))));
    const receipts=JSON.parse(localStorage.getItem(receiptKey(owner))??'[]');setImported(Array.isArray(receipts)?receipts.filter(id=>typeof id==='string'):[]);
    if(outbox.length)void flush();else void refresh();
   }
  }catch{storageReadable.current=false;setError('Stored weight history could not be read. It has been retained.');}
 },[owner,enabled,showDeleted]); // Fetch changes are driven by owner and selected history mode.
 useEffect(()=>{
  if(!enabled)return;
  const reconnect=()=>{if(queue.current.length)void flush();else void refresh();};
  const changed=()=>{
   if(!own())return;
   try{const rows=readWeightHistory(localStorage.getItem(bodyweightKey(owner)));storageReadable.current=true;cache.current=rows;setEvents(rows);setError('');queue.current=readWeightQueue(localStorage.getItem(bodyweightQueueKey(owner)));setPending(queue.current);setPage(weightPage(rows,null,showDeleted));if(owner!=='guest')void refresh();}
   catch(reason){setError(reason instanceof Error?reason.message:'Unable to reload weights.');}
  };
  window.addEventListener('online',reconnect);window.addEventListener('focus',reconnect);window.addEventListener('top1-bodyweight-updated',changed);
  return()=>{window.removeEventListener('online',reconnect);window.removeEventListener('focus',reconnect);window.removeEventListener('top1-bodyweight-updated',changed);};
 },[owner,enabled,flush,refresh,showDeleted]);
 async function mutate(input:WeightMutation){
  if(!own())throw new Error('Your account changed.');
  if(!storageReadable.current)throw new Error('Stored weight history could not be read. It has been retained.');
  const mutation=weightMutation({...input,epoch:owner==='guest'?0:pageRef.current.epoch??0});
  if(owner==='guest'){
   const stored=readWeightHistory(localStorage.getItem(bodyweightKey(owner)));
   const next=appendWeight(stored,mutation);
   saveCache(next.events);setPage(weightPage(next.events,null,showDeleted));setError('');return true;
  }
  if(queue.current.length)throw new Error('Resolve the pending change before recording another.');
  saveQueue([mutation]);
  if(navigator.onLine)await flush();
  return queue.current.length===0;
 }
 async function importGuest(){
  if(!own()||owner==='guest'||pending.length)throw new Error('Resolve pending changes first.');
  const entries=latestWeights(readWeightHistory(localStorage.getItem(bodyweightKey('guest')))).filter(row=>!imported.includes(row.id));
  setBusy(true);setError('');
  try{
   let completed=[...imported];
   for(let index=0;index<entries.length;index+=50){
    if(!own())return;
    const batch=entries.slice(index,index+50);
    const response=await fetch('/api/bodyweight',{method:'POST',headers:{'Content-Type':'application/json','X-Profile-User':owner},body:JSON.stringify({entries:batch}),signal:AbortSignal.timeout(15000)}),body=await response.json();
    if(!response.ok)throw new Error(body.error??'Weight import failed. Browser records are retained.');
    if(!own())return;
    completed=[...new Set([...completed,...batch.map(row=>row.id)])];
    localStorage.setItem(receiptKey(owner),JSON.stringify(completed));setImported(completed);
   }
   await refresh();
  }catch(reason){if(own())setError(reason instanceof Error?reason.message:'Weight import failed.');}
  finally{if(own())setBusy(false);}
 }
 function discardPending(){if(!own())return false;try{saveQueue([]);setError('');void refresh();return true;}catch{setError('Pending weights could not be read. They have been retained.');return false;}}
 function exportBrowser(){
  const data={version:1,scope:owner==='guest'?'guest-browser':'account-browser-cache',events:readWeightHistory(localStorage.getItem(bodyweightKey(owner))),pending:readWeightQueue(localStorage.getItem(bodyweightQueueKey(owner)))};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='TOP1-bodyweight-browser.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const visible=scope===owner&&enabled;
 return {owner,storageReady:visible&&storageReadable.current,page:visible?(owner==='guest'?weightPage(events,null,showDeleted,guestLimit):page):emptyPage,busy:visible&&busy,error:visible?error:'',pending:visible?pending:[],fresh:visible&&(owner==='guest'||fresh),showDeleted,setShowDeleted,loadOlder:()=>owner==='guest'?setGuestLimit(limit=>limit+30):refresh(page.next),mutate,refresh,flush,discardPending,exportBrowser,importGuest,guestCount:visible&&owner!=='guest'?guest.filter(row=>!imported.includes(row.id)).length:0};
}
export type BodyweightState=ReturnType<typeof useBodyweight>;
