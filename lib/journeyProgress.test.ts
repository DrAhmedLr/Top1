import test from 'node:test';
import assert from 'node:assert/strict';
import {comparableAttempts} from './journeyProgress';
import type {MeasurementDetails} from './measurementMetadata';

test('retests require a later date, matching method, and matching equipment',()=>{
 const first:MeasurementDetails={
  method:'manual',
  measuredAt:'2026-11-01T10:00:00Z',
  protocol:{id:'chair_stand_30s_v1',chairHeightCm:45},
 };
 const next={...first,measuredAt:'2026-11-07T10:00:00Z'};
 assert.equal(comparableAttempts(first,next),true);
 assert.equal(comparableAttempts(next,first),false);
 assert.equal(comparableAttempts(first,first),false);
 assert.equal(comparableAttempts(first,{...next,method:undefined}),false);
 assert.equal(comparableAttempts(first,{...next,protocol:{id:'chair_stand_30s_v1',chairHeightCm:50}}),false);
});
