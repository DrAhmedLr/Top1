import {activeMetrics,type Values,type Demographics,type PillarId} from './registry';
import {valid,clamp} from './engine';
import {getMetricCohortNorm} from './demographics';
import {illustrativeTop} from './gameStanding';
export const EXTRA_TRAINABLE_GAME_METRICS=new Set(['zone2_power','grip_combined','sprint_10m']);
/** Entertainment layer only. These anchors are product assumptions, not
 * population norms, clinical targets or a universal scientific consensus.
 * Never used in the scientific engine, signed reports or training optimizer. */
export function metricGameEstimate(id:string,value:number,d:Demographics){
 const m=activeMetrics.find(m=>m.id===id);if(!m||!valid(m,value))return null;
 let mean=m.mean,sd=m.sd;
 try{const r=getMetricCohortNorm(id,d);mean=r.mean;sd=r.stdDev;}catch{}
 const overrides:Record<string,[number,number]>={grip_combined:[d.sex==='female'?56:95,20],sprint_10m:[2.2,.35],waist_height_ratio:[.5,.08],fasting_glucose:[95,15],sauna_minutes:[60,30],cold_plunge_minutes:[10,5]};
 if(overrides[id])[mean,sd]=overrides[id];
 // Prevent endlessly rewarding lower clinical readings, extreme body leanness,
 // sleep duration or thermal exposure. Plateaus are disclosed game policies.
 const plateaus:Record<string,[number,number]>={total_sleep:[420,540],body_fat:d.sex==='female'?[20,30]:[12,22],bp_systolic:[110,125],rhr:[50,65],hba1c:[4.8,5.6],fasting_glucose:[75,99],cystatin_c:[.7,1],fasting_insulin:[3,8],homocysteine:[5,10],waist_height_ratio:[.4,.5],sauna_minutes:[0,90],cold_plunge_minutes:[0,15]};
 const range=plateaus[id];
 const neutral=['sauna_minutes','cold_plunge_minutes','thermal_hrv_rebound'].includes(id);
 const z=neutral?0:range?1-Math.max(range[0]-value,0,value-range[1])**2/sd**2:m.polarity*(value-mean)/sd;
 return {z:clamp(z,-3,3),top:illustrativeTop(clamp(z,-3,3))!};
}
export function benchmarkGame(values:Values,d:Demographics){
 const rows=activeMetrics.flatMap(m=>{const x=values[m.id];if(!valid(m,x))return [];const estimate=metricGameEstimate(m.id,x,d);return estimate?[{id:m.id,pillar:m.pillar,...estimate}]:[];});
 const sections=Object.fromEntries((['bodymarkers','strength','recovery'] as PillarId[]).map(p=>{const group=rows.filter(r=>r.pillar===p);return [p,group.length?illustrativeTop(group.reduce((s,r)=>s+r.z,0)/group.length):null];})) as Record<PillarId,string|null>;
 const groups=(['bodymarkers','strength','recovery'] as PillarId[]).map(p=>rows.filter(r=>r.pillar===p)).filter(g=>g.length);
 return {rows,sections,total:groups.length?illustrativeTop(groups.reduce((s,g)=>s+g.reduce((n,r)=>n+r.z,0)/g.length,0)/groups.length):null};
}
