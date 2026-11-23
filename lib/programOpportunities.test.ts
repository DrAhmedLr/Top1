import assert from 'node:assert/strict';
import test from 'node:test';
import {rankProgramOpportunities} from './programOpportunities';
import type {Observation} from './history';
import {PROFILE_ONLY_PROTOCOL} from './protocols';

const today='2026-11-22';
const push=(value:number,day:string,method:'manual'|'device'='manual'):Observation=>({
  metricId:'pushups',id:day,value,cleared:false,measuredAt:day+'T10:00:00Z',recordedAt:day+'T12:00:00Z',method,
  protocol:{id:'strict_pushups_v1'},
});

test('empty, cleared, malformed, clinical and future measurements cannot create a recommended baseline',()=>{
  assert.deepEqual(rankProgramOpportunities({today,values:{},observations:[push(30,'2026-11-20')]}),[]);
  assert.deepEqual(rankProgramOpportunities({today,values:{apob:80,body_fat:20,total_sleep:420,pushups:2.5,
    dead_hang:80,grip_strength:43},details:{dead_hang:{measuredAt:'2026-12-03T10:00:00Z'},grip_strength:{invalidContext:{message:'Review',original:null}}}}),[]);
});

test('smaller goals use integer and race-time grids and region-independent ordering',()=>{
  const input={today,values:{pushups:19,pullups:0,run_5k:25.1,sit_to_stand:12}};
  const rows=rankProgramOpportunities(input);
  assert.deepEqual(rows,rankProgramOpportunities({...input,values:{sit_to_stand:12,run_5k:25.1,pullups:0,pushups:19}}));
  assert.equal(rows.find(r=>r.metric==='pushups')?.nextTarget,20);
  assert.equal(rows.find(r=>r.metric==='pullups')?.nextTarget,1);
  assert.ok(rows.find(r=>r.metric==='run_5k')!.nextTarget<25.1);
  assert.equal(rows.find(r=>r.metric==='sit_to_stand')?.nextTarget,13);
  assert.ok(rows.every(r=>r.estimatedDays===null&&r.freshness==='undated'));
});

test('only a current, method-matched improvement carries the observed-gain explanation',()=>{
  const first=push(12,'2026-11-10'),last=push(18,'2026-11-21');
  const input={today,values:{pushups:18,dead_hang:59},details:{pushups:{method:last.method,measuredAt:last.measuredAt}}};
  const rows=rankProgramOpportunities({...input,observations:[last,first]});
  assert.equal(rows[0].metric,'pushups');
  assert.equal(rows[0].observations,2);
  assert.equal(rows[0].reason,'observed-gain');
  assert.ok((rows[0].overallPointsGain??0)>0);
  for(const entries of [
    [last,push(12,'2026-11-10','device')],
    [last,{...first,value:null,cleared:true,recordedAt:'2026-11-15T10:00:00Z'},first],
    [push(19,'2026-11-21'),first],
  ]){
    const row=rankProgramOpportunities({...input,observations:entries}).find(r=>r.metric==='pushups')!;
    assert.notEqual(row.reason,'observed-gain');
    assert.equal(row.observations,0);
  }
});

test('signed-in or guest saved goals outrank candidates, preserving explicit load units',()=>{
  const values={bench_1rm:1,pushups:19},details={bench_1rm:{method:'direct_1rm' as const,protocol:{id:PROFILE_ONLY_PROTOCOL,bodyWeightKg:80}}};
  // A test-day body mass belongs to the saved observation.
  const input={today,values,details,goal:{metric:'bench_1rm',target:86,date:'2026-12-15',goalUnit:'kg' as const}};
  const row=rankProgramOpportunities(input)[0];
  assert.equal(row.reason,'saved-goal');
  assert.equal(row.metric,'bench_1rm');
  assert.equal(row.unit,'kg');
  assert.equal(row.current,80);
  assert.equal(row.nextTarget,86);
  const missing=rankProgramOpportunities({...input,details:{}}).find(r=>r.metric==='bench_1rm')!;
  assert.equal(missing.unit,'metric');
  assert.notEqual(missing.reason,'saved-goal');
  const expired=rankProgramOpportunities({...input,goal:{...input.goal,date:'2026-11-10'}});
  assert.ok(expired.every(r=>r.reason!=='saved-goal'));
});

test('stale observations retain an editable target while fresh measurements lead',()=>{
  const recent=push(13,'2026-09-18'),previous=push(9,'2026-09-10');
  const rows=rankProgramOpportunities({today,values:{pushups:13,dead_hang:35},details:{dead_hang:{measuredAt:'2026-11-18T12:00:00Z'},
    pushups:{measuredAt:recent.measuredAt,method:'manual'}},observations:[recent,previous]});
  assert.equal(rows[0].metric,'dead_hang');
  assert.equal(rows[1].freshness,'older');
  assert.notEqual(rows[1].reason,'observed-gain');
});

test('every suggested next target is accepted by the dated program builder for its stored test and unit',async()=>{
  const {supportedProgramMetrics,createGuidedConfig}=await import('./datedProgram');
  const {countMetrics}=await import('./measurementRules');
  const values=Object.fromEntries(supportedProgramMetrics.map(m=>[m.id,countMetrics.has(m.id)?Math.floor((m.min+m.max)/2):(m.min+m.max)/2]));
  const rows=rankProgramOpportunities({today,values});
  assert.equal(rows.length,supportedProgramMetrics.length);
  for(const row of rows){
    const plan=createGuidedConfig({metric:row.metric,baseline:row.current,target:row.nextTarget,goalUnit:row.unit,
      startDay:today,deadline:'2027-01-03',timeZone:'UTC',now:new Date(today+'T12:00:00Z')});
    assert.equal(plan.target,row.nextTarget);
  }
});
