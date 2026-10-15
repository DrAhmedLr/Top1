import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkGame,metricGameEstimate} from './benchmarkGame';
import {activeMetrics} from './registry';
import {gameScenario} from './gameScenarios';
import {pyramidTier,PYRAMID_TIERS} from './pyramid';
const d={age:35,sex:'male' as const};
test('every valid recorded metric has a finite illustrative game estimate, including standalone recovery',()=>{for(const m of activeMetrics){const x=['pushups','sit_to_stand'].includes(m.id)?20:Math.max(m.min,Math.min(m.max,m.mean));const r=metricGameEstimate(m.id,x,d);assert.ok(r,m.id);assert.ok(Number.isFinite(r.z),m.id);assert.ok(PYRAMID_TIERS.includes(r.top),m.id);}assert.ok(benchmarkGame({total_sleep:450},d).total);assert.equal(benchmarkGame({},d).total,null);assert.equal(benchmarkGame({pushups:NaN},d).total,null);});
test('categories exclude missing entries and receive equal weight in global game display',()=>{const a=benchmarkGame({pushups:30},d);assert.equal(a.sections.strength,a.total);assert.equal(a.sections.bodymarkers,null);assert.equal(a.rows.length,1);const b=benchmarkGame({pushups:30,total_sleep:450},d);assert.equal(b.rows.length,2);assert.ok(b.sections.recovery);assert.equal(b.sections.strength,a.sections.strength);assert.deepEqual(benchmarkGame({pushups:30,apob:undefined},d),a);});
test('invalid observations stay unranked and very low pressure or very long sleep do not win',()=>{assert.equal(metricGameEstimate('pushups',1.5,d),null);assert.equal(metricGameEstimate('missing',1,d),null);assert.ok(metricGameEstimate('fasting_glucose',25,d)!.z<metricGameEstimate('fasting_glucose',90,d)!.z);assert.ok(metricGameEstimate('total_sleep',900,d)!.z<metricGameEstimate('total_sleep',450,d)!.z);});
test('each pyramid tier maps to exactly its own highlight and empty data has none',()=>{for(const [i,tier] of PYRAMID_TIERS.entries())assert.equal(pyramidTier(tier),i);assert.equal(pyramidTier(null),-1);assert.equal(pyramidTier('0.1%'),-1);});
test('routes preserve clinical inputs and original measurements, and do not promise weeks',()=>{const values={pushups:20,bench_1rm:1,apob:80,total_sleep:450},before=JSON.stringify(values);for(const route of ['easier','balanced','ambitious'] as const){const r=gameScenario(values,d,5,route);assert.ok(r.goal.targets.length<=({easier:1,balanced:2,ambitious:3}[route]));assert.ok(r.goal.targets.every(g=>['pushups','bench_1rm','total_sleep'].includes(g.id)&&g.target>g.current));assert.ok(!('weeks' in r));assert.ok(r.goal.targets.every(g=>g.target<=g.current*1.5+5));}assert.equal(JSON.stringify(values),before);});
test('impossible tiers are reported as unavailable, without fabricating targets',()=>{const r=gameScenario({apob:80},d,1,'ambitious');assert.equal(r.eligibleCount,0);assert.equal(r.goal.targets.length,0);assert.equal(r.reached,false);assert.throws(()=>gameScenario({pushups:20},d,0.1,'easier'));});

test('retired thermal inputs cannot affect rankings',()=>{const a=benchmarkGame({pushups:30},d),b=benchmarkGame({pushups:30,sauna_minutes:90,cold_plunge_minutes:15,thermal_hrv_rebound:1.5},d);assert.deepEqual(a,b);for(const id of ['sauna_minutes','cold_plunge_minutes','thermal_hrv_rebound'])assert.equal(metricGameEstimate(id,10,d),null);});

test('a recorded sprint can improve through a lower time without changing unrecorded inputs',()=>{const r=gameScenario({sprint_10m:2.5},d,35,'easier');assert.equal(r.eligibleCount,1);assert.equal(r.goal.targets[0].id,'sprint_10m');assert.ok(r.goal.targets[0].target<2.5);assert.ok(r.reached);});

test('all 35 active metrics and every populated category can reach full game credit',()=>{
 for(const sex of ['male','female','unselected'] as const)for(const age of [18,35,75,100]){
  const profile={age,sex},values:Record<string,number>={};
  for(const m of activeMetrics){let best=-Infinity;for(let i=0;i<=1000;i++){let x=m.min+(m.max-m.min)*i/1000;if(['pushups','sit_to_stand'].includes(m.id))x=Math.round(x);const r=metricGameEstimate(m.id,x,profile);if(r&&r.z>best){best=r.z;values[m.id]=x;}}assert.equal(best,3,m.id);}
  const r=benchmarkGame(values,profile);assert.equal(r.total,'1%');assert.ok(Object.values(r.sections).every(s=>s==='1%'));assert.equal(r.rows.length,35);
 }
});
test('best-range sleep and resting heart rate do not drag down an elite snapshot',()=>{const a=benchmarkGame({pushups:100},d),b=benchmarkGame({pushups:100,total_sleep:480,rhr:55},d);assert.equal(a.total,'1%');assert.equal(b.total,'1%');assert.equal(metricGameEstimate('total_sleep',480,d)?.top,'1%');assert.equal(metricGameEstimate('rhr',55,d)?.top,'1%');assert.ok(metricGameEstimate('total_sleep',900,d)!.z<3);assert.ok(metricGameEstimate('rhr',25,d)!.z<3);});

test('an elite profile can choose a maintenance week at the highest tier',()=>{const r=gameScenario({pushups:100},d,1,'easier');assert.equal(r.reached,true);assert.equal(r.goal.maintenance,true);assert.equal(r.goal.targets[0].current,r.goal.targets[0].target);});

test('short sleep has an attainable habit route and longer sleep is never pursued past the plateau',()=>{const r=gameScenario({total_sleep:360},d,1,'easier');assert.equal(r.reached,true);assert.equal(r.goal.targets[0].id,'total_sleep');assert.ok(r.goal.targets[0].target>=420&&r.goal.targets[0].target<=540);const long=gameScenario({total_sleep:600},d,1,'easier');assert.equal(long.reached,false);assert.equal(long.goal.targets.length,0);});
