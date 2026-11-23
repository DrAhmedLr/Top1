import {appendTraining,trainingMutation,trainingEqual,type TrainingEvent,type TrainingMutation} from './training';
export interface TrainingLedger {version:1;epoch:number;counter:number;events:TrainingEvent[];pending:TrainingMutation[];pendingBaseCounter?:number}
export interface TrainingStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
export const trainingKey=(owner:string)=>`top1-training-v1:${owner}`;
export const emptyTraining=():TrainingLedger=>({version:1,epoch:0,counter:0,events:[],pending:[]});
export function readTraining(raw:string|null):TrainingLedger {if(raw===null)return emptyTraining();try{const data=JSON.parse(raw) as TrainingLedger;if(data.version!==1||!Number.isSafeInteger(data.epoch)||data.epoch<0||!Number.isSafeInteger(data.counter)||data.counter<0||!Array.isArray(data.events)||!Array.isArray(data.pending)||(data.pending.length>1&&data.pendingBaseCounter===undefined)||(data.pendingBaseCounter!==undefined&&(!Number.isSafeInteger(data.pendingBaseCounter)||data.pendingBaseCounter<0)))throw 0;let events:TrainingEvent[]=[];for(const event of data.events){if(!Number.isSafeInteger(event.sequence)||event.sequence<1||!Number.isFinite(Date.parse(event.recordedAt))||!['personal','guest-import'].includes(event.source))throw 0;const next=appendTraining(events,{...event,expectedRevision:event.revision-1},data.epoch,Math.max(Date.now(),Date.parse(event.recordedAt)));const parsed=next.at(-1)!;if(!trainingEqual(parsed.data,event.data)||next.length===events.length)throw 0;events=[...events,event];}if(events.some((e,i)=>i>0&&e.sequence<=events[i-1].sequence))throw 0;const pending=data.pending.map(m=>trainingMutation(m));if(pending.some(m=>m.epoch!==data.epoch))throw 0;return {...data,events,pending};}catch{throw new Error('Stored training could not be read. It has been retained.');}}
export interface TrainingTransport {read(after:number):Promise<{epoch:number;counter:number;events:TrainingEvent[];next:number|null}>;write(change:TrainingMutation):Promise<TrainingEvent>;writeMany?(changes:TrainingMutation[],expectedCounter:number):Promise<TrainingEvent[]>;import(changes:TrainingMutation[],epoch:number):Promise<void>}
export function trainingHttp(owner:string):TrainingTransport {async function request(path:string,body?:unknown){const response=await fetch(path,{method:body?'POST':'GET',cache:'no-store',headers:{'X-Profile-User':owner,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.error??'Unable to sync training.');if(data.owner!==owner)throw new Error('Your account changed.');return data;}return {read:after=>request('/api/training?after='+after),write:async change=>(await request('/api/training',change)).event,writeMany:async(batch,expectedCounter)=>(await request('/api/training',{version:1,batch,expectedCounter})).events,import:async(changes,epoch)=>{await request('/api/training',{version:1,import:changes,epoch});}};}
/** Owner-bound repository for the Stage 08/09 UI. Call dispose on account switch.
 * Every operation commits a single browser envelope; a failed write retains its request. */
export function trainingRepository(storage:TrainingStorage,owner:string,transport?:TrainingTransport){let active=true,busy=false;const key=trainingKey(owner);const current=()=>{if(!active)throw new Error('Your account changed.');return readTraining(storage.getItem(key));};const save=(value:TrainingLedger)=>{if(!active)throw new Error('Your account changed.');storage.setItem(key,JSON.stringify(value));return value;};
 async function refreshUnlocked(){if(!transport)return current();const before=current();let after=0,counter:number|undefined,epoch:number|undefined,events:TrainingEvent[]=[];do{const page=await transport.read(after);if(!active)throw new Error('Your account changed.');if(counter!==undefined&&(counter!==page.counter||epoch!==page.epoch))throw new Error('Training changed during loading. Retry.');counter=page.counter;epoch=page.epoch;events.push(...page.events);if(page.next!==null&&page.next<=after)throw new Error('Invalid training cursor.');after=page.next??0;if(page.next===null)break;}while(true);if(!trainingEqual(current(),before))throw new Error('Browser training changed during loading. Retry.');const checked=readTraining(JSON.stringify({version:1,epoch,counter,events,pending:[]}));if(before.pending.length&&before.epoch!==epoch)throw new Error('Training history was cleared. Export or discard the pending change.');return save({...checked,pending:before.pending,pendingBaseCounter:before.pendingBaseCounter});}
 async function exclusive<T>(fn:()=>Promise<T>){if(busy)throw new Error('Training sync is already running.');busy=true;try{return typeof navigator!=='undefined'&&navigator.locks?await navigator.locks.request('top1-training:'+owner,fn):await fn();}finally{busy=false;}}
 async function flushUnlocked() {
   if (!transport) return current();
   const state=current(), changes=state.pending;
   if (!changes.length) return refreshUnlocked();
   let receipts:TrainingEvent[];
   if (state.pendingBaseCounter!==undefined) {
     if (!transport.writeMany) throw Error('Batch training sync unavailable.');
     receipts=await transport.writeMany(changes,state.pendingBaseCounter);
   } else {
     receipts=[await transport.write(changes[0])];
   }
   if (!active) throw Error('Your account changed.');
   if (!Array.isArray(receipts)||receipts.length!==changes.length||receipts.some((event,i)=>
     event.requestId!==changes[i].requestId||event.id!==changes[i].id||event.revision!==changes[i].expectedRevision+1||!trainingEqual(event.data,changes[i].data))) throw Error('Invalid training response.');
   save({...current(),pending:[],pendingBaseCounter:undefined});
   return refreshUnlocked();
 }
 async function putChanges(raw:TrainingMutation[],batch:boolean) {
   const ledger=current();
   if (ledger.pending.length) throw Error('Resolve the pending training change first.');
   if (!raw.length) throw Error('Choose at least one training change.');
   const changes=raw.map(item=>trainingMutation(item));
   if (new Set(changes.map(m=>m.requestId)).size!==changes.length) throw Error('Duplicate training change.');
   let events=ledger.events;
   const now=Date.now();
   for (const change of changes) events=appendTraining(events,change,ledger.epoch,now);
   if (!transport) return save({...ledger,events,counter:ledger.counter+events.length-ledger.events.length});
   save({...ledger,pending:changes,pendingBaseCounter:batch?ledger.counter:undefined});
   return flushUnlocked();
 }
 return {read:current,dispose(){active=false;},refresh:()=>exclusive(refreshUnlocked),retry:()=>exclusive(flushUnlocked),isBusy:()=>busy,
  put:(raw:TrainingMutation)=>exclusive(()=>putChanges([raw],false)),
  putMany:(changes:TrainingMutation[])=>exclusive(()=>putChanges(changes,true)),
  export:()=>JSON.stringify({scope:transport?'account-browser-cache':'guest-browser',...current()},null,2),
  discardPending:()=>{if(busy)throw new Error('Wait for training sync to finish.');const state=current();return save({...state,pending:[],pendingBaseCounter:undefined});},
  importGuest:(reviewed:boolean)=>exclusive(async()=>{if(!reviewed||!transport||owner==='guest')throw new Error('Review browser training before importing.');const account=await refreshUnlocked();if(account.pending.length)throw new Error('Resolve the pending training change first.');const guest=readTraining(storage.getItem(trainingKey('guest')));if(guest.pending.length)throw new Error('Resolve browser training before importing.');const changes=guest.events.map(e=>trainingMutation({...e,epoch:account.epoch,expectedRevision:e.revision-1}));for(let i=0;i<changes.length;i+=20){if(!active)throw new Error('Your account changed.');await transport.import(changes.slice(i,i+20),account.epoch);}if(!active)throw new Error('Your account changed.');return refreshUnlocked();})};
}
