import {accountReadOptions} from './accountSession';
import {performanceProfileAtTest} from './performanceContext';
import {challengeProgress} from './challengeProgress';
import {benchmarkEvidence} from './benchmarkCoverage';
import {valid} from './engine';
import {comparableDelta,type Observation} from './history';
import {normalizeMeasurementMetadata,type MeasurementDetails} from './measurementMetadata';
import {metricStandings} from './metricStandings';
import {protocolComplete,protocolOptions} from './protocols';
import type {Demographics,Metric} from './registry';
import type {TopBand} from './topBands';
import {performanceTierBand} from './performanceTiers';
import {PERFORMANCE_RANK_FLOOR} from './performanceRules';

export function challengeBand(tier:string):TopBand|null {
 const band=performanceTierBand(tier);
 return band&&band.to>=PERFORMANCE_RANK_FLOOR?band:null;
}

export function referenceRank(metric:Metric,value:number|undefined,profile:Demographics|undefined,details:MeasurementDetails={},now=Date.now()){
 const evidence=benchmarkEvidence(metric);
 const recorded=valid(metric,value);
 const sourceProfile=profile&&details.protocol?.referenceSex!==undefined?{...profile,sex:details.protocol.referenceSex}:profile;
 const standing=recorded&&sourceProfile&&evidence.kind==='published'?metricStandings({[metric.id]:value},sourceProfile,{[metric.id]:details},now)[0]:undefined;
 const published=standing?.kind==='published'?standing:null;
 const progress=recorded&&!details.invalidContext
  ?challengeProgress(metric.id,value,performanceProfileAtTest(profile,details)):null;
 const reason=standing?.kind==='unavailable'?standing.reason:null;
 return {value:recorded?value:undefined,evidence,published,challenge:progress?.tier??null,progress,reason};
}

function documentedSetup(metric:Metric,details:MeasurementDetails,now:number){
 if(!details.measuredAt||!details.method||details.invalidContext)return false;
 if(protocolOptions[metric.id]&&!protocolComplete(metric.id,details.protocol))return false;
 if(metric.id==='vo2_max'&&details.method==='direct_cpet'&&(!details.exerciseMode||details.derivation?.formula==='cooper_v1'))return false;
 if(['sleep_efficiency','total_sleep','circadian_regularity'].includes(metric.id)&&!details.window)return false;
 try{normalizeMeasurementMetadata({[metric.id]:details},{now});return true;}catch{return false;}
}

function midrank(kind:'personal'|'logged',current:number,previous:number[]){
 const below=previous.filter(n=>n<current).length,equal=previous.filter(n=>n===current).length;
 return {kind,count:previous.length,below,equal,percentile:100*(below+equal/2)/previous.length};
}

export function personalPosition(metric:Metric,value:number|undefined,details:MeasurementDetails,entries:Observation[],now=Date.now()){
 if(!valid(metric,value))return {kind:'missing' as const};
 const ordered=entries.filter(row=>row.metricId===metric.id).sort((a,b)=>(b.sequence??0)-(a.sequence??0)||Date.parse(b.recordedAt)-Date.parse(a.recordedAt)||b.id.localeCompare(a.id));
 const clearedAt=ordered.findIndex(row=>row.cleared);
 const segment=clearedAt<0?ordered:ordered.slice(0,clearedAt);
 const seenDates=new Set<number>(),seenIds=new Set<string>();
 // Keep the newest correction of a dated test. Undated saves remain distinct by ID.
 const tests=segment.filter(row=>{
  if(seenIds.has(row.id))return false;
  seenIds.add(row.id);
  const at=Date.parse(row.measuredAt??'');
  if(Number.isFinite(at)){
   if(seenDates.has(at))return false;
   seenDates.add(at);
  }
  return row.value!==null&&valid(metric,row.value);
 });
 const present=Number(value.toFixed(3)),currentDate=Date.parse(details.measuredAt??'');
 if(documentedSetup(metric,details,now)){
  const current:Observation={...details,id:'current',metricId:metric.id,value,recordedAt:new Date(now).toISOString(),cleared:false};
  const previous=tests.filter(row=>Date.parse(row.measuredAt??'')<currentDate&&documentedSetup(metric,row,now)&&comparableDelta([row,current],now));
  if(previous.length)return midrank('personal',present,previous.map(row=>Number(row.value!.toFixed(3))));
 }
 // No method or test date is inferred. Anchor the current number to its actual saved row.
 // This fallback describes log order and never implies a comparable performance trend.
 const anchor=Number.isFinite(currentDate)?tests.findIndex(row=>Date.parse(row.measuredAt??'')===currentDate):0;
 const current=tests[anchor];
 if(current&&Number(current.value!.toFixed(3))===present){
  const prior=tests.slice(anchor+1).map(row=>Number(row.value!.toFixed(3)));
  if(prior.length)return midrank('logged',present,prior);
 }
 return {kind:'insufficient' as const,count:0};
}

export async function readRankHistory(owner:string,id:string,signal:AbortSignal,request:typeof fetch=fetch){
 const observations:Observation[]=[];
 const ids=new Set<string>();
 let before:number|undefined;
 do{
  const params=new URLSearchParams({metric:id,list:'1'});
  if(before!==undefined)params.set('before',String(before));
  const response=await request('/api/history?'+params,accountReadOptions(owner,signal));
  if(!response.ok)throw Error('History unavailable');
  const page=await response.json() as {entries:Observation[];next:number|null};
  if(!Array.isArray(page.entries)||page.next!==null&&(!Number.isSafeInteger(page.next)||page.next<=0||before!==undefined&&page.next>=before))throw Error('Invalid history page');
  for(const row of page.entries){
   if(!row||row.metricId!==id||typeof row.id!=='string')throw Error('Invalid history observation');
   if(!ids.has(row.id)){ids.add(row.id);observations.push(row);}
  }
  before=page.next??undefined;
 }while(before!==undefined);
 return observations;
}
