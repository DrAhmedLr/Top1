import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMetrics,metrics} from './registry';
import {normalizeValues} from './profile';
import {benchmarkGame,metricGameEstimate} from './benchmarkGame';
import {gameScenario} from './gameScenarios';
import {evaluate} from './engine';
const d={age:35,sex:'male' as const};
test('focused inventory keeps exactly 17 distinct measurements and all 40 storage definitions',()=>{
 const expected=['body_fat','waist_height_ratio','pushups','sit_to_stand','single_leg_balance','bench_1rm','grip_strength','vo2_max','squat_1rm','deadlift_1rm','pullup_1rm','cmj','broad_jump','sprint_10m','total_sleep','rhr','hrv'];
 assert.deepEqual(activeMetrics.map(m=>m.id).sort(),expected.sort());assert.equal(metrics.length,40);
 assert.equal(activeMetrics.filter(m=>m.pillar==='bodymarkers').length,2);assert.equal(activeMetrics.filter(m=>m.pillar==='strength').length,12);assert.equal(activeMetrics.filter(m=>m.pillar==='recovery').length,3);
});
test('every retired measurement remains valid storage without changing current coverage, ranks or scenarios',()=>{
 const retired=Object.fromEntries(metrics.filter(m=>m.archived).map(m=>[m.id,m.mean]));assert.deepEqual(normalizeValues(retired),retired);
 const base={pushups:25,total_sleep:450};assert.deepEqual(benchmarkGame({...base,...retired},d),benchmarkGame(base,d));
 assert.deepEqual(evaluate({...base,...retired},d,{}, {now:Date.parse('2026-10-17T12:00:00Z')}),evaluate(base,d,{}, {now:Date.parse('2026-10-17T12:00:00Z')}));
 for(const [id,value] of Object.entries(retired))assert.equal(metricGameEstimate(id,value,d),null);
 const scenario=gameScenario({...base,...retired},d,1,'ambitious');assert.ok(scenario.goal.targets.every(g=>activeMetrics.some(m=>m.id===g.id)));
});
test('restored HRV is optional recovery data and remains separate from scientific capacity',()=>{
 const hrv=activeMetrics.find(m=>m.id==='hrv')!;assert.equal(hrv.pillar,'recovery');assert.equal(hrv.unit,'ms');assert.equal(hrv.scoringEligible,false);assert.match(hrv.proofData.instructions,/RMSSD/);assert.match(hrv.proofData.url,/frontiersin/);
 const base={pushups:25};assert.equal(benchmarkGame(base,d).rows.length,1);const game=benchmarkGame({...base,hrv:70},d);assert.equal(game.rows.length,2);assert.ok(game.sections.recovery);assert.equal(game.rows.find(r=>r.id==='hrv')?.pillar,'recovery');
 const scientific=evaluate({...base,hrv:70},d);assert.equal(scientific.measured.length,2);assert.equal(scientific.scoredCount,evaluate(base,d).scoredCount);assert.deepEqual(normalizeValues({hrv:70}),{hrv:70});
});
