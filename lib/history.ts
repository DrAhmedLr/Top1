import {metrics,type Values} from './registry';
import {countMetrics} from './measurementRules';
import {normalizeMeasurementMetadata,type MeasurementMetadata,type MeasurementMethod,type ExerciseMode} from './measurementMetadata';
export interface Observation{id:string;sequence?:number;metricId:string;value:number|null;cleared:boolean;recordedAt:string;measuredAt?:string;method?:MeasurementMethod;exerciseMode?:ExerciseMode}
export function observationDate(o:Observation){return o.cleared?o.recordedAt:o.measuredAt??o.recordedAt;}
export function comparableDelta(entries:Observation[],now=Date.now()){
 const recent=entries.slice().sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt));if(recent[0]?.cleared)return null;
 const observations=entries.filter(o=>!o.cleared&&o.value!==null).sort((a,b)=>Date.parse(observationDate(b))-Date.parse(observationDate(a))),latest=observations[0];
 const usable=(o:Observation)=>{const metric=metrics.find(m=>m.id===o.metricId);if(!metric||!o.method||!o.measuredAt||!Number.isFinite(o.value)||o.value!<metric.min||o.value!>metric.max||countMetrics.has(o.metricId)&&!Number.isInteger(o.value))return false;try{normalizeMeasurementMetadata({[o.metricId]:{method:o.method,measuredAt:o.measuredAt,exerciseMode:o.exerciseMode}},{now});return o.metricId!=='vo2_max'||o.method!=='direct_cpet'||!!o.exerciseMode;}catch{return false;}};
 if(!latest||!usable(latest))return null;
 const previous=observations.slice(1).find(o=>usable(o)&&o.metricId===latest.metricId&&o.method===latest.method&&o.exerciseMode===latest.exerciseMode&&Date.parse(o.measuredAt!)<Date.parse(latest.measuredAt!));
 return previous?{change:latest.value!-previous.value!,previous,latest}:null;
}
export function historyChanges(before:Values,after:Values,previousDetails:MeasurementMetadata,details:MeasurementMetadata,recordedAt:string):Omit<Observation,'id'>[]{
 return metrics.flatMap(m=>{const a=before[m.id],b=after[m.id],detail=details[m.id];if(a===b&&JSON.stringify(previousDetails[m.id]??{})===JSON.stringify(detail??{}))return [];if(b===undefined&&a===undefined)return [];if(b!==undefined&&!Number.isFinite(b))return [];
 return [{metricId:m.id,value:b??null,cleared:b===undefined,recordedAt,measuredAt:detail?.measuredAt,method:detail?.method,exerciseMode:detail?.exerciseMode}];});
}
export function readGuestHistory(raw:string|null):Observation[]{try{const p=JSON.parse(raw??'null');if(p?.version!==1||!Array.isArray(p.entries))return [];return p.entries.filter((e:Observation)=>e&&typeof e.id==='string'&&metrics.some(m=>m.id===e.metricId)&&Number.isFinite(Date.parse(e.recordedAt))&&(e.value===null||typeof e.value==='number'&&Number.isFinite(e.value)));}catch{return [];}}

export function validGuestHistory(raw:string|null){try{if(!raw)return true;const p=JSON.parse(raw);return p?.version===1&&Array.isArray(p.entries)&&p.entries.length===readGuestHistory(raw).length;}catch{return false;}}
