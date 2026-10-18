import test from 'node:test';
import assert from 'node:assert/strict';
import {goalChoices,rotateGoals,normalizeGoalBoard,objectiveFor,goalProjection} from './potentialGoals';
import {benchmarkGame} from './benchmarkGame';
import {activeMetrics} from './registry';
const d={age:35,sex:'male' as const,weight:80,height:180};
test('goal refresh cycles all active metrics, while changing one preserves the other cards',()=>{
 const choices=goalChoices({pushups:20},d,1);assert.equal(new Set(choices).size,17);assert.ok(choices.every(id=>activeMetrics.some(m=>m.id===id)));
 let ids=choices.slice(0,3);const seen=new Set(ids);for(let i=0;i<8;i++){const next=rotateGoals(ids,choices);assert.equal(next.length,3);assert.equal(new Set(next).size,3);assert.ok(next.every(id=>!ids.includes(id)));ids=next;ids.forEach(id=>seen.add(id));}assert.equal(seen.size,17);
 const single=rotateGoals(ids,choices,1);assert.equal(single[0],ids[0]);assert.equal(single[2],ids[2]);assert.notEqual(single[1],ids[1]);assert.equal(new Set(single).size,3);
});
test('unmeasured objectives reveal no invented value or rank and do not enter global projections',()=>{
 const values={pushups:20,apob:90};const objective=objectiveFor('squat_1rm',values,d,1,3)!;assert.equal(objective.target,undefined);assert.equal(objective.targetTop,null);assert.equal(objective.current,undefined);
 assert.equal(goalProjection(['squat_1rm','body_fat','rhr'],{squat_1rm:3},values,d,1),benchmarkGame(values,d).total);assert.equal(goalProjection(['pushups'],{}, {},d,1),null);assert.deepEqual(values,{pushups:20,apob:90});
});
test('custom objectives update preview without changing current measurements; count targets require integers',()=>{
 const values={pushups:20,total_sleep:390},snapshot={...values};const objective=objectiveFor('pushups',values,d,1,40)!;assert.equal(objective.target,40);assert.notEqual(objective.currentTop,objective.targetTop);assert.equal(objectiveFor('pushups',values,d,1,20.5)!.target,objectiveFor('pushups',values,d,1)!.target);assert.deepEqual(values,snapshot);
 assert.notEqual(goalProjection(['pushups'],{pushups:150},values,d,1),benchmarkGame(values,d).total);
});
test('goal storage validates unique active cards and drops invalid target overrides',()=>{
 const state={version:1,targetTop:1,ids:['pushups','total_sleep','rhr'],targets:{pushups:20.5,total_sleep:480,rhr:NaN,apob:60}};
 assert.deepEqual(normalizeGoalBoard(state),{...state,targets:{total_sleep:480}});assert.equal(normalizeGoalBoard({...state,ids:['pushups','pushups','rhr']}),null);assert.equal(normalizeGoalBoard({...state,ids:['pushups','apob','rhr']}),null);assert.equal(normalizeGoalBoard({...state,targetTop:0.1}),null);assert.equal(normalizeGoalBoard(null),null);
});
