import assert from 'node:assert/strict';
import test from 'node:test';
import type {AdaptivePlan} from './adaptiveProgram';
import {savedGoalCalibration} from './goalTrackingDisplay';

const current={config:{guidedVersion:1},event:{id:'plan-1',revision:2}} as AdaptivePlan;
const cohort={planId:'plan-1',revision:2,probability:.67,baseProbability:.64,participants:42};

test('the issued saved plan can show its calibrated estimate',()=>{
 assert.equal(savedGoalCalibration(cohort,current,.64),cohort);
});
test('drafts, mismatched plan revisions, and stale forecast snapshots keep their original estimate',()=>{
 for(const entry of [null,{...cohort,planId:'other'},{...cohort,revision:1},{...cohort,baseProbability:.60},{...cohort,probability:NaN},{...cohort,participants:0}]){
  assert.equal(savedGoalCalibration(entry,current,.64),undefined);
 }
 assert.equal(savedGoalCalibration(cohort,null,.64),undefined);
 assert.equal(savedGoalCalibration(cohort,current,undefined),undefined);
 assert.equal(savedGoalCalibration(cohort,{...current,config:{...current.config,guidedVersion:undefined}},.64),undefined);
});
