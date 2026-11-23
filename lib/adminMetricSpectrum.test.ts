import test from 'node:test';
import assert from 'node:assert/strict';
import {metricSpectrum,referenceSpectrum} from './adminMetricSpectrum';
import {activeMetrics} from './registry';
import {challengeStanding} from './challengeProgress';
import {PERFORMANCE_RULES} from './performanceRules';
const profiles=[{age:25,weight:75,sex:'male'},{age:70,weight:105,sex:'female'}] as const;
test('admin bands partition every reachable tier in both scoring directions',()=>{
  for(const metric of activeMetrics) for(const profile of profiles){
    const rule=PERFORMANCE_RULES[metric.id];
    const bands=metricSpectrum(metric,profile);
    if(!rule){assert.equal(bands.length,0);continue;}
    assert.equal(bands[0].from,metric.polarity===1?metric.min:metric.max);
    assert.equal(bands.at(-1)?.through,metric.polarity===1?metric.max:metric.min);
    assert.equal(new Set(bands.map(b=>b.tier)).size,bands.length);
    for(const [index,band] of bands.entries()){
      for(const v of [band.from,band.through]) assert.equal(challengeStanding(metric.id,v,profile)?.tier,band.tier);
      if(index) assert.equal(Math.round(band.from*rule.ticksPerUnit)-Math.round(bands[index-1].through*rule.ticksPerUnit),metric.polarity);
    }
  }
});
test('published preview uses the reference sex and age with all and only the supported thresholds',()=>{
  for(const [id,count] of [['vo2_max',9],['cmj',4],['grip_strength',11]] as const){
    const metric=activeMetrics.find(m=>m.id===id)!;
    const result=referenceSpectrum(metric,profiles[0]);
    assert.ok(result?.available,id);
    assert.equal(result.thresholds.length,count);
    assert.equal(referenceSpectrum(metric,{age:25,sex:'unselected'})?.available,false);
  }
});
