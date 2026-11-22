import test from 'node:test';
import assert from 'node:assert/strict';
import {balancedBaseline,baselineChallenge,BASELINE_VERSION,readBaselineSelection,type BaselineSelection} from './balancedBaseline';
import type {MeasurementMetadata} from './measurementMetadata';

const measuredAt='2026-10-12T10:00:00Z',now=Date.parse('2026-11-10T12:00:00Z');
const base={measuredAt,ageAtMeasurement:30,method:'manual' as const};
const details:MeasurementMetadata={
 pushups:{...base,protocol:{id:'strict_pushups_v1'}},
 pullups:{...base,protocol:{id:'strict_pullups_v1'}},
 sit_to_stand:{...base,protocol:{id:'chair_stand_30s_v1',chairHeightCm:43}},
 run_5k:{...base,protocol:{id:'run5k_outdoor_manual_v1'}},
};
const values={pushups:45,pullups:14,sit_to_stand:20,run_5k:25};
const choices:BaselineSelection={push:{test:'pushups',sex:'male'},pull:{test:'pullups',sex:'male'},lower:{test:'sit_to_stand',sex:'male'},endurance:{test:'run_5k',sex:'male'}};

test('overall requires four selected qualifying areas and uses the weakest challenge',()=>{
 const complete=balancedBaseline({...values,total_sleep:450,body_fat:17},details,choices,now);
 assert.equal(complete.coverage,4);
 assert.deepEqual(complete.overall,{kind:'challenge',version:BASELINE_VERSION,tier:'55%',limitingAreas:['pull','lower']});
 const cleared=balancedBaseline({...values,pullups:undefined,pullup_1rm:.5},details,choices,now);
 assert.equal(cleared.coverage,3);
 assert.equal(cleared.overall,null);
 assert.equal(balancedBaseline(values,details,{},now).coverage,0);
 assert.equal(balancedBaseline({total_sleep:450,body_fat:17},details,choices,now).overall,null);
});

test('a completed zero counts but missing dates, protocols and incompatible variants do not',()=>{
 assert.equal(baselineChallenge('pullups',{pullups:0},details,'male',now)?.tier,'65%+');
 assert.equal(baselineChallenge('pullups',{pullups:1.5},details,'male',now),null);
 assert.equal(baselineChallenge('pullups',values,{pullups:{...details.pullups,measuredAt:undefined}},'male',now),null);
 assert.equal(baselineChallenge('pullups',values,{pullups:{...details.pullups,measuredAt:'2027-01-01T00:00:00Z'}},'male',now),null);
 assert.equal(baselineChallenge('run_5k',values,{run_5k:{...details.run_5k,protocol:{id:'run5k_treadmill_v1'}}},'male',now),null);
 assert.equal(baselineChallenge('sit_to_stand',values,{sit_to_stand:{...details.sit_to_stand,protocol:{id:'chair_stand_30s_v1'}}},'male',now),null);
});

test('documented alternatives qualify in their own units and estimates retain their inputs',()=>{
 const alternatives:MeasurementMetadata={
  bench_1rm:{...base,method:'direct_1rm',protocol:{id:'bench_paused_v1'},derivation:{formula:'epley_ratio_v1',inputs:[108,1],bodyWeightKg:80}},
  pullup_1rm:{...base,method:'epley_estimate',protocol:{id:'weighted_pullup_strict_v1'},derivation:{formula:'pullup_ratio_v1',inputs:[20,6],bodyWeightKg:80}},
  squat_1rm:{...base,method:'direct_1rm',protocol:{id:'squat_parallel_v1',bodyWeightKg:80}},
  vo2_max:{...base,method:'direct_cpet',exerciseMode:'treadmill',protocol:{id:'cpet_treadmill_v1'}},
 };
 const selected:BaselineSelection={push:{test:'bench_1rm',sex:'male'},pull:{test:'pullup_1rm',sex:'male'},lower:{test:'squat_1rm',sex:'male'},endurance:{test:'vo2_max',sex:'male'}};
 const metrics={bench_1rm:1.35,pullup_1rm:.5,squat_1rm:1.5,vo2_max:50};
 assert.equal(balancedBaseline(metrics,alternatives,selected,now).overall?.tier,'20%');
 assert.equal(baselineChallenge('pullup_1rm',{...metrics,pullup_1rm:1},alternatives,'male',now),null);
 assert.equal(baselineChallenge('vo2_max',metrics,{vo2_max:{...alternatives.vo2_max,method:'wearable_estimate',protocol:{id:'wearable_vo2_estimate_v1',equipment:'Watch'}}},'male',now),null);
});

test('browser selection validation rejects cross-area choices and preserves neutral references',()=>{
 const parsed=readBaselineSelection(JSON.stringify({version:BASELINE_VERSION,choices:{...choices,push:{test:'run_5k',sex:'male'},pull:{test:'pullups',sex:'unselected'}}}));
 assert.equal(parsed.push,undefined);
 assert.equal(parsed.pull?.sex,'unselected');
 assert.equal(balancedBaseline(values,details,parsed,now).areas.find(row=>row.area==='pull')?.challenge?.tier,'35%');
});
