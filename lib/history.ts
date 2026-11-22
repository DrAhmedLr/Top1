import {metrics,type Values} from './registry';
import {countMetrics} from './measurementRules';
import {normalizeMeasurementMetadata,type MeasurementMetadata,type MeasurementMethod,type ExerciseMode} from './measurementMetadata';
import {protocolOptions,protocolComplete,protocolKey,type MeasurementProtocol,type ObservationWindow} from './protocols';
import type {CalculationDerivation} from './derivations';
import {epley} from './derivations';
export interface Observation{id:string;sequence?:number;metricId:string;value:number|null;cleared:boolean;recordedAt:string;measuredAt?:string;method?:MeasurementMethod;exerciseMode?:ExerciseMode;protocol?:MeasurementProtocol;window?:ObservationWindow;derivation?:CalculationDerivation;referenceContext?:Record<string,unknown>;ageAtMeasurement?:number;source?:string}
export function observationDate(o:Observation){return o.cleared?o.recordedAt:o.measuredAt&&Number.isFinite(Date.parse(o.measuredAt))?o.measuredAt:o.recordedAt;}
export function absoluteLiftChange(previous:Observation,latest:Observation){
 const a=previous.derivation,b=latest.derivation;if(!a||!b||a.formula!==b.formula||!['epley_ratio_v1','pullup_ratio_v1'].includes(a.formula))return null;
 try{const absolute=(d:CalculationDerivation)=>d.formula==='pullup_ratio_v1'?epley(d.inputs[0]+d.bodyWeightKg!,d.inputs[1]):epley(d.inputs[0],d.inputs[1]);return {changeKg:absolute(b)-absolute(a),kind:a.formula==='pullup_ratio_v1'?'estimated total system load':'estimated lifted load'};}catch{return null;}
}
function usable(o:Observation,now:number){const metric=metrics.find(m=>m.id===o.metricId);if(!metric||!o.method||!o.measuredAt||!Number.isFinite(o.value)||o.value!<metric.min||o.value!>metric.max||countMetrics.has(o.metricId)&&!Number.isInteger(o.value)||protocolOptions[o.metricId]&&!protocolComplete(o.metricId,o.protocol))return false;try{normalizeMeasurementMetadata({[o.metricId]:{method:o.method,measuredAt:o.measuredAt,exerciseMode:o.exerciseMode,protocol:o.protocol,window:o.window}},{now});return o.metricId!=='vo2_max'||o.method!=='direct_cpet'||!!o.exerciseMode;}catch{return false;}}
function newestSave(a:Observation,b:Observation){
 return (b.sequence??0)-(a.sequence??0)||Date.parse(b.recordedAt)-Date.parse(a.recordedAt)||b.id.localeCompare(a.id);
}
function orderedObservations(entries:Observation[]){
 const saves=entries.slice().sort(newestSave);
 const clearedAt=saves.findIndex(entry=>entry.cleared);
 const current=clearedAt<0?saves:saves.slice(0,clearedAt);
 return current.filter(entry=>entry.value!==null).sort((a,b)=>Date.parse(observationDate(b))-Date.parse(observationDate(a))||newestSave(a,b));
}
export function comparableDelta(entries:Observation[],now=Date.now()){
 return comparisonFrom(orderedObservations(entries),now);
}
function comparisonFrom(observations:Observation[],now:number){
 const latest=observations[0];
 if(!latest||!usable(latest,now))return null;
 const previous=observations.slice(1).find(o=>usable(o,now)&&o.metricId===latest.metricId&&o.method===latest.method&&o.exerciseMode===latest.exerciseMode&&protocolKey(o.protocol)===protocolKey(latest.protocol)&&windowKey(o.window)===windowKey(latest.window)&&(!latest.window||!o.window||Date.parse(o.window.end)<=Date.parse(latest.window.start))&&Date.parse(o.measuredAt!)<Date.parse(latest.measuredAt!));
 return previous?{change:latest.value!-previous.value!,previous,latest}:null;
}
export function personalBest(entries:Observation[],reference:Observation|undefined,now=Date.now()){
 if(!reference||!usable(reference,now))return undefined;
 const metric=metrics.find(m=>m.id===reference.metricId);
 if(metric?.pillar!=='strength'||metric.scoringType==='bounded')return undefined;
 const setup=(entry:Observation)=>JSON.stringify([entry.method,entry.exerciseMode,protocolKey(entry.protocol),windowKey(entry.window)]);
 const referenceSetup=setup(reference);
 return entries.reduce((best,entry)=>{
  if(entry.metricId!==reference.metricId||entry.cleared||!usable(entry,now)||setup(entry)!==referenceSetup)return best;
  return (entry.value!-best.value!)*metric.polarity>0?entry:best;
 },reference);
}

export function historyChanges(before:Values,after:Values,previousDetails:MeasurementMetadata,details:MeasurementMetadata,recordedAt:string):Omit<Observation,'id'>[]{
 return metrics.flatMap(m=>{const a=before[m.id],b=after[m.id],detail=details[m.id];if(a===b&&JSON.stringify(previousDetails[m.id]??{})===JSON.stringify(detail??{}))return [];if(b===undefined&&a===undefined)return [];if(b!==undefined&&!Number.isFinite(b))return [];
 return [{metricId:m.id,value:b??null,cleared:b===undefined,recordedAt,measuredAt:detail?.measuredAt,method:detail?.method,ageAtMeasurement:detail?.ageAtMeasurement,source:detail?.source,exerciseMode:detail?.exerciseMode,protocol:detail?.protocol,window:detail?.window,derivation:detail?.derivation}];});
}
function windowKey(w?:ObservationWindow){return w?JSON.stringify([w.statistic,w.sampleCount,Date.parse(w.end)-Date.parse(w.start)]):null;}
export function readGuestHistory(raw:string|null):Observation[]{try{const p=JSON.parse(raw??'null');if(p?.version!==1||!Array.isArray(p.entries))return [];return p.entries.filter((e:Observation)=>e&&typeof e.id==='string'&&metrics.some(m=>m.id===e.metricId)&&Number.isFinite(Date.parse(e.recordedAt))&&(e.value===null||typeof e.value==='number'&&Number.isFinite(e.value)));}catch{return [];}}

export function validGuestHistory(raw:string|null){try{if(!raw)return true;const p=JSON.parse(raw);return p?.version===1&&Array.isArray(p.entries)&&p.entries.length===readGuestHistory(raw).length;}catch{return false;}}

export function latestObservation(entries:Observation[]){
 return orderedObservations(entries).at(0);
}
export function historySummary(entries:Observation[],now=Date.now()){
 const observations=orderedObservations(entries),latest=observations.at(0);
 const latestTime=latest?Date.parse(observationDate(latest)):NaN;
 const previous=observations.find(entry=>Date.parse(observationDate(entry))<latestTime);
 const delta=comparisonFrom(observations,now);
 return {latest,previous,best:personalBest(entries,latest,now),comparison:delta?[delta.latest,delta.previous]:[]};
}
