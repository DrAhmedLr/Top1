import test from 'node:test';
import assert from 'node:assert/strict';
import {gameLevels,profileCompleteness} from './gameLevels';
import {activeMetrics} from './registry';
import {benchmarkGame} from './benchmarkGame';
test('three levels cover the active inventory once and place labs in Advanced',()=>{
 const ids=gameLevels.flatMap(l=>l.ids);assert.equal(gameLevels.length,3);assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,activeMetrics.length);
 assert.ok(gameLevels[0].ids.includes('pushups'));assert.ok(gameLevels[1].ids.includes('bench_1rm'));assert.ok(gameLevels[2].ids.includes('apob'));
});
test('completeness counts valid observations independently of performance',()=>{
 const half=Object.fromEntries(activeMetrics.slice(0,18).map(m=>[m.id,Math.max(m.min,Math.min(m.max,m.mean))]));assert.equal(profileCompleteness(half).percent,50);assert.equal(profileCompleteness({pushups:NaN}).count,0);
 const d={age:30,sex:'male' as const};assert.deepEqual(benchmarkGame({pushups:20,apob:80,hba1c:5.2},d),benchmarkGame({pushups:20},d));assert.equal(profileCompleteness({pushups:20,apob:80}).count,2);
});
test('requested basic tests, wearable gym tests and nested batches stay aligned',()=>{
 for(const id of ['waist_height_ratio','broad_jump','dead_hang','pullups','dips','sprint_400m','run_5k','cmj'])assert.ok(gameLevels[0].ids.includes(id));
 for(const id of ['hrv','rhr','sleep_efficiency','hrr_1min'])assert.ok(gameLevels[1].ids.includes(id));
 assert.equal(gameLevels[0].icon,'home');assert.equal(gameLevels[2].icon,'pushups');
 assert.ok(gameLevels[2].ids.includes('body_fat'));assert.ok(gameLevels[2].ids.includes('vo2_max'));
 for(const level of gameLevels)assert.deepEqual(level.sections.flatMap(s=>s.ids),level.ids);
});
