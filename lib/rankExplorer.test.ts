import assert from 'node:assert/strict';
import test from 'node:test';
import {activeMetrics,type Demographics,type Metric} from './registry';
import {allowedMethods} from './measurementRules';
import {protocolOptions} from './protocols';
import type {MeasurementDetails} from './measurementMetadata';
import type {Observation} from './history';
import {challengeBand,personalPosition,readRankHistory,referenceRank} from './rankExplorer';

const now=Date.parse('2026-10-20T12:00:00Z');
const date=(day:number)=>new Date(now-day*86400000).toISOString();
const metric=(id:string)=>activeMetrics.find(row=>row.id===id)!;
const profile={age:35,sex:'male' as const};
const result=(m:Metric,value:number,ctx:MeasurementDetails,sequence:number):Observation=>({...ctx,id:String(sequence),sequence,metricId:m.id,value,cleared:false,recordedAt:ctx.measuredAt??date(0)});
function setup(m:Metric,day:number):MeasurementDetails{
 const option=protocolOptions[m.id]?.[0];
 const context:MeasurementDetails={method:allowedMethods(m.id)[0],measuredAt:date(day)};
 if(option)context.protocol={id:option.id,equipment:'same device'};
 if(m.id==='vo2_max'){context.exerciseMode='treadmill';context.protocol={id:'cpet_treadmill_v1',peakRer:1.1,referencePopulation:'matches'};}
 if(m.id==='grip_strength')context.protocol={...context.protocol!,hand:'left',trials:3};
 if(m.id==='single_leg_balance')context.protocol={...context.protocol!,hand:'left'};
 if(m.id==='hrv')context.protocol={...context.protocol!,hrvStatistic:'rmssd'};
 if(m.id==='sit_to_stand')context.protocol={...context.protocol!,chairHeightCm:43};
 if(['total_sleep','sleep_efficiency','circadian_regularity'].includes(m.id))context.window={start:date(day+7),end:date(day),statistic:'mean',sampleCount:7};
 return context;
}
test('all 36 active measurements can receive a numerical personal percentile from compatible repeats',()=>{
 assert.equal(activeMetrics.length,36);
 for(const m of activeMetrics){
  const current=Math.max(m.min,Math.round(m.mean)),context=setup(m,0);
  const prior=result(m,current,setup(m,8),1);
  assert.deepEqual(personalPosition(m,current,context,[prior],now),{kind:'personal',count:1,below:0,equal:1,percentile:50},m.id);
 }
});
test('published bounds and challenge tiers have distinct results and clinical inputs keep their raw units',()=>{
 const jump=metric('cmj'),context={measuredAt:date(1),ageAtMeasurement:35,method:'device' as const,protocol:{id:'chms_leonardo_cmj_v1',equipment:'Leonardo',trials:3}};
 const published=referenceRank(jump,65,profile,context,now);
 assert.deepEqual(published.published?.band,{kind:'upper',from:0,to:5});assert.ok(published.challenge);
 assert.equal(referenceRank(jump,65,profile,{},now).published,null);
 const cpet={...setup(metric('vo2_max'),1),ageAtMeasurement:35};
 assert.ok(referenceRank(metric('vo2_max'),50,profile,cpet,now).published);
 assert.equal(referenceRank(metric('vo2_max'),50,profile,{...cpet,derivation:{formula:'cooper_v1',inputs:[2741.4]}},now).published,null);
 const bp=referenceRank(metric('bp_systolic'),125,profile,{},now);
 assert.equal(bp.value,125);assert.equal(bp.published,null);assert.equal(bp.challenge,null);
 assert.equal(referenceRank(metric('pushups'),0,profile,{},now).value,0);
 assert.equal(referenceRank(metric('pushups'),undefined,profile,{},now).challenge,null);
 assert.deepEqual(challengeBand('1%'),{kind:'range',from:.75,to:1});
 assert.deepEqual(challengeBand('65%+'),{kind:'lower',from:65,to:100});
 assert.deepEqual(challengeBand('0.1%'),{kind:'range',from:.075,to:.1});
 assert.deepEqual(challengeBand('0.01%'),{kind:'upper',from:0,to:.01});
 assert.equal(challengeBand('0.001%'),null);
});
test('private percentiles count distinct past attempts since a clear with midranks for ties',()=>{
 const m=metric('pushups'),latest=setup(m,0);
 const entry=(value:number,day:number,seq:number)=>result(m,value,setup(m,day),seq);
 const data=[entry(0,1,4),entry(10,2,3),entry(20,3,2),entry(100,3,1),entry(10,0,8),
  {...entry(45,4,5),protocol:{id:'strict_pushups_v1',equipment:'other setup'}},entry(3,-1,9)];
 assert.deepEqual(personalPosition(m,10,latest,data,now),{kind:'personal',count:3,below:1,equal:1,percentile:50});
 assert.deepEqual(personalPosition(m,10,latest,[...data,{...entry(0,1,10),cleared:true,value:null}],now),{kind:'insufficient',count:0});
 assert.equal(personalPosition(m,10,{},[],now).kind,'insufficient');
 assert.equal(personalPosition(m,undefined,{},data,now).kind,'missing');
});
test('personal blood-test rank describes numeric position including zero rather than fitness',()=>{
 const m=metric('apob'),current=setup(m,0),before=result(m,80,setup(m,10),1);
 assert.deepEqual(personalPosition(m,40,current,[before],now),{kind:'personal',count:1,below:0,equal:0,percentile:0});
 assert.equal(personalPosition(metric('total_sleep'),420,{...setup(metric('total_sleep'),0),window:undefined},[],now).kind,'insufficient');
});
test('quick entries support a descriptive log percentile for every metric, with no inferred dates or methods',()=>{
 for(const m of activeMetrics){
  const value=Math.max(m.min,Math.round(m.mean));
  const first=result(m,value,{source:'manual'},1),second=result(m,value,{source:'manual'},2);
  assert.deepEqual(personalPosition(m,value,{},[first],now),{kind:'insufficient',count:0},m.id);
  assert.deepEqual(personalPosition(m,value,{},[first,second],now),{kind:'logged',count:1,below:0,equal:1,percentile:50},m.id);
  assert.equal(personalPosition(m,value,{},[first,{...second,cleared:true,value:null}],now).kind,'insufficient');
 }
});
test('descriptive log ranks handle zero, remove repeated imports and respect the newest same-date correction',()=>{
 const m=metric('pullups');
 const current=result(m,0,{},9),old=result(m,4,setup(m,5),3),corrected={...old,id:'4',sequence:4,value:0};
 const rank=personalPosition(m,0,{},[current,old,corrected,corrected],now);
 assert.deepEqual(rank,{kind:'logged',count:1,below:0,equal:1,percentile:50});
 assert.equal(personalPosition(m,1,{},[current,old,corrected],now).kind,'insufficient');
 assert.equal(personalPosition(m,0,{},[current,{...old,sequence:7,cleared:true,value:null},old],now).kind,'insufficient');
});
test('private rank pages retain owner and cancellation, deduplicate and reject incomplete pagination',async()=>{
 const m=metric('pushups'),first=result(m,15,setup(m,0),55),second=result(m,10,setup(m,3),45),controller=new AbortController();
 const seen:string[]=[];
 const request:typeof fetch=async(url,options)=>{
  seen.push(String(url));
  assert.equal(new Headers(options?.headers).get('x-profile-user'),'owner-1');
  assert.equal(options?.signal,controller.signal);
  return Response.json(seen.length===1?{entries:[first],next:55}:{entries:[first,second],next:null});
 };
 assert.deepEqual(await readRankHistory('owner-1',m.id,controller.signal,request),[first,second]);
 assert.deepEqual(seen,['/api/history?metric=pushups&list=1','/api/history?metric=pushups&list=1&before=55']);
 await assert.rejects(readRankHistory('owner-1',m.id,controller.signal,async()=>Response.json({entries:[],next:55})));
 await assert.rejects(readRankHistory('owner-1',m.id,controller.signal,async()=>new Response(null,{status:401})));
});

test('push-up ranking uses the saved test profile and leaves unknown test weight neutral',()=>{
 const m=metric('pushups');
 const newerProfile:Demographics={age:30,sex:'male',weight:60};
 const saved:MeasurementDetails={ageAtMeasurement:45,protocol:{id:'strict_pushups_v1',referenceSex:'female',bodyWeightKg:90}};
 const progress=referenceRank(m,20,newerProfile,saved).progress!;
 assert.equal(progress.tier,'15%');assert.equal(progress.next?.value,24);
 assert.ok(progress.modelTopPercent!>13.8&&progress.modelTopPercent!<14);
 assert.deepEqual(progress,referenceRank(m,20,{age:34,sex:'unselected',weight:115},saved).progress);
 assert.equal(referenceRank(m,20,newerProfile).progress?.modelTopPercent,20);
});
