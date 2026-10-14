import {evaluate} from './engine';
import {recordedCoverage} from './coverage';
import type {ProfileState} from './profile';
import {activeMetrics} from './registry';

export function calculationReport(profile:Pick<ProfileState,'values'|'demographics'|'measurementDetails'>,now=Date.now()){
 const result=evaluate(profile.values,profile.demographics,profile.measurementDetails,{now});
 const dates=result.submitted.flatMap(s=>s.context.measuredAt?[s.context.measuredAt]:[]).sort();
 return {
  schemaVersion:1,modelVersion:result.modelVersion,assessedAt:result.assessedAt,
  interpretation:'Experimental product model, not a population rank, health score or diagnosis. Self-reported measurements and methods are not independently verified.',
  observationSpan:{first:dates[0]??null,last:dates.at(-1)??null,undated:result.scoredCount-dates.length,limit:'A mixed-date assessment is not a simultaneous current-performance test.'},
  profile:profile.demographics,
  coverage:{recorded:result.measured.length,total:activeMetrics.length,percentage:recordedCoverage(result.measured.length),scored:result.scoredCount,trackingOnly:result.trackingOnly.length},
  overall:{ready:result.ready,reason:result.readinessReason,modelPoints:result.ready?result.modelScore:null,modelUnits:result.ready?result.z:null,domainUnits:result.domains,domainWeights:result.domainWeights},
  comparison:{recordedMethodsAndDates:result.comparable,referenceSet:result.comparisonKey,limit:'Comparison requires the same model, methods, modality and reference cohort, and a newer measured date for each scored observation. This does not verify identical test conditions.'},
  observations:result.measured.map(m=>{const s=result.submitted.find(s=>s.metric.id===m.id);return {metricId:m.id,unit:m.unit,value:profile.values[m.id],details:profile.measurementDetails?.[m.id]??{},assessment:result.assessments.find(a=>a.metricId===m.id),...(s?{canonicalValue:s.value,formula:m.scoringType,reference:s.reference,cappedModelUnits:s.z,atModelLimit:Math.abs(s.z)>=3,modelPoints:s.modelScore,effectiveWeight:s.effectiveWeight,contribution:s.contribution}:{})};}),
  excludedValues:result.invalidValues.map(issue=>({...issue,recordedText:String(profile.values[issue.metricId])})),
  missingData:'Missing or invalid values are excluded rather than scored as zero. Adding observations changes the reference set and weights.',
  precision:'Eligible input values use the same three-decimal canonical precision as cloud measurement storage.',
 };
}
