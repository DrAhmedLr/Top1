import assert from 'node:assert/strict';
import test from 'node:test';
import { activeMetrics } from './registry';
import { matchesMetricSearch } from './metricSearch';

test('VO2 keyboard input finds scientific VO₂ typography', () => {
  const metric = activeMetrics.find(m => m.id === 'vo2_max')!;
  for (const query of ['vo2', 'VO₂', 'vo2 max', 'vo2_max']) assert.ok(matchesMetricSearch(metric, query), query);
});
test('search ignores case and surrounding spaces and supports word order', () => {
  const metric = activeMetrics.find(m => m.id === 'total_sleep')!;
  assert.ok(matchesMetricSearch(metric, '  SLEEP total  '));
  assert.ok(matchesMetricSearch(metric, ''));
  assert.equal(matchesMetricSearch(metric, 'unrelated measurement'), false);
});
