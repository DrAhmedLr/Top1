import test from 'node:test';import assert from 'node:assert/strict';import {comparableDelta,personalBest,historyChanges,historySummary,observationDate,type Observation} from './history';
import {historyStanding} from './historyStanding';
import {COMPETITIVE_CHALLENGE_METRICS} from './challengeProgress';
import {activeMetrics} from './registry';
const e=(value:number,method:Observation['method'],date:string):Observation=>({id:date,metricId:'pushups',value,method,cleared:false,recordedAt:new Date(date).toISOString(),measuredAt:new Date(date).toISOString(),protocol:{id:'strict_pushups_v1'}});
test('history comparisons require a known consistent method and two distinct measurement dates',()=>{assert.equal(comparableDelta([e(20,undefined,'2026-10-01'),e(25,'manual','2026-10-12')]),null);assert.equal(comparableDelta([e(20,'device','2026-10-01'),e(25,'manual','2026-10-12')]),null);assert.equal(comparableDelta([e(20,'manual','2026-10-01'),e(25,'manual','2026-10-12')])?.change,5);});
test('clears are history events rather than zero values and equal repeat values require new metadata',()=>{assert.equal(historyChanges({pushups:20},{pushups:undefined},{},{},'2026-10-12')[0].value,null);assert.equal(historyChanges({pushups:20},{pushups:20},{},{},'2026-10-12').length,0);assert.equal(historyChanges({pushups:20},{pushups:20},{},{pushups:{measuredAt:'2026-10-12T12:00:00Z'}},'2026-10-12').length,1);});
test('a clearing event is dated when cleared, not when its retained measurement was taken',()=>{const o={...e(20,'manual','2026-10-01'),cleared:true,value:null,recordedAt:'2026-10-12T12:00:00Z'};assert.equal(observationDate(o),o.recordedAt);assert.equal(comparableDelta([e(20,'manual','2026-10-01'),o]),null);});

test('personal best searches older attempts with the latest test setup',()=>{
 const latest=e(25,'manual','2026-10-12');
 const earlier=e(30,'manual','2026-10-01');
 const otherMethod=e(45,'device','2026-10-02');
 const otherSetup={...e(42,'manual','2026-10-03'),protocol:{id:'strict_pushups_v1',equipment:'Different surface'}};
 assert.equal(personalBest([latest,earlier,otherMethod,otherSetup],latest)?.value,30);
 assert.equal(personalBest([latest,earlier],{...latest,method:undefined}),undefined);
});

test('late entry of an older measurement cannot replace the latest dated summary',()=>{
 const newer={...e(25,'manual','2026-10-12'),sequence:1,recordedAt:'2026-11-01T12:00:00Z'};
 const enteredLater={...e(20,'manual','2026-10-01'),sequence:2,recordedAt:'2026-11-02T12:00:00Z'};
 const summary=historySummary([newer,enteredLater]);
 assert.equal(summary.latest?.value,25);assert.equal(summary.best?.value,25);
 assert.equal(summary.comparison[0].value!-summary.comparison[1].value!,5);
});
test('historical TOP uses entry context and original test weight, never current profile context',()=>{
 const entry={...e(25,'manual','2026-10-12'),ageAtMeasurement:30,referenceContext:{profileAgeAtEntry:30,referenceSexAtEntry:'unselected'}};
 assert.ok(historyStanding(entry)?.label.startsWith('TOP'));
 assert.equal(historyStanding({...entry,referenceContext:undefined,ageAtMeasurement:undefined}),null);
 const lift:Observation={...entry,metricId:'bench_1rm',value:1.5,method:'direct_1rm',protocol:{id:'bench_paused_v1'},derivation:{formula:'epley_ratio_v1',inputs:[120,1],bodyWeightKg:80}};
 const before=historyStanding(lift);
 assert.deepEqual(historyStanding(lift),before);assert.equal(lift.derivation?.bodyWeightKg,80);
});

test('historical views recomputed with current rules use the same 13 challenges as Ranking',()=>{
 const base=e(20,'manual','2026-10-12'), referenceContext={profileAgeAtEntry:30,referenceSexAtEntry:'male'};
 for(const metric of activeMetrics){
  const entry={...base,metricId:metric.id,value:Math.min(metric.max,Math.max(metric.min,Math.round(metric.mean))),protocol:undefined,referenceContext};
  const standing=historyStanding(entry);
  if(COMPETITIVE_CHALLENGE_METRICS.has(metric.id))assert.equal(standing?.reference,'TOP1 game tier',metric.id);
  else assert.equal(standing,null,metric.id);
 }
 assert.equal(historyStanding({...base,value:20,referenceContext})?.label,'TOP 20%');
 assert.equal(historyStanding({...base,metricId:'single_leg_balance',value:60,referenceContext}),null);
 assert.equal(historyStanding({...base,metricId:'sit_to_stand',value:20,referenceContext}),null);
});

test('summary and comparable change agree on the latest save for tied test dates',()=>{
 const previous={...e(10,'manual','2025-03-03'),sequence:1};
 const first={...e(15,'manual','2025-03-04'),id:'first',sequence:2};
 const updated={...first,id:'updated',sequence:3,value:20};
 for(const entries of [[first,previous,updated],[updated,previous,first]]){
  const summary=historySummary(entries);
  assert.equal(summary.latest,updated);
  assert.equal(summary.previous,previous);
  assert.deepEqual(summary.comparison,[updated,previous]);
  const cleared={...updated,id:'cleared',sequence:4,cleared:true,value:null};
  assert.deepEqual(historySummary([...entries,cleared]),{latest:undefined,previous:undefined,best:undefined,comparison:[]});
 }
});

test('the previous result uses the complete history, including raw entries with no known method',()=>{
 const last={...e(20,undefined,'2025-04-03'),sequence:1};
 const previous={...e(0,undefined,'2025-04-02'),sequence:2};
 const backfilled=Array.from({length:51},(_,i)=>({...e(10,'manual','2025-01-01'),id:String(i),sequence:i+3,recordedAt:'2025-06-03T12:00:00Z'}));
 const summary=historySummary([...backfilled,last,previous]);
 assert.equal(summary.latest,last);
 assert.equal(summary.previous,previous);
 assert.deepEqual(summary.comparison,[]);
});

test('a test entered after a clear starts a new sequence even if it was backdated',()=>{
 const old={...e(12,'manual','2025-04-01'),sequence:1};
 const cleared={...old,sequence:2,recordedAt:'2025-04-02T12:00:00Z',cleared:true,value:null};
 const fresh={...e(8,'manual','2025-02-01'),sequence:3,recordedAt:'2025-04-03T12:00:00Z'};
 const summary=historySummary([old,cleared,fresh]);
 assert.equal(summary.latest,fresh);
 assert.equal(summary.previous,undefined);
 assert.deepEqual(summary.comparison,[]);
});

test('dated published history uses the age and assessment date captured by the entry',()=>{
 const jump:Observation={
  ...e(60,'device','2021-04-03'),metricId:'cmj',ageAtMeasurement:30,
  referenceContext:{profileAgeAtEntry:32,referenceSexAtEntry:'male'},
  recordedAt:'2023-04-03T12:00:00Z',
  protocol:{id:'chms_leonardo_cmj_v1',equipment:'Leonardo',trials:3},
 };
 const published=historyStanding(jump);
 assert.equal(published?.cohort,'30–34 · male');
 assert.equal(published?.version,'chms-2017-p10-p50-p90-p95-v2');
 assert.deepEqual(historyStanding({...jump,referenceContext:{referenceSexAtEntry:'male'}}),published);
 assert.equal(historyStanding({...jump,referenceContext:{profileAgeAtEntry:40,referenceSexAtEntry:'male'}})?.cohort,null);
});

test('history displays the push-up model under its version and saved test-day profile',()=>{
 const saved={...e(20,'manual','2026-10-12'),ageAtMeasurement:45,
   protocol:{id:'strict_pushups_v1',bodyWeightKg:90,referenceSex:'female' as const},
   referenceContext:{profileAgeAtEntry:51,referenceSexAtEntry:'male'}};
 const standing=historyStanding(saved);
 assert.equal(standing?.version,'performance-v3/pushups');assert.equal(standing?.label,'TOP 13.9%');
});
