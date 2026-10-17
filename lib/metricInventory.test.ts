import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMetrics,metrics} from './registry';
import {normalizeValues} from './profile';
import {benchmarkGame,metricGameEstimate} from './benchmarkGame';
import {gameScenario} from './gameScenarios';
import {evaluate} from './engine';
const d={age:35,sex:'male' as const};
test('focused inventory keeps exactly 16 distinct measurements and all 40 storage definitions',()=>{
 const expected=['body_fat','waist_height_ratio','pushups','sit_to_stand','single_leg_balance','bench_1rm','grip_strength','vo2_max','squat_1rm','deadlift_1rm','pullup_1rm','cmj','broad_jump','sprint_10m','total_sleep','rhr'];
 assert.deepEqual(activeMetrics.map(m=>m.id).sort(),expected.sort());assert.equal(metrics.length,40);
 assert.equal(activeMetrics.filter(m=>m.pillar==='bodymarkers').length,2);assert.equal(activeMetrics.filter(m=>m.pillar==='strength').length,12);assert.equal(activeMetrics.filter(m=>m.pillar==='recovery').length,2);
});
test('every retired measurement remains valid storage without changing current coverage, ranks or scenarios',()=>{
 const retired=Object.fromEntries(metrics.filter(m=>m.archived).map(m=>[m.id,m.mean]));assert.deepEqual(normalizeValues(retired),retired);
 const base={pushups:25,total_sleep:450};assert.deepEqual(benchmarkGame({...base,...retired},d),benchmarkGame(base,d));
 assert.deepEqual(evaluate({...base,...retired},d,{}, {now:Date.parse('2026-10-17T12:00:00Z')}),evaluate(base,d,{}, {now:Date.parse('2026-10-17T12:00:00Z')}));
 for(const [id,value] of Object.entries(retired))assert.equal(metricGameEstimate(id,value,d),null);
 const scenario=gameScenario({...base,...retired},d,1,'ambitious');assert.ok(scenario.goal.targets.every(g=>activeMetrics.some(m=>m.id===g.id)));
});
