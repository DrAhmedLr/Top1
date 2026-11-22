import {clamp,valid} from './engine';
import {activeMetrics,type Demographics} from './registry';

import {performanceGamePercent,PERFORMANCE_RULES_VERSION} from './performanceRules';

export const PUSHUP_MODEL_VERSION=PERFORMANCE_RULES_VERSION+'/pushups';
export type PushupProfile=Partial<Pick<Demographics,'age'|'weight'|'sex'>>;
const pushups=activeMetrics.find(metric=>metric.id==='pushups')!;
/** Product-defined game difficulty. The knots, multipliers and tail are design
 * choices for strict repetitions; they do not estimate observed prevalence. */
export function pushupModelPercentV2(reps:number|undefined,profile:PushupProfile={}):number|null {
  if(!valid(pushups,reps))return null;
  const {age,weight,sex}=profile;
  if(age!==undefined&&(!Number.isInteger(age)||age<18||age>120))return null;
  if(weight!==undefined&&(!Number.isFinite(weight)||weight<25||weight>350))return null;
  if(sex!==undefined&&!['female','male','unselected'].includes(sex))return null;
  const ageFactor=1+.003*clamp((age??30)-30,-12,50);
  const weightFactor=1+.0015*clamp((weight??75)-75,-40,40);
  const sexFactor=sex==='female'?1.2:1;
  const equivalent=reps*ageFactor*weightFactor*sexFactor;
  if(equivalent<=20)return 100*Math.pow(.2,equivalent/20);
  if(equivalent<=44)return 20*Math.pow(.05,(equivalent-20)/24);
  return Math.pow(10,-(equivalent-44)/15);
}

export function pushupModelPercent(reps:number|undefined,profile:PushupProfile={}):number|null {
  return performanceGamePercent('pushups',reps,profile);
}

export {formatGamePercent,performanceTier as pushupTier,performanceTierBand as pushupTierBand} from './performanceTiers';
