import type {Dose,GoalUnit} from './adaptiveProgram';
import {isLift} from './focusedEntry';
import type {TrainingContext} from './personalWorkspace';
import type {Metric} from './registry';

type Label = [string,string,string];
type SuggestedSession = Dose & {exercise?:Label};
const movements = {
  bench_1rm: {free:['Push-ups','Pompes','تمارين الضغط'], weights:['Dumbbell floor press','Développé au sol avec haltères','ضغط الدمبل على الأرض']},
  squat_1rm: {free:['Bodyweight squats','Squats au poids du corps','قرفصاء بوزن الجسم'], weights:['Goblet squat','Goblet squat','قرفصاء بالدمبل']},
  deadlift_1rm: {free:['Hip hinges','Flexions de hanches','تمرين مفصل الورك'], weights:['Dumbbell deadlift','Soulevé de terre avec haltères','رفعة ميتة بالدمبل']},
} satisfies Record<string,{free:Label;weights:Label}>;

export function suggestStartingSession(metric:Metric,baseline:number|undefined,unit:GoalUnit,bodyweight:number|undefined,minutes:number,context:TrainingContext):SuggestedSession {
  const duration=Number.isFinite(minutes)&&minutes>=1?minutes:30;
  const experienced=context.experience==='one_to_three'||context.experience==='over_three';
  const sets=duration<12?1:experienced&&duration>=30?3:2;
  const initial:SuggestedSession={sets,amount:5,mode:'reps',loadKg:0};
  const known=baseline!==undefined&&Number.isFinite(baseline)&&baseline>=0?baseline:undefined;
  const gear=context.equipment??[];
  if(gear.length&&!gear.includes('pullup_bar')&&['pullup_1rm','pullups','dead_hang'].includes(metric.id)){
    return {...initial,exercise:gear.includes('dumbbells')?['Dumbbell row','Tirage avec haltère','تجديف بالدمبل']:['Prone arm pulls','Tirages des bras au sol','سحب الذراعين من وضع الانبطاح']};
  }
  if(metric.id in movements&&gear.length&&!gear.includes('barbell')){
    const move=movements[metric.id as keyof typeof movements];
    return {...initial,exercise:gear.includes('dumbbells')?move.weights:move.free};
  }
  if(isLift(metric.id)){
    const kg=known===undefined?undefined:unit==='kg'?known:bodyweight?known*bodyweight:undefined;
    return {...initial,loadKg:kg?Math.floor(kg*0.5*2)/2:0};
  }
  if(metric.unit==='reps'){
    if(known===0&&metric.id==='pushups')return {...initial,exercise:['Wall push-ups','Pompes au mur','تمارين الضغط على الحائط']};
    if(known===0&&(metric.id==='pullups'||metric.id==='dips'))return {...initial,exercise:metric.id==='pullups'?['Assisted pull-ups','Tractions assistées','عقلة بمساعدة']:['Assisted dips','Dips assistés','متوازي بمساعدة']};
    return {...initial,amount:known===undefined?5:Math.min(20,Math.max(1,Math.floor(known/2)))};
  }
  if(metric.id==='cmj'||metric.id==='broad_jump')return {...initial,amount:3};
  const maxSeconds=Math.max(1,Math.floor(duration*60/(sets*2)));
  const timed=(amount:number,exercise?:Label):SuggestedSession=>({...initial,mode:'seconds',amount:Math.max(1,Math.min(maxSeconds,Math.floor(amount))),exercise});
  if(metric.id==='run_5k')return timed(known===undefined?120:known*60/8,['Easy running interval','Fraction de course à allure facile','فترة جري بوتيرة مريحة']);
  if(metric.id==='sprint_400m')return timed(known===undefined?15:known/4,['Short running interval','Fraction de course courte','فترة جري قصيرة']);
  if(metric.id==='zone2_power')return timed(duration*60/(sets*3),['Easy cycling interval','Fraction de vélo à allure facile','فترة دراجة بوتيرة مريحة']);
  if(metric.id==='grip_strength')return timed(8,['Grip hold','Maintien de la prise','تمرين تثبيت القبضة']);
  return timed(known===undefined?10:known/2);
}
