import test from 'node:test';
import assert from 'node:assert/strict';
import {vo2CohortComparison,calibrationInventory} from './scientificCalibration';
import {friend2015} from './friend2015';
import {evaluate,scoringEligibility} from './engine';
import {activeMetrics} from './registry';
import {normalizeMeasurementMetadata} from './measurementMetadata';
import {repeatDetails} from './observationPresentation';
const now=Date.parse('2026-10-14T12:00:00Z'),d={age:35,sex:'male' as const};
const details={vo2_max:{method:'direct_cpet' as const,exerciseMode:'treadmill' as const,ageAtMeasurement:35,measuredAt:'2026-10-12T12:00:00.000Z',protocol:{id:'cpet_treadmill_v1',peakRer:1.1,referencePopulation:'matches' as const}}};
test('all published sex/decade cells use ordered thresholds and source sample counts',()=>{
 assert.equal(friend2015.male.reduce((n,c)=>n+c.n,0),4611);assert.equal(friend2015.female.reduce((n,c)=>n+c.n,0),3172);
 for(const sex of ['male','female'] as const)for(let decade=0;decade<6;decade++){
  const cell=friend2015[sex][decade],age=20+10*decade,ctx={vo2_max:{...details.vo2_max,ageAtMeasurement:age}};
  assert.ok(cell.quantiles.every((q,i)=>i===0||q>cell.quantiles[i-1]));
  const r=vo2CohortComparison({vo2_max:cell.quantiles[3]},{age,sex},ctx,now);assert.equal(r.available,true);if(!r.available)continue;
  assert.equal(r.label,'At the published 50th-percentile threshold');assert.equal(r.cohort.sampleSize,cell.n);assert.equal(r.exactPercentile,null);assert.equal(r.confidenceInterval,null);
 }
});
test('cohort ranges never interpolate, extrapolate or manufacture top-one-percent standing',()=>{
 for(const [value,expected] of [[10,'Below the published 5th-percentile threshold'],[40,'Between the published 25th and 50th-percentile thresholds'],[100,'Above the published 95th-percentile threshold']] as const){const r=vo2CohortComparison({vo2_max:value},d,details,now);assert.equal(r.available,true);if(r.available)assert.equal(r.label,expected);}
 assert.equal(vo2CohortComparison({},d,details,now).available,false);
});
test('unknown dates, effort, population, modality and unsupported cohorts cannot use a published calibration',()=>{
 const metric=activeMetrics.find(m=>m.id==='vo2_max')!;
 const changes=[{measuredAt:undefined},{protocol:undefined},{protocol:{id:'cpet_treadmill_v1',peakRer:.99,referencePopulation:'matches' as const}},{protocol:{id:'cpet_treadmill_v1',peakRer:1.2}},{protocol:{id:'cpet_treadmill_v1',peakRer:1.2,referencePopulation:'outside' as const}},{exerciseMode:'cycle' as const},{ageAtMeasurement:80},{measuredAt:'2026-10-20T12:00:00Z'}];
 for(const change of changes){const ctx={vo2_max:{...details.vo2_max,...change}};assert.notEqual(scoringEligibility(metric,d,ctx,now).status,'eligible');assert.equal(vo2CohortComparison({vo2_max:45},d,ctx,now).available,false);assert.equal(evaluate({vo2_max:45},d,ctx,{now}).measured.length,1);}
 assert.equal(vo2CohortComparison({vo2_max:45},{age:35,sex:'unselected'},details,now).available,false);
});
test('CPET context round-trips in the persisted protocol; repeats require new report confirmation',()=>{
 assert.deepEqual(normalizeMeasurementMetadata(details,{now}),details);
 assert.throws(()=>normalizeMeasurementMetadata({pushups:{protocol:{id:'strict_pushups_v1',peakRer:1.1}}}));
 const repeat=repeatDetails(details.vo2_max,'2026-10-14T12:00:00Z');assert.equal(repeat.protocol?.peakRer,undefined);assert.equal(repeat.protocol?.referencePopulation,undefined);assert.equal(repeat.ageAtMeasurement,undefined);
});
test('calibration coverage cannot turn provisional parameters into validated population ranks',()=>{
 const inventory=calibrationInventory();assert.equal(inventory.length,38);assert.equal(inventory.filter(c=>c.status==='published-test-reference').length,1);assert.ok(inventory.every(c=>!c.populationCalibrated));
 const r=evaluate({vo2_max:45,pushups:30,sit_to_stand:20},d,details,{now});assert.equal(r.publishedReferenceCount,1);assert.equal(r.provisionalReferenceCount,2);assert.equal(r.ready,true);
});
