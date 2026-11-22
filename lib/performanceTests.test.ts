import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMetrics,metrics} from './registry';
import {benchmarkGame,metricGameEstimate} from './benchmarkGame';
import {normalizeValues} from './profile';
import {evaluate} from './engine';
import {normalizeMeasurementMetadata} from './measurementMetadata';
const d={age:35,sex:'male' as const};
test('new field tests have game benchmarks while scientific scoring stays unchanged',()=>{
 const base={pushups:25,total_sleep:450},added={pullups:21,sprint_400m:60,dead_hang:120};
 assert.deepEqual(normalizeValues(added,true),added);
 assert.equal(benchmarkGame({...base,...added},d).rows.length,5);
 assert.equal(evaluate({...base,...added},d).modelScore,evaluate(base,d).modelScore);
 for(const [id,value] of Object.entries(added)){
  const m=activeMetrics.find(m=>m.id===id)!;
  assert.equal(m.scoringEligible,false);assert.ok(metricGameEstimate(id,value,d)?.top);
  assert.ok(m.proofData.url);assert.match(m.proofData.sampleSize,/not|no /i);
 }
 assert.throws(()=>normalizeValues({pullups:3.5},true));
 assert.throws(()=>normalizeValues({sprint_400m:2.5},true));
 assert.throws(()=>normalizeValues({dead_hang:1201},true));
 assert.deepEqual(normalizeValues({pullups:0,dead_hang:0},true),{pullups:0,dead_hang:0});
});
test('retired acceleration data remain distinct and new protocols round-trip',()=>{
 assert.equal(metrics.find(m=>m.id==='sprint_10m')?.archived,true);
 assert.deepEqual(normalizeValues({sprint_10m:2.5,sprint_400m:60},true),{sprint_10m:2.5,sprint_400m:60});
 const details={pullups:{protocol:{id:'strict_pullups_v1'}},dead_hang:{protocol:{id:'bar_dead_hang_v1',equipment:'bar-30mm'}},sprint_400m:{protocol:{id:'sprint400m_standing_manual_v1',equipment:'track-stopwatch'}}};
 assert.deepEqual(normalizeMeasurementMetadata(details),details);
});
