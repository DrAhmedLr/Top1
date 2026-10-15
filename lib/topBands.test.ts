import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TOP_BAND_EDGES,topBandForThresholds} from './topBands';
const deciles=Array.from({length:9},(_,i)=>({percentile:(i+1)*10,value:(i+1)*10}));
test('display brackets follow the chosen asymmetric scale',()=>{assert.deepEqual(TOP_BAND_EDGES,[1,2.5,5,7.5,10,15,20,25,30,35,45,55,65]);});
test('coarse source intervals span multiple product brackets without interpolating',()=>{assert.deepEqual(topBandForThresholds(65,deciles),{kind:'range',from:30,to:45});assert.deepEqual(topBandForThresholds(35,deciles),{kind:'range',from:55,to:100});});
test('tails never fabricate top 1% and bottom group is 65%+',()=>{assert.deepEqual(topBandForThresholds(95,deciles),{kind:'upper',from:0,to:10});assert.deepEqual(topBandForThresholds(5,deciles),{kind:'lower',from:65,to:100});});
test('rounded threshold ties conservatively include both adjacent intervals',()=>{assert.deepEqual(topBandForThresholds(70,deciles),{kind:'range',from:20,to:45});});
test('a finer source can support narrower bands without changing the display policy',()=>{const fine=[{percentile:90,value:50},{percentile:92.5,value:55},{percentile:95,value:60},{percentile:97.5,value:65},{percentile:99,value:70}];assert.deepEqual(topBandForThresholds(62,fine),{kind:'range',from:2.5,to:5});});
test('invalid or unordered reference values cannot produce a result',()=>{assert.equal(topBandForThresholds(NaN,deciles),null);assert.equal(topBandForThresholds(30,[{percentile:20,value:20},{percentile:40,value:10}]),null);assert.equal(topBandForThresholds(30,[]),null);});

test('supported extreme tails collapse into Top 1%, never a sub-one-percent label',()=>{assert.deepEqual(topBandForThresholds(80,[{percentile:99,value:70},{percentile:99.5,value:75}]),{kind:'best',from:0,to:1});assert.equal(topBandForThresholds(30,[{percentile:NaN,value:10},{percentile:90,value:20}]),null);});
