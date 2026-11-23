import assert from 'node:assert/strict';
import test from 'node:test';
import {calendarWeek, regionalCalendar} from './regionalCalendar';
import {quickLogTests, referenceChart} from './homePresentation';
import {referenceRank} from './rankExplorer';
import {activeMetrics} from './registry';

test('quick logging always offers the same three tests in the same order', () => {
  assert.deepEqual(quickLogTests.map(metric => metric.id), ['run_5k', 'grip_strength', 'squat_1rm']);
});

test('a protocol-matched cohort selects a curve, an ordinary strength entry a pyramid, and a journal value no reference chart', () => {
  const metric = (id:string) => activeMetrics.find(m => m.id === id)!;
  const profile = {age:35, sex:'male' as const};
  const jump = metric('cmj');
  const full = referenceRank(jump, 65, profile, {method:'device', ageAtMeasurement:35, measuredAt:'2026-09-10T00:00:00Z', protocol:{id:'chms_leonardo_cmj_v1', equipment:'Leonardo', trials:3}});
  assert.equal(referenceChart(full)?.kind, 'curve');
  assert.equal(referenceChart(referenceRank(jump, 65, profile))?.kind, 'pyramid');
  assert.equal(referenceChart(referenceRank(metric('apob'), 70, profile)), null);
});

test('regional calendar uses the hosting country hint exclusively and handles week boundaries', () => {
  const headers = new Headers({'x-vercel-ip-country':'US', 'x-forwarded-for':'192.0.2.5'});
  assert.deepEqual(regionalCalendar(headers, true), {region:'US', firstDay:7});
  assert.equal(regionalCalendar(headers, false), null);
  assert.equal(regionalCalendar(new Headers({'x-vercel-ip-country':'XX'}), true), null);
  assert.equal(regionalCalendar(new Headers({'x-vercel-ip-country':'MA'}), true)?.firstDay, 1);
  assert.equal(calendarWeek('2026-11-22', 7)[0].toISOString().slice(0,10), '2026-11-22');
  assert.equal(calendarWeek('2026-11-22')[0].toISOString().slice(0,10), '2026-11-16');
});
