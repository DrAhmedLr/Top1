import test from 'node:test';import assert from 'node:assert/strict';import {readJourneyDraft} from './journeyDraft';
const now=Date.now(),draft={version:1,updatedAt:now,baseline:'unchanged',metric:'pushups',collection:0,guided:false,screen:'record',profile:{age:'30',sex:'unselected',height:'172',weight:'68'},values:{pushups:20}};
test('unfinished entries resume only against unchanged saved data',()=>{assert.equal(readJourneyDraft(JSON.stringify(draft),'unchanged',now)?.values.pushups,20);assert.equal(readJourneyDraft(JSON.stringify(draft),'newer cloud result',now),null);});
test('stale and malformed drafts are ignored',()=>{assert.equal(readJourneyDraft(JSON.stringify(draft),'unchanged',now+8*86400000),null);assert.equal(readJourneyDraft(JSON.stringify({...draft,metric:'unknown'}),'unchanged',now),null);assert.equal(readJourneyDraft(JSON.stringify({...draft,profile:{age:30}}),'unchanged',now),null);assert.equal(readJourneyDraft('broken','unchanged',now),null);});

test('plan alternatives, skipped areas, raw invalid input and opt-out survive interruption',()=>{
 const session={...draft,version:2,screen:'choose',plan:{push:'bench_1rm',pull:'pullups'},skipped:['endurance'],mode:'existing',testWeight:'80',rawInput:'unfinished',liftInputs:{load:'12.',reps:'2'},useForBaseline:false};
 const restored=readJourneyDraft(JSON.stringify(session),'unchanged',now)!;
 assert.deepEqual(restored.plan,session.plan);assert.deepEqual(restored.skipped,['endurance']);
 assert.equal(restored.testWeight,'80');assert.equal(restored.profile.weight,'68');
 assert.equal(restored.rawInput,'unfinished');assert.equal(restored.useForBaseline,false);
 assert.deepEqual(restored.liftInputs,{load:'12.',reps:'2'});
 assert.equal(readJourneyDraft(JSON.stringify({...session,plan:{push:'run_5k'}}),'unchanged',now),null);
 assert.equal(readJourneyDraft(JSON.stringify({...session,skipped:['push']}),'unchanged',now),null);
});
