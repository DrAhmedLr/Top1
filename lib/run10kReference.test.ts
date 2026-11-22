import test from 'node:test';
import assert from 'node:assert/strict';
import {run10kBenchmarks,run10kPercent,formatRunTime,parseRunTime} from './run10kReference';
const d={age:35,sex:'unselected' as const};
test('10 km uses published finisher cutoffs and labels finer tiers as estimates',()=>{
 const r=run10kBenchmarks(d);assert.equal(formatRunTime(r.tiers[0].minutes),'36:18');assert.equal(r.tiers[0].estimated,false);
 assert.deepEqual(r.tiers.slice(1).map(x=>[x.percent,x.estimated]),[[2.5,true],[5,true]]);
 for(const tier of r.tiers)assert.ok(Math.abs(run10kPercent(tier.minutes,d)-tier.percent)<1e-8);
 assert.equal(formatRunTime(run10kBenchmarks({...d,sex:'male'}).tiers[0].minutes),'34:24');
 assert.equal(formatRunTime(run10kBenchmarks({...d,sex:'female'}).tiers[0].minutes),'41:12');
});
test('running duration round-trips minutes:seconds and rejects malformed seconds',()=>{
 assert.equal(parseRunTime('36:18'),'36.3');assert.equal(formatRunTime(36.3),'36:18');
 assert.equal(parseRunTime('36:99'),'NaN');assert.equal(parseRunTime(''),'');
});

test('planner clocks preserve saved subsecond baselines and whole-second targets',()=>{
 for(const [minutes,clock] of [[25.005,'25:00.3'],[25.017,'25:01'],[24.999,'24:59.94'],[20,'20:00']] as const){
  assert.equal(formatRunTime(minutes,true),clock);
  assert.equal(Number(Number(parseRunTime(clock)).toFixed(3)),minutes);
 }
 assert.equal(Number(parseRunTime('٢٥:٠٠٫٣')),25.005);
 assert.equal(parseRunTime('25:60.1'),'NaN');
});
