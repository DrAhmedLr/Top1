import {activeMetrics} from './registry';
import {addDays,checkConfig,dayInZone,guidedRecoveryDates,sessionResult,type AdaptiveConfig,type AdaptivePlan,type Dose,type GoalUnit} from './adaptiveProgram';
import {goalDate} from './personalGoal';
import {normalizeTrainingContext,type TrainingContext} from './personalWorkspace';
import {suggestStartingSession} from './startingSession';
import {budgetDose,countGuidedSessions,daysBetween,guidedDoseForDate,isGuidedRetestDay,isGuidedTrainingDay,maximumGuidedDays,programFamilies,sessionParameters,
 type ProgramEffort,type ProgramLabel,type ProgramWarning} from './guidedSchedule';
import {isLift} from './focusedEntry';
import {valid} from './engine';
import type {Workout} from './training';

export {isGuidedTrainingDay,isGuidedRetestDay,countGuidedSessions,nextGuidedTrainingDay} from './guidedSchedule';
export type {ProgramEffort,ProgramWarning} from './guidedSchedule';
export const supportedProgramMetric=(id:string)=>Object.hasOwn(programFamilies,id);
export const supportedProgramMetrics=activeMetrics.filter(metric=>supportedProgramMetric(metric.id));

const names:Record<string,ProgramLabel>={
 pushups:['Strict push-ups','Pompes strictes','تمارين ضغط كاملة'],
 pullups:['Strict pull-ups','Tractions strictes','عقلة كاملة'],dips:['Controlled dips','Dips contrôlés','تمارين متوازي مضبوطة'],
 sit_to_stand:['Controlled chair rises','Levers de chaise contrôlés','نهوض مضبوط من الكرسي'],
 bench_1rm:['Bench press','Développé couché','ضغط الصدر بالبار'],squat_1rm:['Barbell squat','Squat à la barre','قرفصاء بالبار'],
 deadlift_1rm:['Deadlift','Soulevé de terre','رفعة ميتة'],pullup_1rm:['Bodyweight or assisted pull-ups','Tractions au poids du corps ou assistées','عقلة بوزن الجسم أو بمساعدة'],
 dead_hang:['Supported bar hangs','Suspensions assistées','تعلّق بالعارضة مع دعم'],grip_strength:['Comfortable towel squeezes','Pressions modérées sur une serviette','عصر منشفة بقبضة مريحة'],
 cmj:['Low jumps with a quiet landing','Petits sauts avec réception souple','قفزات منخفضة بهبوط هادئ'],
 broad_jump:['Short standing jumps, reset between reps','Petits sauts en longueur depuis l’arrêt','قفزات أفقية قصيرة من الثبات'],
 single_leg_balance:['Supported balance hold on each leg, eyes open','Équilibre avec appui sur chaque jambe, yeux ouverts','توازن مع دعم على كل ساق والعينان مفتوحتان'],
 run_5k:['Easy run or run–walk intervals','Fractions faciles de course ou de course-marche','فترات جري مريح أو جري ومشي'],
 sprint_400m:['Relaxed running strides','Lignes droites relâchées','تسارعات جري مريحة'],
 zone2_power:['Easy cycling intervals','Fractions de vélo à allure facile','فترات دراجة بوتيرة مريحة'],
};
export function expectedRetestMinutes(config:AdaptiveConfig) {
 // A full 5 km test needs the athlete's recorded course time plus a short setup allowance.
 return config.metric==='run_5k'?Math.ceil(config.baseline)+5:config.minutes;
}
const retest:ProgramLabel=['Repeat the original test and protocol','Refaire le test avec le protocole initial','أعد الاختبار بالطريقة الأصلية'];
const sources={
 resistance:'https://acsm.org/resistance-training-guidelines-update-2026/',
 aerobic:'https://odphp.health.gov/our-work/nutrition-physical-activity/physical-activity-guidelines/current-guidelines',
};

export type GuidedConfigInput={
 metric:string; baseline:number; target:number; startDay:string; deadline:string; timeZone:string; goalUnit?:GoalUnit;
 context?:TrainingContext;bodyWeightKg?:number;locale?:'en'|'fr'|'ar';now?:Date;
};

export function createGuidedConfig({metric:id,baseline,target,startDay,deadline,timeZone,goalUnit='metric',context={},bodyWeightKg,locale='en',now=new Date()}:GuidedConfigInput):AdaptiveConfig{
 const metric=supportedProgramMetrics.find(item=>item.id===id);
 if(!metric)throw Error('goal');
 if(!goalDate(startDay)||!goalDate(deadline)||deadline<=startDay||daysBetween(startDay,deadline)>maximumGuidedDays)throw Error('date');
 // Resolve the saved zone here so preview and persistence reject the same inputs.
 dayInZone(now,timeZone);
 if(bodyWeightKg!==undefined&&(!Number.isFinite(bodyWeightKg)||bodyWeightKg<25||bodyWeightKg>350))throw Error('goal');
 if(goalUnit==='kg'&&bodyWeightKg&&(!valid(metric,baseline/bodyWeightKg)||!valid(metric,target/bodyWeightKg)))throw Error('target');
 const prefs=normalizeTrainingContext(context),family=programFamilies[id]!;
 const minutes=Math.min(60,prefs.minutes??30),days=Math.min(3,prefs.days??(family==='aerobic'?3:2));
 const s=suggestStartingSession(metric,baseline,goalUnit,bodyWeightKg,minutes,prefs);
 const equipment=prefs.equipment??[];
 let exercise=s.exercise??names[id],{sets,amount,loadKg,mode}=s;
 if(family==='repetition'){
   amount=Math.min(15,Math.max(1,Math.floor(baseline*.40)));
   if(baseline<5){
     const regressions:Record<string,ProgramLabel>={pushups:['Incline push-ups on a stable surface','Pompes inclinées sur support stable','ضغط مائل على سطح ثابت'],
       pullups:['Assisted pull-ups','Tractions assistées','عقلة بمساعدة'],dips:['Supported dips','Dips assistés','متوازي بمساعدة'],
       sit_to_stand:['Assisted chair rises','Levers de chaise avec appui','نهوض من الكرسي مع دعم']};
     exercise=s.exercise&&id==='pullups'&&equipment.length&&!equipment.includes('pullup_bar')?s.exercise:regressions[id];
     amount=4;
   }
 }else if(family==='aerobic'){
   // Easy aerobic time is work time. A target race time is never converted to a race-pace prescription.
   exercise=names[id];mode='seconds';sets=2;
   const budgetMinutes=Math.min(minutes*.45,id==='run_5k'?baseline*.42:minutes*.4);
   amount=Math.max(30,Math.floor(budgetMinutes*60/sets/15)*15);
 }else if(family==='stride'){
   exercise=names[id];sets=3;mode='seconds';amount=Math.min(15,Math.max(5,Math.round(baseline*.12)));
 }else if(family==='balance'){
   exercise=names[id];sets=2;mode='seconds';amount=Math.max(3,Math.min(20,Math.floor(baseline*.5)));
 }else if(family==='grip'){
   exercise=names[id];mode='seconds';amount=8;loadKg=0;
 }else if(family==='lift'){
   if(id==='pullup_1rm')loadKg=0;
   if(id!=='pullup_1rm'&&!s.exercise&&!loadKg){
     // No original test-day body mass for a ratio. Use an unloaded variant.
     exercise=id==='bench_1rm'?['Incline push-ups','Pompes inclinées','ضغط مائل']:
       id==='squat_1rm'?['Bodyweight squats','Squats au poids du corps','قرفصاء بوزن الجسم']:
       ['Unloaded hip hinges','Flexions de hanches sans charge','ثني الورك دون حمل'];
   }
 }
 const noBar=equipment.length>0&&!equipment.includes('pullup_bar');
 if(id==='dead_hang'&&noBar){exercise=names.grip_strength;mode='seconds';amount=8;loadKg=0;}
 if(id==='dips'&&equipment.length===1&&equipment[0]==='none'){
   exercise=['Close-grip incline push-ups','Pompes inclinées prise serrée','ضغط مائل بقبضة ضيقة'];amount=Math.min(amount,8);
 }
 const reviewEquipment=Boolean(isLift(id)&&exercise!==names[id]||['pullups','dead_hang'].includes(id)&&noBar||id==='dips'&&equipment.length===1&&equipment[0]==='none');
 const config:AdaptiveConfig={guidedVersion:1,scheduleStart:startDay,metric:id,goalUnit,baseline,target,deadline,createdAt:now.toISOString(),
   days,minutes,exercise:exercise[locale==='fr'?1:locale==='ar'?2:0],exerciseLabels:exercise,dose:{sets,amount,mode,loadKg},
   routineId:crypto.randomUUID(),reviewEquipment,reviewLimitations:!!prefs.limitations,...(bodyWeightKg===undefined?{}:{bodyWeightKg})};
 config.dose=budgetDose(config,config.dose);
 return checkConfig(config);
}

export interface DatedTrainingSession extends Dose {
 date:string;kind:'training';exercise:ProgramLabel;effort:ProgramEffort;
 restSeconds:number;warmupMinutes:number;cooldownMinutes:number;estimatedMinutes:number;
}
export type DatedSession=DatedTrainingSession|{date:string;kind:'retest';exercise:ProgramLabel;estimatedMinutes:number};
export interface DatedProgram {
 weeks:{number:number;start:string;end:string;sessions:DatedSession[]}[];trainingCount:number;targetChange:number;changePerWeek:number;
 warnings:ProgramWarning[];retestDate:string;source:string;
}

function trainingMinutes(config:AdaptiveConfig,dose:Dose) {
 const {restSeconds,warmupMinutes,cooldownMinutes}=sessionParameters(config);
 const seconds=dose.amount*dose.sets*(dose.mode==='reps'?3:1)*(programFamilies[config.metric]==='balance'?2:1)+restSeconds*(dose.sets-1);
 return warmupMinutes+cooldownMinutes+Math.ceil(seconds/60);
}

type CalendarDay=(date:string)=>DatedSession|undefined;
function dayPrescription(config:AdaptiveConfig,date:string,heldDates:Set<string>):DatedSession|undefined{
 if(isGuidedRetestDay(config,date))return {date,kind:'retest',exercise:retest,estimatedMinutes:expectedRetestMinutes(config)};
 if(!isGuidedTrainingDay(config,date))return;
 const dose=guidedDoseForDate(config,date,heldDates.has(date));
 return {date,kind:'training',exercise:config.exerciseLabels??names[config.metric],...dose,...sessionParameters(config),estimatedMinutes:trainingMinutes(config,dose)};
}

function makeCalendar(config:AdaptiveConfig,renderDay:CalendarDay):DatedProgram{
 checkConfig(config);
 if(config.guidedVersion!==1||!config.scheduleStart)throw Error('goal');
 const {scheduleStart:start,deadline}=config;
 const distance=daysBetween(start,deadline),family=programFamilies[config.metric];
 const targetChange=Math.abs(config.target-config.baseline),changePerWeek=7*targetChange/distance;
 const trainingCount=countGuidedSessions(config,start,deadline);
 const warnings:ProgramWarning[]=[];
 if(trainingCount<4)warnings.push('short-window');
 // Planning flag tied to the required rate, not a physiological limit or a calibrated likelihood.
 if(targetChange/Math.max(config.baseline,1)*28/distance>.30)warnings.push('large-change');
 if(config.reviewEquipment)warnings.push('review-equipment');
 if(config.reviewLimitations)warnings.push('review-limitations');
 if(distance>28)warnings.push('reassess');
 const source=family==='aerobic'||family==='stride'?sources.aerobic:sources.resistance;
 const weeks:DatedProgram['weeks']=[];
 for(let offset=0;offset<=distance;offset++){
   const date=addDays(start,offset);
   if(offset%7===0)weeks.push({number:weeks.length+1,start:date,end:addDays(start,Math.min(distance,offset+6)),sessions:[]});
   const sessions=weeks[weeks.length-1].sessions;
   const session=renderDay(date);
   if(session)sessions.push(session);
 }
 return {weeks,trainingCount:weeks.reduce((sum,w)=>sum+w.sessions.filter(s=>s.kind==='training').length,0),targetChange,changePerWeek,warnings,retestDate:deadline,source};
}

export function previewDatedProgram(config:AdaptiveConfig,timeZone:string):DatedProgram {
 dayInZone(new Date(config.createdAt),timeZone);
 const held=new Set<string>();return makeCalendar(config,date=>dayPrescription(config,date,held));
}
export function datedProgram(plan:AdaptivePlan):DatedProgram {
 const versions=plan.calendarRevisions??[];
 const recovery=new Map<AdaptiveConfig,Set<string>>();
 const logs=new Map(plan.sessions.flatMap(event=>{
   const w=event.data as Workout,record=sessionResult(w);
   return record&&record.routineId===plan.config.routineId?[[record.day,{record,revision:w.origin?.revision}] as const]:[];
 }));
 // Resolve the calendar against the same revision that backfilled session logs
 // use. An actual workout identifies its exact source on a same-day edit.
 let cursor=0;
 return makeCalendar(plan.config,date=>{
   while(cursor+1<versions.length&&versions[cursor+1].day<=date)cursor++;
   const log=logs.get(date);
   const version=log?versions.find(v=>v.revision===log.revision)??versions[cursor]:versions[cursor];
   const c=version&&version.revision!==plan.event.revision?version.config:plan.config;
   if(!c)return;
   let held=recovery.get(c);
   if(!held){held=guidedRecoveryDates(c,plan.sessions);recovery.set(c,held);}
   const row=dayPrescription(c,date,held);
   if(row?.kind==='training'&&log){
     Object.assign(row,log.record.dose,{estimatedMinutes:trainingMinutes(c,log.record.dose)});
   }
   return row;
 });
}
