import {test} from 'node:test';
import assert from 'node:assert/strict';
import {metrics,activeMetrics,accessibilityTiers,pillars,demoValues,type Demographics} from './registry';
import {evaluate,score,reference,calculateBoundedZScore,calculateSkewedZScore,cdf,inverseCdf,simulate,cooper,epley,weightedPullupRatio,skinfold} from './engine';
const d:Demographics={age:35,sex:'male',weight:80,height:180};
const details={vo2_max:{method:'direct_cpet' as const,ageAtMeasurement:35},grip_strength:{method:'dynamometer_single_hand' as const}};
const m=(id:string)=>metrics.find(m=>m.id===id)!;
const near=(a:number,b:number,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} ≠ ${b}`);
test('36 active triad metrics, normalized weights and preserved legacy inputs',()=>{
 assert.equal(activeMetrics.length,36);assert.equal(metrics.length,38);assert.equal(new Set(metrics.map(m=>m.id)).size,38);
 for(const p of new Set(metrics.map(m=>m.pillar)))near(metrics.filter(m=>m.pillar===p).reduce((s,m)=>s+m.weight,0),1);
 assert.equal(activeMetrics.filter(m=>!m.scoringEligible).length,19);
});
test('missing/invalid entries cannot change the experimental index or measured coverage',()=>{
 const values={total_sleep:480,sit_to_stand:25,pushups:25};const a=evaluate(values,d),b=evaluate({...values,apob:undefined,lpa:NaN,grip_strength:-10},d);
 near(a.z,b.z);near(a.completeness,b.completeness);assert.equal(b.submitted.length,3);assert.ok(a.ready);
 assert.equal(evaluate({},d).ready,false);assert.equal(evaluate({squat_1rm:1.4,bench_1rm:1,deadlift_1rm:1.7},d).ready,false);
});
test('tracking-only biomarkers and extreme vital signs never boost a score',()=>{
 const values={sit_to_stand:25,total_sleep:480,pushups:25};const a=evaluate(values,d),b=evaluate({...values,bp_systolic:70,rhr:25,hba1c:3,body_fat:8,apob:1},d);
 near(a.modelScore,b.modelScore);assert.equal(b.measured.length,7);assert.equal(b.trackingOnly.length,4);
 for(const id of ['bp_systolic','rhr','hba1c','body_fat','apob'])assert.throws(()=>score(m(id),m(id).min,d),/tracking-only/);
});
test('weighted means preserve a common metric scale without metric-count inflation',()=>{
 const squat=reference(m('squat_1rm'),d),dead=reference(m('deadlift_1rm'),d);
 const a=evaluate({squat_1rm:squat.mean+squat.sd},d),b=evaluate({squat_1rm:squat.mean+squat.sd,deadlift_1rm:dead.mean+dead.sd},d);
 near(a.domains.strength!,1);near(b.domains.strength!,1);
 assert.ok(!('percentile' in a)&&!('confidence' in a));
});
test('bounded penalty is continuous at both limits; sleep earns no extra gain for oversleep',()=>{
 near(calculateBoundedZScore(420,420,540,60),1);near(calculateBoundedZScore(419.999,420,540,60),1,1e-8);
 near(calculateBoundedZScore(540.001,420,540,60),1,1e-8);near(calculateBoundedZScore(360,420,540,60),0);
 near(score(m('total_sleep'),420,d),score(m('total_sleep'),900,d));
 assert.throws(()=>calculateBoundedZScore(9,8,10.5,0),RangeError);
});
test('LMS numerical utility is stable near L=0 and enforces its mathematical domain',()=>{
 near(calculateSkewedZScore(64,.5,100,.4,-1),1);
 near(calculateSkewedZScore(50,1e-12,100,.5,-1),-Math.log(.5)/.5);
 for(const value of [0,-1,NaN])assert.throws(()=>calculateSkewedZScore(value,.2,95,.26,-1),RangeError);
});
test('CDF remains a math utility with accurate inversion, separate from the index',()=>{
 near(cdf(0),.5);near(cdf(1.644853626951),.95);
 for(const p of [.0001,.01,.5,.95,.9999])near(cdf(inverseCdf(p)),p);
 assert.throws(()=>inverseCdf(1),RangeError);
});
test('unverified VO2 methods and ages outside the source cohort are tracked without scoring',()=>{
 for(const method of [undefined,'cooper_estimate','wearable_estimate'] as const)assert.equal(evaluate({vo2_max:52},d,{vo2_max:{method}}).scoredCount,0);
 assert.equal(evaluate({vo2_max:52},d,details).scoredCount,1);
 for(const age of [18,19,80,120])assert.equal(evaluate({vo2_max:52},d,{vo2_max:{method:'direct_cpet',ageAtMeasurement:age}}).scoredCount,0);
});
test('bounded influence and same-scale within-pillar bottlenecks',()=>{
 const a=evaluate(demoValues,d,details);assert.ok(a.submitted.every(s=>s.z>=-3&&s.z<=3));
 for(const s of a.bottlenecks){near(s.defect,a.domains[s.metric.pillar]!-s.z);assert.ok(s.defect>=.75);}
 assert.ok(a.modelScore>=0&&a.modelScore<=100);
});
test('scenarios preserve step zero, reach through the actual index, and do not forecast weeks',()=>{
 const a=evaluate(demoValues,d,details);const target=Math.min(90,a.modelScore+2);const scenario=simulate(demoValues,d,target,'Cardio focus',details);
 assert.ok(scenario.steps!==null&&scenario.steps>0);assert.ok(evaluate(scenario.targets,d,details).modelScore>=target);
 near(scenario.points[0].modelScore,a.modelScore);assert.ok(!('weeks' in scenario));
 assert.deepEqual(simulate(demoValues,d,a.modelScore,'Balanced',details).targets,demoValues);
 const impossible=simulate(demoValues,d,100,'Easiest first',details);assert.equal(impossible.steps,null);
 near(impossible.points.at(-1)!.modelScore,evaluate(impossible.targets,d,details).modelScore);
 assert.equal(simulate({lpa:35},d,90,'Balanced').reason,'insufficient-data');
 assert.throws(()=>simulate(demoValues,d,NaN,'Balanced'),RangeError);
});
test('Epley does not inflate a measured 1RM and pull-ups use total system load',()=>{
 near(epley(80,1),80);near(epley(60,5),70);near(weightedPullupRatio(20,5,80),(100*(1+5/30)-80)/80);
 near(weightedPullupRatio(0,1,80),0);assert.throws(()=>epley(50,11),RangeError);
});
test('Cooper and skinfold formulas enforce domains and source age scope',()=>{
 near(cooper(2400),(2400-504.9)/44.73);assert.throws(()=>cooper(100),RangeError);
 const sum=37;near(skinfold(10,15,12,35),495/(1.10938-.0008267*sum+.0000016*sum*sum-.0002574*35)-450);
 for(const age of [17,62,80])assert.throws(()=>skinfold(10,15,12,age),RangeError);
});

test('triad dynamically renormalizes active pillar weights without clinical incentives',()=>{
 const a=evaluate({pushups:20,sit_to_stand:26,total_sleep:420},d);
 near(a.z,(.38*a.domains.strength!+.24*a.domains.recovery!)/(.38+.24));
 assert.equal(a.domains.bodymarkers,undefined);
 near(pillars.reduce((sum,p)=>sum+p.weight,0),1);
 const b=evaluate({pushups:20,sit_to_stand:26,total_sleep:420,sauna_minutes:75,cold_plunge_minutes:13,thermal_hrv_rebound:2,fasting_glucose:85,waist_height_ratio:.45},d);
 near(a.modelScore,b.modelScore);assert.equal(b.trackingOnly.length,5);
});
test('legacy observations survive normalization but cannot enter triad scoring or coverage',()=>{
 const a=evaluate({pushups:20,sit_to_stand:26,total_sleep:420},d),b=evaluate({pushups:20,sit_to_stand:26,total_sleep:420,bp_systolic:115,ankle_dorsiflexion:40},d);
 near(a.completeness,b.completeness);near(a.modelScore,b.modelScore);assert.equal(b.measured.length,3);
});

test('tier assignments follow the brief and omit no active metric',()=>{
 const expected={bodymarkers:[2,3,7],strength:[3,4,8],recovery:[4,3,2]};
 for(const p of pillars)for(const [i,t] of accessibilityTiers.entries())assert.equal(activeMetrics.filter(m=>m.pillar===p.id&&m.tier===t.id).length,expected[p.id][i]);
 assert.equal(m('sauna_minutes').tier,'tier1_everyday');assert.equal(m('thermal_hrv_rebound').tier,'tier3_precision');
 assert.equal(m('vo2_max').tier,'tier2_standard');
});
