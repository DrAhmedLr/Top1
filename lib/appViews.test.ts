import assert from 'node:assert/strict';
import test from 'node:test';
import {appView, primaryViews, viewHref} from './appViews';

test('the home, measurement, program and profile destinations round trip', () => {
  assert.deepEqual(primaryViews,['overview','performance','potential','profile']);
  for (const view of primaryViews) {
    assert.equal(appView(new URL(viewHref(view), 'https://top1.fit').searchParams), view);
  }
  for (const value of ['', 'constructor', 'toString']) {
    assert.equal(appView(new URLSearchParams({view:value})), 'overview');
  }
});
test('legacy program and measurement links still work', () => {
  for (const value of ['potential','training','program']) assert.equal(appView(new URLSearchParams({view:value})), 'potential');
  for (const value of ['performance','journey','measurements']) assert.equal(appView(new URLSearchParams({view:value})), 'performance');
});
test('history and rankings keep the selected metric on reload', () => {
  for (const view of ['progress','ranking','potential'] as const) {
    const url=new URL(viewHref(view,'run_5k'),'https://top1.fit');
    assert.equal(appView(url.searchParams),view);
    assert.equal(url.searchParams.get('metric'),'run_5k');
  }
  assert.equal(viewHref('overview','run_5k'),'/');
  assert.equal(viewHref('profile','run_5k'),'/?view=profile');
});

test('a next-tier goal link carries only the intent and metric', () => {
  assert.equal(viewHref('potential','pushups',true),'/?view=program&metric=pushups&aim=next');
  assert.equal(viewHref('potential',undefined,true),'/?view=program');
  assert.equal(viewHref('ranking','pushups',true),'/?view=ranking&metric=pushups');
});
