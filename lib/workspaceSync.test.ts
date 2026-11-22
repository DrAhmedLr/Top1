import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceSync,watchWorkspace,readWorkspaceSnapshot,readWorkspaceDraft} from './workspaceSync';
import {emptyWorkspace,workspaceDraftKey,type PersonalWorkspace} from './personalWorkspace';
const store=()=>{const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};};
const goal={version:1 as const,metric:'pushups',target:30,baseline:20,date:'2027-12-01',createdAt:'2026-11-14T00:00:00Z'};
function server(){let data=emptyWorkspace(),revision=0,owner='a',offline=false,posts=0;const request=(async(_url:unknown,init?:RequestInit)=>{
 if(offline)throw Error('Offline');if(init?.method==='POST'){posts++;const d=JSON.parse(init.body as string);if(new Headers(init.headers).get('X-Profile-User')!==owner)return Response.json({error:'Account changed. Reload.'},{status:409});if(d.revision!==revision)return Response.json({error:'Saved elsewhere. Review both versions before replacing.'},{status:409});data=d.data;revision++;}
 return Response.json({owner,data,revision});}) as typeof fetch;
 return {request,get data(){return data;},get revision(){return revision;},get posts(){return posts;},set offline(v:boolean){offline=v;},set owner(v:string){owner=v;}};
}
test('two devices see goals and profile context after refresh, including deletion',async()=>{
 const cloud=server(),a=new WorkspaceSync('a',store(),cloud.request),b=new WorkspaceSync('a',store(),cloud.request);await Promise.all([a.refresh(),b.refresh()]);
 assert.equal(await a.save({...emptyWorkspace(),goal,context:{days:3,loadUnit:'lb',timezone:'Africa/Casablanca'}}),true);await b.refresh();assert.deepEqual(b.getSnapshot().snapshot,a.getSnapshot().snapshot);
 assert.equal(await b.save({...cloud.data,goal:null},1,'goal'),true);await a.refresh();assert.equal(a.getSnapshot().snapshot?.data.goal,null);assert.equal(a.getSnapshot().snapshot?.data.context.days,3);
});
test('stale edits retain their original revision, reload latest, survive restart and explicitly rebase only the edited section',async()=>{
 const cloud=server(),storage=store(),a=new WorkspaceSync('a',store(),cloud.request),b=new WorkspaceSync('a',storage,cloud.request);await Promise.all([a.refresh(),b.refresh()]);
 await a.save({...emptyWorkspace(),goal},0,'goal');const mine={...emptyWorkspace(),context:{days:4}};assert.equal(await b.save(mine,0,'context'),false);
 assert.equal(cloud.revision,1);assert.equal(b.getSnapshot().conflict,true);assert.equal(b.getSnapshot().draft?.revision,0);assert.equal(b.getSnapshot().snapshot?.data.goal?.target,30);
 const restarted=new WorkspaceSync('a',storage,cloud.request);await restarted.refresh();assert.deepEqual(restarted.getSnapshot().draft?.data,mine);assert.equal(await restarted.retry(),true);
 assert.equal(cloud.data.context.days,4);assert.equal(cloud.data.goal?.target,30);assert.equal(storage.getItem(workspaceDraftKey('a')),null);
});
test('a second conflict during review retains the draft and never silently overwrites the newer device',async()=>{
 const cloud=server(),a=new WorkspaceSync('a',store(),cloud.request),b=new WorkspaceSync('a',store(),cloud.request);await Promise.all([a.refresh(),b.refresh()]);
 await a.save({...emptyWorkspace(),context:{days:2}});await b.save({...emptyWorkspace(),context:{days:3}},0,'context');await a.save({...emptyWorkspace(),context:{days:5}},1,'context');
 assert.equal(await b.retry(),false);assert.equal(cloud.data.context.days,5);assert.equal(b.getSnapshot().draft?.data.context.days,3);assert.equal(b.getSnapshot().snapshot?.revision,2);
});
test('offline and storage failures preserve drafts; offline reload can recover without a snapshot',async()=>{
 const cloud=server(),storage=store(),a=new WorkspaceSync('a',storage,cloud.request);await a.refresh();cloud.offline=true;assert.equal(await a.save({...emptyWorkspace(),goal}),false);
 const restarted=new WorkspaceSync('a',storage,cloud.request);await restarted.refresh();assert.equal(restarted.getSnapshot().draft?.data.goal?.target,30);cloud.offline=false;await restarted.refresh();assert.equal(await restarted.retry(),true);
 const broken={...store(),setItem:()=>{throw Error('Storage full');}},c=new WorkspaceSync('a',broken,cloud.request);await c.refresh();const before=cloud.posts;assert.equal(await c.save({...emptyWorkspace(),context:{days:7}}),false);assert.equal(c.getSnapshot().draft?.data.context.days,7);assert.equal(cloud.posts,before);
});
test('refresh during a delayed save neither clears the draft nor leaves the save locked',async()=>{
 const cloud=server();let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});const a=new WorkspaceSync('a',store(),(async(url,init)=>{if(init?.method==='POST')await gate;return cloud.request(url,init);}) as typeof fetch);await a.refresh();
 const save=a.save({...emptyWorkspace(),goal});const refresh=a.refresh();assert.ok(a.getSnapshot().draft);release();assert.equal(await save,true);await refresh;assert.equal(a.getSnapshot().busy,false);assert.equal(await a.save({...cloud.data,context:{days:2}}),true);
});
test('account changes reject reads and writes; detached late responses retain the old owner draft',async()=>{
 const cloud=server(),storage=store(),a=new WorkspaceSync('a',storage,cloud.request);await a.refresh();cloud.owner='b';assert.equal(await a.save({...emptyWorkspace(),goal}),false);assert.equal(a.getSnapshot().saved,false);assert.ok(storage.getItem(workspaceDraftKey('a')));assert.equal(storage.getItem(workspaceDraftKey('b')),null);
 cloud.owner='a';let release!:()=>void;const gate=new Promise<void>(r=>{release=r;}),late=new WorkspaceSync('a',storage,(async(url,init)=>{if(init?.method==='POST')await gate;return cloud.request(url,init);}) as typeof fetch);await late.refresh();const saving=late.retry();late.dispose();release();assert.equal(await saving,false);assert.ok(storage.getItem(workspaceDraftKey('a')));
});
test('invalid stored drafts and malformed responses never become a saved workspace',async()=>{
 assert.throws(()=>readWorkspaceSnapshot({owner:'b',data:emptyWorkspace(),revision:1},'a'),/Account changed/);
 for(const revision of [-1,NaN,'1',undefined])assert.throws(()=>readWorkspaceSnapshot({owner:'a',data:emptyWorkspace(),revision},'a'));
 const storage=store();storage.setItem(workspaceDraftKey('a'),'{bad');const a=new WorkspaceSync('a',storage,server().request);await a.refresh();assert.ok(a.getSnapshot().error);assert.equal(storage.getItem(workspaceDraftKey('a')),'{bad');
 assert.equal(readWorkspaceDraft(JSON.stringify({data:emptyWorkspace(),revision:0})).scope,'all');
});
test('resume, reconnect and visible polling refresh; hidden polls and disposed listeners do not',()=>{
 const win=new EventTarget(),doc=new EventTarget();let tick!:()=>void,count=0,cleared=false;Object.assign(win,{setInterval:(fn:()=>void)=>{tick=fn;return 1;},clearInterval:()=>{cleared=true;}});Object.assign(doc,{visibilityState:'visible'});
 const stop=watchWorkspace(()=>count++,win as Window,doc as Document);win.dispatchEvent(new Event('focus'));win.dispatchEvent(new Event('online'));tick();assert.equal(count,3);Object.assign(doc,{visibilityState:'hidden'});tick();assert.equal(count,3);Object.assign(doc,{visibilityState:'visible'});doc.dispatchEvent(new Event('visibilitychange'));assert.equal(count,4);stop();win.dispatchEvent(new Event('focus'));assert.equal(count,4);assert.ok(cleared);
});
