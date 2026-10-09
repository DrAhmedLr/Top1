import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ageBrackets,demographicLookup,getAgeBracket,getMetricCohortNorm,getMetricBenchmark} from './demographics';
import {metrics,activeMetrics,type Demographics,type Values} from './registry';
import {evaluate,reference,score,eligible} from './engine';
import {getPairwiseCorrelation,getScoredCorrelation} from './correlations';
const d:Demographics={age:25,sex:'male',weight:80,height:180};
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6);
const details={vo2_max:{method:'direct_cpet' as const,ageAtMeasurement:35},grip_strength:{method:'dynamometer_single_hand' as const}};
test('all model cells are finite, but only VO2 parameters are source-grounded',()=>{
 assert.equal(Object.keys(demographicLookup).length,38);
 for(const m of metrics)for(const sex of ['male','female'] as const)for(const bracket of ageBrackets){
  const norm=demographicLookup[m.id][sex][bracket];assert.ok(Number.isFinite(norm.mean)&&norm.stdDev>0);
  assert.equal(norm.provenance,m.id==='vo2_max'?'published':'provisional');
  const profile={...d,sex,age:Number.parseInt(bracket,10)};
  if(eligible(m,profile,details))for(const value of [m.min,m.mean,m.max])assert.ok(Number.isFinite(score(m,value,profile,details)));
 }
});
test('age cohort boundaries are explicit and do not falsely expand the published age range',()=>{
 for(const [age,bracket] of [[18,'18-24'],[24.9,'18-24'],[25,'25-29'],[30,'30-34'],[70,'70+'],[100,'70+']] as const)assert.equal(getAgeBracket(age),bracket);
 for(const age of [17,NaN,Infinity])assert.throws(()=>getAgeBracket(age),RangeError);
 assert.equal(getMetricCohortNorm('vo2_max',{...d,age:80}).provenance,'provisional');
});
test('FRIEND 2015 means/SDs replace arbitrary 7-percent decay and narrow SDs',()=>{
 const male=getMetricCohortNorm('vo2_max',d),female=getMetricCohortNorm('vo2_max',{...d,sex:'female'});
 near(male.mean,47.6);near(male.stdDev,11.3);near(female.mean,37.6);near(female.stdDev,10.2);
 near(getMetricCohortNorm('vo2_max',{...d,age:40}).mean,38.8);
 near(getMetricCohortNorm('vo2_max',{...d,age:70,sex:'female'}).stdDev,3.6);
});
test('lift SDs are no longer manufactured to turn a product target into P99',()=>{
 const m=metrics.find(m=>m.id==='squat_1rm')!,r=reference(m,d);near(r.sd,.45);
 assert.equal(getMetricBenchmark('body_fat',d),'Context required · tracked without scoring');
 assert.equal(getMetricBenchmark('hba1c',d),'Context required · tracked without scoring');
});
test('legacy correlations retain directional semantics but are not used by aggregation',()=>{
 near(getPairwiseCorrelation('squat_1rm','deadlift_1rm'),.68);near(getPairwiseCorrelation('deadlift_1rm','squat_1rm'),.68);
 near(getScoredCorrelation('rhr','hrv',-1,1),.55);near(getPairwiseCorrelation('apob','ggt'),.15);
});
test('full raw-data coverage is independent of scoring eligibility and does not establish confidence',()=>{
 const values:Values=Object.fromEntries(metrics.map(m=>[m.id,m.mean]));
 for(const sex of ['male','female'] as const)for(const bracket of ageBrackets){const result=evaluate(values,{...d,sex,age:Number.parseInt(bracket,10)},details);near(result.completeness,100);assert.equal(result.measured.length,36);assert.equal(result.coverageTier,'High');assert.ok(result.scoredCount<36);assert.ok(Number.isFinite(result.z));}
});
