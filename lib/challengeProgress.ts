import {metricGameVersion} from './benchmarkGame';
import {PERFORMANCE_RULES,PERFORMANCE_RANK_FLOOR,performanceGamePercent,type PerformanceProfile} from './performanceRules';
import {performanceTier} from './performanceTiers';
import {COMPETITIVE_CHALLENGE_METRICS} from './competitiveMetrics';
import {activeMetrics} from './registry';
export {COMPETITIVE_CHALLENGE_METRICS} from './competitiveMetrics';

export type ChallengeBasis = 'fixed' | 'sex-specific' | 'sex-neutral' | 'profile-model';
export interface ChallengeStanding {
  version:string;
  basis:ChallengeBasis;
  tier:string;
  modelTopPercent?:number;
}
export interface ChallengeProgress extends ChallengeStanding {
  next:{tier:string; value:number; delta:number} | null;
}
const roundSaved = (value:number) => Number(value.toFixed(3));

/** Forward game result for a single submitted test. */
export function challengeStanding(id:string,value:number|undefined,profile?:PerformanceProfile):ChallengeStanding|null {
  if(!COMPETITIVE_CHALLENGE_METRICS.has(id))return null;
  const modelTopPercent=performanceGamePercent(id,value,profile);
  if(modelTopPercent===null)return null;
  return {version:metricGameVersion(id),basis:'profile-model',tier:performanceTier(modelTopPercent),modelTopPercent};
}

/** Find the closest strictly better tier on the input grid used for goals. */
export function challengeProgress(id:string, value:number|undefined, profile?:PerformanceProfile): ChallengeProgress | null {
  const standing=challengeStanding(id,value,profile);
  if(!standing||value===undefined)return null;
  const current:ChallengeProgress={...standing,next:null};
  if(Number.parseFloat(current.tier)===PERFORMANCE_RANK_FLOOR)return current;
  const metric=activeMetrics.find(item=>item.id===id)!;
  const saved=roundSaved(value);

  // The forward scorer is monotone on each explicitly allowed test. Search
  // integer ticks in order of increasing performance, skipping unattainable
  // bands (e.g. a single whole repetition can cross two tier boundaries).
  const ticksPerUnit = PERFORMANCE_RULES[id]!.ticksPerUnit;
  const minTick = Math.ceil(metric.min * ticksPerUnit), maxTick = Math.floor(metric.max * ticksPerUnit);
  const reading = (index:number) => roundSaved((metric.polarity === 1 ? minTick + index : maxTick - index) / ticksPerUnit);
  const edge = (tier:string) => tier === '65%+' ? 100 : parseFloat(tier);
  const presentEdge = edge(current.tier);
  const better = (index:number) => {
    const percent=performanceGamePercent(id,reading(index),profile);
    return percent!==null && edge(performanceTier(percent))<presentEdge;
  };
  let lo = 0, hi = maxTick - minTick;
  if (!better(hi)) return current;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (better(mid)) hi = mid;
    else lo = mid + 1;
  }
  const target = reading(lo);
  const next=challengeStanding(id,target,profile);
  if(next) current.next={tier:next.tier,value:target,delta:roundSaved(target-saved)};
  return current;
}
