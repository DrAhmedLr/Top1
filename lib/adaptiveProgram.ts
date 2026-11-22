import {activeMetrics,type Metric} from './registry';
import {valid} from './engine';
import {goalDate} from './personalGoal';
import {isLift} from './focusedEntry';
import {calculationValue} from './derivations';
import {countMetrics} from './measurementRules';
import {comparableDelta,type Observation} from './history';
import {latestTraining,trainingProgram,workout,type TrainingEvent,type TrainingProgram,type Workout} from './training';
import type {MeasurementDetails} from './measurementMetadata';

export const goalMetrics=activeMetrics.filter(metric=>metric.pillar==='strength');
export type GoalUnit='metric'|'kg';
export type Dose={sets:number;amount:number;mode:'reps'|'seconds';loadKg:number};
export type Prescription=Dose&{reason:'initial'|'missed'|'actual'|'progression'};
export type Scenario={dose:string;gain:number;response:number;attendance:number};
export type AdaptiveConfig={
  metric:string;goalUnit:GoalUnit;baseline:number;target:number;deadline:string;createdAt:string;
  days:number;minutes:number;exercise:string;dose:Dose;routineId:string;scenario?:Scenario;bodyWeightKg?:number;
};
export type SessionResult={day:string;routineId:string;dose:Dose;minutes:number};
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
export function checkConfig(c:AdaptiveConfig){
  const metric=goalMetrics.find(m=>m.id===c.metric);
  if(!metric||!['kg','metric'].includes(c.goalUnit)||c.goalUnit==='kg'&&!isLift(metric.id))throw Error('goal');
  const allowed=(v:number)=>c.goalUnit==='kg'?bounded(v,0,2000):valid(metric,v);
  if(!allowed(c.baseline)||!allowed(c.target)||(c.target-c.baseline)*metric.polarity<=0)throw Error('target');
  if(!goalDate(c.deadline)||!Number.isFinite(Date.parse(c.createdAt)))throw Error('date');
  if(!whole(c.days,1,7)||!whole(c.minutes,1,240)||!c.exercise.trim()||c.exercise.length>120||!c.routineId||!validDose(c.dose))throw Error('dose');
  if(c.dose.mode==='seconds'&&c.dose.amount*c.dose.sets>c.minutes*60)throw Error('duration');
  if(c.scenario&&(!c.scenario.dose||!bounded(c.scenario.gain,0.000001,10000)||countMetrics.has(c.metric)&&!Number.isInteger(c.scenario.gain)||!bounded(c.scenario.response,0,100)||!bounded(c.scenario.attendance,0,100)))throw Error('scenario');
  return c;
}
export function scheduledWeekdays(days:number,startDay:string){
  const start=new Date(startDay).getUTCDay();
  return Array.from({length:days},(_,i)=>((start+Math.floor(i*7/days)+6)%7)+1).sort((a,b)=>a-b);
}
export function buildProgram(config:AdaptiveConfig,timeZone:string,original?:TrainingProgram):TrainingProgram {
  checkConfig(config);
  const previous=original?.sessions[0],exercise=previous?.exercises[0],d=config.dose;
  return trainingProgram({version:1,name:config.exercise,notes:programTag+JSON.stringify(config),timeZone,archived:false,
    sessions:[{id:previous?.id??crypto.randomUUID(),name:config.exercise,weekdays:scheduledWeekdays(config.days,dayInZone(new Date(config.createdAt),timeZone)),exercises:[{
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
function proposedDose(c:AdaptiveConfig,sessions:TrainingEvent[]):Prescription{
  const base=c.dose,workouts=sessions.map(e=>e.data as Workout).filter(w=>sessionResult(w)?.routineId===c.routineId);
  if(!workouts.length)return {...base,reason:'initial'};
  const last=workouts[0],expected=sessionResult(last)!.dose;
  if(last.status==='abandoned')return {...expected,sets:Math.max(1,expected.sets-1),reason:'missed'};
  const actual=actualDose(last);
  if(!actual)return {...base,reason:'initial'};
  const hit=(w:Workout)=>{
    const a=actualDose(w),e=sessionResult(w);
    return !!a&&!!e&&a.mode===e.dose.mode&&a.amount>=e.dose.amount&&a.sets>=e.dose.sets&&a.loadKg>=e.dose.loadKg;
  };
  const step=base.mode==='seconds'?5:1,limit=base.mode==='seconds'?Math.floor(c.minutes*60/Math.max(1,actual.sets)):1000;
  const canProgress=workouts.length>1&&hit(last)&&hit(workouts[1])&&actual.amount+step<=Math.min(base.amount*1.25+step,limit);
  return {...actual,sets:Math.min(actual.sets,base.sets),amount:Math.min(limit,Math.max(1,actual.amount+(canProgress?step:0))),reason:canProgress?'progression':'actual'};
}
export function adaptivePlans(events:TrainingEvent[]){
  const entities=latestTraining(events),programs=entities.filter(e=>e.kind==='program'&&!e.deleted&&!(e.data as TrainingProgram).archived&&e.data.notes.startsWith(programTag)).sort((a,b)=>b.sequence-a.sequence);
  const output=[];
  for(const event of programs){
    let config:AdaptiveConfig;
    try{config=checkConfig(JSON.parse(event.data.notes.slice(programTag.length)));}catch{continue;}
    const sessions=entities.filter(e=>e.kind==='workout'&&!e.deleted&&(e.data as Workout).origin?.programId===event.id&&sessionResult(e.data as Workout))
      .sort((a,b)=>sessionResult(b.data as Workout)!.day.localeCompare(sessionResult(a.data as Workout)!.day)||b.sequence-a.sequence);
    output.push({event,config,sessions,prescription:proposedDose(config,sessions)});
  }
  return output;
}
export function activePlan(events:TrainingEvent[]){return adaptivePlans(events).at(0)??null;}
export type AdaptivePlan=NonNullable<ReturnType<typeof activePlan>>;
export function countScheduled(weekdays:number[],from:string,through:string){
  const days=Math.floor((Date.parse(through)-Date.parse(from))/dayMs)+1;
  if(!Number.isFinite(days)||days<=0)return 0;
  const rest=days%7,first=new Date(from).getUTCDay();
  return Math.floor(days/7)*weekdays.length+Array.from({length:rest},(_,i)=>weekdays.includes(((first+i+6)%7)+1)).filter(Boolean).length;
}
export function doseKey(config:AdaptiveConfig,d:Dose){
  return JSON.stringify([config.routineId,config.metric,config.goalUnit,config.exercise,d.mode,d.sets,d.amount,d.loadKg,config.days,config.minutes]);
}
export type PerformedSession={sets:number;amount:number;loadKg:number;minutes:number;endedAt?:string};
export function planForSession(events:TrainingEvent[],plan:AdaptivePlan,day:string,endedAt?:string):AdaptivePlan{
  const zone=plan.event.data.timeZone;
  const revisions=events.filter(e=>e.kind==='program'&&e.id===plan.event.id).sort((a,b)=>a.revision-b.revision);
  const original=revisions.filter(e=>endedAt?Date.parse(e.recordedAt)<=Date.parse(endedAt):dayInZone(new Date(e.recordedAt),zone)<=day).at(-1)??revisions[0];
  if(!original)return plan;
  const version=adaptivePlans([original]).at(0);
  if(!version)throw Error('date');
  const earlier=plan.sessions.filter(e=>sessionResult(e.data as Workout)!.day<day);
  return {...version,sessions:plan.sessions,prescription:proposedDose(version.config,earlier)};
}
export function makeWorkout(plan:AdaptivePlan,day:string,actual:PerformedSession|null,now=new Date()){
  const program=plan.event.data as TrainingProgram,template=program.sessions[0],exercise=template.exercises[0],dose=plan.prescription;
  const today=dayInZone(now,program.timeZone);
  if(!goalDate(day)||day>today||day<dayInZone(new Date(plan.config.createdAt),program.timeZone)||day>plan.config.deadline)throw Error('date');
  if(plan.sessions.some(e=>sessionResult(e.data as Workout)?.day===day))throw Error('duplicate');
  if(actual&&(!validDose({...actual,mode:dose.mode})||!whole(actual.minutes,1,1440)||(dose.mode==='seconds'&&actual.sets*actual.amount>actual.minutes*60)))throw Error('actual');
  const end=actual?.endedAt?new Date(actual.endedAt):now;
  if(actual&&(!Number.isFinite(end.getTime())||end>now||dayInZone(end,program.timeZone)!==day))throw Error('date');
  const start=actual?new Date(end.getTime()-actual.minutes*60000):end;
  const meta:SessionResult={day,routineId:plan.config.routineId,minutes:actual?.minutes??0,dose:{sets:dose.sets,amount:dose.amount,mode:dose.mode,loadKg:dose.loadKg}};
  // The immutable origin identifies the saved template. Keep the effective dose for this particular occurrence separately.
  return workout({version:1,name:template.name,notes:sessionTag+JSON.stringify(meta),timeZone:program.timeZone,startedAt:start.toISOString(),endedAt:end.toISOString(),
    status:actual?'completed':'abandoned',origin:{programId:plan.event.id,revision:plan.event.revision,sessionId:template.id},
    snapshot:{name:template.name,exercises:template.exercises},
    exercises:actual?[{id:crypto.randomUUID(),plannedExerciseId:exercise.id,name:exercise.name,notes:'',substitutionReason:'',status:'performed',
      sets:Array.from({length:actual.sets},()=>({id:crypto.randomUUID(),[dose.mode==='reps'?'reps':'durationSeconds']:actual.amount,loadKg:actual.loadKg,completed:true})),
    }]:[],
  },now.getTime());
}
/** A scheduled day has one entity per plan, including across devices and retries. */
export async function workoutId(programId:string,day:string){
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(programId+'|'+day)));
  digest[6]=(digest[6]&15)|0x50;digest[8]=(digest[8]&63)|0x80;
  const hex=Array.from(digest.slice(0,16),x=>x.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
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
  const sessions=countScheduled(weekdays,today,config.deadline)-
    (today<=config.deadline&&weekdays.includes((new Date(today).getUTCDay()+6)%7+1)&&plan.sessions.some(e=>sessionResult(e.data as Workout)?.day===today)?1:0);
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
  if(sessions.some(w=>{const r=sessionResult(w),actual=actualDose(w);return !r||r.routineId!==config.routineId||r.minutes!==config.minutes||!actual||!sameDose(actual);}))return;
  const observed=delta/sessions.length;
  const gain=countMetrics.has(metric.id)?Math.round(observed):Number(observed.toFixed(3));
  if(gain<=0)return;
  return {gain,observed,delta,count:sessions.length};
}
