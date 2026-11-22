import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersonalGoal,readPersonalGoal} from './personalGoal';
const now=new Date('2026-11-12T12:00:00Z');
test('goal roundtrip retains a real target and rejects missing or regressing baselines',()=>{
 const goal=createPersonalGoal('pushups','25','2027-01-15',{pushups:20},now);
 assert.deepEqual(readPersonalGoal(JSON.stringify(goal)),goal);
 for(const values of [{},{pushups:30}])assert.throws(()=>createPersonalGoal('pushups','25','2027-01-15',values,now));
});
test('run targets use elapsed time and reject impossible or past dates',()=>{
 assert.equal(createPersonalGoal('run_5k','24:30','2027-01-15',{run_5k:26},now).target,24.5);
 for(const date of ['2026-02-30','2026-11-01',''])assert.throws(()=>createPersonalGoal('pushups','25',date,{pushups:20},now));
 assert.throws(()=>readPersonalGoal('{"version":1}'));
});
