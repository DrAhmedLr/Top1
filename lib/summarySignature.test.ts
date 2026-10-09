import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPublicSummary,parsePublicSummary} from './profile';
import {signSummary,verifySummary} from './summarySignature';
const key='a-test-only-signing-key-of-more-than-thirty-two-characters';
const d={age:32,sex:'female' as const,weight:60,height:165};
const summary=buildPublicSummary({demographics:d,values:{sit_to_stand:25,total_sleep:480,reaction_time:250}});
test('signed snapshots survive JSON/database roundtrips and bind identity and demographics',async()=>{
 const signed=JSON.parse(JSON.stringify(await signSummary(summary,'owner',d,key)));
 assert.ok(await verifySummary(summary,signed,'owner',d,key));
 assert.equal(await verifySummary(summary,signed,'someone-else',d,key),null);
 assert.equal(await verifySummary(summary,signed,'owner',{...d,age:33},key),null);
});
test('forged summary values, unsigned and legacy-percentile snapshots fail closed',async()=>{
 const signed=await signSummary(summary,'owner',d,key);
 assert.equal(await verifySummary({...summary,modelScore:99},signed,'owner',d,key),null);
 assert.equal(await verifySummary(summary,summary,'owner',d,key),null);
 assert.equal(parsePublicSummary({...summary,modelVersion:undefined,percentile:99}),null);
});
test('missing signing configuration never creates an unsigned public snapshot',async()=>{
 await assert.rejects(signSummary(summary,'owner',d,'short'),/not configured/);
});
