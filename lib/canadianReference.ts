import {metrics,type Values,type Demographics} from './registry';
import {valid} from './engine';
import {normalizeMeasurementMetadata,type MeasurementMetadata} from './measurementMetadata';
import {topBandForThresholds} from './topBands';
export const CANADIAN_SOURCE='https://www150.statcan.gc.ca/n1/pub/82-003-x/2019010/article/00002-eng.htm';
export const CANADIAN_JUMP_PROTOCOL='chms_leonardo_cmj_v1';
export const CANADIAN_GRIP_PROTOCOL='chms_smedley_combined_v1';
export const CANADIAN_INSTRUCTIONS={
 cmj:'Use a Leonardo Mechanograph force plate, with arm swing allowed. After 1–2 practice jumps, record the highest of three valid two-leg countermovement jumps (up to five attempts). Both feet leave and land together. Other force plates, phone apps, wall marks and hands-on-hips jumps are different protocols.',
 grip_combined:'Use a Smedley III analogue dynamometer standing, arm about 45 degrees away from the body. Alternate hands for two trials per hand. Add the best left and best right result in kg. Do not use a single-hand maximum or the seated hydraulic protocol.'
};
// Hoffmann et al. (2019), CHMS cycle 5, Tables 1 and 4. Statistics Canada
// Open Licence. Deliberately load P10/P50/P90 only: report enclosing bands,
// never interpolate a precise rank or extrapolate a top-one-percent tail.
// Rows: 18–19, then five-year cohorts starting at 20. Units: cm and kg.
export const canadianQuantiles={
 cmj:{male:[[36.3,48.7,60.1],[36.6,49.4,60.7],[35.5,48,59],[33.9,45.8,56.3],[32.3,43.5,53.5],[30.7,41.1,50.7],[29.1,38.8,48],[27.4,36.4,45.1],[25.7,33.9,42.2],[23.8,31.3,39],[21.7,28.5,35.5]],female:[[25.6,32.8,40.2],[24.7,31.8,39.3],[24.1,31.3,38.8],[23.6,30.9,38.5],[22.9,30.2,37.8],[22,29.1,36.6],[20.8,27.7,34.9],[19.5,26.1,32.9],[18.1,24.4,30.9],[16.8,22.7,28.8],[15.6,21.1,26.9]]},
 grip_combined:{male:[[62.3,83.3,105.1],[68.8,90.7,113.4],[73.2,95.3,118.1],[74.3,96,118.4],[73.6,94.8,116.7],[71.9,92.6,114],[69.8,89.9,110.8],[67.4,87,107.4],[64.8,84,103.8],[62.1,80.8,100.1],[59.4,77.5,96.2],[56.5,74.1,92.2],[53.6,70.6,88.1]],female:[[40.2,52.5,65.6],[41.7,54.3,67.8],[42.5,55.3,69],[42.9,55.8,69.6],[43,56,69.9],[42.8,55.7,69.5],[42.1,54.8,68.4],[41.1,53.4,66.6],[39.7,51.6,64.4],[38.2,49.6,61.9],[36.5,47.5,59.2],[34.8,45.3,56.5],[33.1,43.1,53.8]]}
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
 return {available:true as const,band:topBandForThresholds(Number(value!.toFixed(3)),[10,50,90].map((percentile,i)=>({percentile,value:row[i]})))!,source:CANADIAN_SOURCE,ageMin,ageMax,sex:d.sex};
}
