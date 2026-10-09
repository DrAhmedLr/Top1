import type { MeasurementMetadata } from './measurementMetadata';
import { metrics, pillars, type Metric, type Values, type Demographics, type PillarId } from './registry';
import { getMetricCohortNorm } from './demographics';
import { MODEL_VERSION, MODEL_SCORE_MIN, MODEL_SCORE_MAX } from './model';
export const clamp = (n:number,lo:number,hi:number) => Math.min(hi,Math.max(lo,n));
// Numerical Recipes approximation. Mathematical utility only, never a population rank.
export function cdf(z:number) { if(z===0)return .5; const x=Math.abs(z)/Math.SQRT2,t=1/(1+.5*x); const erfc=t*Math.exp(-x*x-1.26551223+t*(1.00002368+t*(.37409196+t*(.09678418+t*(-.18628806+t*(.27886807+t*(-1.13520398+t*(1.48851587+t*(-.82215223+t*.17087277))))))))); return z>=0?1-erfc/2:erfc/2; }
export function inverseCdf(p:number) { if(!Number.isFinite(p)||p<=0||p>=1)throw new RangeError('Probability must be between 0 and 1.');let lo=-8,hi=8;for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(cdf(mid)<p)lo=mid;else hi=mid;}return (lo+hi)/2; }
export function reference(m:Metric,d:Demographics,details:MeasurementMetadata={}){
  const norm=getMetricCohortNorm(m.id,m.id==='vo2_max'&&details[m.id]?.ageAtMeasurement!==undefined?{...d,age:details[m.id].ageAtMeasurement!}:d);
  return {...norm,sd:norm.stdDev,L:norm.lms?.L??0,M:norm.lms?.M??norm.mean,S:norm.lms?.S??Math.sqrt(Math.log(1+(norm.stdDev/norm.mean)**2))};
}
export function valid(m:Metric,x:number|undefined):x is number{return typeof x==='number'&&Number.isFinite(x)&&x>=m.min&&x<=m.max;}
export function eligible(m:Metric,d:Demographics,details:MeasurementMetadata={}){return m.scoringEligible&&(m.id!=='vo2_max'||(Number.isInteger(details[m.id]?.ageAtMeasurement)&&details[m.id].ageAtMeasurement!>=20&&details[m.id].ageAtMeasurement!<=79&&details[m.id]?.method==='direct_cpet'));}
function validateProfile(d:Demographics){
  if(!Number.isInteger(d.age)||d.age<18||d.age>120||!['male','female'].includes(d.sex)||!Number.isFinite(d.weight)||d.weight<25||d.weight>350||!Number.isFinite(d.height)||d.height<100||d.height>240)throw new RangeError('Invalid demographic profile.');
}
export function calculateBoundedZScore(val:number,minOpt:number,maxOpt:number,stdDev:number){
  if(![val,minOpt,maxOpt,stdDev].every(Number.isFinite)||stdDev<=0||minOpt>maxOpt)throw new RangeError('Invalid bounded parameters.');
  const distance=Math.max(minOpt-val,0,val-maxOpt);
  return 1-(distance/stdDev)**2; // continuous quadratic plateau; no percentile claim
}
export function calculateSkewedZScore(val:number,L:number,M:number,S:number,polarity:number){
  if(![val,L,M,S,polarity].every(Number.isFinite)||val<=0||M<=0||S<=0||Math.abs(polarity)!==1)throw new RangeError('Invalid LMS parameters.');
  // expm1 avoids cancellation; L=0 is the exact logarithmic limit.
  const log=Math.log(val/M);
  return polarity*(L===0?log/S:Math.expm1(L*log)/(L*S));
}
export function score(m:Metric,x:number,d:Demographics,details:MeasurementMetadata={}){
  validateProfile(d);
  if(!valid(m,x))throw new RangeError(`Unsupported value for ${m.id}.`);
  if(!eligible(m,d,details))throw new RangeError(`${m.id} is tracking-only for this profile.`);
  const r=reference(m,d,details);
  // Sleep consensus establishes a lower-duration recommendation, not evidence
  // that every duration over 9 h should be penalized. No gain above the plateau.
  const raw=m.id==='total_sleep'?calculateBoundedZScore(Math.min(x,540),420,540,r.sd)
    :m.scoringType==='bounded'&&r.boundedOptimal?calculateBoundedZScore(x,r.boundedOptimal.minOptimal,r.boundedOptimal.maxOptimal,r.sd)
    :m.scoringType==='skewed'?calculateSkewedZScore(x,r.L,r.M,r.S,m.polarity)
    :m.polarity*(x-r.mean)/r.sd;
  return clamp(raw,MODEL_SCORE_MIN,MODEL_SCORE_MAX);
}
export const toModelScore=(z:number)=>clamp(50+15*z,0,100);
export type Scored={metric:Metric;value:number;z:number;modelScore:number;defect:number};
export function evaluate(values:Values,d:Demographics,details:MeasurementMetadata={}){
  validateProfile(d);
  const measured=metrics.filter(m=>valid(m,values[m.id]));
  const submitted:Scored[]=measured.filter(m=>eligible(m,d,details)).map(metric=>{const value=values[metric.id]!;const z=score(metric,value,d,details);return {metric,value,z,modelScore:toModelScore(z),defect:0};});
  const domains:Partial<Record<PillarId,number>>={};
  for(const p of pillars){
    const group=submitted.filter(s=>s.metric.pillar===p.id);if(!group.length)continue;
    // A weighted MEAN preserves the unit scale. Covariance-normalizing a sum
    // assumes validated joint distributions; no such data exist for this model.
    const weight=group.reduce((sum,s)=>sum+s.metric.weight,0);
    domains[p.id]=group.reduce((sum,s)=>sum+s.metric.weight*s.z,0)/weight;
  }
  const active=pillars.filter(p=>domains[p.id]!==undefined);
  const weight=active.reduce((sum,p)=>sum+p.weight,0);
  const z=weight?active.reduce((sum,p)=>sum+p.weight*domains[p.id]!,0)/weight:0;
  const completeness=clamp(100*measured.reduce((sum,m)=>sum+pillars.find(p=>p.id===m.pillar)!.weight*m.weight,0),0,100);
  for(const s of submitted)s.defect=domains[s.metric.pillar]!-s.z;
  return {modelVersion:MODEL_VERSION,ready:submitted.length>=3&&active.length>=2,z,modelScore:toModelScore(z),completeness,coverageTier:completeness<40?'Low':completeness<75?'Moderate':'High',domains,submitted,measured,scoredCount:submitted.length,activeDomainCount:active.length,trackingOnly:measured.filter(m=>!eligible(m,d,details)),bottlenecks:submitted.filter(s=>s.defect>=.75).sort((a,b)=>b.defect-a.defect),strengths:[...submitted].sort((a,b)=>b.z-a.z).slice(0,3)};
}
export type Strategy='Easiest first'|'Cardio focus'|'Strength focus'|'Balanced';
export function simulate(values:Values,d:Demographics,target:number,strategy:Strategy,details:MeasurementMetadata={}){
  if(!Number.isFinite(target)||target<0||target>100)throw new RangeError('Model target must be 0–100.');
  const result=evaluate(values,d,details);
  let selected=result.submitted.filter(s=>s.metric.scenarioChangePerStep>0);
  if(strategy==='Easiest first')selected=selected.filter(s=>s.metric.easiestPathPriority<=2);
  else if(strategy==='Balanced')selected=[...result.submitted].sort((a,b)=>a.z-b.z).slice(0,3);
  else selected=selected.filter(s=>s.metric.pillar===(strategy==='Cardio focus'?'cardiovascular':'strength_mobility'));
  const targets=(step:number):Values=>{
    const next={...values};if(step===0)return next;
    for(const s of selected){
      const m=s.metric,r=reference(m,d,details),desired=clamp(s.z+m.scenarioChangePerStep*step,MODEL_SCORE_MIN,MODEL_SCORE_MAX);
      let value:number;
      if(m.scoringType==='bounded'&&r.boundedOptimal){
        const {minOptimal:lo,maxOptimal:hi}=r.boundedOptimal;
        const distance=r.sd*Math.sqrt(Math.max(0,1-Math.min(desired,1)));
        value=s.value<lo?lo-distance:s.value>hi&&m.id!=='total_sleep'?hi+distance:s.value;
      }else if(m.scoringType==='skewed'){
        const base=1+r.L*r.S*desired*m.polarity;
        value=r.L===0?r.M*Math.exp(desired*m.polarity*r.S):base>0?r.M*Math.exp(Math.log(base)/r.L):m.min;
      }else value=r.mean+desired*m.polarity*r.sd;
      // A clipped starting score must never cause an instantaneous deterioration.
      next[m.id]=clamp(m.polarity===1?Math.max(s.value,value):Math.min(s.value,value),m.min,m.max);
      if(m.id==='total_sleep'&&s.value<420)next[m.id]=clamp(value,m.min,420);
    }
    return next;
  };
  let steps:number|null=null;
  if(result.ready){if(target<=result.modelScore)steps=0;else if(selected.length)for(let step=1;step<=260;step++)if(evaluate(targets(step),d,details).modelScore>=target){steps=step;break;}}
  const horizon=steps??260;
  const final=result.ready?targets(horizon):{...values};
  return {steps,selected:result.ready?selected:[],targets:final,reason:!result.ready?'insufficient-data':steps===null?'unreachable':'reached',points:result.ready?Array.from({length:7},(_,i)=>{const step=Math.round(i*horizon/6);return {step,modelScore:evaluate(targets(step),d,details).modelScore,target};}):[]};
}
export function cooper(meters:number){if(!Number.isFinite(meters)||meters<=504.9)throw new RangeError('Unsupported Cooper distance.');return (meters-504.9)/44.73;}
export function epley(weight:number,reps:number){if(!Number.isFinite(weight)||weight<=0||!Number.isInteger(reps)||reps<1||reps>10)throw new RangeError('Use positive load and 1–10 whole repetitions.');return reps===1?weight:weight*(1+reps/30);}
export function weightedPullupRatio(addedKg:number,reps:number,weightKg:number){if(!Number.isFinite(addedKg)||addedKg<0||!Number.isFinite(weightKg)||weightKg<=0)throw new RangeError('Invalid pull-up load.');return (epley(weightKg+addedKg,reps)-weightKg)/weightKg;}
export function skinfold(chest:number,abdomen:number,thigh:number,age:number){
  if(![chest,abdomen,thigh].every(n=>Number.isFinite(n)&&n>0&&n<=80)||!Number.isInteger(age)||age<18||age>61)throw new RangeError('Male Jackson–Pollock estimate supports age 18–61 and plausible site measurements.');
  const sum=chest+abdomen+thigh,density=1.10938-.0008267*sum+.0000016*sum*sum-.0002574*age;
  const result=495/density-450;if(!Number.isFinite(result)||result<3||result>60)throw new RangeError('Skinfold estimate outside supported range.');return result;
}
