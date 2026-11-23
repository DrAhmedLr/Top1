import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {journeyInput, journeyRequestIp, journeyWriteProof} from './customerJourneyInput';

test('journey collection accepts only catalogued product contexts and recognized intent',()=>{
  const entry={id:randomUUID(),sessionId:randomUUID(),at:new Date().toISOString(),event:'goal_selected',view:'program',metric:'pushups'};
  const batch={consentId:randomUUID(),events:[entry]};
  assert.deepEqual(journeyInput(batch),batch);
  assert.deepEqual(journeyInput({enabled:false}),{enabled:false});
  for (const fields of [{email:'somebody@example.test'},{ip:'192.0.2.100'},{metric:'secret'},{view:'https://example.test?secret'},{seconds:3},{at:'today'}])
    assert.equal(journeyInput({...batch,events:[{...entry,...fields}]}),null);
  for (const seconds of [-1,0,61,1.1]) assert.equal(journeyInput({...batch,events:[{...entry,event:'screen_time',seconds}]}),null);
  assert.ok(journeyInput({...batch,events:[{...entry,event:'screen_time',seconds:60}]}));
  assert.equal(journeyInput({...batch,events:Array(26).fill(entry)}),null);
  assert.equal(journeyInput({...batch,consentId:undefined}),null);
  assert.equal(journeyInput({...batch,ip:'192.0.2.100'}),null);
});

test('only a Vercel-supplied single IP can be recorded and proofs are purpose-bound',()=>{
  const headers=new Headers({'x-vercel-forwarded-for':'2001:db8::a','x-forwarded-for':'192.0.2.1'});
  assert.equal(journeyRequestIp(headers,true),'2001:db8::a');
  assert.equal(journeyRequestIp(headers,false),null);
  for (const value of ['192.0.2.1, 192.0.2.2','fe80::1%0','192.0.2.999','']) {
    headers.set('x-vercel-forwarded-for',value);
    assert.equal(journeyRequestIp(headers,true),null);
  }
  headers.delete('x-vercel-forwarded-for');
  assert.equal(journeyRequestIp(headers,true),null);
  assert.equal(journeyWriteProof(undefined),null);
  assert.match(journeyWriteProof('sample')!,/^[0-9a-f]{64}$/);
  assert.notEqual(journeyWriteProof('sample'),journeyWriteProof('different'));
});
