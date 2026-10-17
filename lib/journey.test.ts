import {test} from 'node:test';
import assert from 'node:assert/strict';
import {journeyChanges,rankCardSvg,rankChangeReason} from './journey';
import type {Observation} from './history';
const d={age:35,sex:'male' as const};
const observation=(id:string,value:number,date:string):Observation=>({id,metricId:'pushups',value,cleared:false,recordedAt:date,measuredAt:date,method:'manual',protocol:{id:'strict_pushups_v1'}});
const entries=[observation('a',20,'2026-10-14T12:00:00Z'),observation('b',25,'2026-10-15T12:00:00Z')];
test('badges require dated matching observations and actual improvement',()=>{
 assert.equal(journeyChanges(entries,{pushups:25},d)[0]?.personalBest,true);
 assert.equal(journeyChanges(entries,{pushups:30},d).length,0);
 assert.equal(journeyChanges([{...entries[0],method:undefined},entries[1]],{pushups:25},d).length,0);
 const worse=[...entries,observation('c',23,'2026-10-16T12:00:00Z')];assert.equal(journeyChanges(worse,{pushups:23},d)[0]?.personalBest,false);
 const oldBest=[observation('old',30,'2026-10-13T12:00:00Z'),...entries];assert.equal(journeyChanges(oldBest,{pushups:25},d)[0]?.personalBest,false);
});
test('rank explanations distinguish coverage changes from result changes',()=>{
 assert.equal(rankChangeReason({pushups:20},{pushups:25},d),'Recorded results changed');
 assert.equal(rankChangeReason({pushups:20},{pushups:20,total_sleep:450},d),'Measurements added or removed');
});
test('share SVG escapes selected labels and includes the illustrative disclosure',()=>{
 const svg=rankCardSvg('My rank','Top 5%','Elite','Illustrative estimate · not a world rank',[{name:'<script> & test',top:'Top 10%'}]);
 assert.ok(svg.includes('&lt;script&gt; &amp; test'));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('not a world rank'));assert.ok(!svg.includes('pushups'));
});
