import type {MeasurementDetails,MeasurementMethod} from './measurementMetadata';
import {normalizeTimestamp} from './timestamp';
export const countMetrics=new Set(['pushups','sit_to_stand']);
export const labMetrics=new Set(['apob','lpa','fasting_insulin','hscrp','hba1c','homocysteine','cystatin_c','ggt','fasting_glucose']);
export function allowedMethods(id:string):MeasurementMethod[]{
 if(labMetrics.has(id))return ['lab'];
 if(id==='vo2_max')return ['direct_cpet','cooper_estimate','wearable_estimate'];
 if(id==='body_fat')return ['dexa','skinfold_estimate','device'];
 if(id==='visceral_fat')return ['dexa','device'];
 if(id==='grip_strength')return ['dynamometer_single_hand','manual','device'];
 if(['squat_1rm','bench_1rm','deadlift_1rm','pullup_1rm'].includes(id))return ['direct_1rm','epley_estimate','manual'];
 return ['manual','device'];
}
export function observationAge(id:string,d:MeasurementDetails,now=Date.now()){
 if(!d.measuredAt)return {label:'Measurement date unknown',older:false};
 try{normalizeTimestamp(d.measuredAt);}catch{return {label:'Date needs correction',older:false,invalid:true};}
 if(Date.parse(d.measuredAt)>now+300000)return {label:'Future date · correct this observation',older:false,invalid:true};
 const days=Math.max(0,Math.floor((now-Date.parse(d.measuredAt))/86400000));
 const reviewAfter=labMetrics.has(id)?180:['total_sleep','sleep_efficiency','circadian_regularity','sauna_minutes','cold_plunge_minutes'].includes(id)?14:30;
 return {label:days>reviewAfter?`Older observation · ${days} days ago`:`Measured ${days===0?'today':`${days} days ago`}`,older:days>reviewAfter,reviewAfter};
}
