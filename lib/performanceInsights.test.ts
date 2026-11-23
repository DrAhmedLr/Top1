import test from 'node:test';
import assert from 'node:assert/strict';
import {activePlan, buildProgram, doseKey, makeWorkout, type AdaptiveConfig} from './adaptiveProgram';
import {appendTraining, type TrainingEvent} from './training';
import {createGuidedConfig, previewDatedProgram} from './datedProgram';
import {guidedAdherenceScenario} from './guidedAdherence';
import type {Observation} from './history';
import {performanceInsights} from './performanceInsights';
import {overallPerformance} from './overallPerformance';

const now = Date.parse('2026-10-01T09:00Z');
const base:AdaptiveConfig={metric:'pushups',goalUnit:'metric',baseline:20,target:24,deadline:'2026-10-14',
  days:3,minutes:20,exercise:'Push-up',createdAt:new Date(now).toISOString(),dose:{mode:'reps',amount:5,sets:3,loadKg:0},routineId:'a'};
function makePlan(config:AdaptiveConfig) {
  const events = appendTraining([],{id:crypto.randomUUID(),requestId:crypto.randomUUID(),epoch:0,expectedRevision:0,reason:'',deleted:false,
    version:1,kind:'program',data:buildProgram(config,'UTC')},0,now);
  return activePlan(events)!;
}
const input = {values:{pushups:20,pullups:7},details:{},profile:{age:30,sex:'male' as const},entries:[],now,today:'2026-10-01'};

test('the first-day scenario responds to target difficulty and leaves the current score intact',()=>{
  const first = performanceInsights({...input,plan:makePlan(base)});
  assert.deepEqual(first.performance,overallPerformance(input.values,input.details,input.profile,now));
  assert.equal(first.goal?.scenario?.source,'illustrative');
  assert.equal(first.goal?.scenario?.assumptions.gain,1);
  assert.deepEqual(first.goal?.personal,{kind:'unavailable',reason:'insufficient',intervals:0});
  const easier = performanceInsights({...input,plan:makePlan({...base,target:22})});
  assert.ok(easier.goal!.scenario!.p > first.goal!.scenario!.p);
  assert.equal(first.goal?.atTargetPercent,overallPerformance({...input.values,pushups:24},{},input.profile,now).overall?.percent);
  assert.equal(performanceInsights(input).goal,null);
});

test('saved assumptions are used only at the matching dose and kg projection requires test-day weight',()=>{
 const assumptions={dose:doseKey(base,base.dose),gain:1,attendance:100,response:100};
 const plan=makePlan({...base,scenario:assumptions});
 assert.equal(performanceInsights({...input,plan}).goal?.scenario?.p,1);
 assert.equal(performanceInsights({...input,plan}).goal?.scenario?.source,'saved');
 const changed={...plan,prescription:{...plan.prescription,sets:1}};
 assert.equal(performanceInsights({...input,plan:changed}).goal?.scenario?.source,'illustrative');
 const lift=makePlan({...base,metric:'bench_1rm',goalUnit:'kg',baseline:80,target:96});
 assert.equal(performanceInsights({...input,plan:lift}).goal?.atTargetPercent,null);
 const projected=performanceInsights({...input,values:{bench_1rm:1},details:{bench_1rm:{method:'direct_1rm',
   derivation:{formula:'epley_ratio_v1',inputs:[80,1],bodyWeightKg:80}}},plan:lift});
 assert.equal(projected.goal?.atTargetPercent,overallPerformance({bench_1rm:1.2},{},input.profile,now).overall?.percent);
});

test('following a generated calendar unlocks a full-attendance estimate at the third comparable checkpoint',()=>{
 const today='2026-10-01', config=createGuidedConfig({metric:'pushups',baseline:10,target:15,startDay:today,
   deadline:'2026-10-31',timeZone:'UTC',now:new Date(now)});
 const calendar=previewDatedProgram(config,'UTC').weeks.flatMap(week=>week.sessions);
 const first=makePlan(config);
 const read=(plan:typeof first,entries:Observation[],day:string)=>performanceInsights({...input,values:{pushups:entries.at(-1)?.value??10},
   entries,plan,today:day,now:Date.parse(day+'T20:00Z')}).goal!.adherence;
 const baseline:Observation={id:'baseline',sequence:1,metricId:'pushups',value:10,measuredAt:today+'T08:00:00Z',recordedAt:today+'T08:10:00Z',
   cleared:false,method:'manual',protocol:{id:'strict_pushups_v1'}};
 const entries=[baseline];
 let ledger:TrainingEvent[]=[first.event];
 const dayOne=read(first,entries,today);
 assert.deepEqual(dayOne,guidedAdherenceScenario(config,today));
 assert.equal(dayOne?.sessions,calendar.filter(session=>session.kind==='training').length);
 let checkpoints=0;
 for(const session of calendar){
  const {date}=session;
  if(session.kind==='training'){
   const ended=new Date(date+'T13:00Z');
   const data=makeWorkout(activePlan(ledger)!,date,{...session,minutes:session.estimatedMinutes},ended);
   ledger=appendTraining(ledger,{id:crypto.randomUUID(),requestId:crypto.randomUUID(),epoch:0,expectedRevision:0,reason:'',
    deleted:false,version:1,kind:'workout',data},0,ended.getTime());
   continue;
  }
  checkpoints++;
  entries.push({...baseline,id:'test'+checkpoints,sequence:1+checkpoints,value:10+checkpoints,measuredAt:date+'T09:00:00Z',recordedAt:date+'T09:01:00Z'});
  const forecast=read(activePlan(ledger)!,entries,date);
  assert.equal(forecast?.intervals,checkpoints);
  assert.equal(forecast?.kind,checkpoints<3?'illustrative':'personal');
  if(checkpoints===3){
   assert.ok(date<config.deadline);
   assert.equal(forecast?.sessions,calendar.filter(item=>item.kind==='training'&&item.date>date).length);
   break;
  }
 }
 assert.equal(checkpoints,3);
});

test('account insights read the verified owner, honor paged training and reject mixed snapshots',async()=>{
 const {createClient}=await import('@supabase/supabase-js');
 const {accountPerformanceInsights,InsightsChanged}=await import('./performanceInsightsServer');
 const owner='00000000-0000-4000-8000-000000000001';
 const today=new Date(),createdAt=today.toISOString();
 const plan=makePlan({...base,createdAt:base.createdAt,deadline:new Date(today.getTime()+86400000).toISOString().slice(0,10)});
 let changed=false, calls:string[]=[];
 const transport:typeof fetch=async(input,options)=>{
   const url=new URL(String(input)), path=url.pathname.split('/').at(-1)!;
   calls.push(path);
   let data:unknown;
   if(path==='profiles'){
     assert.equal(url.searchParams.get('id'),'eq.'+owner);
     data=[{age:30,sex:'male',weight_kg:80,revision:2}];
   }else if(path==='read_training_page'){
     const cursor=JSON.parse(String(options?.body)).p_after;
     data={counter:1,epoch:0,events:cursor===0?[plan.event]:[],next:cursor===0?plan.event.sequence:null};
   }else if(path==='read_current_measurements'){
     data={values:{pushups:21},details:{}};
   }else if(path==='metric_logs'){
     assert.equal(url.searchParams.get('user_id'),'eq.'+owner);
     assert.equal(url.searchParams.get('metric_id'),'eq.pushups');
     data=[{id:'first',sequence:2,metric_id:'pushups',metric_value:21,is_deleted:false,
       measured_at:createdAt,recorded_at:createdAt,method:'manual',protocol_context:{id:'strict_pushups_v1'}}];
   }else if(path==='training_state'){
     assert.equal(url.searchParams.get('user_id'),'eq.'+owner);
     data=[{epoch:0,counter:changed?2:1}];
   }else throw Error('Unexpected request '+path);
   return Response.json(data);
 };
 const client=createClient('https://fixture.invalid','fixture',{global:{fetch:transport},auth:{persistSession:false,autoRefreshToken:false}});
 const result=await accountPerformanceInsights(client,owner);
 assert.equal(result.performance.coverage,1);
 assert.equal(result.goal?.current,21);
 assert.equal(result.goal?.scenario?.source,'illustrative');
 assert.equal(calls.filter(call=>call==='read_training_page').length,2);
 changed=true;
 await assert.rejects(accountPerformanceInsights(client,owner),InsightsChanged);
});
