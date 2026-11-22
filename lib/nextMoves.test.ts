import test from 'node:test';
import assert from 'node:assert/strict';
import {nextMoves} from './nextMoves';
const d={age:30,sex:'male' as const,weight:80,height:180};
test('missing results suggest baselines without fabricating targets',()=>{
 const moves=nextMoves({},d);assert.equal(moves.length,3);assert.ok(moves.every(m=>m.current===undefined&&m.target===undefined&&m.tier===null));
});
test('nearby game targets preserve measured values and exclude clinical or recovery interventions',()=>{
 const values={pushups:20,rhr:90,hrv:10,body_fat:30};const snapshot={...values};const moves=nextMoves(values,d);
 assert.deepEqual(values,snapshot);const pushups=moves.find(m=>m.metric.id==='pushups');assert.ok(pushups);assert.equal(pushups.current,20);assert.ok(pushups.target!>20);assert.ok(pushups.tier);assert.ok(moves.every(m=>!['rhr','hrv','body_fat','waist_height_ratio','vo2_max'].includes(m.metric.id)));
});
test('recorded suggestions appear before baselines and never suggest a non-improving target',()=>{
 const moves=nextMoves({pushups:20,single_leg_balance:10},d);let sawBaseline=false;
 for(const move of moves){if(move.target===undefined)sawBaseline=true;else{assert.equal(sawBaseline,false);assert.notEqual(move.current,move.target);assert.ok(move.gap>0);}}
 assert.ok(moves.length<=3);
});

test('push-up suggestions can pass an already-earned top one percent tier',()=>{
 const next=nextMoves({pushups:60},{age:30,weight:75,sex:'male'}).find(move=>move.metric.id==='pushups');
 assert.equal(next?.target,62);
 assert.equal(next?.tier,'0.75%');
});
