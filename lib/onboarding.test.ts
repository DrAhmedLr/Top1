import assert from 'node:assert/strict';
import test from 'node:test';
import { blankProfileDraft, parseProfileDraft, profileToDraft } from './onboarding';

test('first-time basics have no assumed personal data', () => {
  assert.deepEqual(profileToDraft(), { age: '', sex: '', weight: '', height: '' });
  assert.equal(parseProfileDraft(blankProfileDraft()), undefined);
  assert.deepEqual(parseProfileDraft({ age:'32',sex:'male',weight:'',height:'' }),{age:32,sex:'male'});
});
test('setup validates complete basics before creating a persistable profile', () => {
  const draft = { age:'32',sex:'female',weight:'65,5',height:'170' };
  assert.deepEqual(parseProfileDraft(draft), {age:32,sex:'female',weight:65.5,height:170});
  assert.equal(parseProfileDraft({...draft,sex:''})?.sex,'unselected');
  for (const bad of [{age:'4'}, {age:'32.5'}, {weight:'0'}, {height:'Infinity'}]) assert.equal(parseProfileDraft({...draft,...bad}), undefined);
});
