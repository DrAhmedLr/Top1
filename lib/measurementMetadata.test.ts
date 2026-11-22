import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTimestamp,normalizeMeasurementMetadata} from './measurementMetadata';
import {normalizeDemographics,normalizeValues} from './profile';
import {transformHealthPayload} from './adapters/healthSync';
import {repeatDetails} from './observationPresentation';
import {protocolComplete,protocolKey,PROFILE_ONLY_PROTOCOL} from './protocols';
import {performanceProfileAtTest,withPerformanceProfile} from './performanceContext';
import {COMPETITIVE_CHALLENGE_METRICS} from './competitiveMetrics';

test('each open test retains its own profile without inventing a measurement method',()=>{
 const profile={age:28,sex:'female' as const,weight:68};
 for(const id of COMPETITIVE_CHALLENGE_METRICS){
  const saved=normalizeMeasurementMetadata({[id]:withPerformanceProfile(id,{},profile)})[id];
  assert.deepEqual(performanceProfileAtTest({age:60,sex:'male',weight:97},saved),profile,id);
  assert.ok(!saved.method);
  if(id!=='pushups'){
   assert.equal(saved.protocol?.id,PROFILE_ONLY_PROTOCOL);
   assert.equal(protocolComplete(id,saved.protocol),false);
   assert.equal(protocolKey(saved.protocol),null);
  }
  const next=repeatDetails(saved,'2026-11-22T10:00:00Z');
  assert.equal(next.protocol?.bodyWeightKg,undefined,id);
  assert.equal(next.protocol?.referenceSex,undefined,id);
 }
 assert.deepEqual(withPerformanceProfile('bp_systolic',{},profile),{});
 const missing=withPerformanceProfile('run_5k',{},{});
 assert.deepEqual(performanceProfileAtTest(profile,missing),{age:undefined,sex:'unselected',weight:undefined});
});

test('a lift keeps the bodyweight used in its calculation and a documented protocol stays intact',()=>{
 const lift=withPerformanceProfile('bench_1rm',{
  method:'direct_1rm',protocol:{id:'bench_paused_v1'},
  derivation:{formula:'epley_ratio_v1',inputs:[100,1],bodyWeightKg:80},
 },{age:29,sex:'male',weight:95});
 assert.equal(lift.protocol?.id,'bench_paused_v1');
 assert.equal(lift.protocol?.bodyWeightKg,80);
 assert.equal(performanceProfileAtTest(undefined,lift).weight,80);
});

test('strict push-ups preserve the test-day profile and start each retest with fresh context',()=>{
 const protocol={id:'strict_pushups_v1',bodyWeightKg:90,referenceSex:'female' as const};
 const stored=normalizeMeasurementMetadata({pushups:{ageAtMeasurement:45,protocol}}).pushups;
 assert.deepEqual(stored,{ageAtMeasurement:45,protocol});
 const next=repeatDetails(stored,'2026-11-22T00:00:00Z');
 assert.equal(next.protocol?.bodyWeightKg,undefined);
 assert.equal(next.protocol?.referenceSex,undefined);
 assert.equal(next.ageAtMeasurement,undefined);
 assert.equal(stored.protocol?.bodyWeightKg,90);
 assert.equal(protocolKey(stored.protocol),protocolKey(next.protocol));
 for(const patch of [{bodyWeightKg:0},{bodyWeightKg:Infinity},{referenceSex:'other'}]){
  assert.throws(()=>normalizeMeasurementMetadata({pushups:{protocol:{...protocol,...patch}}}));
 }
 assert.throws(()=>normalizeMeasurementMetadata({hrv:{protocol:{id:'hrv_rmssd_supine_v1',referenceSex:'female'}}}));
});
test('timestamps require a timezone and a real calendar date',()=>{
 assert.equal(normalizeTimestamp('2026-10-09T10:00:00+01:00'),'2026-10-09T09:00:00.000Z');
 for(const value of ['2026-02-31T00:00:00Z','2026-10-09','unknown','2026-10-09T25:00:00Z'])assert.throws(()=>normalizeTimestamp(value));
});
test('unknown metadata stays unknown and malformed methods never become verified tests',()=>{
 assert.deepEqual(normalizeMeasurementMetadata(undefined),{});
 assert.deepEqual(normalizeMeasurementMetadata({rhr:{}}),{rhr:{}});
 assert.throws(()=>normalizeMeasurementMetadata({vo2_max:{method:'verified'}}));
 assert.throws(()=>normalizeDemographics({age:32,sex:['male'],weight:78,height:180}));
});
test('client precision matches PostgreSQL snapshot and measurement precision',()=>{
 assert.deepEqual(normalizeValues({squat_1rm:1.23456}),{squat_1rm:1.235});
 assert.equal(normalizeDemographics({age:32,sex:'male',weight:78.1234,height:180}).weight,78.12);
});
test('wearable imports retain timestamps, label estimates and do not overwrite newer observations',()=>{
 const payload={source:'garmin' as const,timestamp:'2026-10-08T10:00:00Z',metrics:{vo2Max:50,restingHeartRate:55}};
 const result=transformHealthPayload(payload,{rhr:52},{rhr:{measuredAt:'2026-10-09T10:00:00Z'}});
 assert.equal(result.values.rhr,52);assert.equal(result.values.vo2_max,50);assert.equal(result.measurementDetails.vo2_max.method,'wearable_estimate');
});

test('retired thermal observations remain valid stored legacy values',()=>{const old={sauna_minutes:75,cold_plunge_minutes:13,thermal_hrv_rebound:1.5};assert.deepEqual(normalizeValues(old),old);});
