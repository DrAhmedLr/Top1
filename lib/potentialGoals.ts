import {activeMetrics,type Values,type Demographics} from './registry';
import {valid} from './engine';
import {benchmarkGame,metricGameEstimate} from './benchmarkGame';
import {gameScenario} from './gameScenarios';
import {TOP_BAND_EDGES} from './topBands';
export type GoalBoardState={version:1;targetTop:number;ids:string[];targets:Record<string,number>};
const homeFirst=['pushups','total_sleep','single_leg_balance','sit_to_stand','waist_height_ratio','rhr','hrv'];
export function goalChoices(values:Values,d:Demographics,targetTop:number){
 const suggested=gameScenario(values,d,targetTop,'ambitious').goal.targets.map(g=>g.id);
 return [...new Set([...suggested,...activeMetrics.filter(m=>valid(m,values[m.id])).map(m=>m.id),...homeFirst,...activeMetrics.map(m=>m.id)])];
}
export function rotateGoals(ids:string[],choices:string[],slot?:number){
 const next=[...ids];
 if(slot!==undefined){if(slot<0||slot>=ids.length)return next;const start=choices.indexOf(ids[slot]);const candidate=Array.from({length:choices.length},(_,i)=>choices[(start+i+1)%choices.length]).find(id=>!ids.includes(id));if(candidate)next[slot]=candidate;return next;}
 // Prefer an entirely new set; all metrics remain available through each card.
 const start=choices.indexOf(ids.at(-1)??'');const alternatives=Array.from({length:choices.length},(_,i)=>choices[(start+i+1)%choices.length]).filter(id=>!ids.includes(id));return [...alternatives,...ids].slice(0,3);
}
export function normalizeGoalBoard(raw:unknown):GoalBoardState|null{
 if(!raw||typeof raw!=='object')return null;const state=raw as GoalBoardState;
 if(state.version!==1||!TOP_BAND_EDGES.some(n=>n===state.targetTop)||!Array.isArray(state.ids)||state.ids.length!==3||new Set(state.ids).size!==3||state.ids.some(id=>!activeMetrics.some(m=>m.id===id)))return null;
 const targets:Record<string,number>={};for(const id of state.ids){const m=activeMetrics.find(m=>m.id===id)!;const value=state.targets?.[id];if(valid(m,value))targets[id]=value;}
 return {version:1,targetTop:state.targetTop,ids:state.ids,targets};
}
export function objectiveFor(id:string,values:Values,d:Demographics,targetTop:number,custom?:number){
 const metric=activeMetrics.find(m=>m.id===id);if(!metric)return null;
 const current=values[id];if(!valid(metric,current))return {metric,current:undefined,target:undefined,currentTop:null,targetTop:null,achieved:false};
 // Reuse the bounded what-if model; baseline-less cards never acquire an invented value.
 const suggested=gameScenario({[id]:current},d,targetTop,'easier').goal.targets.find(g=>g.id===id)?.target??current;
 const target=valid(metric,custom)?custom:suggested,currentEstimate=metricGameEstimate(id,current,d),targetEstimate=metricGameEstimate(id,target,d);
 return {metric,current,target,currentTop:currentEstimate?.top??null,targetTop:targetEstimate?.top??null,achieved:!!currentEstimate&&!!targetEstimate&&currentEstimate.z>=targetEstimate.z-1e-8};
}
export function goalProjection(ids:string[],targets:Record<string,number>,values:Values,d:Demographics,targetTop:number){
 const projected={...values};for(const id of ids){const goal=objectiveFor(id,values,d,targetTop,targets[id]);if(goal?.target!==undefined)projected[id]=goal.target;}
 return benchmarkGame(projected,d).total;
}
