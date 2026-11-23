import test from 'node:test';
import assert from 'node:assert/strict';
import {captureEvent,recordView,setAnalyticsClient,safeEventProperties} from './analytics';

test('only an enumerated screen can accompany a usage event', () => {
  assert.deepEqual(safeEventProperties('measurement_saved', {metric_id:'pushups',value:60,age:32,email:'private@example.test'}), {});
  assert.deepEqual(safeEventProperties('app_viewed', {view:'/?token=secret'}), {});
  assert.deepEqual(safeEventProperties('app_viewed', {view:'program',country:'MA'}), {view:'program'});
});

test('events before opt-in are dropped, repeated screens deduplicate, and withdrawal stops capture', () => {
  const events: unknown[] = [];
  recordView('overview');
  captureEvent('goal_saved');
  setAnalyticsClient({capture: (...args) => events.push(args)});
  recordView('overview');
  recordView('overview');
  recordView('measurements');
  captureEvent('workout_logged', {amount:42});
  captureEvent('app_viewed', {view:'/admin?secret=1'});
  setAnalyticsClient(null);
  captureEvent('goal_saved');
  assert.deepEqual(events, [['app_viewed',{view:'overview'}],['app_viewed',{view:'measurements'}],['workout_logged',{}]]);
});
