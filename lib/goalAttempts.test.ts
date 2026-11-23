import test from 'node:test';
import assert from 'node:assert/strict';
import {activePlan,currentAdaptivePlans,buildProgram,makeWorkout,planForSession,type AdaptiveConfig} from './adaptiveProgram';
import {createGuidedConfig,previewDatedProgram} from './datedProgram';
import {comparableGuidedCurrent,goalAttemptMetrics,guidedAttemptMetrics,guidedGoalEvidence,postIssueAdherence,replayGoalAttempts} from './goalAttempts';
import type {Observation} from './history';
import {appendTraining,type TrainingEvent,type TrainingProgram,type Workout} from './training';

const first='2026-10-01',opening=first+'T10:00:00Z',deadline='2026-10-29';
const instant=(s:string)=>Date.parse(s);
const config=(metric='pushups',baseline=10,target=16,zone='UTC')=>createGuidedConfig({
 metric,baseline,target,startDay:first,deadline,timeZone:zone,now:new Date(opening)});
function change(events:TrainingEvent[],data:TrainingProgram|Workout,at:string,prior?:TrainingEvent,deleted=false){
 return appendTraining(events,{version:1,id:prior?.id??crypto.randomUUID(),requestId:crypto.randomUUID(),kind:'timeZone' in data&&'sessions' in data?'program':'workout',
  expectedRevision:prior?.revision??0,epoch:0,reason:prior?'Updated fixture':'',data,deleted},0,instant(at));
}
function program(c=config(),zone='UTC'){return change([],buildProgram(c,zone),opening);}
function entry(value:number,at:string,seq:number,extra:Partial<Observation>={}):Observation{
 const stamp=new Date(at).toISOString();
 return {id:'reading-'+seq,sequence:seq,metricId:'pushups',value,measuredAt:stamp,recordedAt:stamp,method:'manual',
  protocol:{id:'strict_pushups_v1'},cleared:false,...extra};
}
const baseline=entry(10,first+'T08:00:00Z',1);
const read=(events:TrainingEvent[],entries:Observation[],asOf:string)=>replayGoalAttempts(events,entries,instant(asOf));
function completed(events:TrainingEvent[],date:string,mod?:(w:Workout)=>Workout,at=date+'T13:00:00Z'){
 const p=activePlan(events)!;
 const row=previewDatedProgram(p.config,'UTC').weeks.flatMap(w=>w.sessions).find(s=>s.kind==='training'&&s.date===date)!;
 if(row.kind!=='training')throw Error('Test requires a training day');
 const now=new Date(at),w=makeWorkout(p,date,{...row,minutes:row.estimatedMinutes},now);
 return change(events,mod?mod(w):w,at);
}

test('calendar progress separates future, due, skipped, partial and fully prescribed sessions',()=>{
 const c=config(),initial=program(c),[dayOne]=read(initial,[baseline],opening);
 const calendar=previewDatedProgram(c,'UTC').weeks.flatMap(w=>w.sessions).filter(s=>s.kind==='training');
 assert.equal(dayOne.adherence.planned,calendar.length);
 assert.deepEqual({...dayOne.adherence,planned:0},{planned:0,due:0,completed:0,partial:0,skipped:0,unlogged:0,percent:null});
 let data=completed(initial,calendar[0].date);
 data=completed(data,calendar[1].date,w=>({...w,exercises:w.exercises.map(ex=>({...ex,sets:ex.sets.slice(0,1)}))}));
 const skipped=makeWorkout(activePlan(data)!,calendar[2].date,null,new Date(calendar[2].date+'T14:00Z'));
 data=change(data,skipped,calendar[2].date+'T14:00Z');
 const [past]=read(data,[baseline],deadline+'T12:00Z');
 assert.deepEqual(past.adherence,{planned:calendar.length,due:calendar.length,completed:1,partial:1,skipped:1,
  unlogged:calendar.length-3,percent:100/calendar.length});
 const [early]=read(data,[baseline,entry(16,calendar[1].date+'T09:00Z',2)],deadline+'T12:00Z');
 assert.equal(early.status,'reached');assert.equal(early.reachedOn,calendar[1].date);
 assert.equal(early.adherence.due,1);assert.equal(early.adherence.percent,100);
 assert.equal(early.adherence.planned,calendar.length);
});

test('only comparable dated tests from the selected baseline can resolve an attempt',()=>{
 const data=program(),late=entry(22,'2026-11-01T07:00Z',5);
 const observations=[baseline,entry(18,'2026-10-05T10:00Z',2,{method:'device'}),
  entry(17,'2026-10-06T09:00Z',3,{measuredAt:undefined}),entry(14,'2026-10-28T07:00Z',4),late];
 const [missing]=read(data,observations,'2026-11-02T12:00Z');
 assert.equal(missing.status,'unobserved');assert.equal(missing.terminalMeasuredAt,null);
 assert.equal(missing.observedValue,14);assert.equal(missing.lateObservedValue,22);assert.equal(missing.lateObservedOn,'2026-11-01');
 assert.equal(read(data,[late], '2026-11-02T12:00Z')[0].lateObservedOn,null);
 const savedLater=entry(16,'2026-10-15T08:00Z',6,{recordedAt:'2026-11-03T11:00:00Z'});
 assert.equal(read(data,[...observations,savedLater],'2026-11-02T18:00Z')[0].status,'unobserved');
 const [resolved]=read(data,[...observations,savedLater],'2026-11-03T12:00Z');
 assert.equal(resolved.status,'reached');assert.equal(resolved.reachedOn,'2026-10-15');
 assert.equal(resolved.resolvedAt,'2026-11-03T11:00:00.000Z');
 const corrected=entry(12,savedLater.measuredAt!,7,{recordedAt:'2026-11-03T12:30:00Z'});
 assert.equal(read(data,[...observations,savedLater,corrected],'2026-11-03T13:00Z')[0].status,'unobserved');
 const clear=entry(0,'2026-11-03T12:30Z',8,{cleared:true,value:null});
 assert.equal(read(data,[...observations,savedLater,clear],'2026-11-03T13:00Z')[0].baselineMeasuredAt,null);
});

test('a below-target deadline retest matures at the following local midnight across DST',()=>{
 const zone='America/New_York',c={...config('pushups',10,16,zone),deadline:'2026-11-01'};
 const data=program(c,zone),measured=entry(14,'2026-11-02T03:00Z',2);
 const [pending]=read(data,[baseline,measured],'2026-11-02T04:59:59Z');
 assert.equal(pending.status,'active');
 assert.deepEqual(pending.deadlineMissCandidate,{measuredAt:'2026-11-02T03:00:00.000Z',resolvedAt:'2026-11-02T05:00:00.000Z',
  completed:0,due:pending.adherence.planned,planned:pending.adherence.planned});
 const [closed]=read(data,[baseline,measured],'2026-11-02T05:00:00Z');
 assert.equal(closed.status,'missed');assert.equal(closed.resolvedAt,'2026-11-02T05:00:00.000Z');assert.equal(closed.deadlineMissCandidate,null);
 const [hit]=read(data,[baseline,measured,entry(17,'2026-11-02T04:59:58Z',3)],'2026-11-02T05:00Z');
 assert.equal(hit.status,'reached');assert.equal(hit.reachedOn,'2026-11-01');
 const later=entry(22,'2026-11-02T05:00:01Z',4);
 assert.equal(read(data,[baseline,later],'2026-11-03T00:00Z')[0].status,'unobserved');
});

test('a later lower comparable result updates the live value and retains the first on-time achievement',()=>{
 const data=program(),hit=entry(17,'2026-10-11T09:00Z',2),lower=entry(13,'2026-11-04T10:00Z',3);
 const [atHit]=read(data,[baseline,hit],'2026-10-12T08:00Z');
 const [after]=read(data,[baseline,hit,lower],'2026-11-05T08:00Z');
 assert.equal(after.status,'reached');
 assert.equal(after.reachedOn,'2026-10-11');assert.equal(after.observedValue,17);
 assert.equal(after.latestComparableValue,13);assert.equal(after.latestComparableOn,'2026-11-04');
 assert.equal(after.terminalMeasuredAt,atHit.terminalMeasuredAt);
 assert.deepEqual(after.adherence,atHit.adherence);
});

test('edits preserve original outcomes, open new goal revisions and avoid retroactive credit',()=>{
 const c=config(),one=program(c),p=one[0];
 const scenarioOnly=change(one,buildProgram({...c,scenario:{dose:'other',gain:1,attendance:50,response:50}},'UTC',p.data as TrainingProgram),
  '2026-10-04T12:00Z',p);
 const edited=change(scenarioOnly,buildProgram({...c,target:20,deadline:'2026-11-02'},'UTC',p.data as TrainingProgram),
  '2026-10-12T12:00Z',scenarioOnly.at(-1));
 const data=change(edited,buildProgram(config('run_5k',30,25),'UTC'),'2026-10-20T12:00Z');
 const tests=[baseline,entry(21,'2026-10-11T08:00Z',2)];
 const [run,revised,original]=read(data,tests,'2026-10-25T10:00Z');
 assert.equal(run.metric,'run_5k');assert.equal(run.status,'active');
 assert.equal(revised.revision,3);assert.equal(revised.status,'superseded');assert.equal(revised.observedValue,null);
 assert.equal(original.status,'reached');assert.equal(original.revision,1);assert.equal(original.observedValue,21);
 assert.equal(read(data,[baseline],'2026-10-14T10:00Z')[1].status,'superseded');
 assert.deepEqual(guidedAttemptMetrics(data),['pushups','run_5k']);
 assert.deepEqual(read([...data].reverse(),[...tests].reverse(),'2026-10-25T10:00Z'),[run,revised,original]);
});

test('workout corrections, duplicate dates and changed exercise prescriptions do not inflate adherence',()=>{
 const one=program(),day=first;
 const completedOnce=completed(one,day);const event=completedOnce.at(-1)!;
 const original=event.data as Workout;
 const altered={...original,exercises:original.exercises.map(x=>({...x,substitutionReason:'Alternative',name:'Alternative exercise'}))};
 const corrected=change(completedOnce,altered,'2026-10-03T15:00Z',event);
 assert.equal(read(corrected,[baseline],'2026-10-02T08:00Z')[0].adherence.completed,1);
 assert.equal(read(corrected,[baseline],'2026-10-04T08:00Z')[0].adherence.partial,1);
 const removed=change(corrected,altered,'2026-10-04T15:00Z',corrected.at(-1),true);
 assert.equal(read(removed,[baseline],'2026-10-05T08:00Z')[0].adherence.unlogged,2);
 const duplicate=change(completedOnce,original,'2026-10-02T15:00Z');
 assert.equal(read(duplicate,[baseline],'2026-10-03T08:00Z')[0].adherence.partial,1);
});

test('a same-day edit cannot require the finished workout twice, and archival ends the attempt',()=>{
 const c=config(),original=program(c),worked=completed(original,first);
 const revision=buildProgram({...c,target:19},'UTC',original[0].data as TrainingProgram);
 const edited=change(worked,revision,first+'T15:00Z',original[0]);
 const archived=change(edited,{...revision,archived:true},'2026-10-08T12:00Z',edited.at(-1));
 const [newer,older]=read(archived,[baseline,entry(20,'2026-10-09T08:00Z',2)],'2026-10-10T08:00Z');
 assert.equal(newer.status,'superseded');assert.equal(older.status,'superseded');
 assert.equal(older.adherence.completed,1);assert.equal(newer.adherence.completed,0);
 assert.equal(newer.adherence.planned,older.adherence.planned-1);
 const onNextMorning=read(edited,[baseline],'2026-10-02T10:00Z')[0];
 assert.equal(onNextMorning.adherence.due,0);
});

test('an imported original can describe past success but cannot precede its server issuance for calibration',()=>{
 const imported=program().map(e=>({...e,source:'guest-import' as const,recordedAt:'2026-11-04T12:00:00Z'}));
 const reading=entry(17,'2026-10-11T08:00Z',2,{recordedAt:'2026-11-04T12:00:00Z'});
 assert.equal(read(imported,[baseline,reading],'2026-11-03T16:00Z').length,0);
 const [out]=read(imported,[baseline,reading],'2026-11-04T12:01Z');
 assert.equal(out.status,'reached');assert.equal(out.terminalMeasuredAt,'2026-10-11T08:00:00.000Z');
 assert.equal(out.openedAt,out.resolvedAt);assert.equal(out.startDay,first);
});

test('lower-is-better targets and absolute lift targets retain their measured units and protocol',()=>{
 const run=config('run_5k',30,25);
 const runResults=[entry(30,'2026-10-01T08:00Z',1,{metricId:'run_5k',protocol:{id:'run5k_outdoor_manual_v1'}}),
  entry(24,'2026-10-08T08:00Z',2,{metricId:'run_5k',protocol:{id:'run5k_outdoor_manual_v1'}})];
 assert.equal(read(program(run),runResults,'2026-10-15T12:00Z')[0].status,'reached');
 const c:AdaptiveConfig=createGuidedConfig({metric:'bench_1rm',goalUnit:'kg',baseline:80,target:90,bodyWeightKg:80,
  startDay:first,deadline,timeZone:'UTC',now:new Date(opening)});
 const weight=(kg:number,ratio:number,seq:number,day:string)=>entry(ratio,day+'T08:00Z',seq,{metricId:'bench_1rm',method:'direct_1rm',
  protocol:{id:'bench_paused_v1'},derivation:{formula:'epley_ratio_v1',bodyWeightKg:kg,inputs:[kg*ratio,1]}});
 const results=[weight(80,1,1,first),weight(75,1.2,2,'2026-10-10')];
 const [lift]=read(program(c),results,'2026-10-15T08:00Z');
 assert.equal(lift.status,'reached');assert.equal(lift.observedValue,90);
 assert.equal(read(program(c),[results[0],{...results[1],derivation:undefined}],'2026-10-15T08:00Z')[0].status,'active');
});

test('legacy adaptive goals follow saved weekdays, minutes and adaptive progression; ordinary routines stay outside goal tracking',()=>{
 const legacy:AdaptiveConfig={metric:'pushups',goalUnit:'metric',baseline:10,target:16,deadline,createdAt:opening,days:2,minutes:20,
  exercise:'Push-up',routineId:'legacy',dose:{sets:3,amount:4,mode:'reps',loadKg:0}};
 const data=buildProgram(legacy,'UTC');data.sessions[0].weekdays=[1,3];
 let ledger=change([],data,opening);
 const occurrences=[['2026-10-05',20],['2026-10-07',20],['2026-10-12',20],['2026-10-14',18]] as const;
 const doses:number[]=[];
 for(const [day,minutes] of occurrences){
  const end=day+'T12:00:00.000Z',p=planForSession(ledger,activePlan(ledger)!,day,end);
  doses.push(p.prescription.amount);
  ledger=change(ledger,makeWorkout(p,day,{...p.prescription,minutes},new Date(end)),end);
 }
 const unrelated={...data,notes:'Ordinary strength routine'};
 ledger=change(ledger,unrelated,'2026-10-15T09:00Z');
 const attempts=read(ledger,[baseline,entry(16,'2026-10-16T08:00Z',2)],'2026-10-30T12:00Z');
 assert.equal(attempts.length,1);
 const [attempt]=attempts;
 assert.equal(attempt.programKind,'manual');assert.equal(attempt.status,'reached');
 assert.deepEqual(doses.slice(0,3),[4,4,5]);
 assert.deepEqual(attempt.adherence,{planned:8,due:4,completed:3,partial:1,skipped:0,unlogged:0,percent:75});
 const original=ledger[1],firstWork=original.data as Workout;
 const correction=change(ledger,{...firstWork,exercises:firstWork.exercises.map(ex=>({...ex,sets:ex.sets.slice(0,1)}))},
  '2026-10-17T08:00Z',original);
 const [reviewed]=read(correction,[baseline,entry(16,'2026-10-16T08:00Z',2)],'2026-10-30T12:00Z');
 assert.equal(reviewed.adherence.completed,2);assert.equal(reviewed.adherence.partial,2);
 assert.deepEqual(guidedAttemptMetrics(ledger),[]);assert.deepEqual(goalAttemptMetrics(ledger),['pushups']);
 assert.equal(replayGoalAttempts([ledger.at(-1)!],[baseline],instant('2026-10-30T12:00Z')).length,0);
});

test('current guided measurement matches the original baseline setup through the deadline, including before a target edit',()=>{
 const c=config(),initial=program(c);
 const edited=change(initial,buildProgram({...c,target:20},'UTC',initial[0].data as TrainingProgram),'2026-10-12T12:00Z',initial[0]);
 const p=activePlan(edited)!,asOf=instant('2026-11-05T15:00Z');
 const strict=entry(14,'2026-10-08T13:00Z',2);
 const wrong=entry(80,'2026-10-14T15:00Z',3,{method:'device'});
 const late=entry(25,'2026-10-30T12:00Z',4);
 assert.equal(comparableGuidedCurrent(p,[baseline,strict,wrong,late],asOf),14);
 assert.deepEqual(guidedGoalEvidence(p,[baseline,strict,wrong,late],asOf),{current:14,entries:[baseline,strict]});
 assert.equal(comparableGuidedCurrent(p,[strict,wrong,late],asOf),10);
 assert.equal(comparableGuidedCurrent(p,[baseline,strict,wrong,late,entry(0,'2026-11-02T15:00Z',5,{value:null,cleared:true})],asOf),10);
});

test('each forecast evaluates only the outstanding workouts after its exact issuance timestamp',()=>{
 const c=config(),data=program(c),dates=previewDatedProgram(c,'UTC').weeks.flatMap(w=>w.sessions).filter(s=>s.kind==='training').map(s=>s.date);
 let ledger=data;
 for(const date of dates.slice(0,3))ledger=completed(ledger,date);
 // The middle workout was uploaded after the second forecast. Its actual
 // interval crossed issue time, so it was already under way when issued.
 const second=ledger[2].data as Workout;
 const delayed=ledger.map((e,i)=>i===2?{...e,recordedAt:'2026-10-10T14:00:00Z'}:e);
 const endOfReview='2026-10-12T12:00Z',asOf=instant(endOfReview);
 const attempts=read(delayed,[baseline,entry(17,'2026-10-09T16:00Z',2)],endOfReview);
 const at=[first+'T10:01:00.125001Z',second.startedAt.replace(/Z$/, '001Z'),'2026-10-08T14:00:00.000003Z','2026-10-10T05:00:00Z'];
 const receipts=at.map(issuedAt=>({planId:data[0].id,revision:1,issuedAt}));
 const results=postIssueAdherence(delayed,attempts,receipts,asOf),key=(index:number)=>data[0].id+'/1/'+at[index];
 assert.deepEqual(results.get(key(0)),{completed:3,due:3});
 assert.deepEqual(results.get(key(1)),{completed:1,due:1});
 assert.deepEqual(results.get(key(2)),{completed:0,due:0});
 assert.equal(results.has(key(3)),false);
 const missing=delayed.slice(0,-1);
 assert.deepEqual(postIssueAdherence(missing,read(missing,[baseline,entry(17,'2026-10-09T16:00Z',2)],endOfReview),receipts,asOf).get(key(1)),{completed:0,due:1});
});

test('distinct goals in one group keep separate attempts, calendar records and deadlines',()=>{
 const groupId=crypto.randomUUID();
 const push={...config(),groupId};
 const pull={...config('pullups',5,8),groupId};
 let events=program(push);
 const pushId=events[0].id;
 events=change(events,buildProgram(pull,'UTC'),'2026-10-01T10:01:00Z');
 const pullId=events.at(-1)!.id;
 assert.deepEqual(currentAdaptivePlans(events).map(p=>p.event.id),[pushId,pullId]);
 const tests=[baseline,entry(5,first+'T08:01:00Z',2,{metricId:'pullups',protocol:{id:'strict_pullups_v1'}}),
   entry(16,'2026-10-06T08:00:00Z',3)];
 const outcomes=read(events,tests,'2026-10-08T08:00:00Z');
 assert.equal(outcomes.find(x=>x.planId===pushId)?.status,'reached');
 assert.equal(outcomes.find(x=>x.planId===pullId)?.status,'active');
 assert.ok(outcomes.every(x=>x.groupId===groupId));
 const revised=change(events,buildProgram({...pull,target:9},'UTC',events[1].data as TrainingProgram),'2026-10-09T10:00:00Z',events[1]);
 assert.deepEqual(currentAdaptivePlans(revised).map(p=>p.event.id),[pushId,pullId]);
 const changed=read(revised,tests,'2026-10-10T08:00:00Z');
 assert.equal(changed.find(x=>x.planId===pullId&&x.revision===1)?.status,'superseded');
 assert.equal(changed.find(x=>x.planId===pullId&&x.revision===2)?.status,'active');
 assert.equal(changed.find(x=>x.planId===pushId)?.status,'reached');
 const archived=change(revised,{...revised.at(-1)!.data,archived:true} as TrainingProgram,'2026-10-11T08:00:00Z',revised.at(-1));
 assert.deepEqual(currentAdaptivePlans(archived).map(p=>p.event.id),[pushId]);
 const standalone=change(events,buildProgram(config('dips',3,10),'UTC'),'2026-10-12T08:00:00Z');
 assert.equal(currentAdaptivePlans(standalone).length,1);
 assert.equal(read(standalone,tests,'2026-10-13T08:00:00Z').find(x=>x.planId===pullId)?.status,'superseded');
 const replacement=change(events,buildProgram({...push,target:22},'UTC'),'2026-10-03T10:00:00Z');
 assert.deepEqual(new Set(currentAdaptivePlans(replacement).map(p=>p.event.id)),new Set([pullId,replacement.at(-1)!.id]));
});

test('a substituted workout retains the prescription and cannot count as a matched session or a sibling retest',()=>{
 const groupId=crypto.randomUUID();
 const push={...config(),groupId},pull={...config('pullups',5,8),groupId};
 let events=change(program(push),buildProgram(pull,'UTC'),'2026-10-01T10:01:00Z');
 const [planned,sibling]=currentAdaptivePlans(events);
 const session=previewDatedProgram(push,'UTC').weeks.flatMap(w=>w.sessions).find(s=>s.kind==='training')!;
 if(session.kind!=='training')throw Error('Expected training session');
 const at=session.date+'T15:00:00Z',dose={...session,minutes:session.estimatedMinutes};
 for(const substitution of [{name:'',reason:'Equipment'},{name:push.exercise,reason:'Same'},{name:'Incline variation',reason:''}]){
   assert.throws(()=>makeWorkout(planned,session.date,{...dose,substitution},new Date(at)),/substitution/);
 }
 const w=makeWorkout(planned,session.date,{...dose,substitution:{name:' Incline variation ',reason:' Different equipment '}},new Date(at));
 assert.equal(w.snapshot.exercises[0].name,push.exercise);
 assert.equal(w.exercises[0].name,'Incline variation');
 assert.equal(w.exercises[0].substitutionReason,'Different equipment');
 assert.equal(w.exercises[0].plannedExerciseId,w.snapshot.exercises[0].id);
 events=change(events,w,at);
 const result=read(events,[baseline,entry(5,first+'T08:01:00Z',2,{metricId:'pullups',protocol:{id:'strict_pullups_v1'}})],at);
 const own=result.find(a=>a.planId===planned.event.id)!,other=result.find(a=>a.planId===sibling.event.id)!;
 assert.deepEqual([own.status,own.adherence.completed,own.adherence.partial],['active',0,1]);
 assert.deepEqual([other.status,other.terminalMeasuredAt,other.adherence.completed,other.adherence.partial],['active',null,0,0]);
});

test('adding a sibling preserves an unchanged single-goal attempt, and stopping all goals never revives a previous one',()=>{
 const standalone=config(),old=program(standalone),id=old[0].id,groupId=crypto.randomUUID();
 const second=config('pullups',5,9);
 const promoted=change(old,buildProgram({...standalone,groupId},'UTC',old[0].data as TrainingProgram),'2026-10-02T09:00:00Z',old[0]);
 const joined=change(promoted,buildProgram({...second,groupId},'UTC'),'2026-10-02T09:00:00Z');
 const replay=read(joined,[baseline],'2026-10-03T08:00:00Z');
 assert.equal(replay.filter(a=>a.planId===id).length,1);assert.equal(replay.find(a=>a.planId===id)?.revision,1);
 assert.equal(replay.find(a=>a.planId===id)?.status,'active');assert.equal(currentAdaptivePlans(joined).length,2);
 let stop=joined;
 for(const event of [promoted.at(-1)!,joined.at(-1)!])stop=change(stop,{...event.data,archived:true} as TrainingProgram,'2026-10-04T08:00:00Z',event);
 assert.equal(activePlan(stop),null);
 const newer=change(old,buildProgram(second,'UTC'),'2026-10-02T10:00:00Z');
 const archived=change(newer,{...newer.at(-1)!.data,archived:true} as TrainingProgram,'2026-10-04T08:00:00Z',newer.at(-1));
 assert.equal(activePlan(archived),null);
});
