import {activeMetrics,type Values,type Demographics} from './registry';
import {canadianComparison} from './canadianReference';
import {valid} from './engine';
import type {MeasurementMetadata} from './measurementMetadata';
import {vo2CohortComparison} from './scientificCalibration';
import {gripComparison} from './gripReference';
import {topBandForThresholds,type TopBand} from './topBands';
export function bandLabel(band:TopBand){return band.kind==='best'?'1%':band.kind==='lower'?'65%+':band.kind==='upper'?`${band.to}%`:`${band.from}–${band.to===100?'65%+':`${band.to}%`}`;}
/** Each result depends on that test alone. No completeness threshold or averaging of percentiles. */
export function metricStandings(values:Values,d:Demographics,details:MeasurementMetadata,now=Date.now()){
 return activeMetrics.filter(m=>valid(m,values[m.id])).map(metric=>{
  if(metric.id==='cmj'||metric.id==='grip_combined'){
   const r=canadianComparison(metric.id,values,d,details,now);
   return {metric,value:values[metric.id]!,band:r.available?r.band:null,reason:r.available?'Canadian age/sex comparison; not a world rank. Broad bands use the published P10, P50 and P90 thresholds.':r.reason,source:r.available?r.source:null,cohort:r.available?`${r.ageMin}–${r.ageMax} · ${r.sex}`:null,reference:r.available?'Canadian population reference · 2016–2017':null};
  }
  if(metric.id==='grip_strength'){
   const r=gripComparison(values,d,details,now);
   return {metric,value:values[metric.id]!,band:r.available?r.band:null,reason:r.available?'Grip comparison only; not an overall strength rank.':r.reason,source:r.available?r.source:null,cohort:r.available?`${r.ageMin}${r.ageMax===null?'+':`–${r.ageMax}`} · ${r.sex}`:null,reference:r.available?'International grip reference · 2025':null};
  }
  if(metric.id==='vo2_max'){
   const r=vo2CohortComparison(values,d,details,now);
   return {metric,value:values[metric.id]!,band:r.available?topBandForThresholds(r.value,r.thresholds):null,reason:r.available?'Aerobic test comparison only; not an overall fitness rank.':r.reason,source:r.available?r.source:null,cohort:r.available?`${r.cohort.ageMin}–${r.cohort.ageMax} · ${r.cohort.sex}`:null,reference:r.available?'VO₂ · US laboratory reference':null};
  }
  return {metric,value:values[metric.id]!,band:null,reason:'No compatible percentile reference is connected for this test. Your measurement is still recorded.',source:null,cohort:null,reference:null};
 });
}
