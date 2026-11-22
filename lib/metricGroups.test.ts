import test from 'node:test';
import assert from 'node:assert/strict';
import {metricGroups} from './metricGroups';
import {activeMetrics} from './registry';
test('entry groups include every active measurement exactly once',()=>{
 const ids=metricGroups.flatMap(group=>[...group.metrics]);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual([...ids].sort(),activeMetrics.map(m=>m.id).sort());
});
