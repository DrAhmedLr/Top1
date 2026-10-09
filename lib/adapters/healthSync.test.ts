import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transformHealthPayloadToProfile, type ExternalHealthPayload } from './healthSync';
const payload:ExternalHealthPayload={source:'apple_health',hrvStatistic:'rmssd',timestamp:'2026-10-09T10:00:00Z',metrics:{restingHeartRate:52,hrvMs:65,totalSleepMinutes:480,sleepEfficiencyPercent:94,vo2Max:50,apobMgDl:70,fastingInsulinUiuMl:4,hscrpMgL:.3}};
test('all eight normalized fields map to registry IDs without mutating inputs',()=>{
  const existing={body_fat:20,rhr:60};
  assert.deepEqual(transformHealthPayloadToProfile(payload,existing),{body_fat:20,rhr:52,hrv:65,total_sleep:480,sleep_efficiency:94,vo2_max:50,apob:70,fasting_insulin:4,hscrp:.3});
  assert.deepEqual(existing,{body_fat:20,rhr:60});
});
test('partial and empty payloads preserve unprovided measurements and undefined profile inputs',()=>{
  const existing={apob:90,rhr:undefined};
  assert.deepEqual(transformHealthPayloadToProfile({...payload,metrics:{hrvMs:72}},existing),{apob:90,rhr:undefined,hrv:72});
  const updated=transformHealthPayloadToProfile({...payload,metrics:{}},existing);
  assert.deepEqual(updated,existing);assert.notEqual(updated,existing);
});
test('all supported providers share the normalized adapter',()=>{
  for(const source of ['apple_health','garmin','oura','whoop','quest_diagnostics'] as const) assert.equal(transformHealthPayloadToProfile({...payload,source},{}).apob,70);
});
test('nonfinite, wrong-unit range, and runtime null values fail atomically',()=>{
  const existing={rhr:60};
  for(const value of [NaN,Infinity,-1,500,null] as const) assert.throws(()=>transformHealthPayloadToProfile({...payload,metrics:{restingHeartRate:50,vo2Max:value as number}},existing),RangeError);
  assert.deepEqual(existing,{rhr:60});
});

test('SDNN and undefined HRV definitions cannot enter the RMSSD field',()=>{
 assert.throws(()=>transformHealthPayloadToProfile({...payload,hrvStatistic:'sdnn'},{}),/RMSSD/);
 assert.throws(()=>transformHealthPayloadToProfile({...payload,hrvStatistic:undefined},{}),/RMSSD/);
});
