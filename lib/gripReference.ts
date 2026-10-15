import {activeMetrics,type Values,type Demographics} from './registry';
import {valid} from './engine';
import {normalizeMeasurementMetadata,type MeasurementMetadata} from './measurementMetadata';
import {topBandForThresholds} from './topBands';
// Tomkinson et al., J Sport Health Sci 2025;14:101014, Table 2 (CC BY 4.0).
// Transcribed absolute (kg) population-weighted smoothed quantiles; no interpolation.
export const GRIP_SOURCE='https://doi.org/10.1016/j.jshs.2024.101014';
export const GRIP_PERCENTILES=[5,10,20,30,40,50,60,70,80,90,95] as const;
export const GRIP_PROTOCOL='igrips_hydraulic_max_v1';
export const GRIP_INSTRUCTIONS='Use a hydraulic dynamometer seated, with elbow flexed, forearm neutral and handle adjusted to your hand. Test both hands three times each. Enter the highest single result in kg, not the sum of both hands. Record the test date and your age at that test.';
export const gripQuantiles={
 male:[
 [33.9,36.8,40.5,43.2,45.7,48.0,50.4,52.9,56.0,60.1,63.6],
 [35.5,38.5,42.1,44.8,47.1,49.3,51.5,53.9,56.7,60.7,64.0],
 [35.0,38.3,42.2,45.0,47.4,49.7,52.0,54.4,57.4,61.5,64.9],
 [33.8,37.3,41.5,44.5,47.1,49.5,51.9,54.4,57.5,61.8,65.3],
 [32.3,36.0,40.4,43.6,46.3,48.8,51.2,53.9,57.1,61.5,65.1],
 [30.6,34.4,39.0,42.3,45.1,47.6,50.2,52.9,56.2,60.7,64.4],
 [28.9,32.8,37.4,40.7,43.5,46.2,48.8,51.6,54.8,59.4,63.1],
 [27.2,31.0,35.6,38.9,41.7,44.4,47.0,49.8,53.1,57.7,61.4],
 [25.5,29.1,33.6,36.9,39.7,42.4,45.0,47.8,51.1,55.6,59.3],
 [23.7,27.2,31.5,34.7,37.5,40.1,42.8,45.6,48.8,53.2,56.8],
 [21.9,25.2,29.3,32.4,35.1,37.7,40.3,43.1,46.3,50.6,54.1],
 [20.0,23.1,27.0,29.9,32.5,35.1,37.6,40.3,43.5,47.7,51.1],
 [18.0,20.8,24.5,27.3,29.8,32.3,34.8,37.5,40.5,44.7,48.0],
 [15.9,18.5,21.9,24.6,27.0,29.4,31.8,34.4,37.4,41.5,44.6],
 [13.7,16.1,19.2,21.7,24.0,26.3,28.7,31.2,34.2,38.1,41.2],
 [11.3,13.5,16.4,18.8,20.9,23.1,25.4,27.9,30.8,34.6,37.5],
 [8.8,10.8,13.5,15.7,17.8,19.8,22.0,24.5,27.2,30.9,33.8]],
 female:[
 [19.7,21.7,24.0,25.7,27.2,28.6,30.0,31.6,33.6,36.6,39.1],
 [20.0,22.0,24.5,26.3,27.9,29.4,30.9,32.6,34.6,37.4,39.7],
 [19.6,21.8,24.4,26.4,28.1,29.7,31.3,33.1,35.2,38.0,40.4],
 [19.0,21.3,24.1,26.2,28.0,29.7,31.4,33.2,35.4,38.4,40.8],
 [18.3,20.7,23.7,25.8,27.6,29.4,31.1,33.0,35.2,38.3,40.8],
 [17.6,20.1,23.1,25.2,27.1,28.9,30.6,32.5,34.8,37.9,40.4],
 [16.9,19.4,22.4,24.5,26.4,28.2,29.9,31.8,34.0,37.1,39.7],
 [16.1,18.5,21.5,23.7,25.5,27.3,29.0,30.9,33.0,36.1,38.6],
 [15.2,17.6,20.6,22.7,24.5,26.2,27.9,29.7,31.8,34.9,37.4],
 [14.3,16.6,19.5,21.6,23.3,25.0,26.6,28.4,30.5,33.4,35.8],
 [13.2,15.5,18.3,20.3,22.0,23.6,25.2,26.9,28.9,31.8,34.1],
 [12.0,14.3,17.0,18.9,20.5,22.1,23.6,25.2,27.2,29.9,32.2],
 [10.7,12.9,15.5,17.4,18.9,20.4,21.9,23.5,25.3,28.0,30.2],
 [9.3,11.4,13.9,15.7,17.2,18.6,20.0,21.5,23.3,25.9,28.0],
 [7.8,9.8,12.2,13.9,15.3,16.7,18.0,19.5,21.2,23.6,25.7],
 [6.1,8.0,10.3,11.9,13.3,14.6,15.9,17.3,18.9,21.2,23.2],
 [4.2,6.1,8.3,9.8,11.2,12.4,13.6,14.9,16.5,18.7,20.6]]
};
export function gripComparison(values:Values,d:Demographics,details:MeasurementMetadata,now=Date.now()){
 const value=values.grip_strength,m=activeMetrics.find(m=>m.id==='grip_strength')!,ctx=details.grip_strength;
 if(!valid(m,value))return {available:false as const,reason:'Record a valid grip-strength measurement.'};
 if(d.sex==='unselected')return {available:false as const,reason:'Choose a reference sex to compare this test.'};
 try{normalizeMeasurementMetadata({grip_strength:ctx??{}},{now});}catch{return {available:false as const,reason:'Check the method, date and protocol for this test.'};}
 const age=ctx?.ageAtMeasurement;
 if(!Number.isInteger(age)||age!<20||age!>d.age)return {available:false as const,reason:'Record your age at the grip test (20 or older).'};
 if(!ctx?.measuredAt)return {available:false as const,reason:'Record the date of this test.'};
 const years=new Date(now).getUTCFullYear()-new Date(ctx.measuredAt).getUTCFullYear();
 if(Math.abs(d.age-age!-years)>1)return {available:false as const,reason:'Check the test date and recorded ages.'};
 if(ctx.method!=='device'||ctx.protocol?.id!==GRIP_PROTOCOL||ctx.protocol.hand!=='both'||ctx.protocol.trials!==3||!ctx.protocol.equipment)return {available:false as const,reason:'Confirm the international grip protocol in measurement details.'};
 const index=Math.min(16,Math.floor((age!-20)/5)),quantiles=gripQuantiles[d.sex][index],thresholds=GRIP_PERCENTILES.map((percentile,i)=>({percentile,value:quantiles[i]}));
 return {available:true as const,band:topBandForThresholds(Number(value.toFixed(3)),thresholds)!,source:GRIP_SOURCE,ageMin:20+5*index,ageMax:index===16?null:24+5*index,sex:d.sex,thresholds};
}
