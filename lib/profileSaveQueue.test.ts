import test from 'node:test';
import assert from 'node:assert/strict';
import {ProfileSaveQueue,SupersededSave,saveVisibility} from './profileSaveQueue';
import {emptyProfile,type ProfileState} from './profile';
import {discardAcknowledgedDraft} from './drafts';
import {authoritativeMeasurementDetails} from './measurementMetadata';
const profile=(value:number):ProfileState=>({...emptyProfile,values:{pushups:value},revision:0});
const deferred=()=>{let resolve!:(p:ProfileState)=>void;const promise=new Promise<ProfileState>(r=>{resolve=r;});return {promise,resolve};};

test('serialized edits use only revisions acknowledged by this queue',async()=>{
 const q=new ProfileSaveQueue();q.adopt('a',4);const first=deferred(),seen:number[]=[];
 const a=q.enqueue('a',profile(20),async p=>{seen.push(p.revision!);return first.promise;});
 const b=q.enqueue('a',profile(25),async p=>{seen.push(p.revision!);return {...p,revision:6};});
 await Promise.resolve();await Promise.resolve();first.resolve({...profile(20),revision:5});await Promise.all([a,b]);assert.deepEqual(seen,[4,5]);
});
test('reload invalidates queued edits instead of rebasing them onto another device',async()=>{
 const q=new ProfileSaveQueue();q.adopt('a',4);const first=deferred();let writes=0;
 const a=q.enqueue('a',profile(20),async()=>{writes++;return first.promise;});const rejectedA=assert.rejects(a,SupersededSave);
 const b=q.enqueue('a',profile(25),async p=>{writes++;return p;});const rejectedB=assert.rejects(b,SupersededSave);
 await Promise.resolve();await Promise.resolve();q.adopt('a',7);first.resolve({...profile(20),revision:5});await Promise.all([rejectedA,rejectedB]);assert.equal(writes,1);assert.equal(q.currentRevision('a'),7);
});
test('failed write stops already queued payloads; a reviewed retry remains possible',async()=>{
 const q=new ProfileSaveQueue();q.adopt('a',4);let writes=0;
 const a=q.enqueue('a',profile(20),async()=>{writes++;throw new Error('Conflict');});
 const b=q.enqueue('a',profile(25),async p=>{writes++;return p;});
 await Promise.all([assert.rejects(a,/Conflict/),assert.rejects(b,SupersededSave)]);assert.equal(writes,1);
 q.adopt('a',5);await q.enqueue('a',profile(25),async p=>({...p,revision:6}));assert.equal(q.currentRevision('a'),6);
});
test('discarding a draft invalidates its pending saves',async()=>{
 const q=new ProfileSaveQueue();q.adopt('a',1);let writes=0;
 const job=q.enqueue('a',profile(20),async p=>{writes++;return p;});q.invalidate();await assert.rejects(job,SupersededSave);assert.equal(writes,0);
});
test('an older cloud snapshot cannot replace an acknowledged revision',async()=>{
 const q=new ProfileSaveQueue();q.adopt('a',1);await q.enqueue('a',profile(20),async p=>({...p,revision:2}));assert.equal(q.adopt('a',1),false);assert.equal(q.currentRevision('a'),2);
});
test('foreground refresh adopts newer saved results only while the same clean account is idle',async()=>{
 const queue=new ProfileSaveQueue();
 queue.adopt('first',1);
 const applied:number[]=[];
 const adopt=(p:ProfileState)=>{applied.push(p.revision!);};
 let idle=true;
 const waiting=deferred();
 const reading=queue.refresh('first',()=>idle,()=>waiting.promise,adopt);
 idle=false;waiting.resolve({...profile(35),revision:2});await reading;
 assert.deepEqual(applied,[]);
 idle=true;
 await queue.refresh('first',()=>idle,async current=>{assert.equal(current,1);return {...profile(35),revision:2};},adopt);
 await queue.refresh('first',()=>idle,async()=>({...profile(20),revision:1}),adopt);
 assert.deepEqual(applied,[2]);
 const writing=deferred();
 const save=queue.enqueue('first',profile(36),()=>writing.promise);
 await queue.refresh('first',()=>true,async()=>assert.fail('Do not poll over a pending save'),adopt);
 writing.resolve({...profile(36),revision:3});await save;
 const switched=deferred();
 const detached=queue.refresh('first',()=>true,()=>switched.promise,adopt);
 queue.adopt('second',0);switched.resolve({...profile(40),revision:4});await detached;
 assert.deepEqual(applied,[2]);assert.equal(queue.currentRevision('second'),0);
});
test('metric autosaves cannot restore revoked visibility from stale captured state',async()=>{
 const q=new ProfileSaveQueue();q.adopt('a',1);let publicState=true,rev=1;
 const write=(intent?:boolean)=>async(p:ProfileState)=>{publicState=saveVisibility(publicState,p.isPublic,intent);return {...p,isPublic:publicState,revision:++rev};};
 const a=q.enqueue('a',{...profile(20),isPublic:true},write());
 const revoke=q.enqueue('a',{...profile(20),isPublic:false},write(true));
 const stale=q.enqueue('a',{...profile(25),isPublic:true},write());
 await Promise.all([a,revoke,stale]);assert.equal(publicState,false);
 assert.equal(saveVisibility(false,true,true),true);assert.equal(saveVisibility(true,false,undefined),true);assert.throws(()=>saveVisibility(false,true,'yes'));
});
test('an older program save cannot delete a newer stored draft',()=>{
 let stored='new plan';const storage={getItem:()=>stored,removeItem:()=>{stored='';}};
 assert.equal(discardAcknowledgedDraft(storage,'draft','old plan'),false);assert.equal(stored,'new plan');assert.equal(discardAcknowledgedDraft(storage,'draft','new plan'),true);assert.equal(stored,'');
});
test('an authoritative save explicitly clears omitted protocol context rather than inheriting an older test',()=>{
 assert.deepEqual(authoritativeMeasurementDetails({vo2_max:50,pushups:20},undefined),{vo2_max:{},pushups:{}});
 assert.deepEqual(authoritativeMeasurementDetails({vo2_max:50},{vo2_max:{method:'direct_cpet',exerciseMode:'treadmill',ageAtMeasurement:32}}),{vo2_max:{method:'direct_cpet',ageAtMeasurement:32,exerciseMode:'treadmill'}});
});
