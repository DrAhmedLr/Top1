import {friend2022,FRIEND_PERCENTILES,FRIEND_SOURCE,FRIEND_REFERENCE_VERSION} from './friend2022';
import {scoringEligibility,valid} from './engine';
import {activeMetrics,type Demographics,type Values,type Metric} from './registry';
import type {MeasurementMetadata} from './measurementMetadata';
export function metricCalibration(m:Metric){return {metricId:m.id,status:m.id==='vo2_max'?'published-test-reference':m.scoringEligible?'provisional-model':'tracking-only',populationCalibrated:false,source:m.id==='vo2_max'?FRIEND_SOURCE:null,referenceVersion:m.id==='vo2_max'?FRIEND_REFERENCE_VERSION:null,reason:m.id==='vo2_max'?'Published US test-cohort thresholds, with explicit inclusion criteria; no global rank.':m.scoringEligible?'Product parameters; no validated population distribution.':'No quantitative performance reference is enabled.'};}
export const calibrationInventory=()=>activeMetrics.map(metricCalibration);
/** Report published threshold intervals, never interpolate/extrapolate an exact
 * percentile from means/SDs, rounded quantiles or an unrepresentative sample. */
export function vo2CohortComparison(values:Values,d:Demographics,details:MeasurementMetadata,now=Date.now()){
 const m=activeMetrics.find(m=>m.id==='vo2_max')!,value=values.vo2_max;
 if(!valid(m,value))return {available:false as const,reason:'Record a valid VO₂ measurement; leaving it blank is fine.'};
 const eligibility=scoringEligibility(m,d,details,now);
 if(eligibility.status!=='eligible')return {available:false as const,reason:eligibility.reason};
 const age=details.vo2_max.ageAtMeasurement!,sex=d.sex as 'male'|'female',decade=Math.floor((age-20)/10),cell=friend2022[sex][decade];
 const x=Number(value.toFixed(3)),at=cell.quantiles.findIndex(q=>x===q),next=cell.quantiles.findIndex(q=>q>x);
 const label=at>=0?`At the published ${FRIEND_PERCENTILES[at]}th-percentile threshold`:next===0?'Below the published 10th-percentile threshold':next===-1?'Above the published 90th-percentile threshold':`Between the published ${FRIEND_PERCENTILES[next-1]}th and ${FRIEND_PERCENTILES[next]}th-percentile thresholds`;
 return {available:true as const,referenceVersion:FRIEND_REFERENCE_VERSION,source:FRIEND_SOURCE,table:3,value:x,cohort:{ageMin:20+decade*10,ageMax:29+decade*10,sex,sampleSize:cell.n},label,mean:cell.mean,sd:cell.sd,thresholds:FRIEND_PERCENTILES.map((percentile,i)=>({percentile,value:cell.quantiles[i]})),exactPercentile:null,confidenceInterval:null,limits:'Rounded published thresholds from a US laboratory cohort, not a representative worldwide sample. No exact rank, confidence interval, clinical interpretation or composite calibration is inferred.'};
}
