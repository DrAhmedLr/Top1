import test from 'node:test';
import assert from 'node:assert/strict';
import {baselineArea,resultChange,resultComparison,unfinishedPlan} from './journeyResult';
import {draftValues,journeyBaseline,journeyDraftKey,readJourneyDraft} from './journeyDraft';
import {BASELINE_VERSION,baselineStorageKey} from './balancedBaseline';
import {clearBaselineChoice,importedBaselineChoices,saveBaselineChoice} from './baselineStorage';
import type {MeasurementMetadata} from './measurementMetadata';

const now=Date.now(),date=new Date(now-86400000).toISOString();
const profile={age:30,sex:'unselected' as const};
const details:MeasurementMetadata={pullups:{measuredAt:date,ageAtMeasurement:30,method:'manual',protocol:{id:'strict_pullups_v1'}}};
function store(){
 const data=new Map<string,string>();
 return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
}
test('zero is a completed result, incomplete context is not a baseline choice',()=>{
 const storage=store();
 assert.equal(saveBaselineChoice(storage,'guest','pullups',{pullups:0},{},'unselected'),null);
 assert.equal(storage.data.size,0);
 const selected=saveBaselineChoice(storage,'guest','pullups',{pullups:0},details,'unselected')!;
 assert.equal(selected.pull?.test,'pullups');
 assert.equal(unfinishedPlan({pull:'pullups'},selected,{pullups:0},details).length,0);
 assert.deepEqual(unfinishedPlan({pull:'pullups'},selected,{},details),['pull']);
 assert.equal(baselineArea('grip_strength'),undefined);
});
test('personal change requires separately dated matching protocols, preserving a zero',()=>{
 const before=details.pullups,after={...before,measuredAt:new Date(now-10000).toISOString()};
 assert.equal(resultChange('pullups',0,before,2,after,now),2);
 assert.equal(resultChange('pullups',5,before,2,after,now),-3);
 assert.equal(resultChange('pullups',undefined,before,2,after,now),null);
 assert.equal(resultChange('pullups',0,before,2,{...after,method:'device'},now),null);
 assert.equal(resultChange('pullups',0,before,2,{...after,measuredAt:date},now),null);
 assert.equal(resultChange('pullups',2,after,0,before,now),null);
 assert.equal(resultChange('unknown',1,before,2,after,now),null);
});
test('each result keeps challenge fallback distinct from a matched published cohort',()=>{
 const fallback=resultComparison('pullups',14,profile,details.pullups,now)!;
 assert.equal(fallback.published,null);assert.ok(fallback.challenge);
 const jump={measuredAt:date,ageAtMeasurement:30,method:'device' as const,protocol:{id:'chms_leonardo_cmj_v1',equipment:'Leonardo',trials:3}};
 const published=resultComparison('cmj',60,{age:30,sex:'male'},jump,now)!;
 assert.equal(published.published?.referenceVersion,'chms-2017-p10-p50-p90-p95-v2');
 assert.equal(resultComparison('cmj',60,profile,jump,now)?.published,null);
 assert.equal(resultComparison('pullups',1.5,profile,details.pullups,now),null);
});
test('stable baseline fingerprints survive metadata reordering but reject newer observations',()=>{
 const original=journeyBaseline(profile,{pullups:0},details);
 const reordered=journeyBaseline({...profile},{pullups:0},{pullups:{protocol:{id:'strict_pullups_v1'},method:'manual',ageAtMeasurement:30,measuredAt:date}});
 assert.equal(original,reordered);
 const draft={version:2,updatedAt:now,baseline:original,metric:'pullups',collection:0,guided:false,screen:'record',profile:{age:'30',sex:'unselected',height:'',weight:''},values:{pullups:0},details};
 assert.ok(readJourneyDraft(JSON.stringify(draft),reordered,now));
 assert.equal(readJourneyDraft(JSON.stringify(draft),journeyBaseline(profile,{pullups:1},details),now),null);
 assert.deepEqual(draftValues({pullups:0,pushups:NaN,run_5k:undefined}),{pullups:0});
});
test('reviewed guest import preserves account choices and never imports unfinished session input',()=>{
 const storage=store(),guest={values:{pullups:0},measurementDetails:details};
 saveBaselineChoice(storage,'guest','pullups',guest.values,details,'unselected');
 const draftKey=journeyDraftKey('guest');storage.setItem(draftKey,'unsaved raw data');
 const copied=importedBaselineChoices(storage,'account-a',guest,guest);
 assert.equal(copied.pull?.test,'pullups');
 assert.equal(storage.getItem(journeyDraftKey('account-a')),null);
 assert.equal(storage.getItem(draftKey),'unsaved raw data');
 assert.equal(storage.getItem(baselineStorageKey('account-b')),null);
 storage.setItem(baselineStorageKey('account-b'),JSON.stringify({version:BASELINE_VERSION,choices:{pull:{test:'pullup_1rm',sex:'male'}}}));
 assert.equal(importedBaselineChoices(storage,'account-b',guest,guest).pull?.test,'pullup_1rm');
 const blocked=importedBaselineChoices(storage,'account-c',guest,{...guest,values:{pullups:1}});
 assert.equal(blocked.pull,undefined);
});

test('opting out clears only the selected alternative in its area',()=>{
 const storage=store();
 saveBaselineChoice(storage,'guest','pullups',{pullups:0},details,'unselected');
 assert.equal(clearBaselineChoice(storage,'guest','pullup_1rm').pull?.test,'pullups');
 assert.equal(clearBaselineChoice(storage,'guest','pullups').pull,undefined);
});
