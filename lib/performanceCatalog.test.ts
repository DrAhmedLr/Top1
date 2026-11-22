import assert from 'node:assert/strict';
import test from 'node:test';
import {activeMetrics, type Metric} from './registry';
import {buildPerformanceCatalog,measurementTrack} from './performanceCatalog';

const pushups = activeMetrics.find(metric => metric.id === 'pushups')!;
function extra(id: string, pillar: Metric['pillar'], tier: Metric['tier']): Metric {
  return {...pushups, id, pillar, tier};
}

test('the catalogue follows registry additions, retirements and duplicates while preserving curated ordering', () => {
  const registry = [
    extra('new_barbell_test', 'strength', 'tier2_standard'),
    {...pushups, archived: true},
    extra('balance_walk', 'strength', 'tier1_everyday'),
    extra('swim_200m', 'strength', 'tier2_standard'),
    extra('waist_measurement', 'bodymarkers', 'tier2_standard'),
    extra('recovery_check', 'recovery', 'tier3_precision'),
    pushups, pushups,
    {...pushups, id: 'retired_test', archived: true},
    activeMetrics.find(metric => metric.id === 'fasting_glucose')!,
  ];
  const {categories, order} = buildPerformanceCatalog(registry);
  assert.deepEqual(Object.fromEntries(categories.map(group => [group.id, group.ids])), {
    bodyweight: ['pushups', 'balance_walk'], gym: ['new_barbell_test'], cardio: ['swim_200m'],
    body: ['waist_measurement'], recovery: ['recovery_check'], blood: ['fasting_glucose'],
  });
  assert.equal(new Set(order.map(metric => metric.id)).size, 7);
  assert.equal(order.length, 7);
  assert.ok(categories.every(group => group.ids.every((id, index) => group.metrics[index].id === id)));
});

test('categories remain available when the supplied registry has no active measures', () => {
  const {categories, order} = buildPerformanceCatalog([{...pushups, archived: true}]);
  assert.equal(categories.length, 6);
  assert.deepEqual(order, []);
  assert.ok(categories.every(group => group.ids.length === 0 && group.metrics.length === 0));
});


test('ranked, capped, and journal tabs partition all registered measurements',()=>{
  const counts={performance:0,capped:0,journal:0};
  for(const m of activeMetrics)counts[measurementTrack(m.id)]++;
  assert.deepEqual(counts,{performance:13,capped:3,journal:20});
  assert.equal(measurementTrack('vo2_max'),'capped');
  assert.equal(measurementTrack('future_unknown_test'),'journal');
});
