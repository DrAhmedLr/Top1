import assert from 'node:assert/strict';
import test from 'node:test';
import {activePlan,adaptivePlans,binomialTail,buildProgram,checkConfig,countScheduled,dayInZone,doseKey,goalMetrics,goalValue,makeWorkout,planForSession,observedGain,scenarioResult,scheduledWeekdays,workoutId,type AdaptiveConfig} from './adaptiveProgram';
import {appendTraining,type TrainingEvent,type TrainingMutation,type TrainingProgram,type Workout} from './training';
import {type Observation} from './history';
const base:AdaptiveConfig={metric:'pushups',goalUnit:'metric',baseline:20,target:24,deadline:'2026-10-11',createdAt:'2026-10-01T09:00:00Z',days:3,minutes:30,exercise:'Push-up',dose:{sets:2,amount:8,mode:'reps',loadKg:2},routineId:'first'};
function write(events:TrainingEvent[],kind:TrainingMutation['kind'],data:TrainingProgram|Workout,id=crypto.randomUUID(),expectedRevision=0){
  return appendTraining(events,{version:1,kind,id,expectedRevision,data,epoch:0,requestId:crypto.randomUUID(),deleted:false,reason:''},0,Date.parse('2026-10-12T12:00:00Z'));
}
const init=(c=base)=>write([],'program',buildProgram(c,'UTC'));
function log(events:TrainingEvent[],day:string,actual:{sets:number;amount:number;loadKg:number;minutes:number}|null){
  const plan=activePlan(events)!;
  return write(events,'workout',makeWorkout(plan,day,actual,new Date(day+'T18:00:00Z')));
}
test('routine schedule uses the original calendar zone and counts only scheduled dates through the deadline',()=>{
  assert.equal(dayInZone(new Date('2026-10-01T00:01:00Z'),'America/New_York'),'2026-09-30');
  assert.deepEqual(scheduledWeekdays(3,'2026-10-01'),[1,4,6]);
  assert.equal(countScheduled([1,4,6],'2026-10-01','2026-10-08'),4);
  assert.equal(countScheduled([1,4,6],'2026-10-09','2026-10-08'),0);
});
test('workouts preserve the immutable template and effective session, and only logged behavior changes future work',()=>{
  const original=init(),actual={sets:2,amount:6,loadKg:1,minutes:25};
  const one=log(original,'2026-10-01',actual);
  const after=activePlan(one)!;
  assert.deepEqual(after.prescription,{sets:2,amount:6,loadKg:1,mode:'reps',reason:'actual'});
  const workout=after.sessions[0].data as Workout;
  assert.deepEqual(workout.snapshot.exercises,(original[0].data as TrainingProgram).sessions[0].exercises);
  assert.equal(Date.parse(workout.endedAt!)-Date.parse(workout.startedAt),25*60000);
  assert.equal(workout.snapshot.exercises[0].sets[0].reps,8);
  assert.equal(workout.exercises[0].sets[0].reps,6);
  assert.throws(()=>makeWorkout(after,'2026-10-01',actual,new Date('2026-10-01T20:00:00Z')),/duplicate/);
  const skipped=activePlan(log(one,'2026-10-02',null))!;
  assert.deepEqual(skipped.prescription,{sets:1,amount:6,loadKg:1,mode:'reps',reason:'missed'});
  assert.equal((skipped.sessions[0].data as Workout).exercises.length,0);
  assert.throws(()=>makeWorkout(skipped,'2026-12-01',null,new Date('2026-10-02T20:00:00Z')),/date/);
  const hit={sets:2,amount:8,loadKg:2,minutes:30};
  assert.equal(activePlan(log(log(original,'2026-10-01',hit),'2026-10-02',hit))?.prescription.amount,9);
});
test('one session identity per program/calendar day survives retries and separate accounts keep their own entities',async()=>{
  const id=crypto.randomUUID();
  assert.equal(await workoutId(id,'2026-10-01'),await workoutId(id,'2026-10-01'));
  assert.notEqual(await workoutId(id,'2026-10-01'),await workoutId(id,'2026-10-02'));
  assert.notEqual(await workoutId(id,'2026-10-01'),await workoutId(crypto.randomUUID(),'2026-10-01'));
});
test('scenario follows polarity, actual time horizon, load-specific assumptions and exact binomial cases',()=>{
  assert.equal(binomialTail(2,1,.5),.75);
  assert.equal(binomialTail(3,4,1),0);
  assert.equal(binomialTail(3,0,0),1);
  assert.ok(Math.abs(binomialTail(1000,1,.999)!-1)<1e-10);
  const c={...base,days:7,target:22,deadline:'2026-10-02'};
  const scenario={dose:doseKey(c,c.dose),attendance:100,response:50,gain:1};
  const plan=activePlan(init({...c,scenario}))!;
  assert.equal(scenarioResult(plan,20,'2026-10-01')!.p,.25);
  assert.equal(scenarioResult(plan,21,'2026-10-01')!.p,.75);
  assert.equal(scenarioResult(plan,22,'2026-10-02')!.p,1);
  assert.equal(scenarioResult({...plan,prescription:{...plan.prescription,loadKg:3}},20,'2026-10-01'),undefined);
  const run={...c,metric:'run_5k',baseline:25,target:24};
  assert.equal(scenarioResult(activePlan(init({...run,scenario:{...scenario,dose:doseKey(run,run.dose)}}))!,25,'2026-10-01')!.p,.75);
});
test('two like-for-like dated tests and matching actual sessions can suggest a descriptive gain; changed dose, equipment or undocumented tests suppress it',()=>{
  let events=init();
  const actual={sets:2,amount:6,loadKg:2,minutes:30};
  events=log(log(events,'2026-10-01',actual),'2026-10-02',actual);
  const plan=activePlan(events)!;
  const test=(day:string,value:number):Observation=>({id:day,metricId:'pushups',value,method:'manual',protocol:{id:'strict_pushups_v1'},measuredAt:day,recordedAt:day,cleared:false});
  const latest=test('2026-10-02T20:00:00Z',24),prior=test('2026-10-01T10:00:00Z',20);
  assert.deepEqual(observedGain(plan,[latest,prior]),{gain:2,observed:2,delta:4,count:2});
  assert.equal(observedGain({...plan,prescription:{...plan.prescription,loadKg:5}},[latest,prior]),undefined);
  assert.equal(observedGain(plan,[latest,{...prior,method:undefined}]),undefined);
  assert.equal(observedGain(plan,[latest,{...prior,measuredAt:'2026-09-30T19:00:00Z'}]),undefined);
});
test('new goals keep previous sessions and original data while unsupported targets remain invalid',()=>{
  const old=log(init(),'2026-10-01',null),newer=write(old,'program',buildProgram({...base,metric:'pullups',baseline:5,target:10},'UTC'));
  assert.equal(activePlan(newer)?.config.metric,'pullups');
  const prior=adaptivePlans(newer)[1];
  assert.equal(prior.config.metric,'pushups');assert.equal(prior.sessions.length,1);
  assert.throws(()=>checkConfig({...base,target:19}));assert.throws(()=>checkConfig({...base,dose:{...base.dose,sets:0}}));
  assert.throws(()=>checkConfig({...base,metric:'apob'}));
  assert.equal(goalValue(goalMetrics.find(m=>m.id==='bench_1rm')!,'kg',1.25,{}),undefined);
  assert.equal(goalValue(goalMetrics.find(m=>m.id==='bench_1rm')!,'kg',1.25,{derivation:{formula:'epley_ratio_v1',inputs:[100,1],bodyWeightKg:80}}),100);
});

test('a completed backfill uses its true end time, day, and the plan in effect before later edits',()=>{
  const firstData=buildProgram(base,'America/New_York'),id=crypto.randomUUID();
  const event=(data:TrainingProgram,expectedRevision:number,at:string,prior:TrainingEvent[])=>appendTraining(prior,{kind:'program',version:1,id,data,epoch:0,requestId:crypto.randomUUID(),expectedRevision,deleted:false,reason:''},0,Date.parse(at));
  const first=event(firstData,0,'2026-10-01T09:00:00Z',[]);
  const revised=buildProgram({...base,dose:{...base.dose,amount:12},routineId:'updated'},'America/New_York',firstData);
  const records=event(revised,1,'2026-10-04T09:00:00Z',first);
  const active=activePlan(records)!,endedAt='2026-10-03T01:00:00Z',day='2026-10-02';
  const template=planForSession(records,active,day,endedAt);
  assert.equal(template.event.revision,1);assert.equal(template.prescription.amount,8);
  const actual={sets:1,amount:6,loadKg:2,minutes:30,endedAt};
  const backfill=makeWorkout(template,day,actual,new Date('2026-10-06T13:00:00Z'));
  assert.equal(backfill.endedAt,'2026-10-03T01:00:00.000Z');
  assert.equal(backfill.startedAt,'2026-10-03T00:30:00.000Z');
  assert.equal(backfill.snapshot.exercises[0].sets[0].reps,8);
  assert.throws(()=>makeWorkout(template,'2026-10-03',actual,new Date('2026-10-06T13:00:00Z')),/date/);
  const after=activePlan(write(records,'workout',backfill))!;
  assert.deepEqual(after.prescription,{...base.dose,amount:12,reason:'initial'});
  assert.equal(after.sessions.length,1);
  assert.throws(()=>makeWorkout(planForSession([...records,...after.sessions],after,day,endedAt),day,actual,new Date('2026-10-06T13:00:00Z')),/duplicate/);
});
test('an expired program has no prospective probability even after a late retest exceeds its goal',()=>{
  const scenario={dose:doseKey(base,base.dose),gain:1,response:50,attendance:100};
  const plan=activePlan(init({...base,scenario}))!;
  assert.equal(scenarioResult(plan,25,'2026-10-12'),undefined);
});
