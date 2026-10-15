import {countMetrics} from './measurementRules';
import {protocolKey,protocolComplete,protocolOptions} from './protocols';
import { normalizeMeasurementMetadata, type MeasurementMetadata, type MeasurementDetails } from './measurementMetadata';
import { metrics, pillars, type Metric, type Values, type Demographics, type PillarId } from './registry';
import { getMetricCohortNorm } from './demographics';
import { MODEL_VERSION, MODEL_SCORE_MIN, MODEL_SCORE_MAX } from './model';
export const clamp = (n:number,lo:number,hi:number) => Math.min(hi,Math.max(lo,n));
// Numerical Recipes approximation. Mathematical utility only, never a population rank.
export function cdf(z:number) {
 if(Number.isNaN(z))throw new RangeError('Normal CDF requires a number.');if(z===Infinity)return 1;if(z===-Infinity)return 0;
 // Integrate the normal density near zero: the tail approximation's constant
 // error otherwise reverses ordering immediately beside the mean.
 if(Math.abs(z)<.5){let term=z,sum=z;for(let n=1;n<18;n++){term*=-z*z/(2*n);sum+=term/(2*n+1);}return .5+sum/Math.sqrt(2*Math.PI);}
 const x=Math.abs(z)/Math.SQRT2,t=1/(1+.5*x),erfc=t*Math.exp(-x*x-1.26551223+t*(1.00002368+t*(.37409196+t*(.09678418+t*(-.18628806+t*(.27886807+t*(-1.13520398+t*(1.48851587+t*(-.82215223+t*.17087277)))))))));return z>=0?1-erfc/2:erfc/2;
}
export function inverseCdf(p:number) { if(!Number.isFinite(p)||p<=0||p>=1)throw new RangeError('Probability must be between 0 and 1.');if(p===.5)return 0;let lo=-8,hi=8;while(cdf(lo)>p)lo*=2;while(cdf(hi)<p)hi*=2;for(let i=0;i<90;i++){const mid=(lo+hi)/2;if(cdf(mid)<p)lo=mid;else hi=mid;}return (lo+hi)/2; }
export function reference(m:Metric,d:Demographics,details:MeasurementMetadata={}){
  const norm=getMetricCohortNorm(m.id,m.id==='vo2_max'&&details[m.id]?.ageAtMeasurement!==undefined?{...d,age:details[m.id].ageAtMeasurement!}:d);
  return {...norm,sd:norm.stdDev,L:norm.lms?.L??0,M:norm.lms?.M??norm.mean,S:norm.lms?.S??Math.sqrt(Math.log(1+(norm.stdDev/norm.mean)**2))};
}
export function valid(m:Metric,x:number|undefined):x is number{return typeof x==='number'&&Number.isFinite(x)&&x>=m.min&&x<=m.max&&(!countMetrics.has(m.id)||Number.isInteger(x));}
export type EligibilityStatus='eligible'|'archived'|'context-only'|'invalid-context'|'protocol-required'|'unsupported-cohort';
export function scoringEligibility(m:Metric,d:Demographics,details:MeasurementMetadata={},now=Date.now()):{status:EligibilityStatus;reason:string}{
  if(details[m.id]?.invalidContext)return {status:'invalid-context',reason:'Stored details need review. The raw observation is retained but does not enter the model.'};
  if(m.archived)return {status:'archived',reason:'Preserved legacy observation; outside the active model.'};
  if(!m.scoringEligible)return {status:'context-only',reason:'Context and tracking only; no model score.'};
  if(d.sex==='unselected')return {status:'unsupported-cohort',reason:'Raw tracking is available. Choose a supported reference cohort only if you want experimental comparisons.'};
  const context=details[m.id]??{};
  try{normalizeMeasurementMetadata({[m.id]:context},{now});}catch{return {status:'invalid-context',reason:'The method or date needs correction before this observation can enter the model.'};}
  if(m.id==='vo2_max'){
    if(context.method!=='direct_cpet'||context.exerciseMode!=='treadmill')return {status:'protocol-required',reason:'The published reference requires direct treadmill CPET. Cycle tests, estimates and unknown modalities remain tracking only.'};
    if(!context.measuredAt||context.protocol?.id!=='cpet_treadmill_v1'||!protocolComplete(m.id,context.protocol))return {status:'protocol-required',reason:'The FRIEND reference requires a dated direct treadmill CPET report, peak RER ≥ 1.0, and confirmed match to its population (no known cardiovascular disease or COPD). Unknown or unmatched context remains tracking only.'};
    const age=context.ageAtMeasurement;
    if(!Number.isInteger(age)||age!<20||age!>89)return {status:'unsupported-cohort',reason:'Record a test age of 20–89 for the supported treadmill cohort.'};
    if(age!>d.age)return {status:'invalid-context',reason:'The test age exceeds your profile age. Check both before using this reference.'};
    if(context.measuredAt){const years=new Date(now).getUTCFullYear()-new Date(context.measuredAt).getUTCFullYear();if(Math.abs((d.age-age!)-years)>1)return {status:'invalid-context',reason:'The test date and recorded ages do not agree. Check the test age and your current profile age.'};}
  }
  return {status:'eligible',reason:m.id==='vo2_max'?'Published treadmill cohort parameters; self-reported protocol.':'Provisional product reference; not a validated benchmark.'};
}
export function eligible(m:Metric,d:Demographics,details:MeasurementMetadata={},now=Date.now()){return scoringEligibility(m,d,details,now).status==='eligible';}
function validateProfile(d:Demographics){
  if(!Number.isInteger(d.age)||d.age<18||d.age>120||!['male','female','unselected'].includes(d.sex)||d.weight!==undefined&&(!Number.isFinite(d.weight)||d.weight<25||d.weight>350)||d.height!==undefined&&(!Number.isFinite(d.height)||d.height<100||d.height>240))throw new RangeError('Invalid demographic profile.');
}
export function calculateBoundedZScore(val:number,minOpt:number,maxOpt:number,stdDev:number){
  if(![val,minOpt,maxOpt,stdDev].every(Number.isFinite)||stdDev<=0||minOpt>maxOpt)throw new RangeError('Invalid bounded parameters.');
  const distance=Math.max(minOpt-val,0,val-maxOpt);
  return 1-(distance/stdDev)**2; // continuous quadratic plateau; no percentile claim
}
export function calculateSkewedZScore(val:number,L:number,M:number,S:number,polarity:number){
  if(![val,L,M,S,polarity].every(Number.isFinite)||val<=0||M<=0||S<=0||Math.abs(polarity)!==1)throw new RangeError('Invalid LMS parameters.');
  // expm1 avoids cancellation; L=0 is the exact logarithmic limit.
  const relative=(val-M)/M;
  const log=Number.isFinite(relative)&&relative>-1?Math.log1p(relative):Math.log(val)-Math.log(M);
  return polarity*(L===0?log/S:Math.expm1(L*log)/(L*S));
}
export function score(m:Metric,x:number,d:Demographics,details:MeasurementMetadata={},now=Date.now()){
  validateProfile(d);
  if(!valid(m,x))throw new RangeError(`Unsupported value for ${m.id}.`);
  // Match the canonical numeric(10,3) observation used by cloud persistence.
  x=Number(x.toFixed(3));
  if(!eligible(m,d,details,now))throw new RangeError(`${m.id} is tracking-only for this profile. ${scoringEligibility(m,d,details,now).reason}`);
  const r=reference(m,d,details);
  // Sleep consensus establishes a lower-duration recommendation, not evidence
  // that every duration over 9 h should be penalized. No gain above the plateau.
  const raw=m.id==='total_sleep'?calculateBoundedZScore(Math.min(x,540),420,540,r.sd)
    :m.scoringType==='bounded'&&r.boundedOptimal?calculateBoundedZScore(x,r.boundedOptimal.minOptimal,r.boundedOptimal.maxOptimal,r.sd)
    :m.scoringType==='skewed'?calculateSkewedZScore(x,r.L,r.M,r.S,m.polarity)
    :m.polarity*(x-r.mean)/r.sd;
  return clamp(raw,MODEL_SCORE_MIN,MODEL_SCORE_MAX);
}
export function toModelScore(z:number){if(!Number.isFinite(z))throw new RangeError('Model units must be finite.');return 50+15*clamp(z,MODEL_SCORE_MIN,MODEL_SCORE_MAX);}
export type Scored={metric:Metric;value:number;z:number;modelScore:number;defect:number;context:MeasurementDetails;reference:ReturnType<typeof reference>;effectiveWeight:number;contribution:number};
export function evaluate(values:Values,d:Demographics,details:MeasurementMetadata={},options:{now?:number}={}){
  validateProfile(d);
  const now=options.now??Date.now();if(!Number.isFinite(now)||!Number.isFinite(new Date(now).getTime()))throw new RangeError('Invalid assessment time.');
  const measured=metrics.filter(m=>!m.archived&&valid(m,values[m.id]));
  const invalidValues=metrics.filter(m=>!m.archived&&values[m.id]!=null&&!valid(m,values[m.id])).map(m=>({metricId:m.id,status:'invalid-value' as const,reason:'Outside the supported value range or repetition precision; excluded from scoring and coverage.'}));
  const assessments=measured.map(metric=>({metricId:metric.id,...scoringEligibility(metric,d,details,now),dated:!!details[metric.id]?.measuredAt,knownMethod:!!details[metric.id]?.method}));
  const accepted=new Set(assessments.filter(s=>s.status==='eligible').map(s=>s.metricId));
  const submitted:Scored[]=measured.filter(m=>accepted.has(m.id)).map(metric=>{const value=Number(values[metric.id]!.toFixed(3));const z=score(metric,value,d,details,now);return {metric,value,z,modelScore:toModelScore(z),defect:0,context:normalizeMeasurementMetadata({[metric.id]:details[metric.id]??{}},{now})[metric.id],reference:reference(metric,d,details),effectiveWeight:0,contribution:0};});
  const domains:Partial<Record<PillarId,number>>={};
  for(const p of pillars){
    const group=submitted.filter(s=>s.metric.pillar===p.id);if(!group.length)continue;
    // A weighted MEAN preserves the unit scale. Covariance-normalizing a sum
    // assumes validated joint distributions; no such data exist for this model.
    const weight=group.reduce((sum,s)=>sum+s.metric.weight,0);
    domains[p.id]=clamp(group.reduce((sum,s)=>sum+s.metric.weight*s.z,0)/weight,MODEL_SCORE_MIN,MODEL_SCORE_MAX);
  }
  const active=pillars.filter(p=>domains[p.id]!==undefined);
  const weight=active.reduce((sum,p)=>sum+p.weight,0);
  const z=weight?clamp(active.reduce((sum,p)=>sum+p.weight*domains[p.id]!,0)/weight,MODEL_SCORE_MIN,MODEL_SCORE_MAX):0;
  const completeness=clamp(100*measured.reduce((sum,m)=>sum+pillars.find(p=>p.id===m.pillar)!.weight*m.weight,0),0,100);
  const domainWeights=Object.fromEntries(active.map(p=>[p.id,p.weight/weight])) as Partial<Record<PillarId,number>>;
  for(const s of submitted){const groupWeight=submitted.filter(x=>x.metric.pillar===s.metric.pillar).reduce((sum,x)=>sum+x.metric.weight,0);s.effectiveWeight=domainWeights[s.metric.pillar]!*s.metric.weight/groupWeight;s.contribution=s.effectiveWeight*s.z;s.defect=domains[s.metric.pillar]!-s.z;}
  // Values and dates do not define a protocol/reference set. Changing either
  // may be compared only when the known methods and reference cells still match.
  const comparisonKey=JSON.stringify([MODEL_VERSION,d.sex,submitted.map(s=>[s.metric.id,s.context.method??null,s.context.exerciseMode??null,protocolKey(s.context.protocol),s.reference.cohortLabel??null,s.reference.provenance,s.reference.mean,s.reference.sd,s.reference.L,s.reference.M,s.reference.S,s.reference.boundedOptimal??null,s.effectiveWeight]).sort((a,b)=>String(a[0])<String(b[0])?-1:String(a[0])>String(b[0])?1:0)]);
  const ready=submitted.length>=3&&active.length>=1;
  return {modelVersion:MODEL_VERSION,assessedAt:new Date(now).toISOString(),ready,readinessReason:ready?'Experimental model available; this is not statistical confidence.':submitted.length<3?'Record three eligible observations.':'Record three eligible capacity observations.',z,modelScore:toModelScore(z),completeness,coverageTier:completeness<40?'Low':completeness<75?'Moderate':'High',domains,domainWeights,comparisonKey,comparable:ready&&submitted.every(s=>!!s.context.method&&!!s.context.measuredAt&&(!protocolOptions[s.metric.id]||protocolComplete(s.metric.id,s.context.protocol))),assessments,invalidValues,submitted,measured,publishedReferenceCount:submitted.filter(s=>s.reference.provenance==='published').length,provisionalReferenceCount:submitted.filter(s=>s.reference.provenance==='provisional').length,scoredCount:submitted.length,activeDomainCount:active.length,trackingOnly:measured.filter(m=>!accepted.has(m.id)),bottlenecks:submitted.filter(s=>s.defect>=.75).sort((a,b)=>b.defect-a.defect),strengths:[...submitted].sort((a,b)=>b.z-a.z).slice(0,3)};
}
export function comparableAssessments(a:ReturnType<typeof evaluate>,b:ReturnType<typeof evaluate>){return a.comparable&&b.comparable&&a.comparisonKey===b.comparisonKey&&b.submitted.every(s=>Date.parse(s.context.measuredAt!)>Date.parse(a.submitted.find(previous=>previous.metric.id===s.metric.id)!.context.measuredAt!));}
export type Strategy='Easiest first'|'Cardio focus'|'Strength focus'|'Balanced';
export function simulate(values:Values,d:Demographics,target:number,strategy:Strategy,details:MeasurementMetadata={},options:{allowPartial?:boolean}={}){
  if(!Number.isFinite(target)||target<0||target>100)throw new RangeError('Model target must be 0–100.');
  if(!['Easiest first','Cardio focus','Strength focus','Balanced'].includes(strategy))throw new RangeError('Choose a supported scenario strategy.');
  const now=Date.now(),result=evaluate(values,d,details,{now});
  const ready=result.ready||!!options.allowPartial&&result.submitted.length>0;
  let selected=result.submitted.filter(s=>s.metric.scenarioChangePerStep>0);
  if(strategy==='Easiest first')selected=selected.filter(s=>s.metric.easiestPathPriority<=2);
  else if(strategy==='Balanced')selected=[...selected].sort((a,b)=>a.z-b.z).slice(0,3);
  else if(strategy==='Cardio focus')selected=selected.filter(s=>['vo2_max','zone2_power','hrr_1min'].includes(s.metric.id));
  else selected=selected.filter(s=>s.metric.pillar==='strength'&&!['vo2_max','zone2_power','hrr_1min'].includes(s.metric.id));
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
      if(countMetrics.has(m.id))value=Math.round(value);
      // A clipped starting score must never cause an instantaneous deterioration.
      next[m.id]=clamp(m.polarity===1?Math.max(s.value,value):Math.min(s.value,value),m.min,m.max);
      if(m.id==='total_sleep'&&s.value<420)next[m.id]=clamp(value,m.min,420);
    }
    return next;
  };
  const evaluated=new Map<number,ReturnType<typeof evaluate>>([[0,result]]);
  const at=(step:number)=>{const cached=evaluated.get(step);if(cached)return cached;const computed=evaluate(targets(step),d,details,{now});evaluated.set(step,computed);return computed;};
  let steps:number|null=null;
  // Each selected trajectory is non-decreasing under the fixed reference set.
  // Find the first attainable integer step without reevaluating 260 full profiles.
  if(ready){if(target<=result.modelScore)steps=0;else if(selected.length&&at(260).modelScore>=target){let lo=1,hi=260;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(at(mid).modelScore>=target)hi=mid;else lo=mid+1;}steps=lo;}}
  const horizon=steps??260;
  const final=ready?targets(horizon):{...values};
  return {steps,selected:ready?selected:[],targets:final,ceiling:ready?at(260).modelScore:null,reason:!ready?'insufficient-data':steps===null?'unreachable':'reached',points:ready?Array.from(new Set(Array.from({length:7},(_,i)=>Math.round(i*horizon/6)))).map(step=>({step,modelScore:at(step).modelScore,target})):[]};
}
export {cooper,epley,weightedPullupRatio,skinfold} from './derivations';
