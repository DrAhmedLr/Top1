import test from 'node:test';
import assert from 'node:assert/strict';
import {observationSeries,repeatDetails,assessmentContext} from './observationPresentation';
import type {Observation} from './history';
const observation=(id:string,day:number,equipment='A'):Observation=>({id,metricId:'cmj',value:30+day,cleared:false,recordedAt:`2026-01-0${day}T12:00:00Z`,measuredAt:`2026-01-0${day}T12:00:00Z`,method:'device',protocol:{id:'cmj_hands_hips_v1',equipment}});
test('chart separates incompatible protocols and unknown-context points',()=>{
 const points=observationSeries([observation('a',1),observation('b',2),observation('c',3,'B'),{...observation('d',4),method:undefined}]);
 assert.equal(points[0].series,points[1].series);assert.notEqual(points[1].series,points[2].series);assert.notEqual(points[2].series,points[3].series);
});
test('repeat retains equipment but never reuses old calculation, window or test age',()=>{
 const repeat=repeatDetails({method:'device',protocol:{id:'sleep_device_7d_v1',equipment:'A'},window:{start:'2026-01-01T00:00:00Z',end:'2026-01-08T00:00:00Z',sampleCount:7,statistic:'mean'},ageAtMeasurement:32},'2026-02-01T00:00:00Z');
 assert.equal(repeat.protocol?.equipment,'A');assert.equal(repeat.window,undefined);assert.equal(repeat.ageAtMeasurement,undefined);
 assert.equal(assessmentContext([{},{}]).unknownDates,2);
});
