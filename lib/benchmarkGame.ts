import {activeMetrics,type Values,type Demographics,type PillarId} from './registry';
import {valid,clamp,inverseCdf} from './engine';
import {getMetricCohortNorm} from './demographics';
import {run10kPercent} from './run10kReference';
import {TOP_BAND_EDGES} from './topBands';
import {fieldBenchmarkPercent} from './fieldBenchmarks';
import {illustrativeTop} from './gameStanding';
import {performanceTier} from './performanceTiers';
import {PERFORMANCE_RULES,PERFORMANCE_RULES_VERSION,performanceGamePercent} from './performanceRules';
export const BENCHMARK_GAME_VERSION='12-performance-v3';
export function metricGameVersion(id:string){return Object.hasOwn(PERFORMANCE_RULES,id)?PERFORMANCE_RULES_VERSION+'/'+id:'10-three-levels';}
export const CONTEXT_GAME_METRICS=new Set(['apob','lpa','fasting_insulin','hscrp','hba1c','homocysteine','cystatin_c','ggt','fasting_glucose','bp_systolic','hrr_1min','zone2_power','sleep_efficiency','circadian_regularity','reaction_time']);
export const EXTRA_TRAINABLE_GAME_METRICS=new Set(['total_sleep']);
/** Entertainment layer only. These anchors are product assumptions, not
 * population norms, clinical targets or a universal scientific consensus.
 * Never used in the scientific engine, signed reports or training optimizer. */
export function metricGameEstimate(id:string,value:number,d:Demographics){
 if(!Object.hasOwn(PERFORMANCE_RULES,id))return metricGameEstimateV10(id,value,d);
 const modelTopPercent=performanceGamePercent(id,value,d);
 if(modelTopPercent===null)return null;
 // Older aggregate/scenario consumers expect a standardized value in [-3,3].
 // Current individual challenges use the full practical ladder down to 0.01%.
 const rawZ=-inverseCdf(Math.min(1-1e-12,modelTopPercent/100));
 return {z:clamp(rawZ+1e-9,-3,3),rawZ,ceiling:3,top:performanceTier(modelTopPercent),modelTopPercent};
}

/** Frozen scorer used by the versioned four-area pilot. */
export function metricGameEstimateV10(id:string,value:number,d:Demographics){
 if(CONTEXT_GAME_METRICS.has(id))return null;
 const m=activeMetrics.find(m=>m.id===id);if(!m||!valid(m,value))return null;
 // Evaluate exactly the value that survives a profile save and reload.
 value=Number(value.toFixed(3));
 const fieldPercent=fieldBenchmarkPercent(id,value,d);
 if(fieldPercent!==null){const p=fieldPercent,z=p<=1?3:clamp(inverseCdf(1-Math.min(99.9,p)/100)+1e-9,-3,3);return {z,top:p>65?'65%+':`${TOP_BAND_EDGES.find(edge=>edge>=p-1e-8)??65}%`,ceiling:3,rawZ:z};}
 if(id==='run_10k'){const p=run10kPercent(value,d),z=p<=1?3:clamp(inverseCdf(1-Math.min(99.9,p)/100)+1e-9,-3,3);return {z,top:p>65?'65%+':`${TOP_BAND_EDGES.find(edge=>edge>=p-1e-8)??65}%`,ceiling:3,rawZ:z};}
 let mean=m.mean,sd=m.sd;
 try{const r=getMetricCohortNorm(id,d);mean=r.mean;sd=r.stdDev;}catch{}
 const overrides:Record<string,[number,number]>={grip_combined:[d.sex==='female'?56:95,20],sprint_10m:[2.2,.35],waist_height_ratio:[.5,.08],fasting_glucose:[95,15]};
 if(overrides[id])[mean,sd]=overrides[id];
 // Prevent endlessly rewarding lower clinical readings, extreme body leanness,
 // sleep duration or thermal exposure. Plateaus are disclosed game policies.
 const plateaus:Record<string,[number,number]>={total_sleep:[420,540],body_fat:d.sex==='female'?[20,30]:[12,22],bp_systolic:[110,125],rhr:[50,65],hba1c:[4.8,5.6],fasting_glucose:[75,99],cystatin_c:[.7,1],fasting_insulin:[3,8],homocysteine:[5,10],waist_height_ratio:[.4,.5]};
 const range=plateaus[id];
 const z=range?1-Math.max(range[0]-value,0,value-range[1])**2/sd**2:m.polarity*(value-mean)/sd;
 // Each metric reaches full game credit at its own attainable ceiling.
 // A useful plateau is fully credited without rewarding more extreme values.
 const ceiling=range?1:Math.min(3,m.polarity*((m.polarity===1?m.max:m.min)-mean)/sd);
 if(ceiling<=0)return null;
 const normalized=clamp(z/ceiling*3,-3,3);
 return {z:normalized,top:illustrativeTop(normalized)!,ceiling,rawZ:z};
}
export function benchmarkGame(values:Values,d:Demographics){
 const rows=activeMetrics.flatMap(m=>{const x=values[m.id];if(!valid(m,x))return [];const estimate=metricGameEstimate(m.id,x,d);return estimate?[{id:m.id,pillar:m.pillar,...estimate}]:[];});
 const sections=Object.fromEntries((['bodymarkers','strength','recovery'] as PillarId[]).map(p=>{const group=rows.filter(r=>r.pillar===p);return [p,group.length?illustrativeTop(group.reduce((s,r)=>s+r.z,0)/group.length):null];})) as Record<PillarId,string|null>;
 const groups=(['bodymarkers','strength','recovery'] as PillarId[]).map(p=>rows.filter(r=>r.pillar===p)).filter(g=>g.length);
 return {rows,sections,total:groups.length?illustrativeTop(groups.reduce((s,g)=>s+g.reduce((n,r)=>n+r.z,0)/g.length,0)/groups.length):null};
}
