import test from 'node:test';
import assert from 'node:assert/strict';
import {activeMetrics} from './registry';
import {performanceOrder,performanceCategories} from './performanceCatalog';
import {focusedEntry,entryRaw} from './focusedEntry';
const metric=(id:string)=>activeMetrics.find(m=>m.id===id)!;
test('all active measurements appear once in six visible activity groups',()=>{
 assert.equal(performanceCategories.length,6);assert.equal(performanceOrder.length,36);
 assert.deepEqual(performanceOrder.map(m=>m.id).sort(),activeMetrics.map(m=>m.id).sort());
 assert.equal(new Set(performanceOrder.map(m=>m.id)).size,36);assert.equal(performanceOrder[0].id,'pushups');
});
test('focused entry validates counts, localized numbers, time and sleep units',()=>{
 assert.equal(focusedEntry(metric('pushups'),{raw:'٢٥'}).value,25);
 assert.throws(()=>focusedEntry(metric('pushups'),{raw:'25.5'}));assert.throws(()=>focusedEntry(metric('pushups'),{raw:''}));
 assert.equal(focusedEntry(metric('run_5k'),{raw:'٢٤:٣٠'}).value,24.5);
 assert.equal(focusedEntry(metric('total_sleep'),{raw:'7,5'}).value,450);
 assert.throws(()=>focusedEntry(metric('run_5k'),{raw:'24:99'}));
});
test('editing a value never copies the prior test date or protocol',()=>{
 const details={measuredAt:'2026-11-01T12:00:00Z',method:'manual' as const,protocol:{id:'strict_pushups_v1'}};
 assert.deepEqual(focusedEntry(metric('pushups'),{raw:'30'},{value:20,details}).details,{source:'manual'});
 assert.deepEqual(focusedEntry(metric('pushups'),{raw:'20'},{value:20,details}).details,details);
 const sleep=metric('total_sleep');assert.equal(focusedEntry(sleep,{raw:entryRaw(sleep,440.123)},{value:440.123,details:{}}).value,440.123);
});
test('lifting uses canonical kg and preserves exact previous inputs when display is unchanged',()=>{
 const result=focusedEntry(metric('bench_1rm'),{raw:'',load:'176.3698',reps:'5',weight:'80',loadUnit:'lb'});
 assert.equal(result.value,1.167);assert.ok(Math.abs(result.details.derivation!.inputs[0]-80)<.001);
 assert.equal(result.details.measuredAt,undefined);assert.equal(result.details.method,'epley_estimate');
 assert.deepEqual(focusedEntry(metric('bench_1rm'),{raw:'',load:'176.37',reps:'5',weight:'80',loadUnit:'lb'},result),result);
 for(const patch of [{weight:''},{weight:'0'},{reps:'11'},{load:'-1'}])assert.throws(()=>focusedEntry(metric('bench_1rm'),{raw:'',load:'80',weight:'80',reps:'5',...patch}));
});
test('editing an unweighted pull-up requires an explicit zero for added load',()=>{
 const pullup=metric('pullup_1rm');
 const inputs={raw:'',load:'0',reps:'5',weight:'80'};
 const saved=focusedEntry(pullup,inputs);
 assert.deepEqual(focusedEntry(pullup,{...inputs,load:'٠'},saved),saved);
 for(const load of ['', '   '])assert.throws(()=>focusedEntry(pullup,{...inputs,load},saved),/Complete the load/);
});

test('equivalent localized displays retain the exact saved result and its context',()=>{
 const details={method:'device' as const,measuredAt:'2026-08-10T12:00:00Z'};
 for(const raw of ['7.34','7,340','٧٫٣٤']){
  const previous={value:440.123,details};
  assert.deepEqual(focusedEntry(metric('total_sleep'),{raw},previous),previous);
 }
 const run={value:24.511,details};
 assert.deepEqual(focusedEntry(metric('run_5k'),{raw:'٢٤:٣١'},run),run);
 assert.deepEqual(focusedEntry(metric('run_5k'),{raw:'٢٤:٣٢'},run),{value:24.533,details:{source:'manual'}});
});

test('new focused entries use stored precision after validating the original value',()=>{
 assert.equal(focusedEntry(metric('sprint_400m'),{raw:'60,0001'}).value,60);
 assert.equal(focusedEntry(metric('sprint_400m'),{raw:'60,0009'}).value,60.001);
 assert.throws(()=>focusedEntry(metric('sprint_400m'),{raw:'39,9999'}));
 assert.throws(()=>focusedEntry(metric('pushups'),{raw:'25,0001'}));
});
