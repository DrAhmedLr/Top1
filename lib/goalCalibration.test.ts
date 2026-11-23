import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calibratedGoalProbability,type CalibrationPartition} from './goalCalibration';

const group=(n:number,reached:number,p:number):CalibrationPartition=>({participants:n,reached,expected:n*p,brierBase:(reached*(1-p)**2+(n-reached)*p**2)/n});

test('calibration shrinks corrections and requires improvement for later participants',()=>{
 const training=group(40,32,.6),validation=group(24,18,.6);
 const adjusted=calibratedGoalProbability(.6,{training,validation});
 assert.ok(adjusted && Math.abs(adjusted.probability-(.6+8/60))<1e-9);
 assert.equal(adjusted.participants,64);
 assert.equal(calibratedGoalProbability(.6,{training,validation:group(24,12,.6)}),null);
 assert.ok(calibratedGoalProbability(.6,{training:group(60,6,.6),validation:group(20,5,.6)})!.probability>=.45-1e-12);
});

test('small, incomplete and non-improving cohorts leave the original forecast alone',()=>{
 const sample=group(20,10,.5);
 for (const evidence of [null,{training:sample,validation:null},{training:group(19,2,.5),validation:sample},{training:sample,validation:sample},{training:sample,validation:{...sample,expected:NaN}}]) {
  assert.equal(calibratedGoalProbability(.5,evidence),null);
 }
});
