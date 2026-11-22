import assert from 'node:assert/strict';
import test from 'node:test';
import {COMPETITIVE_CHALLENGE_METRICS} from './challengeProgress';
import type {CalibrationArtifact} from './benchmarkCalibration';
import {overallPerformance, overallChangeForSave, performanceAreas} from './overallPerformance';
import {worldwidePerformance} from './worldwidePerformance';
import type {MeasurementMetadata} from './measurementMetadata';

const complete = {pushups:20, pullups:10, broad_jump:2, run_5k:25};
const now = Date.parse('2026-11-22T12:00:00Z');
const profile = {age:30,sex:'male' as const,weight:75};

test('all thirteen eligible tests have one area; only available valid areas contribute', () => {
  const ids = Object.values(performanceAreas).flat();
  assert.equal(ids.length,13);
  assert.deepEqual(new Set(ids),COMPETITIVE_CHALLENGE_METRICS);
  const one = overallPerformance({pushups:150, fasting_glucose:90, total_sleep:480},{},profile,now);
  assert.equal(one.coverage,1);
  assert.equal(one.testCount,1);
  assert.ok(one.overall);
  assert.equal(one.overall.percent,.01);
  assert.equal(overallPerformance({total_sleep:480},{},profile,now).overall,null);
  const first = overallPerformance(complete,{},profile,now);
  assert.equal(first.coverage,4);
  assert.ok(first.overall);
  assert.deepEqual(overallPerformance({...complete,rhr:46,apob:5,body_fat:12},{},profile,now),first);
  assert.equal(overallPerformance(complete,{pushups:{invalidContext:{message:'invalid',original:null}}},profile,now).coverage,3);
  assert.equal(overallPerformance({...complete,broad_jump:NaN},{},profile,now).coverage,3);
  assert.equal(overallPerformance(complete,{pullups:{measuredAt:'2027-01-01T12:00:00Z'}},profile,now).coverage,3);
  const wrongLift:MeasurementMetadata = {bench_1rm:{method:'direct_1rm',derivation:{formula:'epley_ratio_v1',inputs:[100,1],bodyWeightKg:80}}};
  assert.equal(overallPerformance({bench_1rm:3},wrongLift,profile,now).coverage,0);
});

test('area averages share weight evenly and the weakest-area guard applies to an uneven performance profile', () => {
  // These three field rules each give the Top 1% milestone.
  const four = {pushups:60,dead_hang:180,broad_jump:2.65,run_5k:20};
  const r = overallPerformance(four,{},profile,now);
  assert.equal(r.overall?.tier,'1%');
  assert.equal(r.overall?.points,2);
  assert.deepEqual(overallPerformance({...four,sprint_400m:50},{},profile,now).overall,r.overall);
  assert.notEqual(overallPerformance({...four,pushups:150},{},profile,now).overall?.tier,'1%');
  const mixed = overallPerformance({...four,pushups:150,run_5k:180},{},profile,now);
  assert.equal(mixed.overall?.limitedByWeakest,true);
  assert.equal(mixed.overall?.tier,'10%');
  const extra = overallPerformance({...four,dips:0},{},profile,now);
  assert.equal(extra.testCount,5);
  assert.equal(extra.areas[0].points,1);
  assert.equal(extra.overall?.points,1.75);
});

test('combined push-up contribution uses the same saved bodyweight and reference sex as the individual tier', () => {
  const context:MeasurementMetadata = {pushups:{ageAtMeasurement:50,protocol:{id:'strict_pushups_v1',bodyWeightKg:95,referenceSex:'female'}}};
  const a = overallPerformance(complete,context,profile,now);
  const b = overallPerformance(complete,context,{age:20,weight:55,sex:'male'},now);
  assert.deepEqual(a.areas[0],b.areas[0]);
  assert.notEqual(a.areas[0].tier,overallPerformance(complete,{},profile,now).areas[0].tier);
});

test('the second test updates the provisional percentage, including a second test in the same area',()=>{
  const first=overallChangeForSave('pushups',20,{}, {},{},profile,profile,now);
  assert.deepEqual(first,{previous:null,current:20,coverage:1,testCount:1});
  const next=overallChangeForSave('run_5k',25,{}, {pushups:20},{},profile,profile,now);
  assert.equal(next?.previous,20);
  assert.equal(next?.coverage,2);
  assert.equal(next?.testCount,2);
  assert.ok(Math.abs(next!.current-Math.sqrt(20*10))<1e-9);
  const sameArea=overallChangeForSave('dips',18,{}, {pushups:20},{},profile,profile,now);
  assert.equal(sameArea?.coverage,1);
  assert.equal(sameArea?.testCount,2);
  assert.equal(sameArea?.current,next?.current);
  const retest=overallChangeForSave('run_5k',26,{}, {pushups:20,run_5k:25},{},profile,profile,now);
  assert.equal(retest?.previous,next?.current);
  assert.ok(retest!.current>retest!.previous!);
  assert.equal(retest?.testCount,2);
  const unchanged=overallChangeForSave('run_5k',25,{}, {pushups:20,run_5k:25},{},profile,profile,now);
  assert.equal(unchanged?.current,unchanged?.previous);
  assert.equal(overallChangeForSave('sit_to_stand',28,{}, {pushups:20},{},profile,profile,now),null);
  assert.equal(overallChangeForSave('apob',70,{}, {pushups:20},{},profile,profile,now),null);
});

test('a worldwide estimate needs a reviewed four-area battery and an identifiable, resolved reference tail', () => {
  const variables = [
    {id:'pushups',domain:'push',protocolId:'strict_pushups_v1',direction:1},
    {id:'pullups',domain:'pull',protocolId:'strict_pullups_v1',direction:1},
    {id:'broad_jump',domain:'lower',protocolId:'standing_broad_jump_v1',direction:1},
    {id:'run_5k',domain:'running',protocolId:'run5k_outdoor_gps_v1',direction:-1},
  ] satisfies CalibrationArtifact['variables'];
  const details:MeasurementMetadata = Object.fromEntries(variables.map(v => [v.id,{method:'manual',measuredAt:'2026-11-20T10:00:00Z',protocol:{id:v.protocolId}}]));
  const sample = (split:string) => Array.from({length:50},(_,i) => ({id:split+i,weight:1,values:{pushups:i,pullups:i,broad_jump:1+i/50,run_5k:45-i/2}}));
  const a:CalibrationArtifact = {
    id:'test-only',version:'test-v1',batteryId:'test-battery',population:'Test fixture only',scope:'worldwide-adults',
    sourceKind:'probability-sample',representative:true,approved:true,variables,
    domainWeights:{push:.25,pull:.25,lower:.25,running:.25},normalization:sample('n'),validation:sample('v'),
    validationReport:'unit-test fixture',samplingDesign:'unit-test fixture',effectiveSampleSize:50,
    validatedPercentileCeiling:100,confidenceLevel:.95,uncertaintyMethod:'test envelope',confidenceDefinition:'strict-below',
    confidenceBands:[{score:0,lower:0,upper:.15},{score:1,lower:.85,upper:1}],
  };
  assert.deepEqual(worldwidePerformance(null,complete,details,now),{available:false,reason:'reference'});
  assert.equal(worldwidePerformance({...a,scope:'national-adults'},complete,details,now).available,false);
  assert.equal(worldwidePerformance({...a,cohort:{ageMin:20,ageMax:29}},complete,details,now).available,false);
  assert.equal(worldwidePerformance({...a,sourceKind:'convenience'},complete,details,now).available,false);
  assert.equal(worldwidePerformance({...a,domainWeights:{push:.5,pull:.2,lower:.2,running:.1}},complete,details,now).available,false);
  assert.deepEqual(worldwidePerformance(a,complete,{},now),{available:false,reason:'battery'});
  const midpoint = {pushups:25,pullups:25,broad_jump:1.5,run_5k:32.5};
  const out = worldwidePerformance(a,midpoint,details,now);
  assert.ok(out.available);
  assert.equal(out.topPercent,50);
  assert.ok(out.interval[0] <= 50 && out.interval[1] >= 50);
  const best = {pushups:100,pullups:50,broad_jump:3,run_5k:12};
  assert.deepEqual(worldwidePerformance(a,best,details,now),{available:false,reason:'precision'});
  assert.deepEqual(worldwidePerformance({...a,effectiveSampleSize:4},{pushups:40,pullups:40,broad_jump:1.8,run_5k:25},details,now),{available:false,reason:'precision'});
});
