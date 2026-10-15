import type {WeeklyPlan,PlanTask} from './program';
export interface ScenarioSelection{modelTarget:number;targets:{id:string;name:string;unit:string;current:number;target:number}[]}
/** Add editable routine suggestions, never promise an adaptation rate or overwrite a plan. */
export function addScenarioSteps(plan:WeeklyPlan,goal:ScenarioSelection,labels:(kind:'practice'|'retest'|'review',name:string,target:string)=>string,id:()=>string):WeeklyPlan{
 if(!Number.isFinite(goal.modelTarget)||goal.modelTarget<0||goal.modelTarget>100||!goal.targets.length)throw new Error('Choose an attainable scenario first.');
 const tasks:PlanTask[]=goal.targets.slice(0,2).flatMap(g=>{if(!Number.isFinite(g.current)||!Number.isFinite(g.target)||g.name.length>100)throw new Error('Check the scenario targets.');const target=`${Number(g.target.toFixed(2))} ${g.unit}`;return [{id:id(),label:labels('practice',g.name,target).slice(0,160),days:[1,4],completed:[]},{id:id(),label:labels('retest',g.name,target).slice(0,160),days:[7],completed:[]}];});
 tasks.push({id:id(),label:labels('review','','').slice(0,160),days:[3,6],completed:[]});
 if(plan.tasks.length+tasks.length>8)throw new Error('Make room in your plan before adding scenario steps.');
 return {...plan,tasks:[...plan.tasks,...tasks]};
}
