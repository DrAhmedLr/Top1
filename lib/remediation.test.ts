import test from 'node:test';
import assert from 'node:assert/strict';
import {authoritativeMeasurementDetails,normalizeMeasurementMetadata} from './measurementMetadata';
import {calculationValue} from './derivations';
import {benchmarkReadiness} from './benchmark';
import {empiricalBenchmark,type CalibrationArtifact} from './benchmarkCalibration';
import {evaluate} from './engine';
import {recordRoutine,emptyTimeline,routineProgress,scheduledTasks,completedOn,dayInZone} from './routineHistory';
import {emptyPlan,type WeeklyPlan} from './program';
import {deleteOwnAccount} from './accountLifecycle';
import {comparableDelta,type Observation} from './history';

test('calculated observations reproduce their original inputs and cannot inherit current body weight',()=>{
 const d={formula:'epley_ratio_v1' as const,inputs:[60,5],bodyWeightKg:80};assert.equal(calculationValue(d),.875);
 assert.equal(authoritativeMeasurementDetails({bench_1rm:.875},{bench_1rm:{derivation:d}}).bench_1rm.derivation?.bodyWeightKg,80);
 assert.throws(()=>authoritativeMeasurementDetails({bench_1rm:.9},{bench_1rm:{derivation:d}}),/reproduce/);
 assert.throws(()=>normalizeMeasurementMetadata({vo2_max:{derivation:d}}));
});
test('protocols reject statistic and metric mismatches; averaging windows require real ordered dates',()=>{
 assert.throws(()=>normalizeMeasurementMetadata({hrv:{protocol:{id:'hrv_rmssd_supine_v1',hrvStatistic:'sdnn'}}}));
 assert.throws(()=>normalizeMeasurementMetadata({grip_combined:{protocol:{id:'nhanes_grip_combined_v1',hand:'left',trials:3}}}));
 assert.throws(()=>normalizeMeasurementMetadata({pushups:{protocol:{id:'chair_stand_30s_v1'}}}));
 assert.throws(()=>normalizeMeasurementMetadata({grip_strength:{protocol:{id:'grip_single_v1',hand:'both'}}}));
 assert.throws(()=>normalizeMeasurementMetadata({sprint_10m:{protocol:{id:'sprint10m_gates_v1',equipment:'   '}}}));
 assert.throws(()=>normalizeMeasurementMetadata({total_sleep:{window:{start:'2026-10-10T00:00:00Z',end:'2026-10-09T00:00:00Z',statistic:'mean',sampleCount:7}}}));
});
test('health, habits and missing reference selection cannot manufacture a physical capacity score',()=>{
 const baseline={pushups:30,sit_to_stand:25,grip_strength:45},d={age:32,sex:'male' as const},a=evaluate(baseline,d);
 const b=evaluate({...baseline,total_sleep:900,sleep_efficiency:100,circadian_regularity:100,hrv:250,rhr:25,sauna_minutes:600,cold_plunge_minutes:120,apob:1},d);
 assert.equal(a.z,b.z);assert.equal(b.domains.recovery,undefined);assert.equal(b.domains.bodymarkers,undefined);assert.equal(a.ready,true);
 const raw=evaluate(baseline,{age:32,sex:'unselected'});assert.equal(raw.scoredCount,0);assert.equal(raw.measured.length,3);
 assert.equal(benchmarkReadiness(baseline,{}).rank,null);
});
const calibration=():CalibrationArtifact=>({id:'fixture',version:'1',batteryId:'fixture-battery',population:'Synthetic test of an approved-artifact shape; never enabled in the app',scope:'national-adults',sourceKind:'probability-sample',representative:true,approved:true,variables:[{id:'a',protocolId:'a_v1',direction:1,domain:'capacity'},{id:'b',protocolId:'b_v1',direction:-1,domain:'speed'}],domainWeights:{capacity:.5,speed:.5},normalization:Array.from({length:100},(_,i)=>({id:`train-${i}`,weight:1,values:{a:i,b:100-i}})),validation:Array.from({length:100},(_,i)=>({id:`validation-${i}`,weight:1,values:{a:i,b:100-i}})),validationReport:'test-only independent report placeholder',samplingDesign:'test-only simple sample',confidenceLevel:.95,uncertaintyMethod:'test-only confidence envelope',confidenceDefinition:'strict-below',effectiveSampleSize:100,validatedPercentileCeiling:95,confidenceBands:[{score:0,lower:0,upper:.1},{score:1,lower:.9,upper:1}]});
test('empirical composite ranks use joint validation participants rather than normal-CDF or average-percentile claims',()=>{
 const a=calibration(),r=empiricalBenchmark(a,{a:49,b:51},{a:'a_v1',b:'b_v1'});assert.equal(r.available,true);if(!r.available)return;assert.equal(r.percentile,49);assert.equal(r.midrankPercentile,49.5);assert.equal(r.topOnePercent,false);
 const scaled={...a,normalization:a.normalization.map(r=>({...r,weight:r.weight*17})),validation:a.validation.map(r=>({...r,weight:r.weight*17}))};assert.deepEqual(empiricalBenchmark(scaled,{a:49,b:51},{a:'a_v1',b:'b_v1'}),r);
 assert.equal(empiricalBenchmark(a,{a:49},{a:'a_v1'}).available,false);assert.equal(empiricalBenchmark(a,{a:49,b:51},{a:'wrong',b:'b_v1'}).available,false);
});
test('calibration rejects volunteer/synthetic samples, reused validation participants, and fabricated precision',()=>{
 for(const change of [{sourceKind:'convenience' as const},{sourceKind:'synthetic' as const},{representative:false},{approved:false},{validationReport:''},{effectiveSampleSize:101},{confidenceBands:[{score:0,lower:.99,upper:1},{score:1,lower:.99,upper:1}]}])assert.throws(()=>empiricalBenchmark({...calibration(),...change},{a:49,b:51},{a:'a_v1',b:'b_v1'}));
 const a=calibration();a.validation[0].id=a.normalization[0].id;assert.throws(()=>empiricalBenchmark(a,{a:49,b:51},{a:'a_v1',b:'b_v1'}),/disjoint/);
});
test('unresolved reference tails cannot produce precise high percentiles',()=>{
 const r=empiricalBenchmark(calibration(),{a:1000,b:-1000},{a:'a_v1',b:'b_v1'});
 assert.equal(r.available,false);if(!r.available)assert.match(r.reason,/validated resolution/);
});
test('routine edits and archived actions preserve prior schedules and independent check-in events',()=>{
 const monday='2026-10-12',plan:WeeklyPlan={version:1,focus:'consistency',tasks:[{id:'walk',label:'Walk',days:[1,2,3,4,5,6,7],completed:[]}]};
 const initial=recordRoutine(null,plan,emptyTimeline(),monday,'UTC',{taskId:'walk',completed:true});
 const changed=recordRoutine(plan,{...plan,tasks:[{...plan.tasks[0],label:'New label',days:[5]}]},initial.timeline,'2026-10-14','UTC');
 assert.equal(scheduledTasks(changed.timeline,monday)[0].label,'Walk');assert.equal(completedOn(changed.timeline,'walk',monday),true);
 assert.deepEqual(routineProgress(initial.timeline,monday),{done:1,due:1,target:7,unknownDays:0});
 const archived=recordRoutine(plan,emptyPlan(),initial.timeline,'2026-10-14','UTC');assert.equal(archived.timeline.completions.length,1);assert.equal(scheduledTasks(archived.timeline,'2026-10-14').length,1);assert.equal(scheduledTasks(archived.timeline,'2026-10-15').length,0);
 assert.equal(initial.timeline.schedules.length,1);assert.throws(()=>recordRoutine(plan,plan,initial.timeline,monday,'UTC',{taskId:'other',completed:true}));
});
test('check-in dates follow the saved time zone across UTC calendar boundaries',()=>{
 const at=new Date('2026-10-13T23:30:00Z');assert.equal(dayInZone('UTC',at),'2026-10-13');assert.equal(dayInZone('Pacific/Kiritimati',at),'2026-10-14');assert.throws(()=>dayInZone('not-a-zone',at));
});
test('account deletion requires explicit confirmation and a recent session, revokes first, and accepts only the owner ID',async()=>{
 const calls:string[]=[],actions={recentSession:async()=>true,revoke:async()=>{calls.push('revoke');},remove:async(id:string)=>{calls.push(id);}};
 await assert.rejects(deleteOwnAccount('owner','DELETE',actions));assert.deepEqual(calls,[]);
 await assert.rejects(deleteOwnAccount('owner','DELETE MY ACCOUNT',{...actions,recentSession:async()=>false}));assert.deepEqual(calls,[]);
 await deleteOwnAccount('owner','DELETE MY ACCOUNT',actions);assert.deepEqual(calls,['revoke','owner']);
 await assert.rejects(deleteOwnAccount('owner','DELETE MY ACCOUNT',{...actions,revoke:async()=>{throw new Error('Revocation failed');}}));assert.deepEqual(calls,['revoke','owner']);
});
test('raw comparisons reject equipment changes and overlapping average windows',()=>{
 const o=(value:number,start:string,end:string,equipment='same'):Observation=>({id:end,metricId:'total_sleep',value,cleared:false,method:'device',recordedAt:end,measuredAt:end,protocol:{id:'sleep_device_7d_v1',equipment},window:{start,end,statistic:'mean',sampleCount:7}});
 const a=o(400,'2026-09-28T00:00:00Z','2026-10-05T00:00:00Z'),b=o(420,'2026-10-05T00:00:00Z','2026-10-12T00:00:00Z');assert.equal(comparableDelta([a,b])?.change,20);
 assert.equal(comparableDelta([a,{...b,protocol:{...b.protocol!,equipment:'different'}}]),null);assert.equal(comparableDelta([a,o(420,'2026-10-04T00:00:00Z','2026-10-11T00:00:00Z')]),null);
});

test('a tied group never becomes top one percent because its inclusive CDF reaches one',()=>{
 const a=calibration();a.normalization=a.normalization.map(r=>({...r,values:{a:10,b:10}}));a.validation=a.validation.map(r=>({...r,values:{a:10,b:10}}));a.validatedPercentileCeiling=99;
 const r=empiricalBenchmark(a,{a:10,b:10},{a:'a_v1',b:'b_v1'});assert.equal(r.available,true);if(r.available){assert.equal(r.percentile,0);assert.equal(r.midrankPercentile,50);assert.deepEqual(r.tieRange,[0,100]);assert.equal(r.topOnePercent,false);}
});


test('legacy corrupt context remains exportable without making the whole account unreadable or eligible',()=>{
 const raw={pushups:{measuredAt:'-infinity',method:'manual'}};const details=normalizeMeasurementMetadata(raw,{legacy:true});assert.deepEqual(details.pushups.invalidContext?.original,raw.pushups);
 assert.equal(evaluate({pushups:30},{age:32,sex:'male'},details).scoredCount,0);assert.throws(()=>authoritativeMeasurementDetails({pushups:30},details),/Review/);
});
test('large account exports preserve Unicode across streamed chunk boundaries',async()=>{
 const {jsonExportStream}=await import('./exportStream');const data={records:Array.from({length:20000},(_,i)=>({id:i,label:'🧪'+'x'.repeat(240)}))};const output=await new Response(jsonExportStream(data)).json();assert.deepEqual(output,data);assert.ok(JSON.stringify(data).length>4_500_000);
});
