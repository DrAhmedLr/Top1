import assert from 'node:assert/strict';
import test from 'node:test';
import {activePlan,buildProgram,goalMetrics,makeWorkout,type AdaptiveConfig,type AdaptivePlan} from './adaptiveProgram';
import {appendTraining,type TrainingEvent,type TrainingProgram,type Workout} from './training';
import type {Observation} from './history';
import {personalForecast} from './personalForecast';
import {recentPaceForecast} from './recentGoalPace';
import {protocolOptions,type MeasurementProtocol} from './protocols';

const base:AdaptiveConfig={metric:'pushups',goalUnit:'metric',baseline:20,target:23,deadline:'2026-10-05',createdAt:'2026-09-30T07:00:00Z',days:7,minutes:25,exercise:'Push-up',dose:{mode:'reps',sets:2,amount:8,loadKg:0},routineId:'routine'};
const day=(n:number)=>'2026-10-'+String(n).padStart(2,'0');
const at=(n:number,hours='08')=>day(n)+'T'+hours+':00:00Z';
function write(events:TrainingEvent[],kind:'program'|'workout',data:TrainingProgram|Workout,recordedAt:string){
 return appendTraining(events,{version:1,id:crypto.randomUUID(),expectedRevision:0,kind,data,epoch:0,requestId:crypto.randomUUID(),deleted:false,reason:''},0,Date.parse(recordedAt));
}
function setup(config:AdaptiveConfig=base,days:{n:number;skip?:boolean;different?:boolean}[]=[{n:1},{n:2},{n:3}],zone='UTC'){
 let events=write([],'program',buildProgram(config,zone),config.createdAt);
 const template=activePlan(events)!;
 for(const {n,skip,different} of days){
  const actual=skip?null:{...config.dose,amount:config.dose.amount+(different?1:0),minutes:config.minutes};
  const workout=makeWorkout(template,day(n),actual,new Date(at(n,'13')));
  events=write(events,'workout',workout,at(n,'13'));
 }
 // This scenario evaluates keeping this realized dose for future sessions.
 const plan=activePlan(events)!;
 return {...plan,prescription:template.prescription};
}
function tests(values:number[],metric='pushups',start=1):Observation[]{
 return values.map((value,i)=>({metricId:metric,value,id:metric+i,sequence:i+1,measuredAt:at(start+i),recordedAt:at(start+i),cleared:false,method:'manual',protocol:{id:metric==='run_5k'?'run5k_outdoor_manual_v1':'strict_pushups_v1'}}));
}

test('resampling counts increases, flat results and declines; crossing is evaluated by the deadline',()=>{
 const plan=setup(),entries=tests([20,22,22,21]),forecast=personalForecast(plan,entries,21,day(4));
 assert.equal(forecast.kind,'ready');
 if(forecast.kind!=='ready')return;
 assert.equal(forecast.intervals,3);assert.equal(forecast.completedSessions,3);assert.equal(forecast.remainingSessions,2);
 assert.deepEqual([forecast.improving,forecast.unchanged,forecast.declining],[1,1,1]);
 assert.ok(Math.abs(forecast.probability-4/9)<.04,String(forecast.probability));
 assert.deepEqual(personalForecast(plan,[...entries].reverse(),21,day(4)),forecast);
 const down=personalForecast(plan,tests([24,23,22,21]),21,day(4));
 assert.ok(down.kind==='ready'&&down.probability===0);
});
test('insufficient, changed or undocumented intervals never supply a probability',()=>{
 const entries=tests([20,22,22,21]),plan=setup();
 assert.deepEqual(personalForecast(plan,entries.slice(0,3),22,day(4)),{kind:'unavailable',reason:'insufficient',intervals:2});
 const gap=setup(base,[{n:1},{n:3}]);
 assert.deepEqual(personalForecast(gap,entries,21,day(4)),{kind:'unavailable',reason:'insufficient',intervals:2});
 const changed=setup(base,[{n:1},{n:2,different:true},{n:3}]);
 assert.deepEqual(personalForecast(changed,entries,21,day(4)),{kind:'unavailable',reason:'insufficient',intervals:2});
 const other=entries.map((e,i)=>i===1?{...e,protocol:{id:'strict_pushups_v1',equipment:'other'}}:e);
 assert.equal(personalForecast(plan,other,21,day(4)).kind,'unavailable');
 assert.equal(personalForecast(plan,entries,20.95,day(4)).kind,'unavailable');
 assert.equal(personalForecast(plan,entries.map(e=>({...e,method:undefined})),21,day(4)).kind,'unavailable');
 // An old malformed test between two measurements cannot form or bridge an interval.
 const undated={...entries[1],measuredAt:'invalid legacy date',recordedAt:at(2,'10'),id:'legacy'};
 assert.deepEqual(personalForecast(plan,[...entries,undated],21,day(4)),{kind:'unavailable',reason:'insufficient',intervals:2});
 const malformed={...undated,recordedAt:'invalid save date'};
 assert.deepEqual(personalForecast(plan,[...entries,malformed],21,day(4)),personalForecast(plan,entries,21,day(4)));
});
test('sessions just after UTC midnight belong to the local program day',()=>{
 const plan=setup(base,undefined,'America/New_York');
 const shifted=plan.sessions.map(event=>{
  const workout=event.data as Workout;
  const hours=11.5*3600000;
  return {...event,data:{...workout,startedAt:new Date(Date.parse(workout.startedAt)+hours).toISOString(),endedAt:new Date(Date.parse(workout.endedAt!)+hours).toISOString()}};
 });
 const forecast=personalForecast({...plan,sessions:shifted},tests([20,22,22,21]),21,day(4));
 assert.ok(forecast.kind==='ready'&&forecast.completedSessions===3&&forecast.remainingSessions===2);
});
test('logged pauses count as slots, corrections and repeated imports count each test and session once',()=>{
 const plan=setup(base,[{n:1},{n:2,skip:true},{n:3},{n:4},{n:5}]);
 const entries=tests([20,21,22,24]).map((e,i)=>i?{...e,measuredAt:at(i+2),recordedAt:at(i+2)}:e);
 const corrections=[{...entries[1],id:'stale',sequence:0,value:50},...entries,entries[1]];
 const forecast=personalForecast({...plan,sessions:[...plan.sessions,...plan.sessions]},corrections,24,day(5));
 assert.ok(forecast.kind==='ready');if(forecast.kind!=='ready')return;
 assert.equal(forecast.intervals,3);assert.equal(forecast.completedSessions,3);
 assert.equal(forecast.improving,3);assert.equal(forecast.remainingSessions,0);assert.equal(forecast.probability,1);
 const wiped={...entries[3],id:'clear',sequence:20,value:null,cleared:true};
 assert.equal(personalForecast(plan,[...entries,wiped],24,day(5)).kind,'unavailable');
});
test('fully documented rest intervals remain in the distribution after three training intervals',()=>{
 const config={...base,deadline:day(7)};
 const entries=tests([20,21,18,19,20]);
 const plan=setup(config,[{n:1},{n:2,skip:true},{n:3},{n:4}]);
 const sample=personalForecast(plan,entries,20,day(5));
 assert.ok(sample.kind==='ready'&&sample.intervals===4&&sample.completedSessions===3&&sample.declining===1);
 const resting=setup(config,[{n:1,skip:true},{n:2,skip:true},{n:3,skip:true},{n:4}]);
 assert.deepEqual(personalForecast(resting,entries,20,day(5)),{kind:'unavailable',reason:'insufficient',intervals:1});
});
test('lower-is-better runs and measured absolute lift loads use the goal units',()=>{
 const run=setup({...base,metric:'run_5k',baseline:26,target:22});
 const fast=personalForecast(run,tests([26,25,24,23],'run_5k'),23,day(4));
 assert.ok(fast.kind==='ready'&&fast.probability===1&&fast.improving===3);
 const lift=setup({...base,metric:'bench_1rm',baseline:80,target:100,goalUnit:'kg',exercise:'Bench'});
 const entries=tests([1,1,1,1]).map((e,i):Observation=>({...e,metricId:'bench_1rm',method:'direct_1rm',protocol:{id:'bench_paused_v1'},derivation:{formula:'epley_ratio_v1',inputs:[80+5*i,1],bodyWeightKg:80+5*i}}));
 const weight=personalForecast(lift,entries,95,day(4));
 assert.ok(weight.kind==='ready'&&weight.probability===1&&weight.improving===3);
 const missing=entries.map(e=>({...e,derivation:undefined}));
 assert.deepEqual(personalForecast(lift,missing,95,day(4)),{kind:'unavailable',reason:'context',intervals:0});
});
test('an expired or very long goal never causes an unbounded calculation',()=>{
 const plan=setup(),entries=tests([20,22,22,21]);
 assert.equal(personalForecast(plan,entries,21,day(6)).kind,'unavailable');
 const distant:AdaptivePlan={...plan,config:{...plan.config,deadline:'9000-01-01'}};
 assert.deepEqual(personalForecast(distant,entries,21,day(4)),{kind:'unavailable',reason:'horizon',intervals:0});
 assert.equal(personalForecast(plan,entries,21,'2026-02-30').kind,'unavailable');
});

test('the full-adherence estimate uses only intervals with every prescribed workout completed',()=>{
 const plan=setup({...base,deadline:day(8)},[{n:1},{n:2,skip:true},{n:3},{n:4}]);
 const entries=tests([20,21,19,20,21]);
 const partial=personalForecast(plan,entries.slice(0,4),20,day(4),'adherent-program');
 assert.deepEqual(partial,{kind:'unavailable',reason:'insufficient',intervals:2});
 const full=personalForecast(plan,entries,21,day(5),'adherent-program');
 assert.ok(full.kind==='ready');
 assert.equal(full.intervals,3);
 assert.equal(full.declining,0);
 assert.equal(full.completedSessions,3);
 assert.ok(full.targetSensitivity && full.targetSensitivity.low<=full.probability && full.targetSensitivity.high>=full.probability);
});

test('the adaptive program unlocks after three prescribed intervals including a measured setup-day baseline',()=>{
 const config={...base,createdAt:at(1,'09')};
 let events=write([],'program',buildProgram(config,'UTC'),config.createdAt);
 for(let n=1;n<=3;n++){
  const plan=activePlan(events)!;
  const workout=makeWorkout(plan,day(n),{...plan.prescription,minutes:config.minutes},new Date(at(n,'13')));
  events=write(events,'workout',workout,at(n,'13'));
 }
 const plan=activePlan(events)!;
 assert.ok(plan.prescription.amount>config.dose.amount);
 const entries=tests([20,21,20,22]);
 const forecast=personalForecast(plan,entries,22,day(4),'program');
 assert.ok(forecast.kind==='ready'&&forecast.intervals===3&&forecast.declining===1);
 assert.equal(personalForecast(plan,entries.slice(1),22,day(4),'program').kind,'unavailable');
 const changed=entries.map((entry,i)=>i===0?{...entry,value:19}:entry);
 assert.equal(personalForecast(plan,changed,22,day(4),'program').kind,'unavailable');
 const mismatched=setup(base,[{n:1},{n:2,different:true},{n:3}]);
 assert.equal(personalForecast(mismatched,entries,22,day(4),'program').kind,'unavailable');
});


test('all selectable goal metrics accept four documented comparable tests and matching sessions',()=>{
 for(const metric of goalMetrics){
  const baseline=metric.mean,target=baseline+metric.polarity;
  const config={...base,metric:metric.id,baseline,target};
  const plan=setup(config);
  const option=protocolOptions[metric.id]?.[0];
  const protocol:MeasurementProtocol|undefined=option?{id:option.id}:undefined;
  if(protocol){
   if(metric.id==='cmj'||metric.id==='grip_strength')protocol.equipment='device A';
   if(metric.id==='grip_strength'){protocol.hand='left';protocol.trials=3;}
   if(metric.id==='sit_to_stand')protocol.chairHeightCm=45;
   if(metric.id==='single_leg_balance')protocol.hand='left';
  }
  const entries=tests([baseline,baseline,baseline,baseline],metric.id).map(entry=>({...entry,protocol}));
  const result=personalForecast(plan,entries,baseline,day(4),'program');
  assert.equal(result.kind,'ready',metric.id);
 }
});

test('recent pace uses measured changes and separately logged attendance to project the deadline and finish',()=>{
 const conf={...base,createdAt:at(1,'07'),deadline:day(6),target:26};
 const history=tests([20,21,22,23]);
 const run=(plan:AdaptivePlan,dayNumber:number,rows=history)=>
   recentPaceForecast(plan,rows,rows.at(-1)!.value!,day(dayNumber),Date.parse(at(dayNumber,'18')));
 const initial=run(setup(conf),4);
 assert.equal(initial.kind,'ready');
 if(initial.kind!=='ready')return;
 assert.equal(initial.intervals,3);
 assert.deepEqual(initial.attendance,{completed:3,skipped:0,modified:0,unlogged:0});
 assert.equal(initial.probability,1);assert.equal(initial.finishDay,day(6));
 assert.deepEqual(initial.finishRange,{early:day(6),late:day(6)});
 const skipped=run(setup(conf,[{n:1},{n:2},{n:3},{n:4,skip:true}]),4);
 assert.ok(skipped.kind==='ready'&&skipped.probability<initial.probability);
 assert.equal(skipped.attendance.skipped,1);
 if(skipped.kind==='ready')assert.ok(skipped.finishDay&&skipped.finishDay>day(6));
 const changed=run(setup(conf,[{n:1},{n:2},{n:3},{n:4,different:true}]),4);
 assert.ok(changed.kind==='unavailable'&&changed.reason==='context');
 assert.equal(changed.attendance.modified,1);
 const unlogged=run(setup(conf),6);
 assert.equal(unlogged.kind,'unavailable');assert.equal(unlogged.attendance.unlogged,2);
 const early=run(setup(conf),4,tests([20,21,22]));
 assert.ok(early.kind==='unavailable'&&early.reason==='insufficient'&&early.intervals===2);
 const flat=run(setup(conf),4,tests([20,20,20,20]));
 assert.ok(flat.kind==='ready'&&flat.probability===0&&flat.finishDay===null&&flat.finishRange===null);
 const learnedMod=run(setup(conf,[{n:1,different:true},{n:2},{n:3},{n:4,different:true}]),4);
 assert.ok(learnedMod.kind==='ready');assert.equal(learnedMod.attendance.modified,2);
});

test('recent pace stays resolved after a qualifying target test and later decline',()=>{
 const plan=setup({...base,createdAt:at(1,'07'),deadline:day(15),target:24});
 const entries=tests([20,24,22,23]),now=Date.parse(at(4,'18'));
 assert.equal(recentPaceForecast(plan,entries,23,day(4),now).kind,'unavailable');
 const prior=recentPaceForecast(plan,entries,23,day(4),now);
 assert.ok(prior.kind==='unavailable'&&prior.reason==='reached');
 const revised=recentPaceForecast({...plan,attemptOpenedAt:Date.parse(at(3,'09'))},entries,23,day(4),now);
 assert.ok(revised.kind==='ready');
});
