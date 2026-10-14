import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMetrics,type Demographics,type Values} from './registry';
import {evaluate,score,scoringEligibility,comparableAssessments,simulate,cdf,inverseCdf,calculateSkewedZScore,toModelScore,epley} from './engine';
import {normalizeValues,buildPublicSummary,parsePublicSummary} from './profile';
import {calculationReport} from './calculationReport';
import {normalizeMeasurementMetadata,type MeasurementMetadata} from './measurementMetadata';
import {comparableDelta,type Observation} from './history';
import {signSummary,verifySummary} from './summarySignature';
import {observationAge} from './measurementRules';
const now=Date.parse('2026-10-13T12:00:00Z'),d:Demographics={age:35,sex:'male'},base={pushups:25,sit_to_stand:25,grip_strength:45};
const metric=(id:string)=>activeMetrics.find(m=>m.id===id)!;
const near=(a:number,b:number,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const protocols=(age:number):MeasurementMetadata=>Object.fromEntries(activeMetrics.filter(m=>m.scoringEligible).map(m=>[m.id,m.id==='vo2_max'?{method:'direct_cpet',exerciseMode:'treadmill',protocol:{id:'cpet_treadmill_v1',peakRer:1.1,referencePopulation:'matches'},measuredAt:'2026-10-12T12:00:00Z',ageAtMeasurement:age}:{method:'manual'}]));

test('every active metric and cohort remains finite, bounded and a convex aggregation',()=>{
 let checks=0;
 for(const sex of ['male','female'] as const)for(const age of [18,20,29,30,39,40,69,70,79,80,120]){
  const profile={age,sex},details=protocols(age);
  for(const selector of ['min','mean','midpoint','max'] as const){
   const values=Object.fromEntries(activeMetrics.map(m=>[m.id,selector==='midpoint'?(m.min+m.max)/2:m[selector]])),result=evaluate(values,profile,details,{now});
   assert.ok(Number.isFinite(result.z)&&result.z>=-3&&result.z<=3);assert.ok(result.modelScore>=5&&result.modelScore<=95);
   assert.equal(result.domains.bodymarkers,undefined);
   near(result.submitted.reduce((sum,s)=>sum+s.effectiveWeight,0),1);
   near(result.submitted.reduce((sum,s)=>sum+s.contribution,0),result.z);
   assert.ok(result.z>=Math.min(...result.submitted.map(s=>s.z))-1e-9&&result.z<=Math.max(...result.submitted.map(s=>s.z))+1e-9);
   assert.ok(parsePublicSummary(buildPublicSummary({values,demographics:profile,measurementDetails:details})));
   checks+=result.submitted.length;
  }
 }
 assert.ok(checks>1000);
});

test('scoring is monotonic within each supported metric and sleep has no gain above its plateau',()=>{
 for(const m of activeMetrics.filter(m=>m.scoringEligible)){
  const details=protocols(35),samples=Array.from({length:101},(_,i)=>m.min+(m.max-m.min)*i/100).map(x=>['pushups','sit_to_stand'].includes(m.id)?Math.round(x):x);
  const scores=samples.map(x=>score(m,x,d,details,now));
  for(let i=1;i<scores.length;i++)assert.ok(scores[i]>=scores[i-1]-1e-9,`${m.id} deteriorated when its supported input increased`);
 }
 assert.throws(()=>score(metric('total_sleep'),420,d,{},now),/tracking-only/);
});

test('future and incompatible legacy metadata are retained as recorded data but cannot boost readiness or scores',()=>{
 const original=evaluate(base,d,{}, {now});
 for(const context of [{method:'lab' as const},{method:'manual' as const,measuredAt:'2099-01-01T00:00:00Z'}]){
  const result=evaluate({...base,pushups:150},d,{pushups:context},{now});
  assert.equal(result.measured.length,3);assert.equal(result.scoredCount,2);assert.equal(result.ready,false);
  assert.equal(result.assessments.find(a=>a.metricId==='pushups')?.status,'invalid-context');
  near(result.modelScore,evaluate({sit_to_stand:25,grip_strength:45},d,{}, {now}).modelScore);
 }
 assert.equal(original.ready,true);
 assert.match(observationAge('pushups',{measuredAt:'2099-01-01T00:00:00Z'},now).label,/Future date/);
 assert.match(observationAge('pushups',{measuredAt:'2026-02-31T00:00:00Z'},now).label,/correction/);
});

test('treadmill and cycle CPET cannot share a reference; impossible ages and dates are excluded',()=>{
 for(const exerciseMode of [undefined,'cycle','other'] as const)assert.equal(evaluate({vo2_max:50},d,{vo2_max:{method:'direct_cpet',exerciseMode,ageAtMeasurement:35}},{now}).scoredCount,0);
 const context={method:'direct_cpet' as const,exerciseMode:'treadmill' as const,protocol:{id:'cpet_treadmill_v1',peakRer:1.1,referencePopulation:'matches' as const},measuredAt:'2026-10-12T12:00:00Z',ageAtMeasurement:35};
 const result=evaluate({vo2_max:50},d,{vo2_max:context},{now});assert.equal(result.scoredCount,1);assert.equal(result.submitted[0].reference.cohortLabel,'30–39');
 assert.equal(scoringEligibility(metric('vo2_max'),d,{vo2_max:{...context,ageAtMeasurement:70}},now).status,'invalid-context');
 assert.equal(scoringEligibility(metric('vo2_max'),d,{vo2_max:{...context,measuredAt:'2000-01-01T00:00:00Z'}},now).status,'invalid-context');
 for(const age of [18,19,80,120])assert.equal(scoringEligibility(metric('vo2_max'),{...d,age},{vo2_max:{...context,ageAtMeasurement:age}},now).status,'unsupported-cohort');
 assert.throws(()=>normalizeMeasurementMetadata({pushups:{exerciseMode:'treadmill'}}));
});

test('clinical observations, blanks, invalid values and unknown keys never alter the score or reference set',()=>{
 const a=evaluate(base,d,{}, {now}),values:Values={...base,unknown_copy:150,cmj:NaN,squat_1rm:undefined};
 for(const m of activeMetrics.filter(m=>!m.scoringEligible))values[m.id]=m.min;
 const b=evaluate(values,d,{}, {now});near(a.z,b.z);assert.equal(a.comparisonKey,b.comparisonKey);assert.equal(a.scoredCount,b.scoredCount);
 assert.ok(b.measured.length>a.measured.length);
 assert.equal(b.invalidValues.find(a=>a.metricId==='cmj')?.status,'invalid-value');
});

test('zero repetitions are real observations, distinct from an unmeasured field',()=>{
 const missing=evaluate({total_sleep:420},d),measured=evaluate({grip_strength:45,pushups:0,sit_to_stand:0},d);
 assert.equal(missing.measured.length,1);assert.equal(missing.ready,false);
 assert.equal(measured.measured.length,3);assert.equal(measured.ready,true);
 assert.deepEqual(normalizeValues({pushups:0,sit_to_stand:0},true),{pushups:0,sit_to_stand:0});
});

test('previews use the exact observation precision persisted by the backend without mutating inputs',()=>{
 const values={...base,squat_1rm:1.23456},copy=JSON.stringify(values),a=evaluate(values,d,{}, {now}),b=evaluate(normalizeValues(values,true),d,{}, {now});
 near(a.z,b.z);assert.equal(JSON.stringify(values),copy);assert.equal(a.submitted.find(s=>s.metric.id==='squat_1rm')?.value,1.235);
 assert.throws(()=>score(metric('pushups'),25.00001,d));
});

test('model comparisons require a matching protocol/cohort/subset and a newer full set of dated observations',()=>{
 const details=(date:string):MeasurementMetadata=>Object.fromEntries(Object.keys(base).map(id=>[id,{method:'manual',measuredAt:date,protocol:id==='pushups'?{id:'strict_pushups_v1'}:id==='sit_to_stand'?{id:'chair_stand_30s_v1',chairHeightCm:43}:{id:'grip_single_v1',hand:'left',trials:3,equipment:'fixture dynamometer'}}]));
 const a=evaluate(base,d,details('2026-10-11T12:00:00Z'),{now}),b=evaluate({...base,pushups:30},d,details('2026-10-12T12:00:00Z'),{now});
 assert.ok(comparableAssessments(a,b));assert.equal(comparableAssessments(b,a),false);assert.equal(comparableAssessments(a,a),false);
 const unknown=evaluate(base,d,{}, {now});assert.equal(comparableAssessments(unknown,b),false);
 for(const changed of [evaluate({...base,bench_1rm:1.1},d,details('2026-10-12T12:00:00Z'),{now}),evaluate(base,{...d,age:40},details('2026-10-12T12:00:00Z'),{now}),evaluate(base,{...d,sex:'female'},details('2026-10-12T12:00:00Z'),{now}),evaluate(base,d,{...details('2026-10-12T12:00:00Z'),pushups:{method:'device',measuredAt:'2026-10-12T12:00:00Z'}},{now})])assert.equal(comparableAssessments(a,changed),false);
});

test('a raw trend never mixes metrics, CPET modalities, future observations or cleared latest data',()=>{
 const item=(id:string,value:number,date:string,extra:Partial<Observation>={}):Observation=>({id:date,metricId:id,value,cleared:false,recordedAt:date,measuredAt:date,method:'manual',protocol:{id:'strict_pushups_v1'},...extra});
 const a=item('pushups',20,'2026-10-11T12:00:00Z'),b=item('pushups',25,'2026-10-12T12:00:00Z');
 assert.equal(comparableDelta([b,a],now)?.change,5);
 assert.equal(comparableDelta([{...b,metricId:'sit_to_stand'},a],now),null);
 assert.equal(comparableDelta([{...b,measuredAt:'2099-01-01T00:00:00Z'},a],now),null);
 assert.equal(comparableDelta([{...b,value:25.5},a],now),null);
 assert.equal(comparableDelta([{...b,cleared:true,value:null},a],now),null);
 const cycle=item('vo2_max',45,'2026-10-11T12:00:00Z',{method:'direct_cpet',exerciseMode:'cycle'}),treadmill=item('vo2_max',50,'2026-10-12T12:00:00Z',{method:'direct_cpet',exerciseMode:'treadmill'});
 assert.equal(comparableDelta([cycle,treadmill],now),null);
});

test('normal math utilities remain ordered around zero and invert tails beyond the former eight-unit bracket',()=>{
 assert.ok(cdf(-1e-9)<.5&&cdf(1e-9)>.5);assert.throws(()=>cdf(NaN));
 near(cdf(-9)/1.1285884059538422e-19,1,1e-6);
 const z=inverseCdf(1e-20);assert.ok(z<-8);near(cdf(z)/1e-20,1,1e-10);
 assert.ok(Number.isFinite(calculateSkewedZScore(1e-300,0,1e300,1,1)));
 assert.equal(toModelScore(100),95);assert.equal(toModelScore(-100),5);assert.throws(()=>toModelScore(Infinity));assert.throws(()=>epley(Number.MAX_VALUE,10));
});

test('scenarios never worsen supported performance, mutate saved inputs or emit fractional repetition targets',()=>{
 const values={...base,pushups:0,sit_to_stand:1,total_sleep:120,grip_strength:1},before=JSON.stringify(values),initial=evaluate(values,d);
 for(const strategy of ['Easiest first','Balanced','Strength focus','Cardio focus'] as const){
  const scenario=simulate(values,d,95,strategy);assert.equal(JSON.stringify(values),before);
  assert.ok(evaluate(scenario.targets,d).modelScore>=initial.modelScore-1e-9);
  for(let i=1;i<scenario.points.length;i++)assert.ok(scenario.points[i].modelScore>=scenario.points[i-1].modelScore-1e-9);
  for(const id of ['pushups','sit_to_stand'])assert.ok(Number.isInteger(scenario.targets[id]));
  near(scenario.points.at(-1)!.modelScore,evaluate(scenario.targets,d).modelScore);
  assert.equal(new Set(scenario.points.map(p=>p.step)).size,scenario.points.length);
 }
 assert.throws(()=>simulate(base,d,80,'Typo' as never));
});

test('calculation reports distinguish sparse output from a score and reconcile every recorded contribution',()=>{
 const sparse=calculationReport({values:{pushups:150},demographics:d},now);assert.equal(sparse.overall.modelPoints,null);assert.equal(sparse.coverage.recorded,1);
 const report=calculationReport({values:{...base,apob:95},demographics:d},now);assert.equal(report.coverage.scored,3);assert.equal(report.coverage.trackingOnly,1);assert.equal(report.coverage.percentage,100*4/activeMetrics.length);
 near(report.observations.reduce((sum,o)=>sum+(o.contribution??0),0),report.overall.modelUnits!);assert.equal(report.comparison.recordedMethodsAndDates,false);
});

test('inconsistent snapshots fail closed while V2-signed earlier model snapshots remain verifiable',async()=>{
 const summary=buildPublicSummary({values:base,demographics:d});
 for(const changed of [{...summary,modelScore:99},{...summary,z:2},{...summary,ready:false},{...summary,domains:{...summary.domains,bodymarkers:0}},{...summary,scoredCount:0}])assert.equal(parsePublicSummary(changed),null);
 const historical={...summary,modelVersion:'5.0-triad-experimental',ready:true,z:1,modelScore:65,domains:{strength:1,recovery:1}},key='test-only-key-for-historical-summary-compatibility';
 const signed=await signSummary(historical,'historical-user',d,key);assert.ok(parsePublicSummary(signed));assert.ok(await verifySummary(historical,signed,'historical-user',d,key));
});
