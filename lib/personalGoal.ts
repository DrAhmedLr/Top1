import {activeMetrics,type Values} from './registry';
import {valid} from './engine';
import {parseMeasurementInput} from './measurementInput';
import {normalizeMeasurementMetadata,type MeasurementDetails} from './measurementMetadata';
import {normalizeTrainingContext,type TrainingContext} from './personalWorkspace';
import {parseRunTime} from './run10kReference';
export type PersonalGoal={version:1;metric:string;target:number;date:string;createdAt:string;baseline?:number;baselineDetails?:MeasurementDetails;context?:TrainingContext};
export function goalDate(day:string){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
export function readPersonalGoal(raw:string):PersonalGoal{
 const g=JSON.parse(raw) as PersonalGoal,m=activeMetrics.find(m=>m.pillar==='strength'&&m.id===g?.metric);
 if(g?.version!==1||!m||!valid(m,g.target)||!goalDate(g.date)||!Number.isFinite(Date.parse(g.createdAt)))throw Error('Invalid stored goal');
 if(g.baseline!==undefined&&!valid(m,g.baseline))throw Error('Invalid baseline');
 const baselineDetails=g.baselineDetails?normalizeMeasurementMetadata({[g.metric]:g.baselineDetails})[g.metric]:undefined;
 return {version:1,metric:g.metric,target:g.target,date:g.date,createdAt:g.createdAt,...(g.baseline!==undefined?{baseline:g.baseline}:{}),...(baselineDetails?{baselineDetails}:{} ),...(g.context?{context:normalizeTrainingContext(g.context)}:{})};
}
export function createPersonalGoal(id:string,raw:string,date:string,values:Values,now=new Date()):PersonalGoal{
 const m=activeMetrics.find(m=>m.pillar==='strength'&&m.id===id),current=values[id];
 const parsed=Number(['run_5k','run_10k'].includes(id)?parseRunTime(raw):parseMeasurementInput(raw));
 const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 if(!m||!raw.trim()||!valid(m,parsed)||!valid(m,current)||(parsed-current)*m.polarity<=0||!goalDate(date)||date<=today)throw Error('Choose an improving target and future date');
 return {version:1,metric:id,target:parsed,date,createdAt:now.toISOString(),baseline:current};
}
