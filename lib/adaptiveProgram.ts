import {countGuidedSessions,daysBetween,guidedDoseForDate,isGuidedTrainingDay,maximumGuidedDays,nextGuidedTrainingDay,programFamilies,type GoalRotation,type ProgramLabel} from './guidedSchedule';
import {activeMetrics,type Metric} from './registry';
import {valid} from './engine';
import {goalDate} from './personalGoal';
import {isLift} from './focusedEntry';
import {calculationValue} from './derivations';
import {countMetrics} from './measurementRules';
import {comparableDelta,type Observation} from './history';
import {latestTraining,trainingId,trainingProgram,workout,type TrainingEvent,type TrainingProgram,type Workout} from './training';
import type {MeasurementDetails} from './measurementMetadata';

export const goalMetrics=activeMetrics.filter(metric=>metric.pillar==='strength');
export type GoalUnit='metric'|'kg';
export type Dose={sets:number;amount:number;mode:'reps'|'seconds';loadKg:number};
export type Prescription=Dose&{reason:'initial'|'missed'|'actual'|'progression'};
export type Scenario={dose:string;gain:number;response:number;attendance:number};
export type AdaptiveConfig={
  metric:string;goalUnit:GoalUnit;baseline:number;target:number;deadline:string;createdAt:string;
  days:number;minutes:number;exercise:string;dose:Dose;routineId:string;scenario?:Scenario;bodyWeightKg?:number;
  groupId?:string;rotation?:GoalRotation;guidedVersion?:1;scheduleStart?:string;exerciseLabels?:ProgramLabel;reviewEquipment?:boolean;reviewLimitations?:boolean;
};
export type SessionResult={day:string;routineId:string;dose:Dose;minutes:number;checkInReason?:string;correctedFromSkip?:boolean};
const programTag='TOP1:training-goal:v1\n',sessionTag='TOP1:training-session:v1\n';
const dayMs=86400000;
const bounded=(value:number,min:number,max:number)=>Number.isFinite(value)&&value>=min&&value<=max;
const whole=(value:number,min:number,max:number)=>Number.isInteger(value)&&bounded(value,min,max);
export function dayInZone(date:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part=(key:string)=>parts.find(p=>p.type===key)?.value;
  return [part('year'),part('month'),part('day')].join('-');
}
export function addDays(day:string,n:number){return new Date(Date.parse(day)+n*dayMs).toISOString().slice(0,10);}
export function goalValue(metric:Metric,unit:GoalUnit,value?:number,detail?:MeasurementDetails){
  if(!valid(metric,value))return undefined;
  if(unit==='metric')return value;
  const weight=detail?.derivation?.bodyWeightKg??detail?.protocol?.bodyWeightKg;
  if(!isLift(metric.id)||!weight)return undefined;
  const ratio=detail?.derivation?calculationValue(detail.derivation):value;
  return Number((ratio*weight).toFixed(3));
}
function validDose(d:Dose){return !!d&&whole(d.sets,1,16)&&(d.mode==='reps'?whole(d.amount,1,1000):d.mode==='seconds'&&whole(d.amount,1,14400))&&bounded(d.loadKg,0,2000);}
export function savedAdaptiveConfig(program:TrainingProgram):AdaptiveConfig|undefined{
  if(!program.notes.startsWith(programTag))return;
  try{return checkConfig(JSON.parse(program.notes.slice(programTag.length)));}catch{return;}
}
export function checkConfig(c:AdaptiveConfig){
  const groupId=c.groupId===undefined ? undefined : trainingId(c.groupId);
  const metric=goalMetrics.find(m=>m.id===c.metric);
  if(!metric||!['kg','metric'].includes(c.goalUnit)||c.goalUnit==='kg'&&!isLift(metric.id))throw Error('goal');
  const allowed=(v:number)=>c.goalUnit==='kg'?bounded(v,0,2000):valid(metric,v);
  if(!allowed(c.baseline)||!allowed(c.target)||(c.target-c.baseline)*metric.polarity<=0)throw Error('target');
  if(!goalDate(c.deadline)||!Number.isFinite(Date.parse(c.createdAt)))throw Error('date');
  if(!whole(c.days,1,7)||!whole(c.minutes,1,240)||!c.exercise.trim()||c.exercise.length>120||!c.routineId||!validDose(c.dose))throw Error('dose');
  if(c.dose.mode==='seconds'&&c.dose.amount*c.dose.sets>c.minutes*60)throw Error('duration');
  if(c.guidedVersion!==undefined){
    if(c.guidedVersion!==1||!Object.hasOwn(programFamilies,c.metric)||!c.scheduleStart||!goalDate(c.scheduleStart)||
      c.scheduleStart>=c.deadline||daysBetween(c.scheduleStart,c.deadline)>maximumGuidedDays)throw Error('date');
    if(c.days>3||c.minutes<10||!Array.isArray(c.exerciseLabels)||c.exerciseLabels.length!==3||
       !c.exerciseLabels.every(label=>typeof label==='string'&&label.trim()&&label.length<=120))throw Error('dose');
  }
  if(c.rotation!==undefined){
    const r=c.rotation;
    if(c.guidedVersion!==1||!r||(r.anchor!==undefined&&(!goalDate(r.anchor)||r.anchor<c.scheduleStart!||r.anchor>=c.deadline))||!whole(r.weeks,1,52)||!Array.isArray(r.slots)||!r.slots.length||
      r.slots.length>3*r.weeks||r.slots.some((d,i)=>!whole(d,0,7*r.weeks-1)||(i>0&&d<=r.slots[i-1])))throw Error('schedule');
    for(const dates of [r.checks,r.holds,r.busyTests])if(dates!==undefined&&(!Array.isArray(dates)||dates.length>365||
      dates.some((d,i)=>!whole(d,0,maximumGuidedDays)||(i>0&&d<=dates[i-1]))))throw Error('schedule');
  }
  if(c.scenario&&(!c.scenario.dose||!bounded(c.scenario.gain,0.000001,10000)||countMetrics.has(c.metric)&&!Number.isInteger(c.scenario.gain)||!bounded(c.scenario.response,0,100)||!bounded(c.scenario.attendance,0,100)))throw Error('scenario');
  return groupId && groupId!==c.groupId ? {...c,groupId} : c;
}
export function scheduledWeekdays(days:number,startDay:string){
  const start=new Date(startDay).getUTCDay();
  return Array.from({length:days},(_,i)=>((start+Math.floor(i*7/days)+6)%7)+1).sort((a,b)=>a-b);
}
export function buildProgram(config:AdaptiveConfig,timeZone:string,original?:TrainingProgram):TrainingProgram {
  checkConfig(config);
  const previous=original?.sessions[0],exercise=previous?.exercises[0],d=config.dose;
  const start=config.scheduleStart??dayInZone(new Date(config.createdAt),timeZone);
  const firstWeekday=(new Date(config.rotation?.anchor??start).getUTCDay()+6)%7;
  const weekdays=config.rotation
    ? [...new Set(config.rotation.slots.map(offset=>1+(firstWeekday+offset)%7))].sort()
    : scheduledWeekdays(config.days,start);
  return trainingProgram({version:1,name:config.exercise,notes:programTag+JSON.stringify(config),timeZone,archived:false,
    sessions:[{id:previous?.id??crypto.randomUUID(),name:config.exercise,weekdays,exercises:[{
      id:exercise?.id??crypto.randomUUID(),name:config.exercise,equipment:'',notes:'',
      sets:Array.from({length:d.sets},(_,i)=>({id:exercise?.sets[i]?.id??crypto.randomUUID(),[d.mode==='reps'?'reps':'durationSeconds']:d.amount,loadKg:d.loadKg})),
    }]}]});
}
export function sessionResult(w:Workout):SessionResult|undefined{
  if(!w.notes.startsWith(sessionTag))return;
  try {const r=JSON.parse(w.notes.slice(sessionTag.length)) as SessionResult;return goalDate(r.day)&&validDose(r.dose)&&typeof r.routineId==='string'&&bounded(r.minutes,0,1440)?r:undefined;}catch{return;}
}
export function actualDose(w:Workout):Dose|undefined{
  const sets=w.exercises[0]?.sets.filter(set=>set.completed);
  if(w.status!=='completed'||!sets?.length)return;
  const first=sets[0];
  return {sets:sets.length,amount:Math.min(...sets.map(s=>s.reps??s.durationSeconds??0)),mode:first.reps===undefined?'seconds':'reps',loadKg:Math.min(...sets.map(s=>s.loadKg??0))};
}
// A substitute can be displayed as performed work, but cannot establish a response
// to the planned exercise or justify progressing its prescribed load.
function plannedExerciseDose(w:Workout){
  const performed=w.exercises.filter(e=>e.sets.some(s=>s.completed));
  if(performed.length!==1 || performed[0].substitutionReason || performed[0].name!==w.snapshot.exercises[0]?.name)return;
  return actualDose(w);
}
export function guidedRecoveryDates(config:AdaptiveConfig,sessions:TrainingEvent[]){
  const dates=new Set<string>();
  for(const event of sessions){
    if(event.deleted||event.kind!=='workout')continue;
    const workout=event.data as Workout,report=sessionResult(workout);
    if(!report||report.routineId!==config.routineId)continue;
    const actual=plannedExerciseDose(workout),dose=report.dose;
    if(actual&&actual.mode===dose.mode&&actual.sets>=dose.sets&&actual.amount>=dose.amount&&actual.loadKg>=dose.loadKg)continue;
    const next=nextGuidedTrainingDay(config,addDays(report.day,1));
    if(next)dates.add(next);
  }
  return dates;
}
function scheduledPrescription(config:AdaptiveConfig,sessions:TrainingEvent[],date:string):Prescription{
  const hold=guidedRecoveryDates(config,sessions).has(date);
  const dose=guidedDoseForDate(config,date,hold);
  return {...dose,reason:hold?'missed':dose.amount>config.dose.amount?'progression':'initial'};
}
export function manualPrescription(c:AdaptiveConfig,sessions:TrainingEvent[]):Prescription{
  const base=c.dose,workouts=sessions.map(e=>e.data as Workout).filter(w=>sessionResult(w)?.routineId===c.routineId);
  if(!workouts.length)return {...base,reason:'initial'};
  const last=workouts[0],expected=sessionResult(last)!.dose;
  if(last.status==='abandoned')return {...expected,sets:Math.max(1,expected.sets-1),reason:'missed'};
  const actual=plannedExerciseDose(last);
  if(!actual)return {...base,reason:'initial'};
  const hit=(w:Workout)=>{
    const a=plannedExerciseDose(w),e=sessionResult(w);
    return !!a&&!!e&&a.mode===e.dose.mode&&a.amount>=e.dose.amount&&a.sets>=e.dose.sets&&a.loadKg>=e.dose.loadKg;
  };
  const step=base.mode==='seconds'?5:1,limit=base.mode==='seconds'?Math.floor(c.minutes*60/Math.max(1,actual.sets)):1000;
  const canProgress=workouts.length>1&&hit(last)&&hit(workouts[1])&&actual.amount+step<=Math.min(base.amount*1.25+step,limit);
  return {...actual,sets:Math.min(actual.sets,base.sets),amount:Math.min(limit,Math.max(1,actual.amount+(canProgress?step:0))),reason:canProgress?'progression':'actual'};
}
type GuidedCalendarRevision={
 revision:number;day:string;source:TrainingEvent['source'];
 config:AdaptiveConfig|null;
};
export type GoalPeriod={event:TrainingEvent;config:AdaptiveConfig;key:string;weekdays:number[];revisions:Set<number>;closed:number|null};
function materialKey(c:AdaptiveConfig,zone:string,weekdays:number[]){
 return JSON.stringify([c.groupId,c.rotation,c.guidedVersion,weekdays,c.metric,c.goalUnit,c.baseline,c.target,c.deadline,c.scheduleStart,c.routineId,c.days,c.minutes,
  c.exercise,c.dose.mode,c.dose.sets,c.dose.amount,c.dose.loadKg,c.bodyWeightKg,zone]);
}

/** Input is in ledger sequence order. Ungrouped goals replace the previous goal.
 * A group keeps one active attempt per metric until another group or single goal begins. */
export function goalProgramPeriods(events:readonly TrainingEvent[]){
 const periods:GoalPeriod[]=[];
 const active=new Map<string,GoalPeriod>();
 for(const event of events){
  if(event.kind!=='program')continue;
  const program=event.data as TrainingProgram;
  const config=!event.deleted && !program.archived ? savedAdaptiveConfig(program) : undefined;
  const current=active.get(event.id);
  if(!config && !current)continue;
  const weekdays=[...new Set(program.sessions[0]?.weekdays??[])].sort();
  const key=config ? materialKey(config,program.timeZone,weekdays) : '';
  // Adding a sibling can put an existing, unchanged goal into a group. Preserve
  // its original attempt and forecast while applying the new grouping from now on.
  if(current && config && !current.config.groupId && config.groupId &&
     materialKey({...current.config,groupId:config.groupId},program.timeZone,current.weekdays)===key &&
     current.event.data.timeZone===program.timeZone){
    current.config={...current.config,groupId:config.groupId};current.key=key;
  }
  if(current && current.key===key){current.revisions.add(event.revision);continue;}
  const closed=Date.parse(event.recordedAt);
  for(const [id,period] of active){
   if(id!==event.id && (!config || (config.groupId && config.groupId===period.config.groupId && config.metric!==period.config.metric)))continue;
   period.closed=closed;
   active.delete(id);
  }
  if(config && weekdays.length && weekdays.every(d=>Number.isInteger(d)&&d>=1&&d<=7)){
   const start={event,config,key,weekdays,revisions:new Set([event.revision]),closed:null};
   active.set(event.id,start);
   periods.push(start);
  }
 }
 return periods;
}
function calendarRevisions(events:TrainingEvent[],current:TrainingEvent,config:AdaptiveConfig):GuidedCalendarRevision[] {
 if(config.guidedVersion!==1||current.revision===1)return [];
 return events.filter(e=>e.kind==='program'&&e.id===current.id).sort((a,b)=>a.revision-b.revision).map(event=>{
  let historical:GuidedCalendarRevision['config']=null;
  if(!event.deleted&&!(event.data as TrainingProgram).archived){
    const c=savedAdaptiveConfig(event.data as TrainingProgram);
    if(c?.guidedVersion===1&&c.routineId===config.routineId&&event.data.timeZone===current.data.timeZone){
     historical=c;
    }
  }
  return {revision:event.revision,day:dayInZone(new Date(event.recordedAt),current.data.timeZone),source:event.source,config:historical};
 });
}
export function adaptivePlans(events:TrainingEvent[],includeIds?:ReadonlySet<string>,includeArchived=false){
  const entities=latestTraining(events);
  const programs=entities.filter(e=>e.kind==='program'&&(!includeIds||includeIds.has(e.id))&&!e.deleted&&(includeArchived||!(e.data as TrainingProgram).archived)&&e.data.notes.startsWith(programTag)).sort((a,b)=>b.sequence-a.sequence);
  const sessionsByProgram=new Map<string,TrainingEvent[]>();
  for(const event of entities){
    if(event.kind!=='workout'||event.deleted)continue;
    const work=event.data as Workout,id=work.origin?.programId;
    if(!id || (includeIds&&!includeIds.has(id)) || !sessionResult(work))continue;
    const list=sessionsByProgram.get(id)??[];
    list.push(event); sessionsByProgram.set(id,list);
  }
  const revisions=new Map<string,TrainingEvent[]>();
  for(const event of events){
    if(event.kind!=='program'||(includeIds&&!includeIds.has(event.id)))continue;
    const list=revisions.get(event.id)??[];
    list.push(event); revisions.set(event.id,list);
  }
  const output=[];
  for(const event of programs){
    const config=savedAdaptiveConfig(event.data as TrainingProgram);
    if(!config)continue;
    const sessions=(sessionsByProgram.get(event.id)??[]).sort((a,b)=>sessionResult(b.data as Workout)!.day.localeCompare(sessionResult(a.data as Workout)!.day)||b.sequence-a.sequence);
    let prescription:Prescription;
    if(config.guidedVersion===1){
      const today=dayInZone(new Date(),event.data.timeZone);
      const logged=sessions.some(e=>sessionResult(e.data as Workout)?.day===today);
      const next=nextGuidedTrainingDay(config,logged?addDays(today,1):today);
      prescription=scheduledPrescription(config,sessions,next??config.deadline);
    }else prescription=manualPrescription(config,sessions);
    output.push({event,config,sessions,prescription,calendarRevisions:calendarRevisions(revisions.get(event.id)??[],event,config)});
  }
  return output;
}
export type AdaptivePlan=ReturnType<typeof adaptivePlans>[number] & {attemptOpenedAt?:number};
export function currentAdaptivePlans(events:TrainingEvent[]):AdaptivePlan[]{
  const ordered=events.filter(e=>e.kind==='program').sort((a,b)=>a.sequence-b.sequence);
  const periods=goalProgramPeriods(ordered);
  const activePeriods=periods.filter(p=>p.closed===null);
  const active=new Set(activePeriods.map(p=>p.event.id));
  const opening=new Map(activePeriods.map(({event,config})=>[event.id,
    event.source==='guest-import'&&event.revision===1?Math.min(Date.parse(event.recordedAt),Date.parse(config.createdAt)):Date.parse(event.recordedAt)]));
  const creation=new Map<string,number>();
  for(const event of ordered)if(active.has(event.id)&&!creation.has(event.id))creation.set(event.id,event.sequence);
  return adaptivePlans(events,active).sort((a,b)=>creation.get(a.event.id)!-creation.get(b.event.id)!).map(plan=>({...plan,attemptOpenedAt:opening.get(plan.event.id)}));
}
export function activePlan(events:TrainingEvent[]){return currentAdaptivePlans(events).at(0)??null;}
/** Each revision contributes only its dates in force. On the date of an
 * edit, an undocumented slot remains expected if either revision required it.
 * A logged session's immutable origin can resolve that day precisely. */
export function historicalTrainingCalendar(plan:AdaptivePlan,asOf:string){
 const revisions=plan.calendarRevisions;
 if(!revisions?.length)return;
 const dates=new Set<string>();
 for(let i=0;i<revisions.length;i++){
  const revision=revisions[i],config=revision.config;
  if(!config?.scheduleStart||revision.day>asOf)continue;
  // Imported guest revisions have the import timestamp, not the original save
  // time. Retain all potentially due slots until a known revision takes over.
  const start=revision.revision===1||revision.source==='guest-import'||config.scheduleStart>revision.day?config.scheduleStart:revision.day;
  const last=[config.deadline,revisions[i+1]?.day??asOf,asOf].sort()[0];
  const span=daysBetween(start,last);
  for(let offset=0;offset<=span;offset++){
   const day=addDays(start,offset);
   if(isGuidedTrainingDay(config,day))dates.add(day);
  }
 }
 const byRevision=new Map(revisions.map(revision=>[revision.revision,revision.config]));
 for(const event of plan.sessions){
  if(event.deleted||dayInZone(new Date(event.recordedAt),plan.event.data.timeZone)>asOf)continue;
  const workout=event.data as Workout,record=sessionResult(workout);
  if(!record||record.routineId!==plan.config.routineId||!workout.origin)continue;
  const recorded=byRevision.get(workout.origin.revision);
  if(recorded){
   if(isGuidedTrainingDay(recorded,record.day))dates.add(record.day);
   else dates.delete(record.day);
  }
 }
 const sorted=[...dates].sort();
 const insertion=(day:string)=>{
  let left=0,right=sorted.length;
  while(left<right){const middle=(left+right)>>>1;if(sorted[middle]<day)left=middle+1;else right=middle;}
  return left;
 };
 return {has:(day:string)=>dates.has(day),count:(first:string,last:string)=>Math.max(0,insertion(addDays(last,1))-insertion(first))};
}
export function countScheduled(weekdays:number[],from:string,through:string){
  const days=Math.floor((Date.parse(through)-Date.parse(from))/dayMs)+1;
  if(!Number.isFinite(days)||days<=0)return 0;
  const rest=days%7,first=new Date(from).getUTCDay();
  return Math.floor(days/7)*weekdays.length+Array.from({length:rest},(_,i)=>weekdays.includes(((first+i+6)%7)+1)).filter(Boolean).length;
}
export function doseKey(config:AdaptiveConfig,d:Dose){
  return JSON.stringify([config.routineId,config.metric,config.goalUnit,config.exercise,d.mode,d.sets,d.amount,d.loadKg,config.days,config.minutes,...(config.rotation?[config.rotation]:[])]);
}
export type PerformedSession={sets:number;amount:number;loadKg:number;minutes:number;endedAt?:string;substitution?:{name:string;reason:string};checkInReason?:string};
export function planForSession(events:TrainingEvent[],plan:AdaptivePlan,day:string,endedAt?:string):AdaptivePlan{
  const zone=plan.event.data.timeZone;
  const revisions=events.filter(e=>e.kind==='program'&&e.id===plan.event.id).sort((a,b)=>a.revision-b.revision);
  const original=revisions.filter(e=>endedAt?Date.parse(e.recordedAt)<=Date.parse(endedAt):dayInZone(new Date(e.recordedAt),zone)<=day).at(-1)??revisions[0];
  if(!original)return plan;
  const version=adaptivePlans([original]).at(0);
  if(!version)throw Error('date');
  const earlier=plan.sessions.filter(e=>sessionResult(e.data as Workout)!.day<day);
  const prescription=version.config.guidedVersion===1?scheduledPrescription(version.config,earlier,day):manualPrescription(version.config,earlier);
  return {...version,sessions:plan.sessions,prescription};
}
export function makeWorkout(plan:AdaptivePlan,day:string,actual:PerformedSession|null,now=new Date(),skipReason?:string){
  const program=plan.event.data as TrainingProgram,template=program.sessions[0],exercise=template.exercises[0];
  const dose=plan.config.guidedVersion===1?scheduledPrescription(plan.config,plan.sessions,day):plan.prescription;
  const today=dayInZone(now,program.timeZone);
  const firstDay=plan.config.guidedVersion===1?plan.config.scheduleStart!:dayInZone(new Date(plan.config.createdAt),program.timeZone);
  if(!goalDate(day)||day>today||day<firstDay||day>plan.config.deadline||plan.config.guidedVersion===1&&!isGuidedTrainingDay(plan.config,day))throw Error('date');
  if(plan.sessions.some(e=>sessionResult(e.data as Workout)?.day===day))throw Error('duplicate');
  if(actual&&(!validDose({...actual,mode:dose.mode})||!whole(actual.minutes,1,1440)||(dose.mode==='seconds'&&actual.sets*actual.amount>actual.minutes*60)))throw Error('actual');
  let actualName=exercise.name,substitutionReason='';
  if(actual?.substitution!==undefined){
    const name=actual.substitution?.name,reason=actual.substitution?.reason;
    if(typeof name!=='string'||!name.trim()||name.trim().length>160||name.trim().toLowerCase()===exercise.name.trim().toLowerCase()||
       typeof reason!=='string'||!reason.trim()||reason.trim().length>240)throw Error('substitution');
    actualName=name.trim();substitutionReason=reason.trim();
  }
  const end=actual?.endedAt?new Date(actual.endedAt):now;
  if(actual&&(!Number.isFinite(end.getTime())||end>now||dayInZone(end,program.timeZone)!==day))throw Error('date');
  const start=actual?new Date(end.getTime()-actual.minutes*60000):end;
  const checkInReason=(actual?.checkInReason??skipReason)?.trim().slice(0,120);
  const meta:SessionResult={day,routineId:plan.config.routineId,minutes:actual?.minutes??0,dose:{sets:dose.sets,amount:dose.amount,mode:dose.mode,loadKg:dose.loadKg},...(checkInReason?{checkInReason}:{})};
  // The immutable origin identifies the saved template. Keep the effective dose for this particular occurrence separately.
  return workout({version:1,name:template.name,notes:sessionTag+JSON.stringify(meta),timeZone:program.timeZone,startedAt:start.toISOString(),endedAt:end.toISOString(),
    status:actual?'completed':'abandoned',origin:{programId:plan.event.id,revision:plan.event.revision,sessionId:template.id},
    snapshot:{name:template.name,exercises:template.exercises},
    exercises:actual?[{id:crypto.randomUUID(),plannedExerciseId:exercise.id,name:actualName,notes:'',substitutionReason,status:'performed',
      sets:Array.from({length:actual.sets},()=>({id:crypto.randomUUID(),[dose.mode==='reps'?'reps':'durationSeconds']:actual.amount,loadKg:actual.loadKg,completed:true})),
    }]:[],
  },now.getTime());
}
/**
 * Builds a ledger-compliant revision of an existing logged workout (for example,
 * correcting a skipped session to completed or editing logged sets/minutes).
 * Preserves immutable origin, snapshot, startedAt and timeZone.
 */
export function correctWorkout(previousEvent:TrainingEvent,plan:AdaptivePlan,actual:PerformedSession|null,reason:string,now=new Date()){
  if(previousEvent.kind!=='workout'||previousEvent.deleted)throw Error('actual');
  if(typeof reason!=='string'||reason.trim().length<3)throw Error('reason');
  const old=previousEvent.data as Workout,priorMeta=sessionResult(old);
  if(!priorMeta)throw Error('actual');
  const dose=priorMeta.dose,exercise=old.snapshot.exercises[0];
  if(!exercise)throw Error('actual');
  if(actual&&(!validDose({...actual,mode:dose.mode})||!whole(actual.minutes,1,1440)||(dose.mode==='seconds'&&actual.sets*actual.amount>actual.minutes*60)))throw Error('actual');
  let actualName=exercise.name,substitutionReason='';
  if(actual?.substitution!==undefined){
    const name=actual.substitution?.name,subReason=actual.substitution?.reason;
    if(typeof name!=='string'||!name.trim()||name.trim().length>160||name.trim().toLowerCase()===exercise.name.trim().toLowerCase()||
       typeof subReason!=='string'||!subReason.trim()||subReason.trim().length>240)throw Error('substitution');
    actualName=name.trim();substitutionReason=subReason.trim();
  }
  const startMs=Date.parse(old.startedAt);
  let endMs=now.getTime();
  let correctedFromSkip=false;
  if(actual){
    const idealEnd=startMs+actual.minutes*60000;
    if(idealEnd<=now.getTime()&&dayInZone(new Date(idealEnd),old.timeZone)===priorMeta.day){
      endMs=idealEnd;
    }else if(actual.endedAt){
      const parsed=Date.parse(actual.endedAt);
      if(Number.isFinite(parsed)&&parsed>=startMs&&parsed<=now.getTime()&&dayInZone(new Date(parsed),old.timeZone)===priorMeta.day){
        endMs=parsed;
        if(old.status==='abandoned')correctedFromSkip=true;
      }else{
        endMs=Math.max(startMs,now.getTime());
        correctedFromSkip=old.status==='abandoned';
      }
    }else{
      endMs=Math.max(startMs,now.getTime());
      correctedFromSkip=old.status==='abandoned';
    }
    if(dayInZone(new Date(endMs),old.timeZone)!==priorMeta.day){
      // Keep the corrected end time within the original workout's calendar day when backfilling.
      const prevEndMs=Date.parse(old.endedAt??old.startedAt);
      endMs=Math.max(startMs,Math.min(now.getTime(),prevEndMs));
      correctedFromSkip=true;
    }
  }else{
    endMs=Math.max(startMs,Date.parse(old.endedAt??old.startedAt));
    if(endMs>now.getTime())endMs=startMs;
  }
  const checkInReason=(actual?.checkInReason??priorMeta.checkInReason)?.trim().slice(0,120);
  const meta:SessionResult={
    day:priorMeta.day,routineId:plan.config.routineId,minutes:actual?.minutes??0,dose,
    ...(checkInReason?{checkInReason}:{}),
    ...(correctedFromSkip?{correctedFromSkip:true}:{}),
  };
  return workout({
    version:1,name:old.name,notes:sessionTag+JSON.stringify(meta),timeZone:old.timeZone,
    startedAt:old.startedAt,endedAt:new Date(endMs).toISOString(),
    status:actual?'completed':'abandoned',origin:old.origin,snapshot:old.snapshot,
    exercises:actual?[{id:crypto.randomUUID(),plannedExerciseId:exercise.id,name:actualName,notes:'',substitutionReason,status:'performed',
      sets:Array.from({length:actual.sets},()=>({id:crypto.randomUUID(),[dose.mode==='reps'?'reps':'durationSeconds']:actual.amount,loadKg:actual.loadKg,completed:true})),
    }]:[],
  },now.getTime());
}
/** Deterministic UUIDv5-shaped ID so retrying/double-submitting the same check-in is idempotent. */
export async function deterministicRequestId(parts:readonly string[]){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(parts.join('|'))));
  digest[6]=(digest[6]&15)|0x50;digest[8]=(digest[8]&63)|0x80;
  const hex=Array.from(digest.slice(0,16),x=>x.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
/** A scheduled day has one entity per plan, including across devices and retries. */
export async function workoutId(programId:string,day:string){
  return deterministicRequestId([programId,day]);
}
/** P(K >= required) for independent Bernoulli sessions. Log probabilities keep long horizons numerically stable. */
export function binomialTail(n:number,required:number,p:number){
  if(!whole(n,0,3660)||!Number.isInteger(required)||!bounded(p,0,1))return undefined;
  if(required<=0)return 1;
  if(required>n||p===0)return 0;
  if(p===1)return 1;
  let log= n*Math.log1p(-p),sum=0;
  for(let k=0;k<=n;k++){
    if(k>=required)sum+=Math.exp(log);
    if(k<n)log+=Math.log((n-k)/(k+1))+Math.log(p)-Math.log1p(-p);
  }
  return Math.min(1,Math.max(0,sum));
}
export function scenarioResult(plan:AdaptivePlan,current:number,today:string){
  const config=plan.config,scenario=config.scenario;
  if(today>config.deadline||!scenario||scenario.dose!==doseKey(config,plan.prescription))return;
  const weekdays=(plan.event.data as TrainingProgram).sessions[0].weekdays;
  const guided=config.guidedVersion===1;
  const scheduled=guided?countGuidedSessions(config,today,config.deadline):countScheduled(weekdays,today,config.deadline);
  const dueToday=guided?isGuidedTrainingDay(config,today):weekdays.includes((new Date(today).getUTCDay()+6)%7+1);
  const sessions=scheduled-(dueToday&&plan.sessions.some(e=>sessionResult(e.data as Workout)?.day===today)?1:0);
  if(sessions<0||sessions>3660)return;
  const polarity=goalMetrics.find(m=>m.id===config.metric)!.polarity;
  const gap=Math.max(0,(config.target-current)*polarity),required=Math.ceil(Number((gap/scenario.gain).toFixed(9)));
  const rate=(response:number)=>binomialTail(sessions,required,(response/100)*(scenario.attendance/100))!;
  return {sessions,required,p:rate(scenario.response),low:rate(Math.max(0,scenario.response-10)),high:rate(Math.min(100,scenario.response+10))};
}

/** Descriptive rate over two documented comparable tests and matching logged sessions. */
export function observedGain(plan:AdaptivePlan,pair:Observation[]|undefined) {
  if(pair?.length!==2||!comparableDelta(pair))return;
  const [latest,prior]=pair,config=plan.config,metric=goalMetrics.find(m=>m.id===config.metric);
  if(!metric||!latest.measuredAt||!prior.measuredAt||latest.metricId!==metric.id||prior.metricId!==metric.id)return;
  const first=Date.parse(prior.measuredAt),last=Date.parse(latest.measuredAt);
  if(first<Date.parse(config.createdAt)||last<=first)return;
  const a=goalValue(metric,config.goalUnit,prior.value??undefined,prior),b=goalValue(metric,config.goalUnit,latest.value??undefined,latest);
  if(a===undefined||b===undefined)return;
  const delta=(b-a)*metric.polarity;
  if(delta<=0)return;
  const sessions=plan.sessions.map(e=>e.data as Workout).filter(w=>w.status==='completed'&&w.endedAt&&Date.parse(w.endedAt)>first&&Date.parse(w.endedAt)<=last);
  if(sessions.length<2)return;
  const sameDose=(measured:Dose)=>measured.mode===plan.prescription.mode&&measured.sets===plan.prescription.sets&&measured.amount===plan.prescription.amount&&measured.loadKg===plan.prescription.loadKg;
  if(sessions.some(w=>{const r=sessionResult(w),actual=plannedExerciseDose(w);return !r||r.routineId!==config.routineId||r.minutes!==config.minutes||!actual||!sameDose(actual);}))return;
  const observed=delta/sessions.length;
  const gain=countMetrics.has(metric.id)?Math.round(observed):Number(observed.toFixed(3));
  if(gain<=0)return;
  return {gain,observed,delta,count:sessions.length};
}
