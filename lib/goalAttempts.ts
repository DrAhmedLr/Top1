import {addDays,countScheduled,goalMetrics,goalValue,guidedRecoveryDates,goalProgramPeriods,manualPrescription,savedAdaptiveConfig,sessionResult,type GoalPeriod as Period,type AdaptiveConfig,type AdaptivePlan,type Dose,type GoalUnit} from './adaptiveProgram';
import {calculationValue,normalizeDerivation} from './derivations';
import {countGuidedSessions,guidedDoseForDate,isGuidedTrainingDay} from './guidedSchedule';
import {comparableDelta,comparableTest,type Observation} from './history';
import type {Metric} from './registry';
import {latestTraining,type TrainingEvent,type TrainingProgram,type Workout} from './training';

export type AttemptStatus='active'|'reached'|'missed'|'unobserved'|'superseded';
export interface AttemptAdherence{
 planned:number;due:number;completed:number;partial:number;skipped:number;unlogged:number;percent:number|null;
}
export interface GoalAttempt{
 programKind:'guided'|'manual';groupId?:string;
 planId:string;revision:number;openedAt:string;startDay:string;deadline:string;timeZone:string;
 metric:string;goalUnit:GoalUnit;baseline:number;target:number;status:AttemptStatus;
 baselineMeasuredAt:string|null;baselineRecordedAt:string|null;terminalMeasuredAt:string|null;resolvedAt:string|null;
 reachedOn:string|null;observedOn:string|null;observedValue:number|null;lateObservedOn:string|null;lateObservedValue:number|null;latestComparableOn?:string|null;latestComparableValue?:number|null;
 adherence:AttemptAdherence;
 deadlineMissCandidate:{measuredAt:string;resolvedAt:string;planned:number;due:number;completed:number}|null;
}
export type DatedTest={entry:Observation;at:number;recorded:number};
type ResultTest=DatedTest&{value:number;day:string};
type LoggedSlot={kind:'completed'|'partial'|'skipped';at:number;start:number};
const dayMs=86400000;
const iso=(ms:number)=>new Date(ms).toISOString();

export function datedTests(entries:readonly Observation[],asOf:number){
 const dated=new Map<string,Map<number,DatedTest>>();
 const seen=new Set<string>();
 const ordered=entries.filter(e=>Date.parse(e.recordedAt)<=asOf).sort((a,b)=>
  (a.sequence??0)-(b.sequence??0)||Date.parse(a.recordedAt)-Date.parse(b.recordedAt)||a.id.localeCompare(b.id));
 for(const entry of ordered){
  if(seen.has(entry.id))continue;
  seen.add(entry.id);
  if(entry.cleared){dated.delete(entry.metricId);continue;}
  const at=Date.parse(entry.measuredAt??'');
  if(!Number.isFinite(at)||at>asOf)continue;
  let metric=dated.get(entry.metricId);
  if(!metric){metric=new Map();dated.set(entry.metricId,metric);}
  // A newer save for the same test timestamp replaces even a formerly valid value.
  metric.set(at,{entry,at,recorded:Date.parse(entry.recordedAt)});
 }
 return new Map([...dated].map(([id,byDate])=>[id,[...byDate.values()].sort((a,b)=>a.at-b.at)]));
}

export function testedValue(metric:Metric,unit:GoalUnit,test:DatedTest,asOf:number){
 const {entry}=test;
 if(!comparableTest(entry,asOf))return;
 try{
  if(entry.derivation&&Number(calculationValue(normalizeDerivation(metric.id,entry.derivation)).toFixed(3))!==Number(entry.value!.toFixed(3)))return;
  return goalValue(metric,unit,entry.value??undefined,entry);
 }catch{return;}
}

function localClock(zone:string){
 const format=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
 const day=(ms:number)=>{
  const parts=format.formatToParts(ms);
  return [parts.find(p=>p.type==='year')!.value,parts.find(p=>p.type==='month')!.value,parts.find(p=>p.type==='day')!.value].join('-');
 };
 // Find the true local midnight even on a DST transition or in a fractional-hour zone.
 const after=(date:string)=>{
  let low=Date.parse(date)-dayMs,high=Date.parse(date)+3*dayMs;
  while(high-low>1){const mid=Math.floor((high+low)/2);if(day(mid)>date)high=mid;else low=mid;}
  return high;
 };
 return {day,after};
}

function validatedTests(entries:DatedTest[],metric:Metric,unit:GoalUnit,asOf:number,day:(ms:number)=>string):ResultTest[]{
 return entries.flatMap(test=>{
  const value=testedValue(metric,unit,test,asOf);
  return value===undefined?[]:[{...test,value,day:day(test.at)}];
 });
}

function originalTest(tests:ResultTest[],config:AdaptiveConfig,opened:number){
 const anchorTime=Math.min(opened,Date.parse(config.createdAt));
 const anchors=tests.filter(test=>test.at<=anchorTime&&Math.abs(test.value-config.baseline)<0.0005);
 return anchors.filter(test=>test.recorded<=opened).at(-1)??anchors.at(-1);
}

export function guidedGoalEvidence(plan:AdaptivePlan,entries:readonly Observation[],now:number):{current:number;entries:Observation[]}{
 const {config}=plan,metric=goalMetrics.find(m=>m.id===config.metric);
 const empty={current:config.baseline,entries:[]};
 if(!metric||!Number.isFinite(new Date(now).getTime()))return empty;
 const clock=localClock(plan.event.data.timeZone);
 const tests=validatedTests(datedTests(entries,now).get(metric.id)??[],metric,config.goalUnit,now,clock.day);
 const baseline=originalTest(tests,config,Date.parse(plan.event.recordedAt));
 if(!baseline)return empty;
 const created=Date.parse(config.createdAt);
 const comparable=tests.filter(test=>test.at>baseline.at&&test.at>=created&&test.day<=config.deadline&&
  !!comparableDelta([baseline.entry,test.entry],now));
 return {current:comparable.at(-1)?.value??config.baseline,entries:[baseline.entry,...comparable.map(t=>t.entry)]};
}

export function comparableGuidedCurrent(plan:AdaptivePlan,entries:readonly Observation[],now:number):number{
 return guidedGoalEvidence(plan,entries,now).current;
}

function exactWork(workout:Workout,dose:Dose,name:string){
 const exercises=workout.exercises.filter(e=>e.sets.some(s=>s.completed));
 if(exercises.length!==1||exercises[0].name!==name||exercises[0].substitutionReason)return false;
 const actual=exercises[0].sets.filter(s=>s.completed);
 return actual.length===dose.sets&&actual.every(s=>(dose.mode==='reps'?s.reps:s.durationSeconds)===dose.amount&&(s.loadKg??0)===dose.loadKg);
}

function calendar(period:Period){
 const {config,weekdays}=period;
 if(config.guidedVersion===1)return {has:(day:string)=>isGuidedTrainingDay(config,day),
  count:(first:string,last:string)=>countGuidedSessions(config,first,last)};
 return {has:(day:string)=>weekdays.includes((new Date(day).getUTCDay()+6)%7+1),
  count:(first:string,last:string)=>countScheduled(weekdays,first,last)};
}

type SessionHistory={latest:TrainingEvent[];revisions:TrainingEvent[]};
function manualDoses(period:Period,history:SessionHistory){
 type Occurrence={day:string;event:TrainingEvent};
 const dated:Occurrence[]=[],byId=new Map<string,Occurrence>(),prescribed=new Map<string,Dose>();
 const requests=new Map<string,string>();
 for(const event of history.latest){
  const w=event.data as Workout,note=sessionResult(w);
  if(w.origin&&period.revisions.has(w.origin.revision)&&note?.routineId===period.config.routineId)requests.set(event.id,note.day);
 }
 const position=(day:string,sequence:number)=>{
  let left=0,right=dated.length;
  while(left<right){const middle=(left+right)>>>1,row=dated[middle];
   if(row.day<day||row.day===day&&row.event.sequence<sequence)left=middle+1;else right=middle;}
  return left;
 };
 // Reconstruct only the two preceding sessions the manual engine used at
 // issue time. Later edits cannot rewrite an earlier workout's prescription.
 for(const event of [...history.revisions].sort((a,b)=>a.sequence-b.sequence)){
  const requested=requests.get(event.id);
  if(requested!==undefined){
   const index=position(requested,0);
   const prior=dated.slice(Math.max(0,index-2),index).reverse().map(row=>row.event);
   prescribed.set(event.id,manualPrescription(period.config,prior));
   requests.delete(event.id);
  }
  const old=byId.get(event.id);
  if(old){dated.splice(position(old.day,old.event.sequence),1);byId.delete(event.id);}
  const note=sessionResult(event.data as Workout);
  if(event.deleted||note?.routineId!==period.config.routineId)continue;
  const row={day:note.day,event};
  dated.splice(position(row.day,event.sequence),0,row);byId.set(event.id,row);
 }
 return prescribed;
}

function slots(period:Period,history:SessionHistory,day:(ms:number)=>string){
 const result=new Map<string,LoggedSlot>();
 const scheduled=calendar(period),guided=period.config.guidedVersion===1;
 const recovery=guided?guidedRecoveryDates(period.config,history.latest):new Set<string>();
 const manual=guided?undefined:manualDoses(period,history);
 const same=(a:Dose,b:Dose)=>a.mode===b.mode&&a.sets===b.sets&&a.amount===b.amount&&a.loadKg===b.loadKg;
 for(const event of history.latest){
  const w=event.data as Workout,origin=w.origin;
  if(event.deleted||!origin||origin.programId!==period.event.id||!period.revisions.has(origin.revision))continue;
  const note=sessionResult(w);
  if(!note||note.routineId!==period.config.routineId||!scheduled.has(note.day))continue;
  const end=Date.parse(w.endedAt??event.recordedAt),start=Date.parse(w.startedAt);
  const skipped=w.status==='abandoned';
  if(w.status==='in_progress'&&!w.exercises.some(ex=>ex.sets.some(s=>s.completed)))continue;
  if(!skipped&&(!Number.isFinite(end)||day(end)!==note.day))continue;
  const expected=guided?guidedDoseForDate(period.config,note.day):manual?.get(event.id);
  const issued=!!expected&&same(note.dose,expected)||recovery.has(note.day)&&same(note.dose,guidedDoseForDate(period.config,note.day,true));
  const duration=guided?note.minutes>0:note.minutes===period.config.minutes;
  const doseMet=w.status==='completed'&&issued&&duration&&Math.abs(end-start-note.minutes*60000)<1000&&exactWork(w,note.dose,period.config.exercise);
  const slot:LoggedSlot={kind:skipped?'skipped':doseMet?'completed':'partial',at:skipped?Date.parse(event.recordedAt):end,start};
  const previous=result.get(note.day);
  // Two different entities for the same occurrence cannot establish full adherence.
  result.set(note.day,previous?{kind:'partial',at:Math.min(previous.at,slot.at),start:Math.min(previous.start,slot.start)}:slot);
 }
 return result;
}

function adherenceCounter(period:Period,history:SessionHistory,startDay:string,opened:number,day:(ms:number)=>string){
 const logged=slots(period,history,day),c=period.config,scheduled=calendar(period);
 // The ledger permits one workout per program and local date. A session already
 // logged before a same-day edit belongs to the earlier attempt only.
 const openingSlotUsed=period.event.revision>1&&scheduled.has(startDay)&&history.latest.some(event=>{
  const w=event.data as Workout,record=sessionResult(w);
  const at=Date.parse(w.status==='abandoned'?event.recordedAt:w.endedAt??'');
  return !!w.origin&&w.origin.revision<period.event.revision&&record?.day===startDay&&at<opened;
 });
 return (cutoff:number,afterIssue?:number):AttemptAdherence=>{
  const cutoffDay=day(cutoff),first=afterIssue===undefined?startDay:[startDay,day(afterIssue)].sort()[1];
  const lastClosed=[c.deadline,addDays(cutoffDay,-1)].sort()[0];
  const used=openingSlotUsed&&first===startDay;
  const planned=scheduled.count(first,c.deadline)-(used&&first<=c.deadline?1:0);
  const due=scheduled.count(first,lastClosed)-(used&&first<=lastClosed?1:0);
  const out:AttemptAdherence={planned,due,completed:0,partial:0,skipped:0,unlogged:0,percent:null};
  for(const [date,slot] of logged){
   if(date<first||date>cutoffDay||date>c.deadline||date===first&&used)continue;
   if(afterIssue!==undefined&&(slot.at<=afterIssue||slot.kind!=='skipped'&&slot.start<afterIssue)){
    out.planned--;
    if(date<=lastClosed)out.due--;
    continue;
   }
   if(slot.kind==='skipped'?date===cutoffDay&&slot.at>cutoff:slot.start<opened||slot.at>cutoff)continue;
   if(date===cutoffDay)out.due++;
   out[slot.kind]++;
  }
  out.unlogged=out.due-out.completed-out.partial-out.skipped;
  if(out.due>0)out.percent=100*out.completed/out.due;
  return out;
 };
}

function resultFor(period:Period,metric:Metric,tests:ResultTest[],history:SessionHistory,asOf:number,clock:ReturnType<typeof localClock>){
 const {event,config:c,closed}=period,zone=event.data.timeZone;
 const opened=Date.parse(event.recordedAt);
 // The first imported program retains its creation instant. Later imported
 // revisions have no original edit timestamps, so pre-import retests cannot label them.
 const effective=event.source==='guest-import'&&event.revision===1?Math.min(opened,Date.parse(c.createdAt)):opened;
 const startDay=[clock.day(effective),c.scheduleStart??clock.day(Date.parse(c.createdAt))].sort()[1];
 // An edit retains the original test setup. Pre-edit tests cannot achieve a newly issued target.
 const baseline=originalTest(tests,c,opened);
 const following=baseline?tests.filter(test=>test.at>effective&&test.at>baseline.at&&test.day>=startDay&&
  (closed===null||test.at<closed)&&!!comparableDelta([baseline.entry,test.entry],asOf)):[];
 const inTime=following.filter(t=>t.day<=c.deadline),end=clock.after(c.deadline);
 const hits=inTime.filter(t=>(t.value-c.target)*metric.polarity>=0);
 const hit=hits[0],last=inTime.at(-1),late=following.find(t=>t.day>c.deadline);
 const deadlineTest=last?.day===c.deadline?last:undefined;
 const replaced=closed!==null&&closed<end;
 const status:AttemptStatus=hit?'reached':replaced?'superseded':asOf<end?'active':deadlineTest?'missed':'unobserved';
 const terminal=status==='reached'?hit:status==='missed'?deadlineTest:undefined;
 const observed=hit??last,latestComparable=following.at(-1);
 const cutoff=Math.min(asOf,closed??Infinity,hit?.at??Infinity,end);
 const work=adherenceCounter(period,history,startDay,effective,clock.day)(cutoff);
 const known=(test:ResultTest)=>Math.max(opened,test.at,test.recorded,baseline!.recorded);
 const missKnown=deadlineTest?Math.max(end,known(deadlineTest)):null;
 const resolved=hit?hits.reduce((at,test)=>Math.min(at,known(test)),Infinity):status==='missed'?missKnown:null;
 return {
  programKind:c.guidedVersion===1?'guided':'manual',...(c.groupId?{groupId:c.groupId}:{}),planId:event.id,revision:event.revision,openedAt:iso(opened),metric:c.metric,goalUnit:c.goalUnit,baseline:c.baseline,target:c.target,
  startDay,deadline:c.deadline,timeZone:zone,status,baselineMeasuredAt:baseline?iso(baseline.at):null,baselineRecordedAt:baseline?iso(baseline.recorded):null,
  terminalMeasuredAt:terminal?iso(terminal.at):null,resolvedAt:resolved===null?null:iso(resolved),
  reachedOn:hit?.day??null,observedOn:observed?.day??null,observedValue:observed?.value??null,
  lateObservedOn:late?.day??null,lateObservedValue:late?.value??null,latestComparableOn:latestComparable?.day??null,latestComparableValue:latestComparable?.value??null,adherence:work,
  deadlineMissCandidate:c.guidedVersion===1&&status==='active'&&deadlineTest&&missKnown!==null?{measuredAt:iso(deadlineTest.at),resolvedAt:iso(missKnown),completed:work.completed,due:work.due,planned:work.planned}:null,
 } satisfies GoalAttempt;
}

function indexLedger(events:readonly TrainingEvent[],asOf:number){
 if(!Number.isFinite(new Date(asOf).getTime()))throw Error('A valid observation time is required.');
 const visible=events.filter(e=>Date.parse(e.recordedAt)<=asOf).sort((a,b)=>Date.parse(a.recordedAt)-Date.parse(b.recordedAt)||a.sequence-b.sequence);
 const periods=goalProgramPeriods(visible);
 const byProgram=new Map<string,SessionHistory>();
 const empty:SessionHistory={latest:[],revisions:[]};
 for(const event of visible){
  if(event.kind!=='workout')continue;
  const id=(event.data as Workout).origin?.programId;
  if(!id)continue;
  const rows:SessionHistory=byProgram.get(id)??{latest:[],revisions:[]};
  rows.revisions.push(event);
  byProgram.set(id,rows);
 }
 for(const rows of byProgram.values())rows.latest=latestTraining(rows.revisions).filter(e=>!e.deleted);
 return {periods,byProgram,empty};
}

/** Replay only records known by the supplied instant. Identity is (planId, opening revision). */
export function replayGoalAttempts(events:readonly TrainingEvent[],observations:readonly Observation[],asOf:number):GoalAttempt[]{
 const {periods,byProgram,empty}=indexLedger(events,asOf);
 const history=datedTests(observations,asOf);
 const clocks=new Map<string,ReturnType<typeof localClock>>();
 const tested=new Map<string,ResultTest[]>();
 return periods.reverse().map(period=>{
  const {metric:id,goalUnit}=period.config,zone=period.event.data.timeZone;
  const clock=clocks.get(zone)??localClock(zone);
  clocks.set(zone,clock);
  const metric=goalMetrics.find(m=>m.id===id)!;
  const key=[id,goalUnit,zone].join('|');
  let rows=tested.get(key);
  if(!rows){
   rows=validatedTests(history.get(id)??[],metric,goalUnit,asOf,clock.day);
   tested.set(key,rows);
  }
  return resultFor(period,metric,rows,byProgram.get(period.event.id)??empty,asOf,clock);
 });
}

export function goalAttemptMetrics(events:readonly TrainingEvent[],guidedOnly=false):string[]{
 const metrics=new Set<string>();
 for(const event of events){
  if(event.kind!=='program')continue;
  const config=savedAdaptiveConfig(event.data as TrainingProgram);
  if(config&&(!guidedOnly||config.guidedVersion===1))metrics.add(config.metric);
 }
 return [...metrics].sort();
}
export const guidedAttemptMetrics=(events:readonly TrainingEvent[])=>goalAttemptMetrics(events,true);

export type GoalReceiptRef={planId:string;revision:number;issuedAt:string};
export function postIssueAdherence(events:readonly TrainingEvent[],attempts:readonly GoalAttempt[],receipts:readonly GoalReceiptRef[],asOf:number){
 const output=new Map<string,{completed:number;due:number}>();
 if(!receipts.length)return output;
 const refs=new Map<string,GoalReceiptRef[]>();
 for(const receipt of receipts){
  const key=receipt.planId+'/'+receipt.revision;
  const group=refs.get(key)??[];group.push(receipt);refs.set(key,group);
 }
 const {periods,byProgram,empty}=indexLedger(events,asOf);
 const targets=new Map(attempts.map(a=>[a.planId+'/'+a.revision,a]));
 for(const period of periods){
  const key=period.event.id+'/'+period.event.revision,attempt=targets.get(key),group=refs.get(key);
  if(!attempt||attempt.programKind!=='guided'||!group)continue;
  const measured=attempt.terminalMeasuredAt??attempt.deadlineMissCandidate?.measuredAt;
  if(!measured||!attempt.baselineRecordedAt)continue;
  const local=localClock(attempt.timeZone),opened=Date.parse(period.event.recordedAt);
  const outcomeTime=Date.parse(measured);
  const cutoff=attempt.status==='reached'?outcomeTime:Math.min(asOf,local.after(attempt.deadline));
  const count=adherenceCounter(period,byProgram.get(attempt.planId)??empty,attempt.startDay,opened,local.day);
  for(const receipt of group){
   // Dates saved by the app have millisecond precision. Keep PostgreSQL's
   // fractional issuance precision when a set starts in that same millisecond.
   const subMs=/\.\d{3}(\d+)/.exec(receipt.issuedAt)?.[1];
   const issue=Date.parse(receipt.issuedAt)+(subMs?Number('0.'+subMs):0);
   if(!Number.isFinite(issue)||issue<opened||issue>=outcomeTime||issue<Date.parse(attempt.baselineRecordedAt)||issue>asOf)continue;
   const {due,completed}=count(cutoff,issue);
   output.set(key+'/'+receipt.issuedAt,{completed,due});
  }
 }
 return output;
}
