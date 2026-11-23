import type {AdaptiveConfig, Dose} from './adaptiveProgram';
import {goalDate} from './personalGoal';

export type GoalRotation = {weeks:number; slots:number[]; anchor?:string; busyTests?:number[]; checks?:number[]; holds?:number[]};
export type CalendarConfig=Pick<AdaptiveConfig,'guidedVersion'|'metric'|'scheduleStart'|'deadline'|'days'|'rotation'>;
export const calendarAnchor=(config:CalendarConfig)=>config.rotation?.anchor??config.scheduleStart!;
const dayMs=86400000;
export const maximumGuidedDays=364;
export const daysBetween=(a:string,b:string)=>(Date.parse(b)-Date.parse(a))/dayMs;
export type ProgramFamily='repetition'|'lift'|'aerobic'|'stride'|'jump'|'grip'|'hang'|'balance';

export const programFamilies:Readonly<Record<string,ProgramFamily|undefined>>={
 pushups:'repetition',pullups:'repetition',dips:'repetition',sit_to_stand:'repetition',
 bench_1rm:'lift',squat_1rm:'lift',deadlift_1rm:'lift',pullup_1rm:'lift',
 run_5k:'aerobic',sprint_400m:'stride',zone2_power:'aerobic',cmj:'jump',broad_jump:'jump',
 grip_strength:'grip',dead_hang:'hang',single_leg_balance:'balance',
};
export type ProgramLabel=[string,string,string];
export type ProgramWarning='short-window'|'large-change'|'review-equipment'|'review-limitations'|'reassess';
export type ProgramEffort='submaximal'|'easy-aerobic'|'relaxed-strides'|'quality'|'comfortable-hold'|'balance'|'same-protocol';

function trainingIndex(config:CalendarConfig,offset:number){
 if(config.rotation)return offset<0?-1:config.rotation.slots.indexOf(offset%(7*config.rotation.weeks));
 const weekday=offset%7;
 for(let i=0;i<config.days;i++)if(weekday===Math.floor(7*i/config.days))return i;
 return -1;
}

function retestOffset(config:CalendarConfig,offset:number,distance:number) {
 if(offset===distance)return true;
 if(config.rotation)return offset>0&&offset<distance-1&&!!config.rotation.checks?.includes(offset);
 const family=programFamilies[config.metric];
 const frequent=family==='repetition'||family==='grip'||family==='hang'||family==='balance';
 const cadence=family==='lift'?28:frequent&&config.days<=2?7:14;
 // On a twice-weekly program, day five falls between the training dates at
 // offsets three and seven. Give the final retest precedence over a nearby check.
 return offset>=cadence-2&&(offset+2)%cadence===0&&distance-offset>=Math.ceil(cadence/2);
}

export function isGuidedRetestDay(config:CalendarConfig,date:string) {
 if(config.guidedVersion!==1||!config.scheduleStart||!goalDate(date)||date<config.scheduleStart||date>config.deadline)return false;
 return retestOffset(config,daysBetween(calendarAnchor(config),date),daysBetween(calendarAnchor(config),config.deadline));
}

function trainingOffset(config:CalendarConfig,offset:number,distance:number){
 return offset>=0&&offset<distance&&!config.rotation?.holds?.includes(offset)&&trainingIndex(config,offset)>=0&&
   !retestOffset(config,offset-1,distance)&&!retestOffset(config,offset,distance)&&!retestOffset(config,offset+1,distance);
}

export function isGuidedTrainingDay(config:CalendarConfig,date:string) {
 if(config.guidedVersion!==1||!config.scheduleStart||!goalDate(date))return false;
 return trainingOffset(config,daysBetween(calendarAnchor(config),date),daysBetween(calendarAnchor(config),config.deadline));
}

/** Inclusive count over the bounded generated block. Test dates and recovery
 * days are removed by the same predicate used by the calendar and logger. */
export function countGuidedSessions(config:CalendarConfig,from:string,through:string) {
 if(config.guidedVersion!==1||!config.scheduleStart||!goalDate(from)||!goalDate(through))return 0;
 const anchor=calendarAnchor(config),distance=daysBetween(anchor,config.deadline);
 const first=Math.max(0,daysBetween(anchor,from)),last=Math.min(distance,daysBetween(anchor,through));
 let count=0;
 for(let day=first;day<=last;day++)if(trainingOffset(config,day,distance))count++;
 return count;
}

export function nextGuidedTrainingDay(config:CalendarConfig,from:string):string|undefined {
 if(!config.scheduleStart||!goalDate(from))return;
 const start=from<config.scheduleStart?config.scheduleStart:from;
 if(start>=config.deadline)return;
 for(let i=0;i<=Math.min(maximumGuidedDays,daysBetween(start,config.deadline));i++){
  const date=new Date(Date.parse(start)+i*dayMs).toISOString().slice(0,10);
  if(isGuidedTrainingDay(config,date))return date;
 }
}

export function sessionParameters(config:AdaptiveConfig){
 const family=programFamilies[config.metric];
 const warmupMinutes=config.minutes<15?2:config.minutes<30?3:5;
 const cooldownMinutes=config.minutes<15?1:2;
 const restSeconds=family==='lift'||family==='jump'||family==='stride'?90:family==='balance'?30:60;
 const effort:ProgramEffort=family==='aerobic'?'easy-aerobic':family==='stride'?'relaxed-strides':
   family==='jump'?'quality':family==='grip'||family==='hang'?'comfortable-hold':family==='balance'?'balance':'submaximal';
 return {warmupMinutes,cooldownMinutes,restSeconds,effort};
}

export function budgetDose(config:AdaptiveConfig,dose:Dose) {
 const {warmupMinutes,cooldownMinutes,restSeconds}=sessionParameters(config);
 const available=(config.minutes-warmupMinutes-cooldownMinutes)*60;
 const secondsPerUnit=(dose.mode==='reps'?3:1)*(programFamilies[config.metric]==='balance'?2:1);
 const sets=Math.max(1,Math.min(dose.sets,Math.floor((available+restSeconds)/(secondsPerUnit*dose.amount+restSeconds))));
 const amount=Math.max(1,Math.min(dose.amount,Math.floor((available-restSeconds*(sets-1))/sets/secondsPerUnit)));
 return {...dose,sets,amount};
}

export function guidedDoseForDate(config:AdaptiveConfig,date:string,hold=false):Dose {
 const base=config.dose;
 if(!config.scheduleStart||!goalDate(date)||date<config.scheduleStart)return base;
 const family=programFamilies[config.metric];
 const offset=daysBetween(config.scheduleStart,date),week=Math.floor(offset/7);
 const index=trainingIndex(config,daysBetween(calendarAnchor(config),date));
 const easy=week%4===3||daysBetween(date,config.deadline)<=4||config.days===3&&index===1;
 if(hold||easy)return budgetDose(config,{...base,sets:Math.max(1,base.sets-1)});
 // Steps are deliberately bounded at the initial test's training level. A
 // larger target never licenses an unsupervised increase to a maximal effort.
 const gainFraction=Math.abs(config.target-config.baseline)/Math.max(1,config.baseline);
 const cap=Math.max(1,Math.round(base.amount*Math.min(.30,gainFraction)));
 const steps=Math.min(4,week-Math.floor(week/4));
 const increase=family==='jump'||family==='stride'?0:Math.min(cap,steps*(base.mode==='seconds'?Math.max(1,Math.round(.06*base.amount)):1));
 return budgetDose(config,{...base,amount:base.amount+increase});
}
