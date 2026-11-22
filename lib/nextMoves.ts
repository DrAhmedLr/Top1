import {activeMetrics,type Values,type Demographics} from './registry';
import {valid} from './engine';
import {challengeProgress,COMPETITIVE_CHALLENGE_METRICS} from './challengeProgress';

// These are nearby game thresholds, not estimates of training effort or health benefit.
export function nextMoves(values:Values,d:Demographics){
 const measured=activeMetrics.flatMap(metric=>{
  if(!COMPETITIVE_CHALLENGE_METRICS.has(metric.id))return [];
  const current=values[metric.id];if(!valid(metric,current))return [];
  const next=challengeProgress(metric.id,current,d)?.next;
  return next?[{metric,current,target:next.value,tier:next.tier,gap:Math.abs(next.delta)/Math.max(Math.abs(current),1)}]:[];
 }).sort((a,b)=>a.gap-b.gap).slice(0,3);
 const occupied=new Set(measured.map(m=>m.metric.id));
 const starters=['pushups','broad_jump','run_5k'].filter(id=>!occupied.has(id)&&!valid(activeMetrics.find(m=>m.id===id)!,values[id])).map(id=>({metric:activeMetrics.find(m=>m.id===id)!,current:undefined,target:undefined,tier:null,gap:Infinity}));
 return [...measured,...starters].slice(0,3);
}
