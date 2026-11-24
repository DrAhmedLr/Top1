import {historicalTrainingCalendar,countScheduled,goalMetrics,goalValue,sessionResult,type AdaptivePlan,type Dose} from './adaptiveProgram';
import {countGuidedSessions,isGuidedTrainingDay} from './datedProgram';
import {measurementStep} from './guidedAdherence';
import {calculationValue,normalizeDerivation} from './derivations';
import {comparableDelta,observationDate,type Observation} from './history';
import {goalDate} from './personalGoal';
import type {Metric} from './registry';
import {latestTraining,type TrainingProgram,type Workout} from './training';

const trajectories=2048;
const maximumSessions=3660;
type UnavailableReason='insufficient'|'expired'|'horizon'|'context';
export type PersonalForecast=
 |{kind:'unavailable';reason:UnavailableReason;intervals:number}
 |{kind:'ready';probability:number;intervals:number;completedSessions:number;remainingSessions:number;simulations:number;
   improving:number;unchanged:number;declining:number;targetSensitivity?:{low:number;high:number}};
export type MeasuredTrainingBlock={sessions:number;performed:number;modified:number;change:number};
type Block=MeasuredTrainingBlock;
type TrainingBasis='fixed-dose'|'program'|'adherent-program';
export type TrainingSlot={day:string;at?:number;started?:number;status:'matched'|'modified'|'skipped'|'different'};
type Slot=TrainingSlot;

function samePerformedDose(workout:Workout,dose:Dose,exercise:string){
 const performed=workout.exercises.filter(e=>e.sets.some(set=>set.completed));
 if(performed.length!==1||performed[0].name!==exercise||performed[0].substitutionReason)return false;
 const sets=performed[0].sets.filter(set=>set.completed);
 return sets.length===dose.sets&&sets.every(set=>(dose.mode==='reps'?set.reps:set.durationSeconds)===dose.amount&&(set.loadKg??0)===dose.loadKg);
}

export function sessionSlots(plan:AdaptivePlan,localDay:(ms:number)=>string,asOf:string,basis:TrainingBasis){
 const byDay=new Map<string,Slot>();
 const reported=plan.sessions.filter(event=>{
  const saved=Date.parse(event.recordedAt);
  return Number.isFinite(saved)&&localDay(saved)<=asOf;
 });
 for(const event of latestTraining(reported)){
  if(event.deleted||event.kind!=='workout')continue;
  const workout=event.data as Workout;
  if(workout.origin?.programId!==plan.event.id)continue;
  const record=sessionResult(workout);
  if(!record)continue;
  const at=Date.parse(workout.endedAt??''),started=Date.parse(workout.startedAt);
  const onDay=Number.isFinite(at)&&localDay(at)===record.day;
  const sameRoutine=record.routineId===plan.config.routineId;
  const spanOk=Math.abs(at-started-record.minutes*60000)<1000||(record.correctedFromSkip===true&&event.revision>1&&at>=started);
  const durationMatches=(plan.config.guidedVersion===1?record.minutes>0:record.minutes===plan.config.minutes)&&spanOk;
  // An adaptive program defines the dose separately for each session. A logged
  // substitution or mismatch is still excluded, even if the routine ID matches.
  const dose=basis==='fixed-dose'?plan.prescription:record.dose,planned=record.dose;
  const completed=workout.status==='completed'&&sameRoutine&&onDay&&durationMatches&&samePerformedDose(workout,dose,plan.config.exercise);
  const skipped=workout.status==='abandoned'&&sameRoutine&&planned.mode===dose.mode&&planned.sets===dose.sets&&planned.amount===dose.amount&&planned.loadKg===dose.loadKg;
  const modified=workout.status==='completed'&&sameRoutine&&onDay&&durationMatches&&workout.exercises.some(e=>e.sets.some(s=>s.completed));
  byDay.set(record.day,{
   day:record.day,at:onDay?at:undefined,started:workout.status==='completed'?started:undefined,
   status:byDay.has(record.day)?'different':completed?'matched':skipped?'skipped':modified?'modified':'different',
  });
 }
 return byDay;
}

export function chronologicalTests(entries:Observation[],id:string,asOf:string,localDay:(ms:number)=>string){
 const saves=entries.filter(e=>e.metricId===id&&Number.isFinite(Date.parse(e.recordedAt))&&localDay(Date.parse(e.recordedAt))<=asOf)
  .sort((a,b)=>(b.sequence??0)-(a.sequence??0)||Date.parse(b.recordedAt)-Date.parse(a.recordedAt)||b.id.localeCompare(a.id));
 const clear=saves.findIndex(e=>e.cleared);
 const seenIds=new Set<string>(),seenDates=new Set<number>();
 return (clear<0?saves:saves.slice(0,clear)).filter(e=>{
  const time=Date.parse(observationDate(e));
  const dated=Number.isFinite(Date.parse(e.measuredAt??''));
  if(!Number.isFinite(time)||localDay(time)>asOf||seenIds.has(e.id)||dated&&seenDates.has(time))return false;
  seenIds.add(e.id);
  if(dated)seenDates.add(time);
  return true;
 }).sort((a,b)=>Date.parse(observationDate(a))-Date.parse(observationDate(b)));
}

export function testValue(metric:Metric,plan:AdaptivePlan,observation:Observation){
 if(!Number.isFinite(Date.parse(observation.measuredAt??''))||observation.value===null)return;
 try{
  if(observation.derivation){
   const derivation=normalizeDerivation(metric.id,observation.derivation);
   if(Number(calculationValue(derivation).toFixed(3))!==Number(observation.value.toFixed(3)))return;
  }
  if(metric.id==='vo2_max'&&observation.method==='direct_cpet'&&observation.derivation)return;
  return goalValue(metric,plan.config.goalUnit,observation.value,observation);
 }catch{return;}
}

const weekday=(day:string)=>(new Date(day).getUTCDay()+6)%7+1;
function lowerBoundDay(items:Slot[],day:string){
 let lo=0,hi=items.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(items[mid].day<day)lo=mid+1;else hi=mid;}
 return lo;
}

type Calendar={count:(first:string,last:string)=>number;has:(day:string)=>boolean};
export function intervalBlock(from:number,to:number,first:string,last:string,calendar:Calendar,byDay:Map<string,Slot>,slots:Slot[],change:number,allowModified=false):Block|undefined{
 // A dated workout belongs to (test A, test B]. For unlogged or backfilled skipped
 // slots without a time, the calendar day closes at its end.
 const included=(day:string,at?:number)=>(day>first||at===undefined||at>from)&&(day<last||at!==undefined&&at<=to);
 let expected=calendar.count(first,last);
 for(const boundary of new Set([first,last])){
  if(calendar.has(boundary)&&!included(boundary,byDay.get(boundary)?.at))expected--;
 }
 if(expected<=0)return;
 let logged=0,performed=0,modified=0;
 for(let i=lowerBoundDay(slots,first);i<slots.length&&slots[i].day<=last;i++){
  const slot=slots[i];
  if(!included(slot.day,slot.at))continue;
  if(!calendar.has(slot.day)||slot.status==='different'||slot.status==='modified'&&!allowModified||slot.started!==undefined&&slot.started<from)return;
  logged++;
  if(slot.status==='matched')performed++;
  if(slot.status==='modified')modified++;
 }
 if(logged===expected)return {sessions:logged,performed,modified,change};
}

/** Resample complete measured blocks with replacement, linearly allocating their net
 * signed change across their scheduled slots. Probability means reaching the target
 * at a future slot by the deadline, conditional on repeating these observed blocks. */
function reachProbability(blocks:Block[],sessions:number,gap:number){
 if(gap<=0)return 1;
 if(!sessions||blocks.every(b=>b.change<=0))return 0;
 // A fixed seed gives repeatable Monte Carlo trajectories after each render or reload.
 let successes=0;
 for(let simulation=0;simulation<trajectories;simulation++){
   // Give each trajectory the same draws across targets, even if an easier
   // target stops it earlier. This keeps the sensitivity range ordered.
   let state=(0x73513a29+Math.imul(simulation,0x9e3779b1))>>>0;
  let progress=0,remaining=sessions;
  while(remaining>0){
   state=(Math.imul(state,1664525)+1013904223)>>>0;
   const block=blocks[Math.floor((state/4294967296)*blocks.length)];
   const used=Math.min(remaining,block.sessions);
   progress+=block.change*(used/block.sessions);
   if(progress>=gap-1e-9){successes++;break;}
   remaining-=used;
  }
 }
 return successes/trajectories;
}

export function personalForecast(plan:AdaptivePlan,entries:Observation[],current:number,today:string,basis:TrainingBasis='fixed-dose'):PersonalForecast{
 const none=(reason:UnavailableReason,intervals=0):PersonalForecast=>({kind:'unavailable',reason,intervals});
 const config=plan.config,program=plan.event.data as TrainingProgram;
 const metric=goalMetrics.find(item=>item.id===config.metric);
 if(!metric||!Number.isFinite(current)||!goalDate(today)||program.archived||plan.event.deleted)return none('context');
 if(today>config.deadline)return none('expired');
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:program.timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
 const dayCache=new Map<number,string>();
 const localDay=(ms:number)=>{
  const cached=dayCache.get(ms);
  if(cached)return cached;
  const parts=formatter.formatToParts(ms);
  const result=['year','month','day'].map(key=>parts.find(part=>part.type===key)?.value).join('-');
  dayCache.set(ms,result);return result;
 };
 const started=Date.parse(config.createdAt);
 if(today<localDay(started))return none('context');
 const weekdays=program.sessions[0].weekdays;
 const calendar:Calendar=config.guidedVersion===1?
   {count:(first,last)=>countGuidedSessions(config,first,last),has:day=>isGuidedTrainingDay(config,day)}:
   {count:(first,last)=>countScheduled(weekdays,first,last),has:day=>weekdays.includes(weekday(day))};
 const byDay=sessionSlots(plan,localDay,today,basis);
 const scheduled=calendar.count(today,config.deadline);
 const remainingSessions=scheduled-(byDay.has(today)&&calendar.has(today)?1:0);
 if(remainingSessions>maximumSessions)return none('horizon');
 const tests=chronologicalTests(entries,metric.id,today,localDay),anchor=tests.at(-1);
 if(!anchor)return none('insufficient');
 const baseline=testValue(metric,plan,anchor);
 if(baseline===undefined||Math.abs(baseline-current)>0.0005)return none('context');
 const historical=historicalTrainingCalendar(plan,today)??calendar;
 const slots=[...byDay.values()].sort((a,b)=>a.day.localeCompare(b.day));
 const assessmentTime=Date.parse(today)+36*3600000;
 const blocks:Block[]=[];
 for(let i=1;i<tests.length;i++){
  const prior=tests[i-1],next=tests[i];
  const from=Date.parse(prior.measuredAt??''),to=Date.parse(next.measuredAt??'');
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<=Math.max(started,from))continue;
  // A dated test taken on setup day can anchor the plan when its result was
  // adopted as the starting value. Earlier training stays outside this interval.
  if(from<started&&(basis==='fixed-dose'||localDay(from)!==localDay(started)||testValue(metric,plan,prior)!==config.baseline))continue;
  if(!comparableDelta([prior,next],assessmentTime)||next!==anchor&&!comparableDelta([next,anchor],assessmentTime))continue;
  const a=testValue(metric,plan,prior),b=testValue(metric,plan,next);
  if(a===undefined||b===undefined)continue;
  const start=Math.max(from,started);
  const sample=intervalBlock(start,to,localDay(start),localDay(to),historical,byDay,slots,(b-a)*metric.polarity);
  if(sample&&(basis!=='adherent-program'||sample.sessions===sample.performed))blocks.push(sample);
 }
 // Fully documented breaks belong to the sampling distribution; they cannot by
 // themselves establish the minimum history at the current training dose.
 const trained=blocks.filter(block=>block.performed>0).length;
 if(trained<3)return none('insufficient',trained);
 const gap=(config.target-current)*metric.polarity;
 const step=measurementStep(config);
 return {
  kind:'ready',intervals:blocks.length,remainingSessions,simulations:trajectories,
  completedSessions:blocks.reduce((sum,b)=>sum+b.performed,0),
  improving:blocks.filter(b=>b.change>0).length,unchanged:blocks.filter(b=>b.change===0).length,declining:blocks.filter(b=>b.change<0).length,
  probability:reachProbability(blocks,remainingSessions,gap),
  ...(basis==='adherent-program'?{targetSensitivity:{
   low:reachProbability(blocks,remainingSessions,gap+step),
   high:reachProbability(blocks,remainingSessions,gap-step),
  }}:{}),
 };
}
