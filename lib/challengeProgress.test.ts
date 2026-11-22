import test from 'node:test';
import assert from 'node:assert/strict';
import {metricGameEstimate,metricGameEstimateV10} from './benchmarkGame';
import {benchmarkEvidence} from './benchmarkCoverage';
import {challengeProgress,challengeStanding,COMPETITIVE_CHALLENGE_METRICS} from './challengeProgress';
import {PUSHUP_MODEL_VERSION,pushupModelPercentV2,pushupTierBand} from './pushupChallenge';
import {PERFORMANCE_RULES,performanceGamePercent} from './performanceRules';
import {focusedEntry,entryRaw} from './focusedEntry';
import {activeMetrics} from './registry';

const metric=(id:string)=>activeMetrics.find(m=>m.id===id)!;
const round=(n:number)=>Number(n.toFixed(3));

test('60 strict push-ups earns Top 1% at reference weight throughout the twenties',()=>{
  for(const age of [20,25,29])for(const weight of [50,65,75,85]){
    const profile={age,weight,sex:'male' as const};
    assert.equal(challengeProgress('pushups',59,profile)?.next?.value,60);
    assert.deepEqual(challengeProgress('pushups',60,profile),{
      version:PUSHUP_MODEL_VERSION,basis:'profile-model',modelTopPercent:1,tier:'1%',next:{tier:'0.75%',value:62,delta:2},
    });
  }
  assert.equal(challengeStanding('pushups',20)?.modelTopPercent,20);
  assert.equal(challengeProgress('pushups',20)?.next?.value,25);
  const other=challengeProgress('pushups',20,{age:45,weight:90,sex:'female'});
  assert.ok(Math.abs(other!.modelTopPercent!-13.881755268686046)<1e-10);
  assert.deepEqual(other?.next,{tier:'10%',value:24,delta:4});
  assert.equal(challengeStanding('pushups',0)?.modelTopPercent,100);
  assert.equal(challengeProgress('pushups',90)?.next,null);
  assert.equal(challengeStanding('pushups',150)?.tier,'0.01%');
  assert.equal(metricGameEstimateV10('pushups',20,{age:25,sex:'male'})?.top,'55%');
  assert.equal(pushupModelPercentV2(44,{age:30,weight:75,sex:'male'}),1);
});

test('all 13 curves reproduce every anchor and apply declared test-day factors',()=>{
  assert.deepEqual(new Set(Object.keys(PERFORMANCE_RULES)),COMPETITIVE_CHALLENGE_METRICS);
  for(const [id,rule] of Object.entries(PERFORMANCE_RULES)){
    assert.ok(rule);
    for(const [value,expected] of rule.anchors){
      assert.equal(performanceGamePercent(id,value),expected,id);
      assert.equal(challengeStanding(id,value,{age:25,weight:75,sex:'male'})?.modelTopPercent,expected,id);
    }
    const value=rule.anchors[2][0],base=performanceGamePercent(id,value)!;
    assert.ok(performanceGamePercent(id,value,{age:65})!<base,id);
    assert.ok(performanceGamePercent(id,value,{sex:'female'})!<base,id);
    const weightAdjusted=performanceGamePercent(id,value,{weight:110})!;
    assert.equal(Math.sign(base-weightAdjusted),Math.sign(rule.weightPerKg),id);
    assert.equal(performanceGamePercent(id,value,{sex:'unselected'}),base,id);
    assert.equal(performanceGamePercent(id,value,{age:120}),performanceGamePercent(id,value,{age:100}),id);
    for(const bad of [{age:15},{age:25.5},{weight:NaN},{weight:351}]){
      assert.equal(challengeProgress(id,value,bad),null,id);
    }
  }
  assert.equal(challengeProgress('pushups',20.5),null);
  assert.equal(challengeProgress('pushups',151),null);
  assert.equal(challengeProgress('pushups',-1),null);
  for(const id of ['vo2_max','zone2_power','sit_to_stand','single_leg_balance','total_sleep','body_fat','bp_systolic','run_10k','constructor']){
    assert.equal(challengeProgress(id,20),null,id);
  }
});

test('each next target crosses its tier at the closest practical increment',()=>{
  for(const m of activeMetrics){
    const rule=PERFORMANCE_RULES[m.id];
    if(!rule){assert.notEqual(benchmarkEvidence(m).kind,'challenge',m.id);continue;}
    for(const sex of ['male','female','unselected'] as const){
      const profile={age:42,weight:96,sex};
      let value=m.polarity===1?m.min:m.max;
      for(let i=0;i<40;i++){
        const now=challengeProgress(m.id,value,profile)!;
        assert.equal(now.tier,metricGameEstimate(m.id,value,profile)?.top,m.id);
        if(!now.next){assert.equal(now.tier,'0.01%',m.id);break;}
        const next=now.next,tick=Math.round(next.value*rule.ticksPerUnit);
        assert.ok((next.value-value)*m.polarity>0,m.id);
        assert.equal(next.delta,round(next.value-value),m.id);
        assert.equal(challengeStanding(m.id,next.value,profile)?.tier,next.tier,m.id);
        assert.equal(challengeStanding(m.id,round((tick-m.polarity)/rule.ticksPerUnit),profile)?.tier,now.tier,m.id);
        assert.ok(i<39,m.id);
        value=next.value;
      }
    }
  }
  assert.deepEqual(pushupTierBand('0.01%'),{kind:'upper',from:0,to:.01});
});

test('race thresholds use elapsed time and serialize to the same clock after saving',()=>{
  for(const [display,goal,tier] of [['20:01','20:00','1%'],['21:01','21:00','2.5%'],['25:01','25:00','10%']]){
    const m=metric('run_5k'),{value}=focusedEntry(m,{raw:display});
    const next=challengeProgress(m.id,value)?.next;
    assert.ok(next);assert.equal(next.tier,tier);
    assert.equal(entryRaw(m,next.value),goal);assert.equal(focusedEntry(m,{raw:goal}).value,next.value);
    assert.ok(next.delta<0);
  }
  assert.deepEqual(challengeProgress('run_5k',25)?.next,{tier:'7.5%',value:23.95,delta:-1.05});
  assert.deepEqual(challengeProgress('sprint_400m',50)?.next,{tier:'0.75%',value:49.5,delta:-.5});
  assert.deepEqual(challengeProgress('bench_1rm',1)?.next,{tier:'20%',value:1.07,delta:.07});
  assert.equal(focusedEntry(metric('bench_1rm'),{raw:'',load:'107',reps:'1',weight:'100'}).value,1.07);
});
