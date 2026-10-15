import type {weeklyCoach} from './weeklyCoach';
export const TRAINING_SOURCE='https://acsm.org/resistance-training-guidelines-update-2026/';
export interface ExercisePrescription {
 metricId:string;exercise:string;sets:number;dose:number;unit:'reps'|'seconds'|'minutes'|'metres';perSide:boolean;
 restSeconds:number;effort:string;cue:string;regression:string;progression:string;retest:string;
 workingKg?:number;estimatedSeconds:number;substitute:boolean;
}
export interface HabitPrescription {metricId:string;title:string;minutes:number;steps:string[];review:string}
export interface SessionPrescription {habits:HabitPrescription[];warmupMinutes:number;cooldownMinutes:number;estimatedMinutes:number;budgetMinutes:number;exercises:ExercisePrescription[]}
type Coach=ReturnType<typeof weeklyCoach>;
/** Conservative editable templates, not an individualized clinical prescription.
 * Exact working weights are supplied by the user, never inferred from a rank.
 * Allocation includes work, inter-set rests, warm-up, transitions and cool-down. */
export function trainingPrescription(coach:Coach):SessionPrescription{
 const budgetMinutes=coach.minutes,warmupMinutes=budgetMinutes<=10?3:5,cooldownMinutes=budgetMinutes<=10?1:2;
 const physical=coach.selected.filter(g=>g.kind!=='habit'),habits:HabitPrescription[]=coach.selected.filter(g=>g.kind==='habit').map(g=>({metricId:g.id,title:g.id==='total_sleep'?'Evening wind-down and sleep diary':'Consistent wake-time habit',minutes:5,steps:g.id==='total_sleep'?['Set aside five quiet minutes to prepare for bed; turn off electronic devices thirty minutes before your intended bedtime.','Keep a consistent wake time and allow enough sleep opportunity for your needs; do not force sleep or reduce needed rest.']:['Choose a realistic wake time and keep it consistent across workdays and days off.','Record bedtime and wake time each morning using the same diary or device.'],review:'Review the same seven-day measurement after two weeks. Habit completion does not guarantee a sleep score change.'}));
 const count=physical.length,allocation=count?Math.floor((budgetMinutes-warmupMinutes-cooldownMinutes)*60/count):0;
 const easy=coach.ease||coach.prefs.experience==='starting',gentle=coach.prefs.impact==='gentle',gym=coach.prefs.equipment==='gym';
 const exercises=physical.map(g=>{
  let exercise='',dose=8,unit:ExercisePrescription['unit']='reps',perSide=false,restSeconds=90,substitute=false;
  let cue='Use a controlled range you can repeat without losing technique.',regression='Reduce the load or range and keep the same controlled technique.';
  let progression='After two comfortable sessions, add one repetition per set. At the top of the range, add the smallest available load and return to the lower repetition count.';
  let retest='Review after four consistent weeks, using the same test protocol and a recovered day.';
  let effort=easy?'Finish with at least three repetitions in reserve.':'Finish with two to three repetitions in reserve.';
  let workingKg:number|undefined;
  if(g.id==='pushups'){
   exercise=g.current<5?'Incline push-up against a stable surface':'Strict push-up';dose=g.current<5?5:Math.max(2,Math.min(12,Math.floor(g.current*.4)));
   cue='Keep the trunk straight; use the same controlled depth on every repetition.';regression='Raise your hands onto a stable higher surface; use fewer repetitions if needed.';
   progression='After two comfortable sessions, add one repetition per set, up to twelve. Then lower the incline or choose a slightly harder variation; do not switch the recorded test protocol.';
  }else if(['vo2_max','zone2_power'].includes(g.id)){
   exercise='Brisk walk or stationary cycle';unit='minutes';dose=Math.max(1,Math.floor((allocation-30)/60));restSeconds=0;
   effort='Stay at a pace where you can talk in full sentences.';cue='Start gently and keep breathing steady; reduce pace before technique or comfort deteriorates.';
   regression='Use a slower walk or an easy seated cycle.';progression='If the session feels comfortable twice, add two minutes within your available time before increasing pace.';
   retest='Review the same aerobic test after four to six consistent weeks; a CPET requires its original testing setting.';
  }else if(['squat_1rm','bench_1rm','deadlift_1rm','pullup_1rm'].includes(g.id)){
   const home:Record<string,string>={squat_1rm:'Bodyweight squat to a stable chair',bench_1rm:'Incline push-up against a stable surface',deadlift_1rm:'Unloaded hip-hinge practice',pullup_1rm:'Prone back raise with controlled shoulder movement'};
   const loaded:Record<string,string>={squat_1rm:'Barbell squat',bench_1rm:'Bench press',deadlift_1rm:'Deadlift',pullup_1rm:'Assisted or bodyweight pull-up'};
   exercise=gym?loaded[g.id]:home[g.id];substitute=!gym;dose=easy?6:8;restSeconds=gym?120:60;
   workingKg=gym&&g.id!=='pullup_1rm'?coach.prefs.workingLoads?.[g.id]:undefined;
   if(g.id==='pullup_1rm'&&g.current===0)cue='Use assistance as needed. Zero added test weight does not mean zero total resistance.';
   if(!gym)progression='Build controlled repetitions first. This equipment-free preparation is not equivalent to training or retesting a loaded one-repetition maximum.';
   retest='Review submaximal performance after four weeks. Do not schedule a weekly one-repetition maximum; use an appropriate supervised setting for maximal testing.';
  }else if(['grip_strength','grip_combined','farmers_carry'].includes(g.id)){
   exercise=gym?'Light farmer carry or stationary hold':'Gentle towel squeeze';unit='seconds';dose=15;restSeconds=60;
   effort='Use a comfortable grip effort; keep breathing and stop before the grip fails.';
   cue='Keep wrists neutral and shoulders relaxed.';regression='Use a lighter object or a softer towel squeeze.';
   progression='After two comfortable sessions, add five seconds, up to thirty; then increase load slightly and return to fifteen seconds.';
  }else if(['cmj','broad_jump'].includes(g.id)){
   exercise=gentle?'Controlled chair rise':'Low-effort jump and soft landing';dose=3;restSeconds=90;substitute=gentle;
   effort='Practice crisp controlled movements, not maximum height or distance.';cue='Use a clear non-slip area; land quietly and reset fully between repetitions.';
   regression='Replace jumping with controlled chair rises.';progression='Keep three quality repetitions. Add a set only after two comfortable sessions within the session budget; do not chase maximal height while fatigued.';
  }else if(g.id==='sprint_10m'){
   exercise=gentle||easy?'Brisk marching with controlled knee lift':'Relaxed ten-metre acceleration';dose=gentle||easy?20:10;unit=gentle||easy?'seconds':'metres';restSeconds=90;substitute=gentle||easy;
   effort='Stay below maximum effort and finish each repetition in control.';cue='Use a clear level surface and leave enough room to slow down gradually.';
   regression='Use comfortable walking or supported marching.';progression='After two comfortable sessions, add one repeat within your time budget before adding speed. Never turn the weekly review into a fatigued maximal sprint.';
  }else if(g.id==='sit_to_stand'){
   exercise='Controlled chair rise';dose=Math.max(3,Math.min(10,Math.floor(g.current*.35)));restSeconds=60;
   cue='Use a stable chair against a wall; stand fully and sit down under control.';regression='Use your hands for assistance in practice; keep the recorded test protocol unchanged.';
  }else if(g.id==='single_leg_balance'){
   exercise='Supported single-leg balance, eyes open';unit='seconds';dose=Math.max(5,Math.min(20,Math.floor(g.current*.6)));perSide=true;restSeconds=30;
   effort='Use a support within reach; stop before balance control is lost.';cue='Practice beside a stable counter. Keep your eyes open during practice.';
   regression='Keep both feet on the floor and shift weight gently.';progression='After two controlled sessions, add five seconds per side, up to thirty, before reducing hand support. Do not practice eyes closed without appropriate support.';
  }else{
   exercise='Gentle knee-to-wall ankle mobility';dose=8;perSide=true;restSeconds=30;
   effort='Stay within a comfortable range without forcing a stretch.';cue='Keep the heel grounded and move the knee slowly over the toes.';
   regression='Reduce the movement range and use support.';progression='After two comfortable sessions, increase the controlled range slightly without lifting the heel.';
  }
  if(coach.allReached)progression='Maintain this comfortable workload. Reassess when your measurements or goals change.';
  const workSeconds=unit==='minutes'?dose*60:unit==='seconds'?dose*(perSide?2:1):unit==='metres'?15:dose*4*(perSide?2:1);
  const desired=unit==='minutes'?1:coach.ease?1:easy?2:3;
  const sets=Math.max(1,Math.min(desired,Math.floor((allocation-30+restSeconds)/(workSeconds+restSeconds))));
  return {metricId:g.id,exercise,sets,dose,unit,perSide,restSeconds,effort,cue,regression,progression,retest,workingKg,substitute,estimatedSeconds:sets*workSeconds+Math.max(0,sets-1)*restSeconds+30};
 });
 const estimatedMinutes=Math.ceil(warmupMinutes+cooldownMinutes+exercises.reduce((s,e)=>s+e.estimatedSeconds,0)/60);
 return {habits,warmupMinutes:count?warmupMinutes:0,cooldownMinutes:count?cooldownMinutes:0,estimatedMinutes:count?estimatedMinutes:0,budgetMinutes,exercises};
}
