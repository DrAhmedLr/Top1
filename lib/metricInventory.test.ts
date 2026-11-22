import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMetrics,metrics} from './registry';
import {normalizeValues} from './profile';
import {benchmarkGame,metricGameEstimate} from './benchmarkGame';
import {gameScenario} from './gameScenarios';
import {evaluate} from './engine';
const d={age:35,sex:'male' as const};
test('expanded inventory includes 36 unique measurements and preserves all storage definitions',()=>{
 assert.equal(activeMetrics.length,36);assert.equal(new Set(activeMetrics.map(m=>m.id)).size,36);assert.equal(metrics.length,46);
 for(const id of ['apob','lpa','fasting_insulin','hscrp','hba1c','homocysteine','cystatin_c','ggt','fasting_glucose']){assert.ok(activeMetrics.find(m=>m.id===id));assert.equal(metricGameEstimate(id,10,d),null);}
});
test('every retired measurement remains valid storage without changing current coverage, ranks or scenarios',()=>{
 const retired=Object.fromEntries(metrics.filter(m=>m.archived).map(m=>[m.id,Math.max(m.min,Math.min(m.max,m.mean))]));assert.deepEqual(normalizeValues(retired),retired);
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

test('dips accept whole repetitions, stay optional and have no scientific rank',()=>{
 const dips=activeMetrics.find(m=>m.id==='dips')!;assert.equal(dips.pillar,'strength');assert.equal(dips.scoringEligible,false);assert.equal(activeMetrics.find(m=>m.id==='vo2_max')!.pillar,'bodymarkers');
 assert.deepEqual(normalizeValues({dips:12}),{dips:12});assert.throws(()=>normalizeValues({dips:12.5},true));
 assert.ok(metricGameEstimate('dips',12,d));assert.equal(evaluate({pushups:25,dips:12},d).scoredCount,evaluate({pushups:25},d).scoredCount);
});
