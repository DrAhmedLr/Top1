import {allowedMethods} from './measurementRules';
import { metrics } from './registry';
import {normalizeTimestamp} from './timestamp';
import {normalizeProtocol,type MeasurementProtocol,type ObservationWindow} from './protocols';
import {normalizeDerivation,calculationValue,type CalculationDerivation} from './derivations';
export {normalizeTimestamp} from './timestamp';
export const methods=['manual','lab','direct_cpet','cooper_estimate','wearable_estimate','dynamometer_single_hand','dexa','skinfold_estimate','direct_1rm','epley_estimate','device'] as const;
export type MeasurementMethod=typeof methods[number];
export const exerciseModes=['treadmill','cycle','other'] as const;
export type ExerciseMode=typeof exerciseModes[number];
export interface MeasurementDetails { method?:MeasurementMethod; measuredAt?:string; source?:string; ageAtMeasurement?:number; exerciseMode?:ExerciseMode;protocol?:MeasurementProtocol;window?:ObservationWindow;derivation?:CalculationDerivation;invalidContext?:{message:string;original:unknown} }
export type MeasurementMetadata=Record<string,MeasurementDetails>;
export function authoritativeMeasurementDetails(values:Record<string,number|undefined>,input:unknown):MeasurementMetadata{
 const details=normalizeMeasurementMetadata(input);
 // Omitted context is explicitly unknown. The database's legacy preservation
 // rule must not make a saved observation differ from its signed calculation.
 for(const [id,value] of Object.entries(values))if(value!==undefined&&!details[id])details[id]={};
 for(const [id,value] of Object.entries(values))if(value!==undefined&&details[id]?.derivation&&Math.abs(Number(calculationValue(details[id].derivation!).toFixed(3))-Number(value.toFixed(3)))>0.000001)throw new Error(`Original calculation inputs do not reproduce ${id}.`);
 return details;
}
export function normalizeMeasurementMetadata(input:unknown,options:{legacy?:boolean;now?:number}={}):MeasurementMetadata{
  if(input===undefined)return {};
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid measurement details.');
  const result:MeasurementMetadata={};
  for(const [id,raw] of Object.entries(input)){
    if(!metrics.some(m=>m.id===id)||!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Unknown measurement details.');
    const value=raw as Record<string,unknown>,details:MeasurementDetails={};
    try{
    if(value.invalidContext!==undefined){if(!options.legacy)throw new Error('Review the stored measurement details before saving.');const prior=value.invalidContext as MeasurementDetails['invalidContext'];if(!prior||typeof prior.message!=='string')throw new Error('Invalid stored context marker.');result[id]={invalidContext:{message:prior.message,original:prior.original}};continue;}
    if(value.protocol!==undefined){details.protocol=normalizeProtocol(id,value.protocol);if(id==='vo2_max'&&value.method!==undefined){const expected=details.protocol.id==='cpet_treadmill_v1'?'direct_cpet':details.protocol.id==='cooper_track_12min_v1'?'cooper_estimate':'wearable_estimate';if(value.method!==expected)throw new Error('VO₂ protocol does not match its measurement method.');}}
    if(value.derivation!==undefined)details.derivation=normalizeDerivation(id,value.derivation);
    if(value.window!==undefined){
      if(!['total_sleep','sleep_efficiency','circadian_regularity','sauna_minutes','cold_plunge_minutes'].includes(id)||!value.window||typeof value.window!=='object'||Array.isArray(value.window))throw new Error('This metric does not accept an averaging window.');
      const w=value.window as ObservationWindow,start=normalizeTimestamp(w.start),end=normalizeTimestamp(w.end);
      if(Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>366*86400000||!['mean','median','total'].includes(w.statistic)||!Number.isInteger(w.sampleCount)||w.sampleCount<1||w.sampleCount>10000||!options.legacy&&Date.parse(end)>(options.now??Date.now())+300000)throw new Error('Check window dates, statistic and sample count.');
      details.window={start,end,statistic:w.statistic,sampleCount:w.sampleCount};
    }
    if(value.method!==undefined){if(!methods.includes(value.method as MeasurementMethod))throw new Error('Unsupported measurement method.');if(!options.legacy&&!allowedMethods(id).includes(value.method as MeasurementMethod))throw new Error(`Choose a compatible method for ${id}.`);details.method=value.method as MeasurementMethod;}
    if(value.ageAtMeasurement!==undefined){if(typeof value.ageAtMeasurement!=='number'||!Number.isInteger(value.ageAtMeasurement)||value.ageAtMeasurement<18||value.ageAtMeasurement>120)throw new Error('Invalid age at measurement.');details.ageAtMeasurement=value.ageAtMeasurement;}
    if(value.exerciseMode!==undefined){if(id!=='vo2_max'||!exerciseModes.includes(value.exerciseMode as ExerciseMode))throw new Error('Choose a supported VO₂ exercise modality.');details.exerciseMode=value.exerciseMode as ExerciseMode;}
    if(value.measuredAt!==undefined){details.measuredAt=normalizeTimestamp(value.measuredAt);if(!options.legacy&&Date.parse(details.measuredAt)>(options.now??Date.now())+300000)throw new Error('Measurement dates cannot be in the future.');}
    if(value.source!==undefined){if(typeof value.source!=='string'||!/^[a-z0-9_-]{1,40}$/.test(value.source))throw new Error('Unsupported measurement source.');details.source=value.source;}
    result[id]=details;
    }catch(error){if(!options.legacy)throw error;result[id]={invalidContext:{message:error instanceof Error?error.message:'Stored context needs review.',original:raw}};}
  }
  return result;
}
