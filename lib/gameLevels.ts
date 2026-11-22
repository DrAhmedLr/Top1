import {activeMetrics,bloodMetricIds,type Values} from './registry';
import {valid} from './engine';
const section=(name:string[],ids:string[])=>({name,ids});
export const gameLevels = [
 {id:'basics',name:['Basic Test','Tests de base','الاختبارات الأساسية'],gear:['Bodyweight, tape, bars and track','Poids du corps, mètre, barres et piste','وزن الجسم وشريط قياس وعوارض ومضمار'],icon:'home',
  sections:[
   section(['Daily basics','Bases quotidiennes','الأساسيات اليومية'],['total_sleep','waist_height_ratio','sit_to_stand','single_leg_balance']),
   section(['Calisthenics','Callisthénie','تمارين وزن الجسم'],['pushups','dead_hang','pullups','dips']),
   section(['Jump & run','Sauts et course','القفز والجري'],['broad_jump','cmj','sprint_400m','run_5k'])]},
 {id:'equipped',name:['Gym','Salle de sport','الصالة الرياضية'],gear:['Weights, devices and wearables','Poids, appareils et montres','أوزان وأجهزة وساعات'],icon:'bench_1rm',
  sections:[
   section(['Strength','Force','القوة'],['grip_strength','bench_1rm','squat_1rm','deadlift_1rm','pullup_1rm']),
   section(['Wearables & recovery','Montres et récupération','الساعات والتعافي'],['rhr','hrv','hrr_1min','sleep_efficiency','circadian_regularity']),
   section(['Device tests','Tests avec appareils','اختبارات الأجهزة'],['reaction_time','bp_systolic','zone2_power'])]},
 {id:'advanced',name:['Advanced','Avancé','متقدّم'],gear:['Body composition, VO₂ max and blood work','Composition corporelle, VO₂ max et analyses','تركيب الجسم وVO₂ max وتحاليل الدم'],icon:'pushups',
  sections:[
   section(['Advanced assessments','Évaluations avancées','تقييمات متقدمة'],['body_fat','vo2_max']),
   section(['Blood work','Analyses sanguines','تحاليل الدم'],[...bloodMetricIds])]},
].map(level=>({...level,ids:level.sections.flatMap(group=>group.ids)}));
export function profileCompleteness(values:Values){const count=activeMetrics.filter(m=>valid(m,values[m.id])).length;return {count,total:activeMetrics.length,percent:Math.round(count/activeMetrics.length*100)};}
