import assert from 'node:assert/strict';
import test from 'node:test';
import {addDays,buildProgram,checkConfig,savedAdaptiveConfig} from './adaptiveProgram';
import {countGuidedSessions,datedProgram,previewDatedProgram,supportedProgramMetrics} from './datedProgram';
import {guidedAdherenceScenario} from './guidedAdherence';
import type {Observation} from './history';
import {rankProgramOpportunities} from './programOpportunities';
import {addPortfolioGoals,rankGoalCollections,planGoalPortfolio,relatedProgramGoals,replanMixedManualGoal,replanPortfolioDates,editProgrammeDateOptions,type PortfolioGoal} from './programPortfolio';

const today='2026-11-22', now=new Date(today+'T15:00:00Z');
const base={startDay:today,timeZone:'UTC',now};
const push:PortfolioGoal={metric:'pushups',unit:'metric',current:10,target:14};
const bench:PortfolioGoal={metric:'bench_1rm',unit:'kg',current:70,target:72,bodyWeightKg:80};
const measured=(value:number,offset:number):Observation=>({id:'test-'+offset,value,metricId:'pushups',cleared:false,
 method:'manual',protocol:{id:'strict_pushups_v1'},measuredAt:addDays(today,-offset)+'T12:00:00Z',recordedAt:addDays(today,-offset)+'T13:00:00Z'});

test('related goal proposals return only measured candidates, with tested pairs before movement-family suggestions',()=>{
 const choices=rankProgramOpportunities({today,values:{pushups:10,bench_1rm:.9,dips:4,grip_strength:40,cmj:32,squat_1rm:1.1}});
 const picks=relatedProgramGoals('pushups',choices);
 assert.deepEqual(picks.map(p=>[p.opportunity.metric,p.basis]),[['bench_1rm','study'],['dips','movement']]);
 assert.match(picks[0].source!,/29541130/);
 assert.match(relatedProgramGoals('cmj',choices)[0].source!,/22344055/);
 assert.deepEqual(relatedProgramGoals('pushups',choices.filter(p=>p.metric==='grip_strength')),[]);
});

test('an editable date and target determine the per-goal probability, while harder targets receive later suggested dates',()=>{
 const shorter=planGoalPortfolio({...base,goals:[push,bench]}).items;
 const harder=planGoalPortfolio({...base,goals:[{...push,target:20,deadline:addDays(today,6)},bench]}).items;
 assert.ok(shorter[0].suggestedDate<harder[0].suggestedDate);
 assert.equal(harder[0].config.deadline,addDays(today,6));
 assert.ok(harder[0].estimate!.probability<shorter[0].estimate!.probability);
 assert.equal(harder[1].config.goalUnit,'kg');assert.equal(harder[1].config.baseline,70);
 assert.deepEqual(shorter[1].estimate,guidedAdherenceScenario(shorter[1].config,today));
 assert.throws(()=>planGoalPortfolio({...base,goals:[push,push]}));
 assert.throws(()=>planGoalPortfolio({...base,goals:[{...push,deadline:addDays(today,365)}]}));
});

test('all measured programme goals fit conservative day and minute limits and retain the same calendar on reload',()=>{
 const values=Object.fromEntries(supportedProgramMetrics.map(m=>[m.id, Math.ceil((m.min+m.max)/2)]));
 const choices=rankProgramOpportunities({today,values});
 assert.equal(choices.length,supportedProgramMetrics.length);
 const goals=choices.map(({metric,unit,current,nextTarget})=>({metric,unit,current,target:nextTarget}));
 for(const [days,minutes] of [[1,10],[2,30],[7,60]]){
   const plan=planGoalPortfolio({...base,context:{days,minutes},goals});
   const visits=new Map<string,number>();
   for(const item of plan.items){
     assert.ok(item.config.rotation);
     const restored=savedAdaptiveConfig(buildProgram(item.config,'UTC'));
     assert.deepEqual(restored,item.config);
     const rows=previewDatedProgram(item.config,'UTC').weeks.flatMap(w=>w.sessions);
     assert.equal(countGuidedSessions(item.config,today,item.config.deadline),rows.filter(s=>s.kind==='training').length);
     assert.equal(item.estimate!.sessions,rows.filter(s=>s.kind==='training').length);
     assert.ok(rows.filter(r=>r.kind==='training').length>0);
     for(const event of rows)visits.set(event.date,(visits.get(event.date)??0)+item.config.minutes);
   }
   assert.ok([...visits.values()].every(used=>used<=minutes));
   for(const day of visits.keys())assert.equal(visits.has(addDays(day,1)),false);
   assert.ok(plan.daysPerWeek<=days);
   assert.throws(()=>checkConfig({...plan.items[0].config,rotation:{weeks:1,slots:[0,0]}}));
 }
});

test('three measured intervals at the current protocol can lengthen the date without being counted as training intervals',()=>{
 const obs=[measured(7,60),measured(8,40),measured(9,20),measured(10,0)];
 const details={pushups:obs[3]};
 const input={...base,goals:[push],details,observations:obs};
 const estimate=planGoalPortfolio(input).items[0];
 assert.equal(estimate.dateBasis,'measured-pace');
 assert.ok(estimate.suggestedDate>=addDays(today,80));
 assert.equal(estimate.estimate!.kind,'illustrative');
 assert.equal(planGoalPortfolio({...input,observations:obs.slice(1)}).items[0].dateBasis,'training-scenario');
 assert.equal(planGoalPortfolio({...input,observations:[{...obs[0],method:'device'},...obs.slice(1)]}).items[0].dateBasis,'training-scenario');
 assert.equal(planGoalPortfolio({...input,goals:[{...push,current:11}]}).items[0].dateBasis,'training-scenario');
 const cleared={...obs[1],id:'clear',value:null,cleared:true,recordedAt:addDays(today,-39)+'T14:00:00Z'};
 assert.equal(planGoalPortfolio({...input,observations:[...obs,cleared]}).items[0].dateBasis,'training-scenario');
});

test('a target outside the model horizon has an explicit review flag and preserves its actual probability',()=>{
 const [item]=planGoalPortfolio({...base,goals:[{...push,target:150}],context:{days:1,minutes:10}}).items;
 assert.equal(item.withinHorizon,false);assert.ok(item.suggestedDate<=addDays(today,364));assert.ok(item.estimate!.probability<.5);
});

test('changing a rotation preserves earlier due dates and opens a new attempt even when weekly labels coincide',async()=>{
 const {activePlan,goalProgramPeriods,historicalTrainingCalendar}=await import('./adaptiveProgram');
 const {appendTraining}=await import('./training');
 const grouped=crypto.randomUUID(),planId=crypto.randomUUID();
 const [item]=planGoalPortfolio({...base,goals:[{...push,target:30,deadline:addDays(today,84)}]}).items;
 const config={...item.config,groupId:grouped,rotation:{weeks:2,slots:[0]}};
 const first=buildProgram(config,'UTC');
 const next=buildProgram({...config,rotation:{weeks:2,slots:[7]}},'UTC',first);
 const save=(program:typeof first,at:string,revision:number,events:Parameters<typeof appendTraining>[0])=>
   appendTraining(events,{kind:'program',data:program,expectedRevision:revision,reason:'',deleted:false,id:planId,requestId:crypto.randomUUID(),epoch:0,version:1},0,Date.parse(at));
 const ledger=save(next,addDays(today,22)+'T12:00Z',1,save(first,now.toISOString(),0,[]));
 const attempts=goalProgramPeriods(ledger);
 assert.equal(attempts.length,2);
 const asOf=addDays(today,38);
 const history=historicalTrainingCalendar(activePlan(ledger)!,asOf)!;
 assert.equal(history.has(addDays(today,14)),true);
 assert.equal(history.has(addDays(today,7)),false);
 assert.equal(history.has(addDays(today,35)),true);
 const dates=datedProgram(activePlan(ledger)!).weeks.flatMap(w=>w.sessions.map(s=>s.date));
 assert.ok(dates.includes(addDays(today,14)));
 assert.ok(!dates.includes(addDays(today,7)));
 assert.ok(dates.includes(addDays(today,35)));
});

test('each suggested final or interim test reserves an entire visit and alternate dates have their own forecast',()=>{
 const run:PortfolioGoal={metric:'run_5k',unit:'metric',current:31,target:29};
 const {items}=planGoalPortfolio({...base,goals:[push,bench,run],context:{days:2,minutes:20}});
 const days=new Map<string,string[]>();
 for(const item of items){
   for(const row of previewDatedProgram(item.config,'UTC').weeks.flatMap(w=>w.sessions))
     days.set(row.date,[...(days.get(row.date)??[]),row.kind]);
   assert.equal(item.dateConflict,false);
   assert.ok(item.dateOptions.length>=3);
   assert.equal(new Set(item.dateOptions.map(o=>o.date)).size,item.dateOptions.length);
   const recommended=item.dateOptions.find(o=>o.date===item.suggestedDate)!;
   assert.equal(recommended.probability,item.estimate!.probability);
   assert.ok(item.dateOptions.some(o=>o.date<item.suggestedDate));
   assert.ok(item.dateOptions.some(o=>o.date>item.suggestedDate));
 }
 assert.equal(items[2].retestMinutes,36);
 for(const kinds of days.values())if(kinds.includes('retest'))assert.equal(kinds.length,1);
 const gid=crypto.randomUUID();
 const configs=items.map(({config})=>({...config,groupId:gid}));
 const current=addDays(today,2);
 const options=editProgrammeDateOptions(configs,configs[0],current);
 assert.ok(options.length>=3);assert.ok(options.some(o=>o.date===configs[0].deadline));
 for(const option of options){
   const projected=replanPortfolioDates(configs,{...configs[0],deadline:option.date},current)[0];
   assert.equal(guidedAdherenceScenario(projected,current)?.probability,option.probability);
 }
});

test('colliding manual deadlines and overfilled final test weeks are identified; saved goals keep prior visits when edited',()=>{
 const d=addDays(today,43);
 const conflict=planGoalPortfolio({...base,goals:[{...push,deadline:d},{...bench,deadline:addDays(d,2)}],context:{days:1,minutes:20}});
 assert.ok(conflict.items.every(i=>i.dateConflict));
 const group=crypto.randomUUID();
 const configs=planGoalPortfolio({...base,goals:[push,bench]}).items.map(i=>({...i.config,groupId:group}));
 const editDay=addDays(today,3);
 assert.throws(()=>replanPortfolioDates(configs,{...configs[0],deadline:configs[1].deadline},editDay),/schedule/);
 assert.throws(()=>replanPortfolioDates(configs,configs[0],editDay,new Set([configs[0].metric])),/schedule/);
 const candidate=editProgrammeDateOptions(configs,configs[0],editDay).find(o=>o.date!==configs[0].deadline)!;
 const updated=replanPortfolioDates(configs,{...configs[0],deadline:candidate.date},editDay);
 const past=(c:typeof configs[number])=>previewDatedProgram(c,'UTC').weeks.flatMap(w=>w.sessions.filter(s=>s.date<=editDay));
 assert.deepEqual(past(configs[0]),past({...updated[0],groupId:group}));
 assert.equal(updated[1].target,configs[1].target);
});

test('descriptive collections use only measured metrics and elevate relevant equipment and a current goal',()=>{
 const choices=rankProgramOpportunities({today,values:{pushups:20,bench_1rm:1,dips:10,cmj:40,broad_jump:180,squat_1rm:1.2}});
 const jump=rankGoalCollections({choices,currentMetrics:['cmj'],context:{equipment:['outdoor']}});
 assert.equal(jump[0].id,'jump-power');
 const pressing=rankGoalCollections({choices,currentMetrics:['bench_1rm'],context:{equipment:['barbell']}});
 assert.equal(pressing[0].id,'pressing');
 assert.ok(pressing.every(collection=>collection.goals.length>=2&&collection.goals.every(goal=>choices.includes(goal))));
 assert.deepEqual(rankGoalCollections({choices:choices.slice(0,1)}),[]);
});

test('adding a new goal keeps the original routine, units and deadline and schedules each new test only from today',()=>{
 const [old]=planGoalPortfolio({...base,goals:[{...push,deadline:addDays(today,60)}]}).items;
 const after=addDays(today,9);
 const added=addPortfolioGoals([old.config],{...base,goals:[bench],startDay:after,now:new Date(after+'T10:00:00Z')});
 assert.equal(added.items.length,1);assert.equal(added.revised.length,1);
 const kept=added.revised[0];
 for(const field of ['routineId','scheduleStart','createdAt','baseline','target','deadline','exercise','goalUnit'] as const)
   assert.equal(kept[field],old.config[field],field);
 assert.equal(kept.rotation!.anchor,after);
 assert.equal(added.items[0].config.scheduleStart,after);
 const id=crypto.randomUUID();
 const grouped=[kept,added.items[0].config].map(c=>({...c,groupId:id}));
 const editDay=addDays(after,1),options=editProgrammeDateOptions(grouped,grouped[0],editDay);
 assert.ok(options.length>1);
 const next=options.find(o=>o.date!==kept.deadline)!;
 const revised=replanPortfolioDates(grouped,{...grouped[0],deadline:next.date},editDay);
 assert.equal(revised[0].deadline,next.date);
 assert.equal(revised[1].scheduleStart,after);
});

test('a legacy schedule remains unchanged; extra goals use remaining minutes and never add retests on old workout days',()=>{
 const [first]=planGoalPortfolio({...base,goals:[push]}).items;
 const legacy={...first.config,guidedVersion:undefined,scheduleStart:undefined,days:2,minutes:20,deadline:addDays(today,28)};
 const context={days:3,minutes:35};
 // Sunday and Wednesday, as saved by an older programme revision.
 const combined=addPortfolioGoals([legacy],{...base,goals:[bench],context,manualWeekdays:{pushups:[7,3]}});
 assert.equal(combined.revised[0],legacy);
 const groupId=crypto.randomUUID();
 const joined=[legacy,...combined.items.map(i=>i.config)].map(c=>({...c,groupId}));
 const day=addDays(today,1);
 const edited=replanMixedManualGoal(joined,{...joined[0],target:16},day,'UTC',context,{pushups:[7,3]});
 assert.equal(edited[0].target,16);assert.equal(edited[1].routineId,joined[1].routineId);
 assert.throws(()=>replanMixedManualGoal(joined,{...joined[0],minutes:35},day,'UTC',{days:2,minutes:35},{pushups:[7,3]}),/budget/);
 const row=combined.items[0];
 const byWeek=new Map<number,Set<number>>();
 for(const session of previewDatedProgram(row.config,'UTC').weeks.flatMap(w=>w.sessions)){
   const day=new Date(session.date).getUTCDay(),week=Math.floor((Date.parse(session.date)-Date.parse(today))/604800000);
   if(session.date<=legacy.deadline){
     const seen=byWeek.get(week)??new Set([0,3]);seen.add(day);byWeek.set(week,seen);
     const manualMinutes=day===0||day===3?legacy.minutes:0;
     assert.ok(session.estimatedMinutes+manualMinutes<=context.minutes);
     if(session.kind==='retest')assert.equal(manualMinutes,0);
   }
 }
 assert.ok([...byWeek.values()].every(days=>days.size<=context.days));
 assert.throws(()=>addPortfolioGoals([legacy],{...base,goals:[bench],context:{days:2,minutes:20},manualWeekdays:{pushups:[7,3]}}),/budget/);
});
