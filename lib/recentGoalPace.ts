import {addDays, countScheduled, dayInZone, goalMetrics, historicalTrainingCalendar, type AdaptivePlan} from './adaptiveProgram';
import {countGuidedSessions, daysBetween, isGuidedTrainingDay, maximumGuidedDays} from './guidedSchedule';
import {comparableDelta, type Observation} from './history';
import {goalDate} from './personalGoal';
import {chronologicalTests, intervalBlock, sessionSlots, testValue, type MeasuredTrainingBlock} from './personalForecast';
import type {TrainingProgram} from './training';

export type PaceAttendance={completed:number;modified:number;skipped:number;unlogged:number};
type Activity=Exclude<keyof PaceAttendance,'unlogged'>;
type Support={intervals:number;attendance:PaceAttendance;observationDays:number};
export type RecentGoalPace=Support & (
 | {kind:'unavailable';reason:'insufficient'|'logs'|'context'|'expired'|'stale'|'horizon'|'reached'}
 | {kind:'ready';probability:number;finishDay:string|null;finishRange:{early:string;late:string}|null;
    throughDay:string;simulations:number;lastTestDay:string}
);
const paths=1024;
const recentDays=28;
const evidenceDays=84;
const weekday=(day:string)=>(new Date(day).getUTCDay()+6)%7+1;
const activity=(status:string|undefined):Activity|undefined=>status==='matched'?'completed':status==='modified'?'modified':status==='skipped'?'skipped':undefined;
type DoseSample={change:number;visits:number};

function samples(blocks:MeasuredTrainingBlock[],status:Activity):DoseSample[]{
  if(status==='skipped'){
    // Without measured rest-only intervals a reported skip adds zero modeled
    // training gain. It never creates evidence of a missed or achieved target.
    const rest=blocks.filter(b=>b.performed+b.modified===0).map(b=>({change:b.change/b.sessions,visits:b.sessions}));
    return rest.length?rest:[{change:0,visits:1}];
  }
  const relevant=blocks.filter(b=>(status==='completed'?b.performed:b.modified)>0);
  const isolated=relevant.filter(b=>(status==='completed'?b.modified:b.performed)===0);
  // Prefer intervals with only this kind of performed work. In mixed intervals
  // the observed net change is divided over performed visits; it cannot establish
  // the isolated physiological effect of a substitute or of an individual exercise.
  return (isolated.length?isolated:relevant).map(b=>({change:b.change/(b.performed+b.modified),visits:b.performed+b.modified}));
}

/** Personal scenario. Resample recent documented attendance and measured signed
 * changes, including plateaus and declines. Results never write achieved tests. */
export function recentPaceForecast(plan:AdaptivePlan,entries:Observation[],current:number,today:string,now:number):RecentGoalPace{
  const attendance:PaceAttendance={completed:0,modified:0,skipped:0,unlogged:0};
  const support:Support={attendance,intervals:0,observationDays:0};
  const unavailable=(reason:Extract<RecentGoalPace,{kind:'unavailable'}>['reason']):RecentGoalPace=>({...support,kind:'unavailable',reason});
  const c=plan.config,program=plan.event.data as TrainingProgram,metric=goalMetrics.find(m=>m.id===c.metric);
  if(!metric||!Number.isFinite(now)||!Number.isFinite(current)||!goalDate(today)||program.archived||plan.event.deleted)return unavailable('context');
  if(today>c.deadline)return unavailable('expired');
  const gap=(c.target-current)*metric.polarity;
  if(gap<=0)return unavailable('reached');
  const byTime=new Map<number,string>();
  const localDay=(ms:number)=>{let day=byTime.get(ms);if(!day){day=dayInZone(new Date(ms),program.timeZone);byTime.set(ms,day);}return day;};
  const weekdays=program.sessions[0].weekdays;
  const schedule=c.guidedVersion===1?{has:(d:string)=>isGuidedTrainingDay(c,d),count:(a:string,b:string)=>countGuidedSessions(c,a,b)}:
    {has:(d:string)=>weekdays.includes(weekday(d)),count:(a:string,b:string)=>countScheduled(weekdays,a,b)};
  const historical=historicalTrainingCalendar(plan,today)??schedule;
  const start=Date.parse(c.createdAt),startDay=localDay(start);
  if(startDay>today)return unavailable('context');
  const windowStart=[startDay,addDays(today,1-recentDays)].sort()[1];
  support.observationDays=1+daysBetween(windowStart,today);
  const visible={...plan,sessions:plan.sessions.filter(event=>Date.parse(event.recordedAt)<=now)};
  const byDay=sessionSlots(visible,localDay,today,'program');
  const slots=[...byDay.values()].sort((a,b)=>a.day.localeCompare(b.day));
  const recent:Activity[]=[];
  for(let i=0;i<support.observationDays;i++){
    const day=addDays(windowStart,i),slot=byDay.get(day);
    if(!historical.has(day)||day===today&&!slot)continue;
    const known=activity(slot?.status);
    if(known){attendance[known]++;recent.push(known);}else attendance.unlogged++;
  }
  const tests=chronologicalTests(entries.filter(e=>Date.parse(e.recordedAt)<=now&&(e.measuredAt?Date.parse(e.measuredAt)<=now:true)),metric.id,today,localDay);
  const anchor=tests.at(-1);
  if(!anchor||!anchor.measuredAt)return unavailable('insufficient');
  // A subsequent decline updates current performance while the first qualifying
  // achievement stays resolved. A new target can only be met after its issue.
  const origin=tests.find(t=>t.measuredAt&&testValue(metric,plan,t)===c.baseline);
  const opened=plan.attemptOpenedAt??start;
  if(origin&&tests.some(t=>{
    const measured=t.measuredAt?Date.parse(t.measuredAt):NaN;
    if(t===origin||!(measured>opened)||localDay(measured)>c.deadline||!comparableDelta([origin,t],now))return false;
    const value=testValue(metric,plan,t);
    return value!==undefined&&(value-c.target)*metric.polarity>=0;
  }))return unavailable('reached');
  const value=testValue(metric,plan,anchor);
  if(value===undefined||Math.abs(value-current)>.0005)return unavailable('context');
  const lastTest=Date.parse(anchor.measuredAt),lastTestDay=localDay(lastTest);
  if(daysBetween(lastTestDay,today)>recentDays)return unavailable('stale');
  const blocks:MeasuredTrainingBlock[]=[];
  let earliest=lastTestDay;
  for(let i=1;i<tests.length;i++){
    const a=tests[i-1],b=tests[i],from=Date.parse(a.measuredAt??''),to=Date.parse(b.measuredAt??'');
    if(!Number.isFinite(from)||!Number.isFinite(to)||to<=Math.max(start,from)||daysBetween(localDay(from),today)>evidenceDays)continue;
    const av=testValue(metric,plan,a),bv=testValue(metric,plan,b);
    if(av===undefined||bv===undefined||!comparableDelta([a,b],now)||b!==anchor&&!comparableDelta([b,anchor],now))continue;
    if(from<start&&(av!==c.baseline||daysBetween(localDay(from),startDay)>7))continue;
    const begin=Math.max(start,from),block=intervalBlock(begin,to,localDay(begin),localDay(to),historical,byDay,slots,(bv-av)*metric.polarity,true);
    if(block){blocks.push(block);if(localDay(begin)<earliest)earliest=localDay(begin);}
  }
  support.intervals=blocks.filter(b=>b.performed+b.modified>0).length;
  if(support.intervals<3)return unavailable('insufficient');
  if(recent.length<3||recent.length/(recent.length+attendance.unlogged)<.7)return unavailable('logs');
  const gains={completed:samples(blocks,'completed'),modified:samples(blocks,'modified'),skipped:samples(blocks,'skipped')};
  const postTest:Activity[]=[];
  for(let i=0;i<=daysBetween(lastTestDay,today);i++){
    const day=addDays(lastTestDay,i),slot=byDay.get(day);
    if(!historical.has(day)||day===today&&!slot||day===lastTestDay&&(!slot?.at||slot.at<=lastTest))continue;
    const known=activity(slot?.status);
    // Unmeasured progress since the latest test is unknown if a due slot lacks
    // a record. A later comparable retest can start a fresh verified anchor.
    if(!known||slot?.started!==undefined&&slot.started<lastTest)return unavailable('logs');
    postTest.push(known);
  }
  if([...recent,...postTest].some(s=>!gains[s].length))return unavailable('context');
  // Beyond the actual deadline, a date is a scenario continuing this calendar
  // pattern. Bound extrapolation to at most four measured spans (12-week floor).
  const extension=Math.min(maximumGuidedDays,Math.max(84,4*daysBetween(earliest,lastTestDay)));
  const throughDay=addDays(today,extension);
  if(c.deadline>throughDay)return unavailable('horizon');
  const projectedConfig={...c,deadline:throughDay};
  const future:string[]=[];
  for(let n=0;n<=extension;n++){
    const d=addDays(today,n);
    if(!n&&byDay.has(d))continue;
    if(d<=c.deadline?schedule.has(d):c.guidedVersion===1?isGuidedTrainingDay(projectedConfig,d):weekdays.includes(weekday(d)))future.push(d);
  }
  const finishes:string[]=[];
  let onTime=0;
  for(let path=0;path<paths;path++){
    let state=(0x73513a29+Math.imul(path,0x9e3779b1))>>>0;
    const draw=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const remaining={completed:0,modified:0,skipped:0},rate={completed:0,modified:0,skipped:0};
    function change(status:Activity){
      if(!remaining[status]){
        const pool=gains[status],sample=pool[Math.floor(draw()*pool.length)];
        remaining[status]=sample.visits;rate[status]=sample.change;
      }
      remaining[status]--;return rate[status];
    }
    let progress=0;
    for(const status of postTest)progress+=change(status);
    let hit:string|undefined=progress>=gap-1e-9?today:undefined;
    // Draw short runs of the person's recorded attendance rather than forcing
    // all future visits to be independent or treating unknown slots as skips.
    let cursor=0;
    for(let i=0;!hit&&i<future.length;i++){
      if(i%3===0)cursor=Math.floor(draw()*recent.length);
      progress+=change(recent[cursor]);cursor=(cursor+1)%recent.length;
      if(progress>=gap-1e-9)hit=future[i];
    }
    if(hit){finishes.push(hit);if(hit<=c.deadline)onTime++;}
  }
  finishes.sort();
  const quantile=(q:number)=>finishes[Math.ceil(paths*q)-1]??null;
  const early=quantile(.25),late=quantile(.75);
  return {...support,kind:'ready',probability:onTime/paths,finishDay:quantile(.5),finishRange:early&&late?{early,late}:null,
    throughDay,simulations:paths,lastTestDay};
}
