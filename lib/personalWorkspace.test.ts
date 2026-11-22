import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTrainingContext,readWorkspace,workspaceKey,workspaceDraftKey} from './personalWorkspace';
import {createPersonalGoal} from './personalGoal';
import {benchmarkCoverage} from './benchmarkCoverage';
import {activeMetrics} from './registry';
test('private context validates optional inputs without inventing defaults',()=>{
 assert.deepEqual(normalizeTrainingContext({}),{});
 assert.deepEqual(normalizeTrainingContext({days:3,minutes:45,equipment:['barbell','barbell'],timezone:'Africa/Casablanca',routine:'  lifting  '}),{days:3,minutes:45,equipment:['barbell'],timezone:'Africa/Casablanca',routine:'lifting'});
 for(const raw of [{days:0},{days:8},{minutes:9},{equipment:['invented']},{timezone:'invalid/zone'},{limitations:'x'.repeat(301)},{loadUnit:'stone'}])assert.throws(()=>normalizeTrainingContext(raw));
});
test('goals preserve baseline and context independently of later profile edits',()=>{
 const context={days:2},goal={...createPersonalGoal('pushups','٢٥','2027-03-01',{pushups:20},new Date('2026-11-12T12:00:00Z')),context,baselineDetails:{method:'manual' as const,measuredAt:'2026-11-01T12:00:00Z'}};
 const saved=readWorkspace({version:1,goal,context});context.days=5;
 assert.equal(saved.context.days,2);assert.equal(saved.goal?.context?.days,2);assert.equal(saved.goal?.baseline,20);assert.equal(saved.goal?.target,25);
 assert.notEqual(workspaceKey('a'),workspaceKey('b'));assert.notEqual(workspaceDraftKey('a'),workspaceKey('a'));
 assert.throws(()=>readWorkspace({version:1,context:{},goal:{...goal,baseline:-100}}));
});
test('all active metrics have an explicit comparison boundary',()=>{
 assert.equal(benchmarkCoverage.length,activeMetrics.length);
 assert.deepEqual(benchmarkCoverage.filter(r=>r.kind==='published').map(r=>r.id).sort(),['cmj','grip_strength','vo2_max']);
 assert.ok(benchmarkCoverage.every(r=>r.protocol&&r.precision&&r.cohort));
 assert.equal(benchmarkCoverage.find(r=>r.id==='hrv')?.kind,'tracking');
 assert.match(benchmarkCoverage.find(r=>r.id==='sit_to_stand')?.limitation??'',/not percentiles/);
});
