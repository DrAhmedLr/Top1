import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTimestamp,normalizeMeasurementMetadata} from './measurementMetadata';
import {normalizeDemographics,normalizeValues} from './profile';
import {transformHealthPayload} from './adapters/healthSync';
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
