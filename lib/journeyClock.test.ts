import test from 'node:test';
import assert from 'node:assert/strict';
import {JourneyClock} from './journeyClock';

test('foreground time excludes inactivity, blur and time spent away from the app', () => {
  const clock = new JourneyClock(0, true);
  assert.equal(clock.take(15_500), 15);
  assert.equal(clock.take(61_000), 45);
  clock.interact(200_000);
  assert.equal(clock.take(202_000), 2);
  clock.focus(202_000, false);
  assert.equal(clock.take(450_000), 0);
  clock.focus(450_000, true);
  assert.equal(clock.take(454_000), 4);
});

test('frequent interactions preserve fractions, and time does not move to the next screen', () => {
  const clock = new JourneyClock(0, true);
  assert.equal(clock.take(800), 0);
  clock.interact(800);
  assert.equal(clock.take(1200), 1);
  clock.resetFraction();
  assert.equal(clock.take(2000), 0);
});
