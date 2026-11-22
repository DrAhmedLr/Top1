import {referenceRank} from './rankExplorer';
import {baselineAreas,baselineTests,baselineChallenge,type BaselineArea,type BaselineSelection} from './balancedBaseline';
import {comparableDelta,type Observation} from './history';
import {valid} from './engine';
import type {MeasurementDetails,MeasurementMetadata} from './measurementMetadata';
import {activeMetrics,type Demographics,type Values} from './registry';
import type {BaselinePlan} from './journeyDraft';

export function baselineArea(id:string):BaselineArea|undefined{
 return baselineAreas.find(area=>(baselineTests[area] as readonly string[]).includes(id));
}
export function unfinishedPlan(plan:BaselinePlan,choices:BaselineSelection,values:Values,details:MeasurementMetadata){
 return baselineAreas.filter(area=>{
  const id=plan[area],choice=choices[area];
  return !!id&&(!choice||choice.test!==id||!baselineChallenge(id,values,details,choice.sex));
 });
}
export function resultComparison(id:string,value:number,profile:Demographics,details:MeasurementDetails,now=Date.now()){
 const metric=activeMetrics.find(item=>item.id===id);
 if(!metric||!valid(metric,value))return null;
 const result=referenceRank(metric,value,profile,details,now);
 return {published:result.published,challenge:result.progress?{top:result.progress.tier,version:result.progress.version,modelTopPercent:result.progress.modelTopPercent}:null};
}
export function resultChange(id:string,previous:number|undefined,before:MeasurementDetails|undefined,value:number,after:MeasurementDetails,now=Date.now()){
 const metric=activeMetrics.find(m=>m.id===id);
 if(!metric||previous===undefined||!before||!valid(metric,value)||!before.measuredAt||!after.measuredAt||Date.parse(after.measuredAt)<=Date.parse(before.measuredAt))return null;
 const observation=(n:number,d:MeasurementDetails,index:number):Observation=>({id:String(index),metricId:id,value:n,cleared:false,recordedAt:new Date(now+index).toISOString(),...d});
 return comparableDelta([observation(previous,before,0),observation(value,after,1)],now)?.change??null;
}
