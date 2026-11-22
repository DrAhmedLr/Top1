import {normalizeNumericInput} from './measurementInput';
import type {Demographics} from './registry';
export const RUN_10K_SOURCE='https://runrepeat.com/how-do-you-masure-up-the-runners-percentile-calculator';
// Published race-finisher cutoffs. Intermediate tiers are linear estimates,
// not observed quantiles or general-population ranks. No age adjustment.
const seconds={
 all:[2178,2891,3167,3363,3545,3728,3938,4208,4605,5278],
 male:[2064,2711,2977,3148,3290,3435,3602,3823,4153,4761],
 female:[2472,3215,3481,3662,3830,4014,4238,4536,4966,5594],
};
const percentiles=[1,10,20,30,40,50,60,70,80,90];
export function run10kBenchmarks(d:Demographics){
 const cohort=d.sex==='unselected'?'all':d.sex,values=seconds[cohort];
 const interpolate=(p:number)=>values[0]+(values[1]-values[0])*(p-1)/9;
 return {cohort,source:RUN_10K_SOURCE,points:percentiles.map((percent,i)=>({percent,minutes:values[i]/60})),tiers:[{percent:1,minutes:values[0]/60,estimated:false},{percent:2.5,minutes:interpolate(2.5)/60,estimated:true},{percent:5,minutes:interpolate(5)/60,estimated:true}]};
}
export function run10kPercent(minutes:number,d:Demographics){
 const {points}=run10kBenchmarks(d);
 if(minutes<=points[0].minutes)return 1;
 const last=points.at(-1)!;
 if(minutes>=last.minutes)return Math.min(100,90+(minutes-last.minutes)/(180-last.minutes)*10);
 const next=points.findIndex(p=>p.minutes>=minutes),a=points[next-1],b=points[next];
 return a.percent+(minutes-a.minutes)/(b.minutes-a.minutes)*(b.percent-a.percent);
}
export function formatRunTime(minutes:number, preserveSubseconds=false) {
 const seconds=Math.round(minutes*60);
 // The journal stores three decimal minutes. A whole-second entry should
 // keep its original clock display even after that storage rounding.
 if(!preserveSubseconds || Number(minutes.toFixed(3))===Number((seconds/60).toFixed(3))) {
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
 }
 const hundredths=Math.round(minutes*6000);
 const fraction=String(hundredths%100).padStart(2,'0').replace(/0$/,'');
 return `${Math.floor(hundredths/6000)}:${String(Math.floor(hundredths/100)%60).padStart(2,'0')}.${fraction}`;
}
export function parseRunTime(raw:string){const value=normalizeNumericInput(raw);if(!value.includes(':'))return value;const match=/^(\d{1,3}):([0-5]\d(?:\.\d{1,2})?)$/.exec(value);return match?String(Number(match[1])+Number(match[2])/60):'NaN';}
