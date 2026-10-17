import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PYRAMID_TIERS,PYRAMID_LEAGUES,pyramidLeague,nextPyramidTier} from './pyramid';
test('every existing band belongs to exactly one cosmetic league',()=>{
 for(const [i,top] of PYRAMID_TIERS.entries()){
  assert.equal(PYRAMID_LEAGUES.filter(l=>i>=l.first&&i<=l.last).length,1);
  assert.ok(pyramidLeague(top));
 }
 assert.equal(pyramidLeague('1%')?.name,'GOATs');
 assert.equal(pyramidLeague('65%+')?.name,'Rising');
 assert.equal(pyramidLeague(null),null);
 assert.equal(pyramidLeague('invalid'),null);
});
test('next milestone follows real bands without promising a rank from activity',()=>{
 assert.equal(nextPyramidTier('65%+'),'65%');
 assert.equal(nextPyramidTier('2.5%'),'1%');
 assert.equal(nextPyramidTier('1%'),null);
 assert.equal(nextPyramidTier(null),null);
});
