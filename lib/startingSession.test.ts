import assert from 'node:assert/strict';
import test from 'node:test';
import {activeMetrics} from './registry';
import {suggestStartingSession} from './startingSession';

const metric=(id:string)=>activeMetrics.find(m=>m.id===id)!;
test('the first session uses the current result in its own units and the available time',()=>{
  assert.equal(suggestStartingSession(metric('pushups'),24,'metric',undefined,30,{}).amount,12);
  assert.equal(suggestStartingSession(metric('pushups'),8,'metric',undefined,30,{}).amount,4);
  assert.ok(suggestStartingSession(metric('pushups'),0,'metric',undefined,30,{}).exercise);
  assert.equal(suggestStartingSession(metric('run_5k'),30,'metric',undefined,30,{}).amount,225);
  assert.equal(suggestStartingSession(metric('dead_hang'),30,'metric',undefined,10,{experience:'new'}).amount,15);
  for(const m of activeMetrics.filter(m=>m.pillar==='strength')){
    const d=suggestStartingSession(m,m.max,'metric',undefined,1,{});
    assert.ok(d.sets>=1&&d.amount>=1);
    assert.ok(d.mode==='reps'||d.sets*d.amount<=60);
  }
});
test('a known lift can suggest a starting weight only for the same movement and unit',()=>{
  const bench=metric('bench_1rm');
  assert.equal(suggestStartingSession(bench,1,'metric',80,30,{equipment:['barbell']}).loadKg,40);
  assert.equal(suggestStartingSession(bench,1,'metric',undefined,30,{}).loadKg,0);
  const substitute=suggestStartingSession(bench,80,'kg',undefined,30,{equipment:['dumbbells']});
  assert.ok(substitute.exercise);
  assert.equal(substitute.loadKg,0);
  assert.equal(suggestStartingSession(bench,80,'kg',undefined,40,{experience:'over_three'}).sets,3);
});
