import {metrics,type Values,type Demographics} from './registry';
import {valid} from './engine';
import {normalizeMeasurementMetadata,type MeasurementMetadata} from './measurementMetadata';
import {topBandForThresholds} from './topBands';
export const CANADIAN_SOURCE='https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002-eng.htm';
export const CANADIAN_REFERENCE_VERSION='chms-2017-p10-p50-p90-p95-v2';
export const CANADIAN_ATTRIBUTION='Adapted from Statistics Canada, Normative-referenced percentile values for physical fitness among Canadians, 2019-10-16. This does not constitute an endorsement by Statistics Canada of this product.';
export const CANADIAN_JUMP_PROTOCOL='chms_leonardo_cmj_v1';
export const CANADIAN_GRIP_PROTOCOL='chms_smedley_combined_v1';
export const CANADIAN_INSTRUCTIONS={
 cmj:'Use a Leonardo Mechanograph force plate, with arm swing allowed. After 1–2 practice jumps, record the highest of three valid two-leg countermovement jumps (up to five attempts). Both feet leave and land together. Other force plates, phone apps, wall marks and hands-on-hips jumps are different protocols.',
 grip_combined:'Use a Smedley III analogue dynamometer standing, arm about 45 degrees away from the body. Alternate hands for two trials per hand. Add the best left and best right result in kg. Do not use a single-hand maximum or the seated hydraulic protocol.'
};
// Hoffmann et al. (2019), CHMS cycle 5, Tables 1 and 4. Statistics Canada
// Open Licence. Load P10/P50/P90/P95 and report enclosing bands,
// never interpolate a precise rank or extrapolate a top-one-percent tail.
// Rows: 18–19, then five-year cohorts starting at 20. Units: cm and kg.
export const canadianQuantiles={
 cmj:{male:[[36.3,48.7,60.1,63.2],[36.6,49.4,60.7,63.8],[35.5,48,59,61.9],[33.9,45.8,56.3,59.1],[32.3,43.5,53.5,56.2],[30.7,41.1,50.7,53.3],[29.1,38.8,48,50.5],[27.4,36.4,45.1,47.6],[25.7,33.9,42.2,44.5],[23.8,31.3,39,41.2],[21.7,28.5,35.5,37.6]],female:[[25.6,32.8,40.2,42.4],[24.7,31.8,39.3,41.4],[24.1,31.3,38.8,41.0],[23.6,30.9,38.5,40.7],[22.9,30.2,37.8,40.0],[22,29.1,36.6,38.7],[20.8,27.7,34.9,37.0],[19.5,26.1,32.9,34.9],[18.1,24.4,30.9,32.7],[16.8,22.7,28.8,30.6],[15.6,21.1,26.9,28.5]]},
 grip_combined:{male:[[62.3,83.3,105.1,112.4],[68.8,90.7,113.4,121.1],[73.2,95.3,118.1,125.8],[74.3,96,118.4,125.8],[73.6,94.8,116.7,123.8],[71.9,92.6,114,120.7],[69.8,89.9,110.8,117.3],[67.4,87,107.4,113.6],[64.8,84,103.8,109.9],[62.1,80.8,100.1,106.0],[59.4,77.5,96.2,102.0],[56.5,74.1,92.2,98.0],[53.6,70.6,88.1,93.8]],female:[[40.2,52.5,65.6,69.7],[41.7,54.3,67.8,71.9],[42.5,55.3,69,73.1],[42.9,55.8,69.6,73.8],[43,56,69.9,74.1],[42.8,55.7,69.5,73.8],[42.1,54.8,68.4,72.7],[41.1,53.4,66.6,70.9],[39.7,51.6,64.4,68.7],[38.2,49.6,61.9,66.1],[36.5,47.5,59.2,63.4],[34.8,45.3,56.5,60.6],[33.1,43.1,53.8,57.8]]}
};
export function canadianComparison(id:'cmj'|'grip_combined',values:Values,d:Demographics,details:MeasurementMetadata,now=Date.now()){
 const metric=metrics.find(m=>m.id===id)!,value=values[id],ctx=details[id];
 if(!valid(metric,value))return {available:false as const,reason:'Record a valid measurement to compare this test.'};
 if(d.sex==='unselected')return {available:false as const,reason:'Choose a reference sex to compare this test.'};
 try{normalizeMeasurementMetadata({[id]:ctx??{}},{now});}catch{return {available:false as const,reason:'Check the method, date and protocol for this test.'};}
 const age=ctx?.ageAtMeasurement,max=id==='cmj'?69:79;
 if(!Number.isInteger(age)||age!<18||age!>max||age!>d.age||!ctx?.measuredAt)return {available:false as const,reason:'Record the test date and an age within this reference range.'};
 const years=new Date(now).getUTCFullYear()-new Date(ctx.measuredAt).getUTCFullYear();
 if(Math.abs(d.age-age!-years)>1)return {available:false as const,reason:'Check the test date and recorded ages.'};
 const p=ctx.protocol,expected=id==='cmj'?CANADIAN_JUMP_PROTOCOL:CANADIAN_GRIP_PROTOCOL;
 if(ctx.method!=='device'||p?.id!==expected||!p.equipment||p.trials!==(id==='cmj'?3:2)||id==='grip_combined'&&p.hand!=='both')return {available:false as const,reason:'Confirm the Canadian reference protocol in measurement details.'};
 const index=age!<20?0:1+Math.floor((age!-20)/5),row=canadianQuantiles[id][d.sex][index],ageMin=index===0?18:20+5*(index-1),ageMax=index===0?19:ageMin+4;
 return {available:true as const,band:topBandForThresholds(Number(value!.toFixed(3)),[10,50,90,95].map((percentile,i)=>({percentile,value:row[i]})))!,source:CANADIAN_SOURCE,referenceVersion:CANADIAN_REFERENCE_VERSION,ageMin,ageMax,sex:d.sex};
}
