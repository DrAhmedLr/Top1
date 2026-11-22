import type {Demographics} from './registry';
export const FIELD_BENCHMARK_METRICS=new Set(['pullups','sprint_400m','dead_hang','body_fat','run_5k']);
export type BenchmarkPoint={value:number;top:number;estimated:boolean};
export const FIELD_SOURCES={
 run_5k:'https://github.com/DrAhmedLr/Top1/blob/main/lib/fieldBenchmarks.ts',
 pullups:'https://strengthlevel.com/strength-standards/pull-ups',
 sprint_400m:'https://runninglevel.com/running-times/400m-times',
 body_fat:'https://download.tomtom.com/open/manuals/band/html/en-us/ACEBodyCompositionPercentageChart-Ibiza.htm',
 dead_hang:'https://mtntactical.com/research/mini-study-results-mti-finds-no-perfect-grip-test-for-tactical-athletes/',
} as const;
// Strength Level: community-wide repetitions, not a representative population.
// Female Beginner/Novice are both <1; retain only the unambiguous 0 / P20 anchor.
const pullups={male:[[1,95],[7,80],[13,50],[21,20],[30,5]],female:[[0,80],[6,50],[12,20],[19,5]]};
export function fieldBenchmark(id:string,d:Demographics){
 if(!FIELD_BENCHMARK_METRICS.has(id))return null;
 const sex=d.sex==='female'?'female':'male',neutral=d.sex==='unselected';
 let points:BenchmarkPoint[];
 if(id==='run_5k'){
  points=[[12,1],[20,1],[21,2.5],[22.5,5],[25,10],[30,30],[35,50],[45,80],[60,100]].map(([value,top])=>({value,top,estimated:true}));
 }else if(id==='sprint_400m'){
  points=[[40,1],[50,1],[54,2.5],[57,5],[60,7.5],[75,25],[90,50],[120,80],[180,100]].map(([value,top])=>({value,top,estimated:true}));
 }else if(id==='body_fat'){
  points=[[3,1],[17,1],[20,10],[25,30],[30,55],[40,80],[60,100]].map(([value,top])=>({value,top,estimated:true}));
 }else if(id==='dead_hang'){
  // Deliberate product thresholds. Neither small study estimates these percentiles.
  points=[[0,100],[30,80],[45,50],[60,35],[90,15],[120,5],[150,2.5],[180,1]].map(([value,top])=>({value,top,estimated:true}));
 }else if(id==='pullups'){
  const rows=neutral?[[0,95],[3.5,80],[9.5,50],[16.5,20],[24.5,5]]:pullups[sex];
  points=rows.map(([value,top])=>({value,top,estimated:neutral}));
 }else{return null;}
 if(id==='pullups'){
  // Linear continuation of the P80-to-P95 performance gap to model P99.
  // Top 1% is extrapolated, never a published source cutoff.
  const a=points.at(-2)!,b=points.at(-1)!;
  points.push({value:b.value+(b.value-a.value)*4/15,top:1,estimated:true});
 }
 if(id==='run_5k')return {source:FIELD_SOURCES.run_5k,basis:'TOP1 challenge standard',cohort:'Fixed TOP1 scale · no age or sex adjustment',points,assumptions:'TOP1 challenge scale: 20:00 for 5 km = Top 1%, 21:00 = Top 2.5%, 22:30 = Top 5%, 25:00 = Top 10%. These are product-defined difficulty tiers, not observed world percentiles. Old 10 km results are preserved separately.'};
 if(id==='sprint_400m'||id==='body_fat')return {source:FIELD_SOURCES[id],basis:'TOP1 challenge standard',cohort:'Fixed TOP1 scale · no age or sex adjustment',points,assumptions:id==='sprint_400m'?'TOP1 challenge scale: 60 s = Top 7.5%, 57 s = Top 5%, 54 s = Top 2.5%, 50 s = Top 1%. These are product-defined difficulty tiers, not observed population percentiles. Faster times receive higher game credit.':'TOP1 challenge scale: 17% body fat or below = Top 1%. Lower values receive no additional credit. This is a game rule, not a health target, an athletic-performance measurement or a population percentile. Appropriate body-fat ranges differ by sex and measurement method. This rule does not enter the scientific capacity score.'};
 return {source:FIELD_SOURCES[id as keyof typeof FIELD_SOURCES],basis:id==='dead_hang'?'TOP1 benchmark assumptions':'Community benchmark estimate',
  cohort:id==='dead_hang'?'TOP1 scale · same thresholds for everyone':neutral?'Neutral reference · equal blend of male and female anchors':id==='pullups'?(sex==='male'?'Male lifter community · no age adjustment':'Female lifter community · no age adjustment'):(sex==='male'?'Male runner community · age-adjusted estimate':'Female runner community · age-adjusted estimate'),points,
  assumptions:id==='dead_hang'?'TOP1 sets 45 s at Top 50%, 120 s at Top 5% and 180 s at Top 1%. These are product assumptions informed by small hanging studies, not measured population percentiles. No age or sex adjustment.':'Source ability levels map to Top 95%, 80%, 50%, 20% and 5%. TOP1 interpolates between anchors and extrapolates the upper tail to Top 1%. These self-selected communities are not the world population. Pull-ups have no age or body-weight adjustment; An unspecified sex uses an equal blend, not an observed mixed cohort.'};
}
export function fieldBenchmarkPercent(id:string,value:number,d:Demographics){
 const ref=fieldBenchmark(id,d);if(!ref||!Number.isFinite(value))return null;
 const points=[...ref.points].sort((a,b)=>a.value-b.value);
 const i=points.findIndex(p=>p.value>=value);
 const a=i<0?points.at(-2)!:i===0?points[0]:points[i-1],b=i<0?points.at(-1)!:i===0?points[1]:points[i];
 // Below/above source range uses the nearest segment; clamp display to [1,100].
 return Math.max(1,Math.min(100,a.top+(value-a.value)/(b.value-a.value)*(b.top-a.top)));
}
/** Invert the documented anchor segments for reviewable displayed targets. */
export function fieldBenchmarkTarget(id:string,top:number,d:Demographics){
 const ref=fieldBenchmark(id,d);if(!ref)return null;
 const pts=[...ref.points].sort((a,b)=>a.top-b.top),i=pts.findIndex(p=>p.top>=top);
 const a=i<0?pts.at(-2)!:i===0?pts[0]:pts[i-1],b=i<0?pts.at(-1)!:i===0?pts[1]:pts[i];
 if(a.top===b.top)return b.value;
 return a.value+(top-a.top)/(b.top-a.top)*(b.value-a.value);
}
