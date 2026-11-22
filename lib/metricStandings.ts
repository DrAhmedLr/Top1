import {activeMetrics,type Metric,type Values,type Demographics} from './registry';
import {CANADIAN_ATTRIBUTION,canadianComparison} from './canadianReference';
import {valid} from './engine';
import type {MeasurementMetadata} from './measurementMetadata';
import {vo2CohortComparison} from './scientificCalibration';
import {gripComparison} from './gripReference';
import {topBandForThresholds,type TopBand} from './topBands';
export function bandLabel(band:TopBand){return band.kind==='lower'?`${band.from}%+`:band.kind==='upper'?`${band.to}%`:`${band.from}–${band.to}%`;}
export type PublishedComparison={kind:'published';band:TopBand;source:string;cohort:string;reference:string;referenceVersion:string;attribution?:string};
type TestStanding={metric:Metric;value:number;reason:string}&(PublishedComparison|{kind:'unavailable';band:null;source:null;cohort:null;reference:null;referenceVersion:null;attribution?:undefined});
/** Each result depends on that test alone. No completeness threshold or averaging of percentiles. */
export function metricStandings(values:Values,d:Demographics,details:MeasurementMetadata,now=Date.now()):TestStanding[]{
 return activeMetrics.filter(m=>valid(m,values[m.id])).map((metric):TestStanding=>{
  const value=values[metric.id]!;
  const unavailable=(reason:string):TestStanding=>({kind:'unavailable',metric,value,reason,band:null,source:null,cohort:null,reference:null,referenceVersion:null});
  if(metric.id==='cmj'||metric.id==='grip_combined'){
   const r=canadianComparison(metric.id,values,d,details,now);
   if(!r.available)return unavailable(r.reason);
   return {kind:'published',metric,value,band:r.band,reason:'Canadian age/sex comparison using published P10, P50, P90 and P95 thresholds.',source:r.source,cohort:`${r.ageMin}–${r.ageMax} · ${r.sex}`,reference:'Canadian population reference · 2016–2017',referenceVersion:r.referenceVersion,attribution:CANADIAN_ATTRIBUTION};
  }
  if(metric.id==='grip_strength'){
   const r=gripComparison(values,d,details,now);
   if(!r.available)return unavailable(r.reason);
   return {kind:'published',metric,value,band:r.band,reason:'Published international grip comparison.',source:r.source,cohort:`${r.ageMin}${r.ageMax===null?'+':`–${r.ageMax}`} · ${r.sex}`,reference:'International grip reference · 2025',referenceVersion:'igrips-2025-table2-v1'};
  }
  if(metric.id==='vo2_max'){
   const r=vo2CohortComparison(values,d,details,now);
   if(!r.available)return unavailable(r.reason);
   const band=topBandForThresholds(r.value,r.thresholds);
   if(!band)return unavailable('Published thresholds are unavailable for this cohort.');
   return {kind:'published',metric,value,band,reason:'Published treadmill VO₂ comparison.',source:r.source,cohort:`${r.cohort.ageMin}–${r.cohort.ageMax} · ${r.cohort.sex}`,reference:'VO₂ · US laboratory reference',referenceVersion:r.referenceVersion};
  }
  return unavailable('No compatible percentile reference is connected for this test. Your measurement is still recorded.');
 });
}
