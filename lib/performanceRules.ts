import {clamp,valid} from './engine';
import {activeMetrics,type Demographics} from './registry';

export type PerformanceProfile=Partial<Pick<Demographics,'age'|'sex'|'weight'>>;
type Anchor=readonly [measurement:number, topPercent:number];
interface PerformanceRule {
  /** Anchors in order of improving performance, expressed in the registry's unit. */
  anchors:readonly Anchor[];
  ageStart:number;
  agePerYear:number;
  weightPerKg:number;
  weightNeutralMin?:number;
  femaleFactor:number;
  ticksPerUnit:number;
}

export const PERFORMANCE_RULES_VERSION='performance-v3';
export const PERFORMANCE_RANK_FLOOR=.01;

/** Product difficulty anchors for one strict attempt, not sampled population statistics.
 * The four strength ratios already incorporate test-day body mass. The grip test
 * uses absolute kg; its small negative mass adjustment runs in the opposite
 * direction to events that move the athlete's own body. */
export const PERFORMANCE_RULES:Readonly<Record<string,PerformanceRule|undefined>>={
  pushups:{
    anchors:[[0,100],[10,50],[20,20],[30,10],[40,5],[60,1],[75,.1],[90,.01]],
    ageStart:30,agePerYear:.003,weightPerKg:.0015,weightNeutralMin:25,femaleFactor:1.20,ticksPerUnit:1,
  },
  pullups:{
    anchors:[[0,100],[1,65],[5,35],[8,20],[12,10],[20,5],[26,2.5],[33,1],[42,.1],[52,.01]],
    ageStart:30,agePerYear:.0035,weightPerKg:.002,femaleFactor:1.55,ticksPerUnit:1,
  },
  dips:{
    anchors:[[0,100],[5,55],[10,25],[18,10],[23,5],[27,1],[38,.1],[50,.01]],
    ageStart:32,agePerYear:.003,weightPerKg:.0016,femaleFactor:1.35,ticksPerUnit:1,
  },
  dead_hang:{
    anchors:[[0,100],[30,80],[45,50],[60,35],[90,15],[120,5],[150,2.5],[180,1],[240,.1],[300,.01]],
    ageStart:35,agePerYear:.002,weightPerKg:.002,femaleFactor:1.10,ticksPerUnit:1,
  },
  broad_jump:{
    anchors:[[.1,100],[1.5,65],[1.8,50],[2,30],[2.3,10],[2.5,5],[2.65,1],[2.95,.1],[3.2,.01]],
    ageStart:30,agePerYear:.0025,weightPerKg:.0006,femaleFactor:1.16,ticksPerUnit:100,
  },
  cmj:{
    anchors:[[1,100],[20,65],[32,50],[40,25],[50,10],[55,5],[60,1],[75,.1],[90,.01]],
    ageStart:30,agePerYear:.003,weightPerKg:.00075,femaleFactor:1.20,ticksPerUnit:10,
  },
  grip_strength:{
    anchors:[[1,100],[28,80],[40,50],[48,25],[55,10],[60,5],[65.5,1],[77.5,.1],[90,.01]],
    ageStart:40,agePerYear:.0025,weightPerKg:-.0015,femaleFactor:1.50,ticksPerUnit:10,
  },
  bench_1rm:{
    anchors:[[.1,100],[.65,65],[.8,50],[1,25],[1.25,10],[1.4,5],[1.5,1],[1.8,.1],[2.1,.01]],
    ageStart:35,agePerYear:.0025,weightPerKg:0,femaleFactor:1.55,ticksPerUnit:100,
  },
  squat_1rm:{
    anchors:[[.1,100],[.85,65],[1.1,50],[1.4,25],[1.7,10],[1.95,5],[2.15,1],[2.6,.1],[3,.01]],
    ageStart:35,agePerYear:.003,weightPerKg:0,femaleFactor:1.36,ticksPerUnit:100,
  },
  deadlift_1rm:{
    anchors:[[.1,100],[1,65],[1.35,50],[1.65,25],[2,10],[2.25,5],[2.5,1],[3.1,.1],[3.6,.01]],
    ageStart:35,agePerYear:.0025,weightPerKg:0,femaleFactor:1.30,ticksPerUnit:100,
  },
  pullup_1rm:{
    anchors:[[0,100],[.10,65],[.20,50],[.35,25],[.50,10],[.65,5],[.80,1],[1,.1],[1.25,.01]],
    ageStart:32,agePerYear:.003,weightPerKg:0,femaleFactor:1.30,ticksPerUnit:100,
  },
  run_5k:{
    anchors:[[60,100],[45,80],[35,50],[30,30],[25,10],[22.5,5],[21,2.5],[20,1],[17,.1],[15,.01]],
    ageStart:35,agePerYear:.0025,weightPerKg:.0006,femaleFactor:1.10,ticksPerUnit:60,
  },
  sprint_400m:{
    anchors:[[180,100],[120,80],[90,50],[75,25],[60,7.5],[57,5],[54,2.5],[50,1],[46,.1],[43,.01]],
    ageStart:30,agePerYear:.002,weightPerKg:.0004,femaleFactor:1.10,ticksPerUnit:10,
  },
};

const metricsById=new Map(activeMetrics.map(metric=>[metric.id,metric]));

export function performanceGamePercent(id:string,value:number|undefined,profile:PerformanceProfile={}):number|null{
  const rule=Object.hasOwn(PERFORMANCE_RULES,id)?PERFORMANCE_RULES[id]:undefined;
  const metric=metricsById.get(id);
  if(!rule||!metric||!valid(metric,value))return null;
  const {age,weight,sex}=profile;
  if(age!==undefined&&(!Number.isInteger(age)||age<18||age>120))return null;
  if(weight!==undefined&&(!Number.isFinite(weight)||weight<25||weight>350))return null;
  if(sex!==undefined&&sex!=='male'&&sex!=='female'&&sex!=='unselected')return null;
  const ageFactor=1+rule.agePerYear*clamp((age??rule.ageStart)-rule.ageStart,0,40);
  const kg=weight??75;
  const weightDeviation=clamp(kg-clamp(kg,rule.weightNeutralMin??65,85),-30,30);
  const factor=ageFactor*(1+weightDeviation*rule.weightPerKg)*(sex==='female'?rule.femaleFactor:1);
  const saved=Number(value.toFixed(3));
  const adjusted=metric.polarity===1?saved*factor:saved/factor;
  const anchors=rule.anchors;
  if(metric.polarity*(adjusted-anchors[0][0])<=0)return anchors[0][1];
  for(let i=1;i<anchors.length;i++){
    const [raw,percent]=anchors[i];
    if(metric.polarity*(adjusted-raw)>0)continue;
    if(adjusted===raw)return percent;
    const [previous,before]=anchors[i-1];
    const fraction=(adjusted-previous)/(raw-previous);
    return before*(percent/before)**fraction;
  }
  return PERFORMANCE_RANK_FLOOR;
}
