import {accountReadOptions} from './accountSession';
import {emptyWorkspace,readWorkspace,workspaceKey,workspaceDraftKey,workspaceHasData,type PersonalWorkspace} from './personalWorkspace';
import {readPersonalGoal} from './personalGoal';
export type WorkspaceScope='goal'|'context'|'all';
export type WorkspaceSnapshot={owner:string;data:PersonalWorkspace;revision:number};
export type WorkspaceDraft={data:PersonalWorkspace;revision:number;scope:WorkspaceScope};
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'>;
export type WorkspaceSyncState={snapshot?:WorkspaceSnapshot;draft:WorkspaceDraft|null;guest:PersonalWorkspace|null;busy:boolean;error:string;conflict:boolean;saved:boolean;settled?:{scope:WorkspaceScope;sequence:number}};
export function readWorkspaceSnapshot(raw:unknown,owner:string):WorkspaceSnapshot{
 const r=raw as WorkspaceSnapshot;
 if(r?.owner!==owner)throw Error('Account changed. Reload.');
 if(!Number.isSafeInteger(r.revision)||r.revision<0)throw Error('Invalid workspace revision.');
 return {owner,data:readWorkspace(r.data),revision:r.revision};
}
export function readWorkspaceDraft(raw:string):WorkspaceDraft{
 const d=JSON.parse(raw);
 if(!Number.isSafeInteger(d.revision)||d.revision<0||d.scope!==undefined&&!['goal','context','all'].includes(d.scope))throw Error('Unreadable draft. Export it before editing.');
 return {data:readWorkspace(d.data),revision:d.revision,scope:d.scope??'all'};
}
export function applyWorkspaceDraft(saved:PersonalWorkspace,draft:WorkspaceDraft){
 return draft.scope==='all'?draft.data:{...saved,[draft.scope]:draft.data[draft.scope]};
}
/** One controller per owner. Reads and writes are serialized; detached requests never mutate another account. */
export class WorkspaceSync {
 private state:WorkspaceSyncState={draft:null,guest:null,busy:false,error:'',conflict:false,saved:false};
 private listeners=new Set<()=>void>();
 private active=true;
 private hydrated=false;
 private operation:Promise<unknown>|null=null;
 constructor(readonly owner:string,private storage:Storage,private request:typeof fetch=fetch){}
 getSnapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 dispose(){this.active=false;this.listeners.clear();}
 private patch(change:Partial<WorkspaceSyncState>){if(this.active){this.state={...this.state,...change};this.listeners.forEach(fn=>fn());}}
 private local(owner:string){const raw=this.storage.getItem(workspaceKey(owner));if(raw)return readWorkspace(JSON.parse(raw));const old=this.storage.getItem(`top1-potential-v1:${owner}`);return {...emptyWorkspace(),goal:old?readPersonalGoal(old):null};}
 private async load(){
  if(this.owner==='guest')return {owner:this.owner,data:this.local(this.owner),revision:0};
  const response=await this.request('/api/personal-workspace',accountReadOptions(this.owner,AbortSignal.timeout(15000))),body=await response.json();
  if(!response.ok)throw Error(body.error||'Unable to load your goals and preferences.');
  return readWorkspaceSnapshot(body,this.owner);
 }
 refresh=async()=>{
  if(!this.active)return;
  // A focus/poll refresh must not invalidate a save or unlock a second write.
  if(this.operation){await this.operation;return;}
  const task=this.refreshNow();this.operation=task;try{await task;}finally{if(this.operation===task)this.operation=null;}
 };
 private async refreshNow(){
  this.patch({busy:true,error:''});
  try{
   if(!this.hydrated){const raw=this.storage.getItem(workspaceDraftKey(this.owner));this.patch({draft:raw?readWorkspaceDraft(raw):null});this.hydrated=true;}
   const snapshot=await this.load();if(!this.active)return;
   // Keep submitted drafts in memory through refreshes and failures.
   this.patch({snapshot,conflict:!!this.state.draft&&this.state.draft.revision!==snapshot.revision});
   if(this.owner!=='guest'){
    const candidate=this.local('guest'),legacy=this.storage.getItem(`top1-potential-v1:${this.owner}`);
    this.patch({guest:legacy?{...emptyWorkspace(),goal:readPersonalGoal(legacy)}:workspaceHasData(candidate)?candidate:null});
   }
  }catch(e){this.patch({error:message(e)});}finally{this.patch({busy:false});}
 }
 save=async(data:PersonalWorkspace,revision=this.state.snapshot?.revision,scope:WorkspaceScope='all'):Promise<boolean>=>{
  if(this.operation)await this.operation;
  if(!this.active||this.operation||!this.state.snapshot||revision===undefined)return false;
  const task=this.saveNow(data,revision,scope);this.operation=task;try{return await task;}finally{if(this.operation===task)this.operation=null;}
 };
 private async saveNow(data:PersonalWorkspace,revision:number,scope:WorkspaceScope){
  this.patch({busy:true,error:'',saved:false});let retained='';
  try{
   const draft={data:readWorkspace(data),revision,scope};
   // Preserve the in-memory draft even if persistent storage is full or disabled.
   this.patch({draft});retained=JSON.stringify(draft);this.storage.setItem(workspaceDraftKey(this.owner),retained);
   let snapshot:WorkspaceSnapshot;
   if(this.owner==='guest'){this.storage.setItem(workspaceKey(this.owner),JSON.stringify(draft.data));snapshot={owner:this.owner,data:draft.data,revision:0};}
   else{
    const response=await this.request('/api/personal-workspace',{method:'POST',headers:{'Content-Type':'application/json','X-Profile-User':this.owner},body:JSON.stringify(draft),signal:AbortSignal.timeout(15000)}),body=await response.json();
    if(!this.active)return false;
    if(!response.ok){
     if(response.status===409){this.patch({conflict:true});try{this.patch({snapshot:await this.load()});}catch{/* Retain draft and offer refresh if offline. */}}
     throw Error(body.error||'Unable to save. Your draft is retained.');
    }
    snapshot=readWorkspaceSnapshot(body,this.owner);
   }
   if(!this.active)return false;
   // Do not erase a newer draft written by another tab.
   if(this.storage.getItem(workspaceDraftKey(this.owner))===retained)this.storage.removeItem(workspaceDraftKey(this.owner));
   this.patch({snapshot,draft:null,conflict:false,saved:true,settled:{scope,sequence:(this.state.settled?.sequence??0)+1}});return true;
  }catch(e){this.patch({error:message(e)});return false;}finally{this.patch({busy:false});}
 }
 retry=()=>{const {snapshot,draft}=this.state;return snapshot&&draft?this.save(applyWorkspaceDraft(snapshot.data,draft),snapshot.revision,draft.scope):Promise.resolve(false);};
 discard=()=>{if(this.operation)return;try{const raw=this.storage.getItem(workspaceDraftKey(this.owner));if(raw&&JSON.stringify(readWorkspaceDraft(raw))===JSON.stringify(this.state.draft))this.storage.removeItem(workspaceDraftKey(this.owner));this.patch({draft:null,error:'',conflict:false,settled:{scope:this.state.draft?.scope??'all',sequence:(this.state.settled?.sequence??0)+1}});}catch(e){this.patch({error:message(e)});}};
}
const message=(e:unknown)=>e instanceof Error?e.message:'Unable to sync. Your draft is retained.';

/** Refresh on resume/reconnect and while visible, without a Realtime publication dependency. */
export function watchWorkspace(refresh:()=>unknown,win:Window,doc:Document,interval=15000){
 const visible=()=>{if(doc.visibilityState!=='hidden')void refresh();};
 win.addEventListener('focus',visible);win.addEventListener('online',visible);win.addEventListener('top1-workspace-reset',visible);doc.addEventListener('visibilitychange',visible);
 const timer=win.setInterval(visible,interval);
 return()=>{win.clearInterval(timer);win.removeEventListener('focus',visible);win.removeEventListener('online',visible);win.removeEventListener('top1-workspace-reset',visible);doc.removeEventListener('visibilitychange',visible);};
}
