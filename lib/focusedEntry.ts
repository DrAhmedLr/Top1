import {valid} from './engine';
import {parseMeasurementInput} from './measurementInput';
import {parseRunTime,formatRunTime} from './run10kReference';
import {calculationValue} from './derivations';
import {normalizeMeasurementMetadata,type MeasurementDetails} from './measurementMetadata';
import type {Metric} from './registry';
export const isLift=(id:string)=>['bench_1rm','squat_1rm','deadlift_1rm','pullup_1rm'].includes(id);
export function entryUnit(m:Metric){return m.id==='total_sleep'?'h/night':m.id==='run_5k'?'min:sec':m.unit;}
export function entryRaw(m:Metric,value?:number){return value===undefined?'':m.id==='run_5k'?formatRunTime(value):String(m.id==='total_sleep'?Number((value/60).toFixed(2)):value);}
function parseEntryValue(metric:Metric,raw:string){
 const input=metric.id==='run_5k'?parseRunTime(raw):raw;
 return Number(parseMeasurementInput(input,metric.id==='total_sleep'?60:1));
}
export function focusedEntry(m:Metric,input:{raw:string;load?:string;reps?:string;weight?:string;loadUnit?:'kg'|'lb'},previous?:{value?:number;details:MeasurementDetails}){
 let value:number,details:MeasurementDetails={source:'manual'};
 if(isLift(m.id)){
  if(!input.load?.trim()||!input.reps?.trim()||!input.weight?.trim())throw Error('Complete the load, repetitions and body weight.');
  const kgPerUnit=input.loadUnit==='lb'?0.45359237:1;
  const enteredLoad=Number(parseMeasurementInput(input.load)),reps=Number(parseMeasurementInput(input.reps)),weight=Number(parseMeasurementInput(input.weight));
  const original=previous?.details.derivation;
  if(previous&&valid(m,previous.value)&&original&&enteredLoad===Number((original.inputs[0]/kgPerUnit).toFixed(2))&&reps===original.inputs[1]&&weight===original.bodyWeightKg)return {value:previous.value,details:previous.details};
  const load=enteredLoad*kgPerUnit;
  details={source:'manual',method:reps===1?'direct_1rm':'epley_estimate',derivation:{formula:m.id==='pullup_1rm'?'pullup_ratio_v1':'epley_ratio_v1',inputs:[load,reps],bodyWeightKg:weight}};
  details=normalizeMeasurementMetadata({[m.id]:details})[m.id];value=Number(calculationValue(details.derivation!).toFixed(3));
 }else{
  if(!input.raw.trim())throw Error('Enter your result.');
  value=parseEntryValue(m,input.raw);
  // An unchanged rounded display may be re-entered using localized digits or a comma.
  if(previous&&valid(m,previous.value)&&value===parseEntryValue(m,entryRaw(m,previous.value)))return {value:previous.value,details:previous.details};
 }
 if(!valid(m,value))throw Error('Check the number and unit.');
 value=Number(value.toFixed(3));
 // A new value must not inherit the date, method or protocol of an older test.
 // An unchanged value keeps its original evidence, including published eligibility.
 if(previous?.value===value&&(!isLift(m.id)||JSON.stringify(previous.details.derivation)===JSON.stringify(details.derivation)))details=previous.details;
 return {value,details};
}
