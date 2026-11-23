import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GET} from '../app/api/ladder/[username]/route';
import {ladderUsernames} from './profileLadder';
import {buildPublicSummary} from './profile';
import {publicDemographics,signSummary} from './summarySignature';

test('friends ladder uses only the current published point snapshot and observes withdrawal', async context=>{
 const username='local-fixture';
 const d={age:30,sex:'male' as const};
 const summary=buildPublicSummary({demographics:d,values:{pushups:40,pullups:10,bench_1rm:1.4,run_5k:24,squat_1rm:1.6,deadlift_1rm:2.1}});
 assert.equal(summary.ready,true);
 const key='ladder-test-key-for-ephemeral-unit-tests-only';
 const snapshot={username,...publicDemographics(d),summary:await signSummary(summary,username,d,key)};
 const previous={...process.env};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';
 process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fixture';
 process.env.PUBLIC_SUMMARY_SIGNING_KEY=key;
 context.after(()=>{
  for(const name of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','PUBLIC_SUMMARY_SIGNING_KEY']){
   if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];
  }
 });
 let published=true;
 context.mock.method(globalThis,'fetch',async (url:string)=>{
  assert.equal(String(url),'https://fixture.invalid/rest/v1/rpc/read_public_profile');
  return Response.json(published?snapshot:null);
 });
 const get=()=>GET(new Request('https://example.invalid/api/ladder/'+username),{params:Promise.resolve({username})});
 const available=await get();
 assert.equal(available.headers.get('Cache-Control'),'private, no-store');
 assert.deepEqual(await available.json(),{score:Number(summary.modelScore.toFixed(1))});
 published=false;
 assert.equal((await get()).status,404);
});

test('device ladder validates, normalizes and deduplicates saved usernames',()=>{
 assert.deepEqual(ladderUsernames(null),[]);
 assert.deepEqual(ladderUsernames('[" ATHLETE-ONE ","athlete-one","athlete_two"]'),['athlete-one','athlete_two']);
 assert.throws(()=>ladderUsernames('["not a username"]'));
});
