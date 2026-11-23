import {goalValue,type GoalUnit} from './adaptiveProgram';
import {challengeProgress} from './challengeProgress';
import {supportedProgramMetrics} from './datedProgram';
import {valid} from './engine';
import {comparableDelta,type Observation} from './history';
import {authoritativeMeasurementDetails,type MeasurementMetadata} from './measurementMetadata';
import {countMetrics} from './measurementRules';
import {overallPerformance} from './overallPerformance';
import {goalDate} from './personalGoal';
import {performanceProfileAtTest,withPerformanceProfile} from './performanceContext';
import {PERFORMANCE_RULES} from './performanceRules';
import {protocolKey} from './protocols';
import type {Values,Demographics,Metric} from './registry';

type Goal = {metric:string;target:number;date:string;goalUnit?:GoalUnit};
type Inputs = {values:Values;details?:MeasurementMetadata;observations?:readonly Observation[];profile?:Demographics;goal?:Goal|null;today:string};
export type ProgramOpportunity = {
  metric:string;unit:GoalUnit;current:number;nextTarget:number;
  reason:'saved-goal'|'observed-gain'|'nearby-tier'|'personal-step';
  observations:number;estimatedDays:null;
  overallPointsGain:number|null;freshness:'recent'|'older'|'undated';
};

const dayMs=86400000;
// A small editable target on the input grid. Five percent is a product default,
// not a rate of adaptation. The next model tier may be closer.
function stepTarget(current:number,ticks:number,direction:number,min:number,max:number) {
  const steps=Math.max(1,Math.round(Math.abs(current)*.05*ticks));
  const nextTick=(direction===1?Math.floor(current*ticks+1e-8):Math.ceil(current*ticks-1e-8))+direction*steps;
  return Number(Math.max(min,Math.min(max,nextTick/ticks)).toFixed(3));
}

function measuredGoalValue(metric:Metric,unit:GoalUnit,observation:Observation,now:number){
  const value=observation.value??undefined;
  try {
    authoritativeMeasurementDetails({[metric.id]:value},{[metric.id]:observation},now);
    return goalValue(metric,unit,value,observation);
  } catch {return undefined;}
}

export function rankProgramOpportunities({values,details={},observations=[],profile,goal,today}:Inputs):ProgramOpportunity[] {
  if(!goalDate(today))return [];
  const now=Date.parse(today+'T23:59:59.999Z');
  const baseline=overallPerformance(values,details,profile,now);
  const recent=observations.filter(e=>Date.parse(e.recordedAt)<=now&&(!e.measuredAt||Date.parse(e.measuredAt)<=now));
  const candidates=supportedProgramMetrics.flatMap(metric=>{
    const id=metric.id,raw=values[id],detail=details[id]??{};
    if(!valid(metric,raw))return [];
    try {authoritativeMeasurementDetails({[id]:raw},{[id]:detail},now);} catch {return [];}
    const context=performanceProfileAtTest(profile,detail);
    const selected=goal?.metric===id&&goalDate(goal.date)&&goal.date>=today?goal:null;
    const goalUnit=selected?.goalUnit??'metric';
    const goalCurrent=goalValue(metric,goalUnit,raw,detail);
    const saved=selected&&goalCurrent!==undefined&&(selected.target-goalCurrent)*metric.polarity>0&&
      (goalUnit==='kg'?Number.isFinite(selected.target)&&selected.target<=2000:valid(metric,selected.target))?selected:null;
    const unit=saved?.goalUnit??'metric',current=saved?goalCurrent!:raw;
    const ticks=PERFORMANCE_RULES[id]?.ticksPerUnit??(countMetrics.has(id)||metric.unit==='s'?1:10);
    const tier=challengeProgress(id,raw,context)?.next;
    const step=stepTarget(raw,ticks,metric.polarity,metric.min,metric.max);
    const nearby=!!tier&&Math.abs(tier.value-raw)<=Math.abs(step-raw)+1e-8;
    const nextTarget=saved?saved.target:nearby?tier!.value:step;
    const gap=(nextTarget-current)*metric.polarity;
    if(!(gap>0))return [];

    const delta=comparableDelta(recent.filter(record=>record.metricId===id),now);
    // A backfilled retest or different setup cannot explain the current baseline.
    const pair=delta&&delta.latest.value===raw&&(!detail.method||detail.method===delta.latest.method)&&
      (!detail.protocol||protocolKey(detail.protocol)===protocolKey(delta.latest.protocol))&&
      (!detail.measuredAt||Date.parse(detail.measuredAt)===Date.parse(delta.latest.measuredAt!))?delta:null;
    const measuredAt=detail.measuredAt??pair?.latest.measuredAt;
    const freshness:ProgramOpportunity['freshness']=!measuredAt?'undated':now-Date.parse(measuredAt)<=31*dayMs?'recent':'older';
    const prior=pair?measuredGoalValue(metric,unit,pair.previous,now):undefined;
    const latest=pair?measuredGoalValue(metric,unit,pair.latest,now):undefined;
    const gapDays=pair?(Date.parse(pair.latest.measuredAt!)-Date.parse(pair.previous.measuredAt!))/dayMs:0;
    const aligned=prior!==undefined&&latest!==undefined&&Math.abs(latest-current)<.001;
    const observedGain=aligned&&freshness==='recent'&&gapDays>=1&&gapDays<=30
      ?Math.max(0,(latest-prior)*metric.polarity):0;

    let overallPointsGain:number|null=null;
    if(baseline.overall&&baseline.areas.some(area=>area.tests.some(test=>test.id===id))){
      const ratio=unit==='kg'?(context.weight?nextTarget/context.weight:undefined):nextTarget;
      if(valid(metric,ratio)){
        const hypothetical=withPerformanceProfile(id,{},context);
        const projected=overallPerformance({...values,[id]:ratio},{...details,[id]:hypothetical},profile,now);
        if(projected.overall&&projected.testCount===baseline.testCount)
          overallPointsGain=Math.max(0,projected.overall.points-baseline.overall.points);
      }
    }
    const reason:ProgramOpportunity['reason']=saved?'saved-goal':observedGain>=gap?'observed-gain':nearby?'nearby-tier':'personal-step';
    const opportunity:ProgramOpportunity={metric:id,unit,current,nextTarget,reason,freshness,overallPointsGain,
      observations:aligned?2:0,estimatedDays:null};

    // Within a freshness band, favor small relative gaps, evidence that the
    // athlete recently gained this amount, and improvement in the composite.
    // One log10(2) point gain halves the model TOP% index. Neither factor is a probability.
    const fractionalGap=gap/Math.max(Math.abs(current),unit==='kg'?1:1/ticks);
    const momentum=Math.min(1,observedGain/gap);
    const impact=Math.min(1,(overallPointsGain??0)/Math.log10(2));
    const priority=(1+momentum)*(1+impact)/(1+fractionalGap);
    return [{opportunity,chosen:saved?1:0,fresh:freshness==='recent'?1:0,priority}];
  });
  return candidates.sort((a,b)=>b.chosen-a.chosen||b.fresh-a.fresh||b.priority-a.priority||
    a.opportunity.metric.localeCompare(b.opportunity.metric,'en')).map(c=>c.opportunity);
}
