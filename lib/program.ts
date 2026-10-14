export const planFocus=['consistency','strength','recovery'] as const;
export type PlanFocus=typeof planFocus[number];
export interface PlanTask{id:string;label:string;days:number[];completed:string[]}
export interface WeeklyPlan{version:1;focus:PlanFocus;tasks:PlanTask[]}
export const emptyPlan=():WeeklyPlan=>({version:1,focus:'consistency',tasks:[]});
export function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function validDay(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(`${s}T12:00:00Z`))&&new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s;}
export function normalizePlan(raw:unknown,editing=false):WeeklyPlan{
 if(!raw||typeof raw!=='object')throw new Error('Invalid plan.');const p=raw as WeeklyPlan;
 if(p.version!==1||!planFocus.includes(p.focus)||!Array.isArray(p.tasks)||p.tasks.length>8)throw new Error('Choose a focus and up to eight actions.');
 const ids=new Set<string>();const tasks=p.tasks.map(t=>{
  if(!t||typeof t.id!=='string'||!/^[a-zA-Z0-9_-]{1,50}$/.test(t.id)||ids.has(t.id))throw new Error('Invalid action ID.');ids.add(t.id);
  if(typeof t.label!=='string'||!editing&&!t.label.trim()||t.label.length>160)throw new Error('Give each action a name of up to 160 characters.');
  if(!Array.isArray(t.days)||!editing&&!t.days.length||t.days.some(d=>!Number.isInteger(d)||d<1||d>7))throw new Error('Choose at least one day for each action.');
  if(!Array.isArray(t.completed)||t.completed.length>366||t.completed.some(d=>typeof d!=='string'||!validDay(d)||d>dayKey(new Date(Date.now()+86400000))))throw new Error('Invalid completion date.');
  return {id:t.id,label:t.label.trim(),days:[...new Set(t.days)].sort(),completed:[...new Set(t.completed)].sort()};
 });return {version:1,focus:p.focus,tasks};
}
export function weekDays(today=new Date()){const monday=new Date(today.getFullYear(),today.getMonth(),today.getDate());monday.setDate(monday.getDate()-((monday.getDay()+6)%7));return Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return dayKey(d);});}
export function planProgress(plan:WeeklyPlan,today=new Date()){const dates=weekDays(today);let total=0,done=0;for(const t of plan.tasks)for(const d of t.days){total++;if(t.completed.includes(dates[d-1]))done++;}return {done,total};}
