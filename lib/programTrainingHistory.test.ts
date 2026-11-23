import test from 'node:test';
import assert from 'node:assert/strict';
import {programContextFromHistory} from './programTrainingHistory';
import type {TrainingEvent} from './training';

const now=new Date('2026-11-22T12:00:00Z');
function logged(id:string,day:string):TrainingEvent {
  const end=day+'T12:00:00Z';
  return {id,revision:1,kind:'workout',deleted:false,recordedAt:end,data:{status:'completed',startedAt:day+'T11:35:00Z',endedAt:end}} as TrainingEvent;
}
test('recent attendance supplies missing schedule settings and respects saved availability and corrections',()=>{
  const history=['2026-11-02','2026-11-04','2026-11-09','2026-11-11','2026-11-16','2026-11-18'].map((d,i)=>logged(String(i),d));
  history.push(logged('overlap','2026-11-18'),logged('old','2024-05-01'));
  assert.deepEqual(programContextFromHistory({timezone:'UTC'},history,now),{timezone:'UTC',days:2,minutes:25});
  assert.deepEqual(programContextFromHistory({timezone:'UTC',days:1,minutes:15},history,now),{timezone:'UTC',days:1,minutes:15});
  const deleted=history.map(e=>({...e,revision:2,deleted:true}));
  assert.deepEqual(programContextFromHistory({},[...history,...deleted],now),{});
  assert.deepEqual(programContextFromHistory({},history.slice(0,3),now),{});
});
