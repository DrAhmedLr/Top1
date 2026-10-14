import assert from 'node:assert/strict';
import test from 'node:test';
import { illustrativeTopPercent } from './ranking';
import { evaluate } from './engine';

test('illustrative top placement is bounded and improves as model units increase', () => {
  assert.equal(illustrativeTopPercent(0), 50);
  assert.ok(illustrativeTopPercent(1) < illustrativeTopPercent(0));
  assert.ok(illustrativeTopPercent(3) > 0);
  assert.throws(() => illustrativeTopPercent(NaN));
});
test('valid scoring edits change the live placement without waiting for persistence', () => {
  const d={age:32,sex:'male' as const,weight:78,height:180};
  const first=evaluate({pushups:20,sit_to_stand:15,total_sleep:360},d);
  const next=evaluate({pushups:40,sit_to_stand:15,total_sleep:360},d);
  assert.ok(illustrativeTopPercent(next.z)<illustrativeTopPercent(first.z));
  const tracking=evaluate({pushups:20,sit_to_stand:15,total_sleep:360,rhr:45},d);
  assert.equal(tracking.z,first.z);
});
