import {metricGameEstimateV10} from './benchmarkGame';
import {calculationValue} from './derivations';
import {valid} from './engine';
import {normalizeMeasurementMetadata, type MeasurementMetadata} from './measurementMetadata';
import {protocolComplete} from './protocols';
import {activeMetrics, type Demographics, type Values} from './registry';
import {TOP_BAND_EDGES} from './topBands';

export const BASELINE_VERSION='balanced-challenge-v1';
export const baselineTests={
 push:['pushups','bench_1rm'],
 pull:['pullups','pullup_1rm'],
 lower:['sit_to_stand','squat_1rm'],
 endurance:['run_5k','vo2_max'],
} as const;
export type BaselineArea=keyof typeof baselineTests;
export const baselineAreas=Object.keys(baselineTests) as BaselineArea[];
export type BaselineSelection=Partial<Record<BaselineArea,{test:string;sex:Demographics['sex']}>>;
const bands=[...TOP_BAND_EDGES.map(edge=>`${edge}%`),'65%+'];
const lifts=new Set<string>(['bench_1rm','squat_1rm','pullup_1rm']);

export function baselineStorageKey(owner:string){return `top1-balanced-baseline-v1:${owner}`;}

export function readBaselineSelection(raw:string|null):BaselineSelection{
 try{
  const saved=JSON.parse(raw??'null');
  if(saved?.version!==BASELINE_VERSION)return {};
  const choices:BaselineSelection={};
  for(const area of baselineAreas){
   const choice=saved.choices?.[area];
   if(choice&&(baselineTests[area] as readonly string[]).includes(choice.test)&&['male','female','unselected'].includes(choice.sex))choices[area]=choice;
  }
  return choices;
 }catch{return {};}
}

export function baselineChallenge(id:string,values:Values,details:MeasurementMetadata,sex:Demographics['sex'],now=Date.now()){
 const metric=activeMetrics.find(item=>item.id===id),value=values[id];
 if(!metric||!valid(metric,value))return null;
 if(!baselineAreas.some(area=>(baselineTests[area] as readonly string[]).includes(id)))return null;
 const raw=details[id];
 if(!raw||raw.invalidContext)return null;
 let ctx;
 try{ctx=normalizeMeasurementMetadata({[id]:raw},{now})[id];}catch{return null;}
 if(!ctx.measuredAt||!ctx.ageAtMeasurement||!ctx.method||!ctx.protocol)return null;
 if(id!=='vo2_max'&&!protocolComplete(id,ctx.protocol))return null;
 if(id==='run_5k'&&ctx.protocol.id!=='run5k_outdoor_gps_v1'&&ctx.protocol.id!=='run5k_outdoor_manual_v1')return null;
 if(id==='vo2_max'&&(ctx.method!=='direct_cpet'||ctx.exerciseMode!=='treadmill'||ctx.protocol.id!=='cpet_treadmill_v1'))return null;
 if(lifts.has(id)){
  if(ctx.method==='direct_1rm'){
   if(ctx.derivation?ctx.derivation.inputs[1]!==1:!ctx.protocol.bodyWeightKg)return null;
  }else if(ctx.method!=='epley_estimate'||!ctx.derivation||ctx.derivation.inputs[1]<2)return null;
  if(ctx.derivation&&Number(calculationValue(ctx.derivation).toFixed(3))!==Number(value.toFixed(3)))return null;
 }
 // If legacy rules change, require an explicit pilot migration before deriving a new level.
 const estimate=metricGameEstimateV10(id,value,{age:ctx.ageAtMeasurement,sex});
 if(!estimate||!bands.includes(estimate.top))return null;
 return {kind:'challenge' as const,version:BASELINE_VERSION,test:id,tier:estimate.top,measuredAt:ctx.measuredAt};
}

export function balancedBaseline(values:Values,details:MeasurementMetadata,choices:BaselineSelection,now=Date.now()){
 const areas=baselineAreas.map(area=>{
  const choice=choices[area];
  const challenge=choice&&(baselineTests[area] as readonly string[]).includes(choice.test)?baselineChallenge(choice.test,values,details,choice.sex,now):null;
  return {area,choice,challenge};
 });
 const coverage=areas.filter(area=>area.challenge).length;
 const weakest=coverage===4?Math.max(...areas.map(area=>bands.indexOf(area.challenge!.tier))):-1;
 return {areas,coverage,overall:weakest<0?null:{kind:'challenge' as const,version:BASELINE_VERSION,tier:bands[weakest],limitingAreas:areas.filter(area=>area.challenge?.tier===bands[weakest]).map(area=>area.area)}};
}
