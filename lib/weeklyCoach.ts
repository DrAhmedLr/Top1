import {EXTRA_TRAINABLE_GAME_METRICS} from './benchmarkGame';
import {activeMetrics,type Values} from './registry';
import {valid} from './engine';
import type {ScenarioSelection} from './scenarioPlan';
import {completedOn,scheduledTasks,type RoutineTimeline} from './routineHistory';
import type {WeeklyPlan} from './program';
export interface CoachPreferences {days:number[];minutes:number;experience:'starting'|'regular';readiness:'normal'|'easy'}
export const defaultCoachPreferences=():CoachPreferences=>({days:[1,4],minutes:20,experience:'starting',readiness:'normal'});
export function normalizeCoachPreferences(raw:unknown):CoachPreferences{
 const p=raw as CoachPreferences;
 if(!p||!Array.isArray(p.days)||p.days.length<1||p.days.length>3||new Set(p.days).size!==p.days.length||p.days.some(d=>!Number.isInteger(d)||d<1||d>7)||![10,20,30,45].includes(p.minutes)||!['starting','regular'].includes(p.experience)||!['normal','easy'].includes(p.readiness))throw new Error('Choose one to three days and a session length.');
 return {...p,days:[...p.days].sort()};
}
/** Dated schedule + latest check-in, not raw event counts or future actions. */
export function recentAdherence(history:RoutineTimeline,today:string){
 let due=0,done=0;
 for(let i=1;i<=14;i++){
  const day=new Date(Date.parse(`${today}T12:00:00Z`)-i*86400000).toISOString().slice(0,10),weekday=((new Date(`${day}T12:00:00Z`).getUTCDay()+6)%7)+1;
  for(const task of scheduledTasks(history,day).filter(t=>t.days.includes(weekday))){due++;if(completedOn(history,task.id,day))done++;}
 }
 return {due,done,ratio:due?done/due:null};
}
const strength=new Set(['pushups','bench_1rm','squat_1rm','deadlift_1rm','pullup_1rm','grip_strength','grip_combined','farmers_carry']);
export function weeklyCoach(goal:ScenarioSelection,values:Values,raw:CoachPreferences,history:RoutineTimeline,today:string){
 const prefs=normalizeCoachPreferences(raw),adherence=recentAdherence(history,today),ease=prefs.readiness==='easy'||adherence.due>=4&&adherence.ratio!<.6;
 // No automatic increase from checking boxes. User chooses the next workload.
 const minutes=ease?Math.min(20,prefs.minutes):prefs.minutes;
 const targets=goal.targets.flatMap(g=>{
  const m=activeMetrics.find(m=>m.id===g.id),current=values[g.id];
  if(!m||(!m.scoringEligible&&!EXTRA_TRAINABLE_GAME_METRICS.has(m.id))||!valid(m,current)||!valid(m,g.target)||!valid(m,g.current))return [];
  const gap=(g.target-g.current)*m.polarity;if(gap<=0)return [];
  const reached=(current-g.target)*m.polarity>=0,progress=Math.max(0,Math.min(100,100*(current-g.current)/(g.target-g.current)));
  const kind=strength.has(g.id)?'strength':['vo2_max','zone2_power'].includes(g.id)?'aerobic':['cmj','broad_jump'].includes(g.id)?'power':'skill';
  return [{...g,name:m.name,unit:m.unit,current,baseline:g.current,reached,progress,kind}];
 }).sort((a,b)=>a.progress-b.progress);
 // Rotate the second weekly slot rather than doubling every target's sessions.
 const selected=targets.filter(g=>!g.reached).slice(0,2);
 const days=prefs.days.filter((d,i,all)=>!i||d-all[i-1]>1);
 if(days.length>1&&days[0]===1&&days.at(-1)===7)days.pop();
 return {prefs,adherence,ease,minutes,targets,selected,days,allReached:targets.length>0&&targets.every(g=>g.reached)};
}
export function appendCoachPlan(plan:WeeklyPlan,coach:ReturnType<typeof weeklyCoach>,label:(kind:string,name:string,minutes:number)=>string,id:()=>string):WeeklyPlan{
 if(!coach.selected.length)throw new Error('Update your measurements or choose a new scenario first.');
 const tasks=coach.selected.map(g=>({id:`coach-${g.id}`,label:label(g.id,g.name,coach.selected.length>1?Math.max(5,Math.floor(coach.minutes/2)):coach.minutes).slice(0,160),days:coach.days,completed:plan.tasks.find(t=>t.id===`coach-${g.id}`)?.completed??[]}));
 tasks.push({id:'coach-review',label:label('review','',coach.minutes).slice(0,160),days:[7],completed:plan.tasks.find(t=>t.id==='coach-review')?.completed??[]});
 const preserved=plan.tasks.filter(t=>!t.id.startsWith('coach-'));
 if(preserved.length+tasks.length>8)throw new Error('Make room in your plan before adding scenario steps.');
 return {...plan,tasks:[...preserved,...tasks]};
}
