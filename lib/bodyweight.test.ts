import test from 'node:test';
import assert from 'node:assert/strict';
import {appendWeight,bodyweightKey,bodyweightQueueKey,fromKg,latestWeights,localWeightDate,parseWeight,readWeightHistory,readWeightQueue,toKg,weightMutation,weightPage,type WeightEvent,type WeightMutation} from './bodyweight';
const now=Date.parse('2026-11-11T12:00:00Z');
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const mutation=(n:number,date:string,value=80):WeightMutation=>({id:id(n),requestId:id(n+100),expectedRevision:0,epoch:0,action:'save',value,unit:'kg',measuredAt:date,timeZone:'Africa/Casablanca'});
test('weight units preserve decimal input and never treat blank as a measurement',()=>{
 assert.equal(parseWeight('٨٠٫٥','kg').kg,80.5);
 assert.equal(parseWeight('80,5','kg').kg,80.5);
 assert.equal(toKg(176.36981,'lb'),80);
 assert.ok(Math.abs(fromKg(80,'lb')-176.36981)<.00001);
 for(const value of ['', '0','NaN','Infinity','400'])assert.throws(()=>parseWeight(value,'kg'));
});
test('dated weigh-ins are explicit; offsets are normalized without inventing profile history',()=>{
 assert.deepEqual(readWeightHistory(null),[]);
 const normalized=weightMutation(mutation(1,'2026-10-01T00:30:00+01:00'),now);
 assert.equal(normalized.measuredAt,'2026-09-30T23:30:00.000Z');
 assert.throws(()=>weightMutation(mutation(1,'2026-02-30T12:00:00Z'),now));
 assert.throws(()=>weightMutation(mutation(1,'2027-01-01T00:00:00Z'),now));
 assert.throws(()=>weightMutation({...mutation(1,'2026-10-01T00:00:00Z'),timeZone:'not-a-zone'},now));
 assert.ok(localWeightDate(new Date(now)).startsWith('2026-11-11'));
});
test('corrections retain originals, retries are idempotent and stale edits conflict',()=>{
 const original=appendWeight([],mutation(1,'2026-10-01T12:00:00Z'),now);
 assert.equal(appendWeight(original.events,mutation(1,'2026-10-01T12:00:00Z'),now).events.length,1);
 const corrected={...mutation(1,'2026-10-01T12:00:00Z',79),requestId:id(300),expectedRevision:1};
 const next=appendWeight(original.events,corrected,now);
 assert.equal(next.events.length,2);assert.equal(next.events[0].kg,80);assert.equal(latestWeights(next.events)[0].kg,79);
 assert.throws(()=>appendWeight(next.events,{...corrected,requestId:id(301)},now),/changed/);
 assert.throws(()=>appendWeight(next.events,{...mutation(1,'2026-10-01T12:00:00Z'),value:99},now),/request ID/);
});
test('removal is recoverable and missing entries never become zero',()=>{
 const saved=appendWeight([],mutation(1,'2026-10-01T12:00:00Z'),now);
 const deleted=appendWeight(saved.events,{id:id(1),requestId:id(200),expectedRevision:1,action:'delete'},now);
 assert.equal(latestWeights(deleted.events).length,0);
 assert.equal(latestWeights(deleted.events,true)[0].kg,80);
 const restored=appendWeight(deleted.events,{id:id(1),requestId:id(201),expectedRevision:2,action:'restore'},now);
 assert.equal(latestWeights(restored.events)[0].kg,80);
});
test('pagination orders by test instant with deterministic ties and keeps equal repeat values',()=>{
 let events:WeightEvent[]=[];
 for(let n=1;n<=35;n++)events=appendWeight(events,mutation(n,new Date(now-n*3600000).toISOString()),now).events;
 const first=weightPage(events),second=weightPage(events,first.next);
 assert.equal(first.entries.length,30);assert.equal(second.entries.length,5);
 assert.equal(first.total,35);assert.equal(new Set([...first.entries,...second.entries].map(row=>row.id)).size,35);
 assert.equal(first.latest.length,2);assert.equal(first.latest[0].kg,first.latest[1].kg);
});
test('browser stores and pending edits are owner-scoped and corruption is retained as an error',()=>{
 assert.notEqual(bodyweightKey('guest'),bodyweightKey('account-a'));
 assert.notEqual(bodyweightQueueKey('account-a'),bodyweightQueueKey('account-b'));
 const pending=mutation(1,'2026-10-01T12:00:00Z');
 assert.deepEqual(readWeightQueue(JSON.stringify({version:1,pending:[pending]}))[0],weightMutation(pending));
 assert.throws(()=>readWeightHistory('broken'));
 assert.throws(()=>readWeightQueue('{"version":1,"pending":[{}]}'));
 const saved=appendWeight([],pending).events;
 assert.equal(readWeightHistory(JSON.stringify({version:1,events:saved}))[0].value,80);
});
