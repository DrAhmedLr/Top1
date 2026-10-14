import {allowedMethods} from './measurementRules';
import { metrics } from './registry';
import {normalizeTimestamp} from './timestamp';
export {normalizeTimestamp} from './timestamp';
export const methods=['manual','lab','direct_cpet','cooper_estimate','wearable_estimate','dynamometer_single_hand','dexa','skinfold_estimate','direct_1rm','epley_estimate','device'] as const;
export type MeasurementMethod=typeof methods[number];
export const exerciseModes=['treadmill','cycle','other'] as const;
export type ExerciseMode=typeof exerciseModes[number];
export interface MeasurementDetails { method?:MeasurementMethod; measuredAt?:string; source?:string; ageAtMeasurement?:number; exerciseMode?:ExerciseMode }
export type MeasurementMetadata=Record<string,MeasurementDetails>;
export function authoritativeMeasurementDetails(values:Record<string,number|undefined>,input:unknown):MeasurementMetadata{
 const details=normalizeMeasurementMetadata(input);
 // Omitted context is explicitly unknown. The database's legacy preservation
 // rule must not make a saved observation differ from its signed calculation.
 for(const [id,value] of Object.entries(values))if(value!==undefined&&!details[id])details[id]={};
 return details;
}
export function normalizeMeasurementMetadata(input:unknown,options:{legacy?:boolean;now?:number}={}):MeasurementMetadata{
  if(input===undefined)return {};
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid measurement details.');
  const result:MeasurementMetadata={};
  for(const [id,raw] of Object.entries(input)){
    if(!metrics.some(m=>m.id===id)||!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Unknown measurement details.');
    const value=raw as Record<string,unknown>,details:MeasurementDetails={};
    if(value.method!==undefined){if(!methods.includes(value.method as MeasurementMethod))throw new Error('Unsupported measurement method.');if(!options.legacy&&!allowedMethods(id).includes(value.method as MeasurementMethod))throw new Error(`Choose a compatible method for ${id}.`);details.method=value.method as MeasurementMethod;}
    if(value.ageAtMeasurement!==undefined){if(typeof value.ageAtMeasurement!=='number'||!Number.isInteger(value.ageAtMeasurement)||value.ageAtMeasurement<18||value.ageAtMeasurement>120)throw new Error('Invalid age at measurement.');details.ageAtMeasurement=value.ageAtMeasurement;}
    if(value.exerciseMode!==undefined){if(id!=='vo2_max'||!exerciseModes.includes(value.exerciseMode as ExerciseMode))throw new Error('Choose a supported VO₂ exercise modality.');details.exerciseMode=value.exerciseMode as ExerciseMode;}
    if(value.measuredAt!==undefined){details.measuredAt=normalizeTimestamp(value.measuredAt);if(!options.legacy&&Date.parse(details.measuredAt)>(options.now??Date.now())+300000)throw new Error('Measurement dates cannot be in the future.');}
    if(value.source!==undefined){if(typeof value.source!=='string'||!/^[a-z0-9_-]{1,40}$/.test(value.source))throw new Error('Unsupported measurement source.');details.source=value.source;}
    result[id]=details;
  }
  return result;
}
