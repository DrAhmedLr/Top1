import {activeMetrics,type Values,type Demographics} from './registry';
import {valid} from './engine';
import {benchmarkGame,EXTRA_TRAINABLE_GAME_METRICS} from './benchmarkGame';
import type {ScenarioSelection} from './scenarioPlan';
export const gameRoutes=['easier','balanced','ambitious'] as const;
export type GameRoute=typeof gameRoutes[number];
/** Transparent what-if search, never an adaptation rate or time prediction.
 * Recorded physical capacity only. Clinical markers/exposure are held fixed. */
export function gameScenario(values:Values,d:Demographics,targetTop:number,route:GameRoute){
 if(![1,2.5,5,7.5,10,15,20,25,30,35,45,55,65].includes(targetTop))throw new Error('Choose a pyramid tier.');
 const candidates=activeMetrics.filter(m=>(m.scoringEligible||EXTRA_TRAINABLE_GAME_METRICS.has(m.id))&&valid(m,values[m.id]));
 const next={...values},current=benchmarkGame(values,d),reached=()=>{const top=benchmarkGame(next,d).total;return !!top&&top!=='65%+'&&Number.parseFloat(top)<=targetTop;};
 let steps=0;
 const limit=route==='easier'?1:route==='balanced'?2:3;
 const selected=new Set<string>();
 while(!reached()&&steps<250){
  const options=candidates.filter(m=>selected.has(m.id)||selected.size<limit).flatMap(m=>{
   const before=next[m.id]!,delta=['pushups','sit_to_stand'].includes(m.id)?1:m.id==='vo2_max'?1:m.unit==='× BW'||m.unit==='× BW added'?.025:Math.max(.01,Math.abs(values[m.id]!)*.025),value=Number(Math.min(m.max,Math.max(m.min,before+delta*m.polarity)).toFixed(3));
   // Prevent the sandbox from turning modest practice into extreme raw targets.
   const distance=Math.max(Math.abs(values[m.id]!)*.5,delta*5);
   if(value===before||Math.abs(value-values[m.id]!)>distance+1e-6)return [];
   const old=benchmarkGame(next,d).rows.find(r=>r.id===m.id)!.z,newZ=benchmarkGame({...next,[m.id]:value},d).rows.find(r=>r.id===m.id)!.z;
   const gain=newZ-old;if(gain<=1e-8)return [];
   const cost=delta/Math.max(Math.abs(values[m.id]!),1),changed=Math.abs(before-values[m.id]!)/Math.max(Math.abs(values[m.id]!),1);
   const utility=route==='easier'?gain/(cost*m.easiestPathPriority):route==='balanced'?gain/(1+changed*20):gain/(1+changed*5);
   return [{m,value,utility}];
  }).sort((a,b)=>b.utility-a.utility);
  if(!options.length)break;
  const choice=options[0];next[choice.m.id]=choice.value;selected.add(choice.m.id);steps++;
 }
 const targets=[...selected].map(id=>{const m=activeMetrics.find(m=>m.id===id)!;return {id,name:m.name,unit:m.unit,current:values[id]!,target:next[id]!};});
 const goal:ScenarioSelection={modelTarget:50,targets};
 return {route,current:current.total,top:benchmarkGame(next,d).total,reached:reached(),goal,changes:targets.length,effort:targets.reduce((sum,g)=>sum+(g.target-g.current)/Math.max(Math.abs(g.current),1),0),eligibleCount:candidates.length};
}
