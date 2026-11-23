import {challengeProgress} from './challengeProgress';
import {PERFORMANCE_RULES,type PerformanceProfile} from './performanceRules';
import type {Demographics,Metric} from './registry';
import {CANADIAN_GRIP_PROTOCOL,CANADIAN_JUMP_PROTOCOL,canadianComparison} from './canadianReference';
import {GRIP_PROTOCOL,gripComparison} from './gripReference';
import {vo2CohortComparison} from './scientificCalibration';
import type {MeasurementDetails} from './measurementMetadata';

export function metricSpectrum(metric:Metric,profile:PerformanceProfile) {
  const rows:{tier:string;from:number;through:number}[]=[];
  const rule=PERFORMANCE_RULES[metric.id];
  if (!rule) return rows;
  const scale=rule.ticksPerUnit;
  const min=Math.ceil(metric.min*scale),max=Math.floor(metric.max*scale);
  const boundary=metric.polarity===1?max:min;
  const reading=(tick:number)=>Number((tick/scale).toFixed(3));
  let tick=metric.polarity===1?min:max;
  while ((boundary-tick)*metric.polarity>=0) {
    const result=challengeProgress(metric.id,reading(tick),profile);
    if (!result) break;
    const next=result.next?Math.round(result.next.value*scale):boundary+metric.polarity;
    if ((next-tick)*metric.polarity<=0) throw new Error('Inconsistent tier boundary');
    rows.push({tier:result.tier,from:reading(tick),through:reading(next-metric.polarity)});
    tick=next;
  }
  return rows;
}

/** The admin previews a hypothetical test with the exact published protocol.
 * Using the production comparison functions keeps age and reference exclusions identical. */
export function referenceSpectrum(metric:Metric,profile:Demographics) {
  const measuredAt='2026-01-01T12:00:00.000Z';
  const now=Date.parse(measuredAt);
  const detail:MeasurementDetails={measuredAt,ageAtMeasurement:profile.age,method:'device'};
  const values={[metric.id]:metric.min};
  if (metric.id==='vo2_max') {
    return vo2CohortComparison(values,profile,{vo2_max:{...detail,method:'direct_cpet',exerciseMode:'treadmill',
      protocol:{id:'cpet_treadmill_v1',peakRer:1.1,referencePopulation:'matches'}}},now);
  }
  if (metric.id==='grip_strength') {
    detail.protocol={id:GRIP_PROTOCOL,equipment:'Hydraulic dynamometer',trials:3,hand:'both'};
    return gripComparison(values,profile,{grip_strength:detail},now);
  }
  if (metric.id==='cmj'||metric.id==='grip_combined') {
    detail.protocol=metric.id==='cmj'?{id:CANADIAN_JUMP_PROTOCOL,equipment:'Leonardo Mechanograph',trials:3}
      :{id:CANADIAN_GRIP_PROTOCOL,equipment:'Smedley III',trials:2,hand:'both'};
    return canadianComparison(metric.id,values,profile,{[metric.id]:detail},now);
  }
  return null;
}
