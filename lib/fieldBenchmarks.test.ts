import {CONTEXT_GAME_METRICS} from './benchmarkGame';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldBenchmark,fieldBenchmarkPercent,fieldBenchmarkTarget,FIELD_BENCHMARK_METRICS} from './fieldBenchmarks';
import {metricGameEstimate,metricGameEstimateV10,benchmarkGame} from './benchmarkGame';
import {activeMetrics} from './registry';
const male={age:20,sex:'male' as const},female={age:20,sex:'female' as const};
const near=(a:number|null,b:number)=>assert.ok(a!==null&&Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('community anchors preserve source percentages and extrapolated upper tails are explicit',()=>{
 near(fieldBenchmarkPercent('pullups',13,male),50);near(fieldBenchmarkPercent('pullups',21,male),20);near(fieldBenchmarkPercent('pullups',30,male),5);
 near(fieldBenchmarkPercent('pullups',6,female),50);near(fieldBenchmarkPercent('pullups',19,female),5);
 near(fieldBenchmarkPercent('sprint_400m',60,male),7.5);near(fieldBenchmarkPercent('sprint_400m',57,male),5);near(fieldBenchmarkPercent('sprint_400m',50,female),1);
 for(const id of ['pullups','sprint_400m']){assert.equal(fieldBenchmark(id,male)!.points.every(p=>p.estimated||id==='pullups'),true);near(fieldBenchmarkPercent(id,fieldBenchmarkTarget(id,1,male)!,male),1);}
 assert.equal(metricGameEstimateV10('pullups',21,male)?.top,'20%');assert.equal(metricGameEstimate('sprint_400m',60,male)?.top,'7.5%');
});
test('hang assumptions are visible, neutral cohorts are explicit and ages are bounded',()=>{
 near(fieldBenchmarkPercent('dead_hang',120,male),5);near(fieldBenchmarkPercent('dead_hang',180,male),1);
 assert.ok(fieldBenchmark('dead_hang',male)!.points.every(p=>p.estimated));
 assert.match(fieldBenchmark('pullups',{age:35,sex:'unselected'})!.cohort,/blend/);
 near(fieldBenchmarkTarget('sprint_400m',5,{...male,age:35}),57);
 near(fieldBenchmarkTarget('sprint_400m',5,{...male,age:27.5}),57);
 near(fieldBenchmarkTarget('sprint_400m',5,{...male,age:120}),57);
 near(fieldBenchmarkTarget('sprint_400m',5,{...male,age:18}),57);
});
test('all active measurements get bounded percentages; fields improve monotonically and blanks stay absent',()=>{
 for(const sex of ['male','female','unselected'] as const)for(const age of [18,35,75,120]){
  const d={age,sex};
  for(const m of activeMetrics.filter(m=>!CONTEXT_GAME_METRICS.has(m.id))){const v=m.unit==='reps'?Math.round(Math.max(m.min,m.mean)):Math.max(m.min,m.mean);assert.ok(metricGameEstimate(m.id,v,d)?.top,m.id);}
  for(const id of FIELD_BENCHMARK_METRICS){const m=activeMetrics.find(m=>m.id===id)!;let previous=m.polarity===1?100:1;for(let i=0;i<=100;i++){const v=m.min+(m.max-m.min)*i/100,p=fieldBenchmarkPercent(id,v,d)!;assert.ok(p>=1&&p<=100);assert.ok(m.polarity===1?p<=previous+1e-8:p>=previous-1e-8,id);previous=p;}}
 }
 assert.equal(benchmarkGame({},male).rows.length,0);assert.equal(metricGameEstimate('pullups',undefined as unknown as number,male),null);assert.equal(metricGameEstimate('pullups',2.5,male),null);
});

test('body-fat rule is a fixed game plateau without scientific-score changes',()=>{
 for(const d of [male,female,{age:35,sex:'unselected' as const}]){for(const value of [3,12,16.9,17])assert.equal(metricGameEstimate('body_fat',value,d)?.top,'1%');assert.notEqual(metricGameEstimate('body_fat',17.1,d)?.top,'1%');}
 near(fieldBenchmarkTarget('body_fat',1,male),17);near(fieldBenchmarkTarget('sprint_400m',1,male),50);
});

test('confirmed 5 km distance is distinct from archived 10 km and supports the twenty-minute tier',()=>{
 for(const d of [male,{age:35,sex:'unselected' as const}]){assert.equal(metricGameEstimate('run_5k',20,d)?.top,'1%');assert.equal(metricGameEstimate('run_5k',21,d)?.top,'2.5%');assert.equal(metricGameEstimate('run_5k',22.5,d)?.top,'5%');assert.equal(metricGameEstimate('run_10k',36,d),null);}
 near(fieldBenchmarkTarget('run_5k',1,male),20);
});
