import { metrics } from './registry';
export const methods=['manual','lab','direct_cpet','cooper_estimate','wearable_estimate','dynamometer_single_hand','dexa','skinfold_estimate','direct_1rm','epley_estimate','device'] as const;
export type MeasurementMethod=typeof methods[number];
export interface MeasurementDetails { method?:MeasurementMethod; measuredAt?:string; source?:string; ageAtMeasurement?:number }
export type MeasurementMetadata=Record<string,MeasurementDetails>;
export function normalizeTimestamp(input:unknown):string{
  if(typeof input!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input)||!Number.isFinite(Date.parse(input)))throw new Error('Use an ISO timestamp with a timezone.');
  const year=Number(input.slice(0,4)),month=Number(input.slice(5,7)),day=Number(input.slice(8,10));
  if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||Number(input.slice(11,13))>23||Number(input.slice(14,16))>59||Number(input.slice(17,19))>59)throw new Error('Invalid measurement date.');
  return new Date(input).toISOString();
}
export function normalizeMeasurementMetadata(input:unknown):MeasurementMetadata{
  if(input===undefined)return {};
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid measurement details.');
  const result:MeasurementMetadata={};
  for(const [id,raw] of Object.entries(input)){
    if(!metrics.some(m=>m.id===id)||!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Unknown measurement details.');
    const value=raw as Record<string,unknown>,details:MeasurementDetails={};
    if(value.method!==undefined){if(!methods.includes(value.method as MeasurementMethod))throw new Error('Unsupported measurement method.');details.method=value.method as MeasurementMethod;}
    if(value.ageAtMeasurement!==undefined){if(typeof value.ageAtMeasurement!=='number'||!Number.isInteger(value.ageAtMeasurement)||value.ageAtMeasurement<18||value.ageAtMeasurement>120)throw new Error('Invalid age at measurement.');details.ageAtMeasurement=value.ageAtMeasurement;}
    if(value.measuredAt!==undefined)details.measuredAt=normalizeTimestamp(value.measuredAt);
    if(value.source!==undefined){if(typeof value.source!=='string'||!/^[a-z0-9_-]{1,40}$/.test(value.source))throw new Error('Unsupported measurement source.');details.source=value.source;}
    result[id]=details;
  }
  return result;
}
