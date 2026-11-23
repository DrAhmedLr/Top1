import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuidedConfig,previewDatedProgram,datedProgram,countGuidedSessions,isGuidedTrainingDay,isGuidedRetestDay,
 nextGuidedTrainingDay,supportedProgramMetrics,type GuidedConfigInput} from './datedProgram';
import {activePlan,addDays,buildProgram,doseKey,makeWorkout,planForSession,scenarioResult,sessionResult} from './adaptiveProgram';
import {appendTraining,type TrainingEvent,type Workout} from './training';

const input:GuidedConfigInput={metric:'pushups',baseline:20,target:30,startDay:'2026-09-01',deadline:'2026-10-13',
 timeZone:'Africa/Casablanca',now:new Date('2026-08-30T12:00Z')};
const config=(overrides:Partial<GuidedConfigInput>={})=>createGuidedConfig({...input,...overrides});
const rows=(c=config())=>previewDatedProgram(c,input.timeZone).weeks.flatMap(w=>w.sessions);

test('generated dates share the forecast and logging calendar across weekdays, leap day, partial weeks and rest days',()=>{
 for(const days of [1,2,3])for(const start of ['2026-08-31','2028-02-29']){
   const c=config({startDay:start,deadline:addDays(start,49),context:{days}}),all=rows(c);
   assert.equal(all.at(-1)?.date,c.deadline);assert.equal(all.at(-1)?.kind,'retest');
   const workouts=all.filter(s=>s.kind==='training'),tests=all.filter(s=>s.kind==='retest');
   assert.ok(tests.length>=3);
   assert.equal(workouts.length,countGuidedSessions(c,addDays(start,-8),addDays(c.deadline,8)));
   for(const day of workouts){
    assert.ok(isGuidedTrainingDay(c,day.date));assert.equal(isGuidedRetestDay(c,day.date),false);
    for(const retest of tests)assert.ok(Math.abs(Date.parse(retest.date)-Date.parse(day.date))>=2*86400000);
   }
   for(const day of tests)assert.ok(isGuidedRetestDay(c,day.date));
   const first=nextGuidedTrainingDay(c,addDays(start,-1));
   assert.equal(first,workouts[0].date);
 }
});
test('the workout fits the budget in its actual units for every supported test',()=>{
 for(const metric of supportedProgramMetrics)for(const minutes of [10,20,45]) {
  const baseline=metric.mean,c=config({metric:metric.id,baseline,target:baseline+metric.polarity,context:{minutes,days:3},bodyWeightKg:80});
  for(const row of rows(c)){
   if(row.kind==='retest')continue;
   assert.ok(row.estimatedMinutes<=minutes&&row.estimatedMinutes>0,metric.id);
   assert.ok(row.sets>0&&row.amount>0&&row.restSeconds>0);
   assert.ok(row.exercise.every(label=>label.trim()));
   if(['run_5k','sprint_400m','zone2_power','dead_hang','single_leg_balance','grip_strength'].includes(metric.id))assert.equal(row.mode,'seconds',metric.id);
  }
 }
 const bodyweightLift=config({metric:'bench_1rm',baseline:1,target:1.2,bodyWeightKg:80});
 const kgLift=config({metric:'bench_1rm',baseline:80,target:96,bodyWeightKg:80,goalUnit:'kg'});
 assert.equal(bodyweightLift.dose.loadKg,kgLift.dose.loadKg);
 assert.equal(bodyweightLift.dose.loadKg,40);
 assert.equal(config({metric:'bench_1rm',baseline:1,target:1.2}).dose.loadKg,0);
 assert.match(config({baseline:0,target:3}).exercise,/Incline/);
 const substitution=config({metric:'dead_hang',baseline:30,target:40,context:{equipment:['none']}});
 assert.match(substitution.exercise,/towel/);assert.equal(substitution.reviewEquipment,true);
});
test('conditioned training doses progress, ease before tests, and resist oversized targets and impractical dates',()=>{
 const c=config(),sessions=rows(c).filter(r=>r.kind==='training');
 assert.ok(sessions.some(s=>s.amount>sessions[0].amount));
 const easyWeek=sessions.filter(s=>s.date>=addDays(input.startDay,21)&&s.date<addDays(input.startDay,28));
 assert.ok(easyWeek.every(s=>s.sets<c.dose.sets));
 assert.ok(previewDatedProgram(config({target:90,deadline:addDays(input.startDay,2)}),'UTC').warnings.includes('large-change'));
 const short=config({deadline:addDays(input.startDay,1)});
 assert.equal(previewDatedProgram(short,'UTC').trainingCount,0);
 assert.ok(previewDatedProgram(short,'UTC').warnings.includes('short-window'));
 for(const invalid of [{deadline:input.startDay},{deadline:addDays(input.startDay,365)},{startDay:'2026-02-30'},{target:19},{metric:'rhr'},
    {metric:'run_5k',baseline:26,target:30},{goalUnit:'kg' as const},{metric:'bench_1rm',goalUnit:'kg' as const,baseline:300,target:315,bodyWeightKg:50}]){
   assert.throws(()=>config(invalid));
 }
});
test('a backdated log uses exactly its dated prescription and a missed session lightens only the next training slot',()=>{
 const c=config();
 const add=(events:TrainingEvent[],data:ReturnType<typeof buildProgram>|Workout,kind:'program'|'workout',at:string)=>
   appendTraining(events,{version:1,id:crypto.randomUUID(),expectedRevision:0,requestId:crypto.randomUUID(),data,
     kind,epoch:0,deleted:false,reason:''},0,Date.parse(at));
 let events=add([],buildProgram(c,input.timeZone),'program',c.createdAt);
 let plan=activePlan(events)!;
 const original=datedProgram(plan).weeks.flatMap(w=>w.sessions).filter(r=>r.kind==='training');
 const before=original[0],after=original[1];
 const missed=makeWorkout(plan,before.date,null,new Date(before.date+'T12:00Z'));
 events=add(events,missed,'workout',before.date+'T12:00Z');
 plan=activePlan(events)!;
 const resolved=planForSession(events,plan,after.date);
 assert.equal(resolved.prescription.sets,after.sets-1);
 const row=datedProgram(plan).weeks.flatMap(w=>w.sessions).find(r=>r.date===after.date)!;
 assert.ok(row.kind==='training');assert.equal(row.sets,resolved.prescription.sets);
 const at=after.date+'T12:00Z';
 const logged=makeWorkout(plan,after.date,{...row,minutes:row.estimatedMinutes,endedAt:at},new Date(at));
 assert.equal(sessionResult(logged)?.dose.sets,row.sets);
 assert.throws(()=>makeWorkout(plan,addDays(after.date,1),null,new Date(c.deadline)));
 assert.throws(()=>makeWorkout(plan,c.deadline,null,new Date(c.deadline+'T12:00Z')));
 const scenario={dose:doseKey(c,plan.prescription),response:50,attendance:100,gain:1};
 assert.equal(scenarioResult({...plan,config:{...c,scenario}},20,before.date)?.sessions,countGuidedSessions(c,before.date,c.deadline)-1);
});

test('extending a deadline preserves the past taper and the three comparable trained intervals',async()=>{
 const {historicalTrainingCalendar}=await import('./adaptiveProgram');
 const {personalForecast}=await import('./personalForecast');
 const c=config({deadline:addDays(input.startDay,15),timeZone:'UTC',now:new Date(input.startDay+'T06:00:00Z')});
 const id=crypto.randomUUID();
 const add=(events:TrainingEvent[],kind:'program'|'workout',data:ReturnType<typeof buildProgram>|Workout,date:string,revision=0)=>
   appendTraining(events,{version:1,id:kind==='program'?id:crypto.randomUUID(),expectedRevision:revision,requestId:crypto.randomUUID(),
    data,kind,epoch:0,deleted:false,reason:''},0,Date.parse(date));
 let ledger=add([],'program',buildProgram(c,'UTC'),c.createdAt);
 const revised={...c,deadline:addDays(input.startDay,48),target:32};
 for(let n=0;n<19;n++){
   const day=addDays(input.startDay,n),at=day+'T13:00:00Z';
   if(n===16)ledger=add(ledger,'program',buildProgram(revised,'UTC',ledger[0].data as ReturnType<typeof buildProgram>),day+'T07:00:00Z',1);
   if(!isGuidedTrainingDay(n<16?c:revised,day))continue;
   const plan=planForSession(ledger,activePlan(ledger)!,day,at);
   const workout=makeWorkout(plan,day,{...plan.prescription,minutes:20},new Date(at));
   ledger=add(ledger,'workout',workout,at);
 }
 const plan=activePlan(ledger)!,today=addDays(input.startDay,19);
 const oldRest=addDays(input.startDay,14);
 assert.equal(isGuidedTrainingDay(revised,oldRest),true);
 const history=historicalTrainingCalendar(plan,today)!;
 assert.equal(history.has(oldRest),false);
 const entries=[0,5,12,19].map((offset,i)=>{
   const at=addDays(input.startDay,offset)+'T08:00:00Z';
   return {id:'t'+i,sequence:i+1,value:20+i,metricId:'pushups',method:'manual' as const,protocol:{id:'strict_pushups_v1'},cleared:false,measuredAt:at,recordedAt:at};
 });
 const forecast=personalForecast(plan,entries,23,today,'adherent-program');
 assert.ok(forecast.kind==='ready'&&forecast.intervals===3);
 assert.equal(forecast.remainingSessions,countGuidedSessions(revised,today,revised.deadline));
 const dayOfChange=addDays(input.startDay,14);
 const original=add([],'program',buildProgram(revised,'UTC'),revised.createdAt);
 const shortened=add(original,'program',buildProgram(c,'UTC',original[0].data as ReturnType<typeof buildProgram>),dayOfChange+'T20:00:00Z',1);
 assert.equal(isGuidedTrainingDay(c,dayOfChange),false);
 assert.equal(historicalTrainingCalendar(activePlan(shortened)!,dayOfChange)?.has(dayOfChange),true);
});
