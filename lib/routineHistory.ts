import {dayKey,weekDays,normalizePlan,type WeeklyPlan,type PlanTask,validDay} from './program';
export interface ScheduleRevision{effectiveFrom:string;timeZone:string;tasks:Pick<PlanTask,'id'|'label'|'days'>[]}
export interface CompletionEvent{id:string;date:string;taskId:string;label:string;completed:boolean;recordedAt:string;legacy?:boolean}
export interface RoutineTimeline{schedules:ScheduleRevision[];completions:CompletionEvent[]}
export const emptyTimeline=():RoutineTimeline=>({schedules:[],completions:[]});
export function dayInZone(timeZone:string,date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-');
}
export function tomorrow(day:string){if(!validDay(day))throw new Error('Invalid calendar day.');return new Date(Date.parse(`${day}T12:00:00Z`)+86400000).toISOString().slice(0,10);}
export function scheduledTasks(timeline:RoutineTimeline,day:string){return timeline.schedules.filter(s=>s.effectiveFrom<=day).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)).at(-1)?.tasks??[];}
export function completedOn(timeline:RoutineTimeline,taskId:string,day:string){return timeline.completions.filter(e=>e.taskId===taskId&&e.date===day).at(-1)?.completed??false;}
export function routineProgress(timeline:RoutineTimeline,today:string){
 const dates=weekDays(new Date(`${today}T12:00:00`));let done=0,due=0,target=0,unknownDays=0;
 for(const date of dates){const weekday=((new Date(`${date}T12:00:00`).getDay()+6)%7)+1;
  if(!timeline.schedules.some(s=>s.effectiveFrom<=date)){if(date<=today)unknownDays++;continue;}
  for(const task of scheduledTasks(timeline,date).filter(t=>t.days.includes(weekday))){target++;if(date<=today){due++;if(completedOn(timeline,task.id,date))done++;}}
 }return {done,due,target,unknownDays};
}
export function normalizeTimeline(raw:unknown):RoutineTimeline{
 if(!raw||typeof raw!=='object')throw new Error('Invalid routine history.');const h=raw as RoutineTimeline;
 if(!Array.isArray(h.schedules)||!Array.isArray(h.completions))throw new Error('Invalid routine history.');
 const schedules=h.schedules.map(s=>{if(!s||!validDay(s.effectiveFrom)||typeof s.timeZone!=='string')throw new Error('Invalid schedule date.');dayInZone(s.timeZone);const tasks=normalizePlan({version:1,focus:'consistency',tasks:s.tasks.map(t=>({...t,completed:[]}))}).tasks.map(({id,label,days})=>({id,label,days}));return {effectiveFrom:s.effectiveFrom,timeZone:s.timeZone,tasks};});
 const ids=new Set<string>();const completions=h.completions.map(e=>{if(!e||typeof e.id!=='string'||ids.has(e.id)||!validDay(e.date)||typeof e.taskId!=='string'||typeof e.label!=='string'||typeof e.completed!=='boolean'||!Number.isFinite(Date.parse(e.recordedAt)))throw new Error('Invalid completion history.');ids.add(e.id);return {...e};});
 return {schedules,completions};
}
/** Local equivalent of the server's versioned routine: schedule edits start
 * tomorrow; completion events are independent of editable/removed actions. */
export function recordRoutine(previous:WeeklyPlan|null,next:WeeklyPlan,timeline:RoutineTimeline,day:string,timeZone:string,completion?:{taskId:string;completed:boolean},now=new Date().toISOString()){
 const valid=normalizePlan(next),history=normalizeTimeline(timeline),tasks=valid.tasks.map(({id,label,days})=>({id,label,days}));
 if(!history.schedules.length){
  const baseline=previous?.tasks.length?previous:valid;
  history.schedules.push({effectiveFrom:day,timeZone,tasks:baseline.tasks.map(({id,label,days})=>({id,label,days}))});
  for(const t of previous?.tasks??[])for(const date of t.completed)history.completions.push({id:crypto.randomUUID(),date,taskId:t.id,label:t.label,completed:true,recordedAt:now,legacy:true});
 }
 const latest=history.schedules.at(-1)!;
 if(JSON.stringify(latest.tasks)!==JSON.stringify(tasks)){
  const effectiveFrom=tomorrow(day);const revision={effectiveFrom,timeZone,tasks};
  if(latest.effectiveFrom===effectiveFrom)history.schedules[history.schedules.length-1]=revision;else history.schedules.push(revision);
 }
 if(completion){const weekday=((new Date(`${day}T12:00:00`).getDay()+6)%7)+1,t=scheduledTasks(history,day).find(t=>t.id===completion.taskId&&t.days.includes(weekday));if(!t)throw new Error('This action is not scheduled today.');if(completedOn(history,t.id,day)!==completion.completed)history.completions.push({id:crypto.randomUUID(),date:day,taskId:t.id,label:t.label,completed:completion.completed,recordedAt:now});}
 return {plan:valid,timeline:history};
}
