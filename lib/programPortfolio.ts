import {addDays,checkConfig,dayInZone,scheduledWeekdays,type AdaptiveConfig,type GoalUnit} from './adaptiveProgram';
import {createGuidedConfig,expectedRetestMinutes,supportedProgramMetrics} from './datedProgram';
import {guidedAdherenceScenario,illustrativeGain} from './guidedAdherence';
import {budgetDose,calendarAnchor,countGuidedSessions,daysBetween,maximumGuidedDays,type GoalRotation} from './guidedSchedule';
import {normalizeTrainingContext,type TrainingContext} from './personalWorkspace';
import type {ProgramOpportunity} from './programOpportunities';
import {goalDate} from './personalGoal';
import {datedTests,testedValue,type DatedTest} from './goalAttempts';
import {comparableDelta,type Observation} from './history';
import {protocolKey} from './protocols';
import type {MeasurementDetails,MeasurementMetadata} from './measurementMetadata';

// The studies support training overlap. Goal success is still measured separately on each test.
const pressingStudy='https://pubmed.ncbi.nlm.nih.gov/29541130/'; // Matched low loads, 18 young men; bench 1RM, no repetition-endurance improvement.
const jumpingStudy='https://pubmed.ncbi.nlm.nih.gov/22344055/'; // Deep squat groups improved CMJ in a 10-week trial.
const movementGroups = [
  ['pushups','bench_1rm','dips'],
  ['pullups','pullup_1rm','dead_hang','grip_strength'],
  ['squat_1rm','sit_to_stand','deadlift_1rm','cmj','broad_jump'],
  ['run_5k','sprint_400m'],
];
export type RelatedProgramGoal={opportunity:ProgramOpportunity;basis:'study'|'movement';source?:string};
export function relatedProgramGoals(primaryMetric:string,choices:readonly ProgramOpportunity[]):RelatedProgramGoal[]{
 const group=movementGroups.find(ids=>ids.includes(primaryMetric));
 if(!group)return [];
 const related:RelatedProgramGoal[]=[];
 for(const opportunity of choices){
  const other=opportunity.metric;
  if(other===primaryMetric||!group.includes(other))continue;
  const pair=[primaryMetric,other].sort().join('/');
  const source=pair==='bench_1rm/pushups'?pressingStudy:pair==='cmj/squat_1rm'?jumpingStudy:undefined;
  related.push({opportunity,basis:source?'study':'movement',source});
 }
 return related.sort((a,b)=>Number(!!b.source)-Number(!!a.source));
}

export type PortfolioGoal={
 metric:string;unit:GoalUnit;current:number;target:number;deadline?:string;bodyWeightKg?:number;
};
export type PortfolioInput={
 goals:readonly PortfolioGoal[];manualWeekdays?:Readonly<Record<string,readonly number[]>>;startDay:string;timeZone:string;context?:TrainingContext;observations?:readonly Observation[];details?:MeasurementMetadata;locale?:'en'|'fr'|'ar';now?:Date;
};
export type ProgrammeDateOption={date:string;probability:number|null};
export type PortfolioItem={
 config:AdaptiveConfig;suggestedDate:string;withinHorizon:boolean;dateConflict:boolean;retestMinutes:number;dateOptions:ProgrammeDateOption[];dateBasis:'training-scenario'|'measured-pace';estimate:ReturnType<typeof guidedAdherenceScenario>;
};

/** Fill the available nonconsecutive visit days with equal, complete exercise blocks.
 * In a tight budget a rotation lasts several weeks. All goals receive the same
 * number of opportunities per cycle. Spare slots remain available for recovery.
 */
function distribute(count:number,visitDays:number[],minutes:number){
 const days=visitDays.length;
 const parallel=Math.min(count,Math.floor(minutes/10)); // The existing guided prescription requires at least 10 minutes.
 const weeks=Math.ceil(count/(days*parallel));
 const slotsPerGoal=Math.floor(weeks*days*parallel/count);
 const rotations:GoalRotation[]=Array.from({length:count},()=>({weeks,slots:[]}));
 for(let index=0;index<slotsPerGoal*count;index++){
   const visit=Math.floor(index/parallel);
   const offset=7*Math.floor(visit/days)+visitDays[visit%days];
   rotations[index%count].slots.push(offset);
 }
 return {rotations,minutes:Math.min(60,Math.floor(minutes/parallel))};
}

// Earliest assigned visit with enough prior sessions for the starting model's
// expected gain at full attendance. The 0.5 response assumption matches the
// published in-product scenario; this is a planning date, not a promised result.
function measuredPaceDays(goal:PortfolioGoal,tests:DatedTest[],detail:MeasurementDetails|undefined,now:number){
 const metric=supportedProgramMetrics.find(m=>m.id===goal.metric);
 const anchor=tests.at(-1);
 const dayMs=86_400_000;
 if(!metric||!anchor||!detail?.measuredAt||detail.invalidContext||anchor.at!==Date.parse(detail.measuredAt)||
    now-anchor.at>31*dayMs||anchor.entry.method!==detail.method||protocolKey(anchor.entry.protocol)!==protocolKey(detail.protocol))return;
 const current=testedValue(metric,goal.unit,anchor,now);
 if(current===undefined||Math.abs(current-goal.current)>.0005)return;
 const rates:number[]=[];
 let later=anchor,value=current;
 for(let i=tests.length-2;i>=0&&rates.length<3;i--){
   const test=tests[i],elapsed=(later.at-test.at)/dayMs;
   if(elapsed>90)break;
   if(elapsed<1||!comparableDelta([test.entry,later.entry],now))continue;
   const prior=testedValue(metric,goal.unit,test,now);
   if(prior===undefined)continue;
   rates.push((value-prior)*metric.polarity/elapsed);
   later=test;value=prior;
 }
 if(rates.length!==3)return;
 const median=rates.sort((a,b)=>a-b)[1];
 if(median>0)return Math.ceil(Math.abs(goal.target-current)/median);
}

function proposeDeadline(config:AdaptiveConfig,start:string,paceDays:number|undefined,blocked:ReadonlySet<number>){
 const gain=illustrativeGain(config);
 const steps=Math.max(1,Math.ceil(Number((Math.abs(config.target-config.baseline)/gain).toFixed(9))));
 const required=steps*2;
 let last=addDays(start,maximumGuidedDays);
 let possible=0;
 let dateBasis:PortfolioItem['dateBasis']='training-scenario';
 const cycleDays=(config.rotation?.weeks??1)*7;
 const slots=config.rotation?.slots??Array.from({length:config.days},(_,i)=>Math.floor(7*i/config.days));
 for(let offset=1;offset<=maximumGuidedDays;offset++){
   if(slots.includes((offset-1)%cycleDays))possible++;
   if(blocked.has(offset)||config.rotation?.busyTests?.includes(offset)||config.rotation&&!slots.includes(offset%cycleDays))continue;
   const date=addDays(start,offset);
   last=date;
   if(possible<required||countGuidedSessions({...config,deadline:date},start,date)<required)continue;
   if(paceDays!==undefined&&offset<paceDays){dateBasis='measured-pace';continue;}
   return {suggestedDate:date,withinHorizon:true,dateBasis};
 }
 return {suggestedDate:last,withinHorizon:false,dateBasis};
}

// Reserve each check-in as a complete visit for one metric. A customer can
// compare progress between the start and final tests without stacking maximal
// tests or consuming another goal's training minutes on the same day.
function sharedVisits(rotations:GoalRotation[],deadlines:(number|undefined)[],daysPerWeek:number){
 const weekdays=[...new Set(rotations.flatMap(r=>r.slots.map(d=>d%7)))];
 const available=new Set<number>();
 for(let week=0;week*7<=maximumGuidedDays;week++){
   const start=week*7;
   const finals=deadlines.filter((offset):offset is number=>offset!==undefined&&offset>=start&&offset<start+7);
   const ordinary=weekdays.map(offset=>start+offset)
     .filter(day=>!deadlines.some(d=>d!==undefined&&Math.abs(day-d)<=1));
   // An edited deadline may fall on a normal rest day. Replace visit slots in
   // that week; keep the exercise visits with the most recovery around exams.
   if(finals.length)ordinary.sort((a,b)=>Math.min(...finals.map(f=>Math.abs(f-b)))-Math.min(...finals.map(f=>Math.abs(f-a))));
   ordinary.slice(0,Math.max(0,daysPerWeek-new Set(finals).size)).forEach(day=>available.add(day));
 }
 const terminal=new Set(deadlines.filter((n):n is number=>n!==undefined));
 const heldBy=rotations.map(()=>new Set<number>());
 const checkpoints=rotations.map(()=>new Set<number>());
 const exposures=rotations.map(()=>0);
 for(let day=0;day<=maximumGuidedDays;day++){
   const due=rotations.map((r,i)=>r.slots.includes(day%(7*r.weeks))&&day<(deadlines[i]??Infinity)?i:-1).filter(i=>i>=0);
   if(!due.length)continue;
   if(!available.has(day)||[day-1,day,day+1].some(d=>terminal.has(d))){
     for(const i of due)heldBy[i].add(day);
     continue;
   }
   const check=due.filter(i=>exposures[i]>=4&&!rotations[i].busyTests?.includes(day)).sort((a,b)=>exposures[b]-exposures[a])[0];
   if(check===undefined){for(const i of due)exposures[i]++;continue;}
   checkpoints[check].add(day);exposures[check]=0;
   for(const i of due)if(i!==check)heldBy[i].add(day);
 }
 for(const [i,r] of rotations.entries()){
   r.checks=[...checkpoints[i]];
   r.holds=[...heldBy[i]].sort((a,b)=>a-b);
 }
}

function finalVisits(configs:AdaptiveConfig[],goals:readonly PortfolioGoal[],paces:(number|undefined)[],start:string,daysPerWeek:number){
 const rotations=configs.map(config=>config.rotation!);
 const deadlines=goals.map(g=>g.deadline?daysBetween(start,g.deadline):undefined);
 const assigned=deadlines.slice();
 const planned=new Map<number,ReturnType<typeof proposeDeadline>>();
 // Fix the earliest outstanding recommendation first. A final test takes its
 // entire visit; the remaining estimates recalculate against the open visits.
 while(planned.size<configs.length){
   sharedVisits(rotations,assigned,daysPerWeek);
   let selected=-1, best:ReturnType<typeof proposeDeadline>|undefined;
   for(const [i,config] of configs.entries()){
     if(planned.has(i))continue;
     const reserved=new Set<number>();
     for(const [j,offset] of assigned.entries())if(j!==i&&offset!==undefined)
       for(const d of [offset-1,offset,offset+1])reserved.add(d);
     for(let week=0;week*7<=maximumGuidedDays;week++){
       const others=assigned.filter((d,j)=>j!==i&&d!==undefined&&Math.floor(d/7)===week);
       if(others.length>=daysPerWeek)for(let day=week*7;day<week*7+7;day++)reserved.add(day);
     }
     const suggestion=proposeDeadline(config,start,paces[i],reserved);
     if(!best||suggestion.suggestedDate<best.suggestedDate){best=suggestion;selected=i;}
   }
   planned.set(selected,best!);
   assigned[selected]??=daysBetween(start,best!.suggestedDate);
 }
 sharedVisits(rotations,assigned,daysPerWeek);
 return {planned,assigned};
}

function finalConflict(deadlines:(number|undefined)[],index:number,offset:number,days:number){
 return deadlines.some((other,j)=>index!==j&&other!==undefined&&Math.abs(other-offset)<=1)||
   deadlines.filter(other=>other!==undefined&&Math.floor(other/7)===Math.floor(offset/7)).length>days;
}

export function replanPortfolioDates(configs:readonly AdaptiveConfig[],changed:AdaptiveConfig,today:string,lockedMetrics:ReadonlySet<string>=new Set()):AdaptiveConfig[]{
 const guided=configs.filter(c=>c.guidedVersion===1&&!lockedMetrics.has(c.metric)&&c.deadline>today);
 if(guided.length!==configs.length){
   const replanned=replanPortfolioDates(guided,changed,today,lockedMetrics);
   return configs.map(c=>replanned.find(r=>r.metric===c.metric)??c);
 }
 const index=configs.findIndex(c=>c.metric===changed.metric);
 if(index<0||!goalDate(today))throw Error('schedule');
 const original=configs[index],start=calendarAnchor(original);
 if(!original.groupId||!start||lockedMetrics.has(original.metric)||original.deadline<=today||changed.deadline<=today||
    changed.groupId!==original.groupId||changed.routineId!==original.routineId||
    configs.some(c=>!c.rotation||c.groupId!==original.groupId||calendarAnchor(c)!==start||c.days!==original.days))throw Error('schedule');
 const result=configs.map((c,i)=>i===index?checkConfig({...original,target:changed.target,deadline:changed.deadline}):c);
 if(original.deadline===changed.deadline)return result;
 const cut=daysBetween(start,today);
 const offsets=result.map(c=>daysBetween(start,c.deadline));
 if(original.rotation?.busyTests?.includes(offsets[index])||finalConflict(offsets,index,offsets[index],original.days))throw Error('schedule');
 const rotations=result.map(c=>({...c.rotation!}));
 sharedVisits(rotations,offsets,original.days);
 return result.map((c,i)=>{
   if(c.deadline<=today||lockedMetrics.has(c.metric))return c;
   const r=c.rotation!;
   const merge=(before:number[]|undefined,after:number[]|undefined)=>
     [...(before??[]).filter(n=>n<=cut),...(after??[]).filter(n=>n>cut)];
   const checks=merge(r.checks,rotations[i].checks),holds=merge(r.holds,rotations[i].holds);
   if(JSON.stringify(checks)===JSON.stringify(r.checks??[])&&JSON.stringify(holds)===JSON.stringify(r.holds??[]))return c;
   return checkConfig({...c,rotation:{...r,checks,holds}});
 });
}

function selectableDays(configs:readonly AdaptiveConfig[],changed:AdaptiveConfig,today:string){
 const start=calendarAnchor(changed);
 const first=Math.max(1,daysBetween(start,today)+1);
 const otherDates=configs.filter(c=>c.metric!==changed.metric).map(c=>daysBetween(start,c.deadline));
 const cycle=(changed.rotation?.weeks??1)*7;
 const slots=changed.rotation?.slots??Array.from({length:changed.days},(_,i)=>Math.floor(7*i/changed.days));
 const choices:string[]=[];
 for(let d=first;d<=maximumGuidedDays-daysBetween(changed.scheduleStart!,start);d++){
   const date=addDays(start,d);
   if(changed.rotation?.busyTests?.includes(d)||!slots.includes(d%cycle)&&date!==changed.deadline)continue;
   if(changed.rotation&&finalConflict([...otherDates,d],otherDates.length,d,changed.days))continue;
   choices.push(date);
 }
 return choices;
}

function dateMenu(configs:readonly AdaptiveConfig[],config:AdaptiveConfig,today:string,center:string,locked:ReadonlySet<string>,
 current:number,loggedToday:boolean,choices=selectableDays(configs,config,today)):ProgrammeDateOption[]{
 if(!choices.length)return [];
 const targetIndex=choices.reduce((best,day,i)=>Math.abs(daysBetween(day,center))<Math.abs(daysBetween(choices[best],center))?i:best,0);
 const step=Math.max(1,Math.round((targetIndex+1)/3));
 const indices=new Set([targetIndex,Math.max(0,targetIndex-step),Math.min(choices.length-1,targetIndex+step)]);
 if(indices.size<3)indices.add(Math.min(choices.length-1,targetIndex+2*step));
 if(indices.size<3)indices.add(Math.max(0,targetIndex-2*step));
 const original=choices.indexOf(config.deadline);
 if(original>=0)indices.add(original);
 const result:ProgrammeDateOption[]=[];
 for(const index of [...indices].sort((a,b)=>a-b)){
   const date=choices[index];
   const changed={...config,deadline:date};
   let projected=changed;
   if(config.rotation&&configs.length>1&&date!==config.deadline){
     const start=calendarAnchor(config),cut=daysBetween(start,today);
     const rotations=configs.map(c=>({...c.rotation!}));
     const offsets=configs.map(c=>daysBetween(start,c.metric===config.metric?date:c.deadline));
     sharedVisits(rotations,offsets,config.days);
     const idx=configs.findIndex(c=>c.metric===config.metric);
     const r=rotations[idx],previous=config.rotation;
     const merged=(past:number[]|undefined,future:number[]|undefined)=>[...(past??[]).filter(day=>day<=cut),...(future??[]).filter(day=>day>cut)];
     projected={...changed,rotation:{...r,checks:merged(previous.checks,r.checks),holds:merged(previous.holds,r.holds)}};
   }
   if(!locked.has(config.metric))result.push({date,probability:guidedAdherenceScenario(projected,today,current,loggedToday)?.probability??null});
 }
 return result;
}

export function editProgrammeDateOptions(configs:readonly AdaptiveConfig[],changed:AdaptiveConfig,today:string,
 lockedMetrics:ReadonlySet<string>=new Set(),current=changed.baseline,loggedToday=false):ProgrammeDateOption[]{
 if(changed.guidedVersion!==1||!changed.scheduleStart||!goalDate(today)||lockedMetrics.has(changed.metric))return [];
 configs=configs.filter(c=>c.guidedVersion===1&&!lockedMetrics.has(c.metric)&&c.deadline>today);
 const choices=selectableDays(configs,changed,today);
 const gap=(changed.target-current)*supportedProgramMetrics.find(m=>m.id===changed.metric)!.polarity;
 const required=2*Math.max(1,Math.ceil(Number((gap/illustrativeGain(changed)).toFixed(9))))+Number(loggedToday);
 const center=choices.find(day=>countGuidedSessions({...changed,deadline:day},today,day)>=required)??choices.at(-1);
 return center?dateMenu(configs,changed,today,center,lockedMetrics,current,loggedToday,choices):[];
}

type AvailableVisits={offsets:number[];minutes:number;busyTests:number[]};
export function planGoalPortfolio({goals,startDay,timeZone,context={},observations=[],details={},locale='en',now=new Date()}:PortfolioInput, available?:AvailableVisits){
 const preferences=normalizeTrainingContext(context);
 const hasAerobic=goals.some(goal=>goal.metric==='zone2_power'||goal.metric==='run_5k');
 const daysPerWeek=available?.offsets.length??Math.min(3,preferences.days??(hasAerobic?3:2));
 const minutesPerVisit=available?.minutes??preferences.minutes??30;
 const items:PortfolioItem[]=[];
 if(!goals.length)return {items,daysPerWeek,minutesPerVisit};
 const ids=new Set(goals.map(goal=>goal.metric));
 if(ids.size!==goals.length||goals.some(goal=>!supportedProgramMetrics.some(m=>m.id===goal.metric)))throw Error('goal');
 if(!goalDate(startDay))throw Error('date');
 const visitDays=available?.offsets??Array.from({length:daysPerWeek},(_,i)=>Math.floor(7*i/daysPerWeek));
 const budget=distribute(goals.length,visitDays,minutesPerVisit);
 const measured=datedTests(observations,now.getTime());
 const paces=goals.map(goal=>measuredPaceDays(goal,measured.get(goal.metric)??[],details[goal.metric],now.getTime()));
 const configs=goals.map((goal,index)=>{
   const config=createGuidedConfig({metric:goal.metric,baseline:goal.current,goalUnit:goal.unit,target:goal.target,startDay,
     deadline:goal.deadline??addDays(startDay,maximumGuidedDays),context:{...preferences,days:daysPerWeek,minutes:budget.minutes},
     bodyWeightKg:goal.bodyWeightKg,locale,now,timeZone});
   if(goals.length>1||available)config.rotation={...budget.rotations[index],...(available?{busyTests:available.busyTests}:{})};
   return config;
 });
 const shared=goals.length>1||available?finalVisits(configs,goals,paces,startDay,daysPerWeek):null;
 for(const [i,config] of configs.entries()){
   const suggestion=shared?.planned.get(i)??proposeDeadline(config,startDay,paces[i],new Set());
   config.deadline=goals[i].deadline??suggestion.suggestedDate;
   checkConfig(config);
   const offset=daysBetween(startDay,config.deadline);
   const dateConflict=!!config.rotation?.busyTests?.includes(offset)||!!shared&&finalConflict(shared.assigned,i,offset,daysPerWeek);
   const retestMinutes=expectedRetestMinutes(config);
   items.push({config,...suggestion,dateConflict,retestMinutes,dateOptions:[],estimate:guidedAdherenceScenario(config,startDay)});
 }
 for(const item of items)item.dateOptions=dateMenu(configs,item.config,startDay,item.suggestedDate,new Set(),item.config.baseline,false);
 return {items,daysPerWeek,minutesPerVisit};
}

// Collections identify performance tests a customer has already measured.
// Saved goals, recent progress, preferred equipment and fresh tests affect
// their order. A collection is a training theme, not a percentile or badge.
type CollectionDefinition={
 id:string;title:[string,string,string];metrics:string[];equipment:NonNullable<TrainingContext['equipment']>;
};
const collections:CollectionDefinition[]=[
 {id:'pressing',title:['Pressing strength','Force de poussée','قوة الدفع'],metrics:['pushups','bench_1rm','dips'],equipment:['barbell','machines','dumbbells']},
 {id:'calisthenics',title:['Calisthenics foundation','Bases de la callisthénie','أساسيات تمارين وزن الجسم'],metrics:['pushups','pullups','dips','dead_hang'],equipment:['none','pullup_bar']},
 {id:'jump-power',title:['Jump power','Puissance de saut','قوة القفز'],metrics:['cmj','broad_jump','squat_1rm'],equipment:['outdoor','barbell']},
 {id:'pulling',title:['Pulling and grip','Tirage et préhension','قوة السحب والقبضة'],metrics:['pullups','pullup_1rm','dead_hang','grip_strength'],equipment:['pullup_bar']},
 {id:'lower-strength',title:['Lower-body strength','Force des jambes','قوة الجزء السفلي'],metrics:['squat_1rm','deadlift_1rm','sit_to_stand'],equipment:['barbell','dumbbells']},
 {id:'running',title:['Running performance','Performance en course','أداء الجري'],metrics:['run_5k','sprint_400m'],equipment:['outdoor']},
 {id:'balance',title:['Balance and chair rises','Équilibre et levers de chaise','التوازن والنهوض من الكرسي'],metrics:['single_leg_balance','sit_to_stand'],equipment:['none']},
];
export function rankGoalCollections({choices,context,currentMetrics=[]}:{
 choices:readonly ProgramOpportunity[];context?:TrainingContext;currentMetrics?:readonly string[];
}){
 const current=new Set(currentMetrics);
 const ranked=collections.flatMap(collection=>{
   const goals=choices.filter(c=>collection.metrics.includes(c.metric));
   if(goals.length<2)return [];
   const priority=goals.reduce((score,g)=>score+Number(current.has(g.metric)||g.reason==='saved-goal')*4+
     Number(g.reason==='observed-gain')*2+Number(g.freshness==='recent'),0)/goals.length;
   const equipment=context?.equipment?.some(e=>collection.equipment.includes(e))?1:0;
   return [{id:collection.id,title:collection.title,goals,priority:priority+equipment+goals.length/collection.metrics.length}];
 });
 return ranked.sort((a,b)=>b.priority-a.priority).map(({priority:_,...result})=>result);
}

function remainingManualBudget(manual:AdaptiveConfig[],input:PortfolioInput):AvailableVisits{
 const context=normalizeTrainingContext(input.context??{});
 const minutes=context.minutes??30,visits=context.days??3;
 const startWeekday=(new Date(input.startDay).getUTCDay()+6)%7;
 const reserved=Array.from({length:7},()=>0),busyTests=new Set<number>();
 for(const plan of manual){
   const weekdays=input.manualWeekdays?.[plan.metric]??scheduledWeekdays(plan.days,dayInZone(new Date(plan.createdAt),input.timeZone));
   const end=daysBetween(input.startDay,plan.deadline);
   for(const weekday of weekdays)reserved[(weekday-startWeekday+6)%7]+=plan.minutes;
   for(let offset=0;offset<=Math.min(end+1,maximumGuidedDays);offset++){
     const weekday=1+(startWeekday+offset)%7;
     if(weekdays.includes(weekday)||Math.abs(offset-end)<=1)busyTests.add(offset);
   }
 }
 const fixed=reserved.filter(t=>t>0).length;
 const open=reserved.map((_,i)=>i).filter(i=>reserved[(i+1)%7]===0&&reserved[(i+6)%7]===0&&minutes-reserved[i]>=10);
 let best:AvailableVisits|undefined;
 for(let mask=1;mask<2**open.length;mask++){
   const days=open.filter((_,i)=>(mask&(1<<i))!==0);
   if(days.length>3||days.some(i=>days.includes((i+1)%7))||fixed+days.filter(i=>reserved[i]===0).length>visits)continue;
   const free=Math.min(...days.map(i=>minutes-reserved[i]));
   if(!best||days.length*free>best.offsets.length*best.minutes)best={offsets:days,minutes:free,busyTests:[...busyTests].sort((a,b)=>a-b)};
 }
 if(!best)throw Error('budget');
 return best;
}

function resizeContinuing(existing:AdaptiveConfig,next:AdaptiveConfig,anchor:string){
 const config={...existing,days:next.days,minutes:next.minutes,rotation:{...next.rotation!,anchor}};
 config.dose=budgetDose(config,existing.dose);
 return checkConfig(config);
}

export function replanMixedManualGoal(configs:readonly AdaptiveConfig[],changed:AdaptiveConfig,today:string,timeZone:string,
 context:TrainingContext,manualWeekdays?:PortfolioInput['manualWeekdays'],lockedMetrics:ReadonlySet<string>=new Set()):AdaptiveConfig[]{
 const old=configs.find(c=>c.metric===changed.metric);
 if(!old||old.guidedVersion===1||changed.guidedVersion===1||old.deadline<=today||changed.deadline<=today||
   changed.routineId!==old.routineId||!old.groupId||old.groupId!==changed.groupId||lockedMetrics.has(changed.metric))throw Error('schedule');
 const result=configs.map(c=>c.metric===old.metric?checkConfig(changed):c);
 const active=result.filter(c=>c.deadline>today&&!lockedMetrics.has(c.metric));
 const guided=active.filter(c=>c.guidedVersion===1);
 if(!guided.length)return result;
 const manual=active.filter(c=>c.guidedVersion!==1);
 const weekdays={...manualWeekdays};
 if(old.days!==changed.days)weekdays[changed.metric]=scheduledWeekdays(changed.days,dayInZone(new Date(changed.createdAt),timeZone));
 const goals=guided.map(c=>({metric:c.metric,unit:c.goalUnit,current:c.baseline,target:c.target,deadline:c.deadline,bodyWeightKg:c.bodyWeightKg}));
 const input={goals,startDay:today,timeZone,context,manualWeekdays:weekdays};
 const adjusted=planGoalPortfolio(input,remainingManualBudget(manual,input));
 if(adjusted.items.some(i=>i.dateConflict||!i.dateOptions.length))throw Error('schedule');
 return result.map(c=>{
   const next=adjusted.items.find(i=>i.config.metric===c.metric);
   return next?resizeContinuing(c,next.config,today):c;
 });
}

export function addPortfolioGoals(existing:readonly AdaptiveConfig[],input:PortfolioInput,lockedMetrics:ReadonlySet<string>=new Set()){
 const existingIds=new Set(existing.map(c=>c.metric));
 if(input.goals.some(g=>existingIds.has(g.metric)))throw Error('goal');
 const current=existing.filter(c=>c.guidedVersion===1&&c.deadline>input.startDay&&!lockedMetrics.has(c.metric));
 const manual=existing.filter(c=>c.guidedVersion!==1&&c.deadline>input.startDay&&!lockedMetrics.has(c.metric));
 if(!current.length&&!manual.length||!input.goals.length)throw Error('goal');
 const head=existing[0];
 if(existing.some(c=>c.groupId!==head.groupId))throw Error('group');
 const goals:PortfolioGoal[]=current.map(c=>({metric:c.metric,unit:c.goalUnit,current:c.baseline,target:c.target,deadline:c.deadline,bodyWeightKg:c.bodyWeightKg}));
 const portfolio=planGoalPortfolio({...input,goals:[...goals,...input.goals]},manual.length?remainingManualBudget(manual,input):undefined);
 const configurations=portfolio.items.map(item=>({...item.config,rotation:{...item.config.rotation!,anchor:input.startDay}}));
 const revised=current.map((c,i)=>resizeContinuing(c,configurations[i],input.startDay));
 const items=portfolio.items.slice(current.length).map((item,i)=>({...item,config:configurations[current.length+i]}));
 if(manual.length&&items.some(item=>!item.dateOptions.length))throw Error('budget');
 return {...portfolio,items,revised:[...revised,...manual]};
}
