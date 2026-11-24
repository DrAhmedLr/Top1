import {goalDate,readPersonalGoal,type PersonalGoal} from './personalGoal';

export type EquipmentOption='none'|'dumbbells'|'barbell'|'machines'|'pullup_bar'|'outdoor';
export type IsoWeekday='1'|'2'|'3'|'4'|'5'|'6'|'7';
export type DiscomfortSeverity='none'|'mild'|'concerning';
export type DiscomfortReport={severity:DiscomfortSeverity;area?:string;note?:string};
export type DayAvailabilityOverride={
 date:string;minutes?:number;equipment?:EquipmentOption[];discomfort?:DiscomfortReport;
 reason?:string;recordedAt:string;expiresOn:string;
};
export type CoachingPreferences={style?:'direct'|'supportive'|'minimal';likes?:string[];dislikes?:string[]};
export type DelegationGrant={
 exercises:boolean;schedule:boolean;target:boolean;deadline:boolean;priority:boolean;commitment:boolean;
 maxSessionShiftDays?:number;updatedAt?:string;
};
export type StoredDecisionSnapshot={
 exercise:string;sets:number;amount:number;mode:'reps'|'seconds';loadKg:number;minutes:number;date:string;
};
export type StoredCoachDecision={
 id:string;modelVersion:string;decidedAt:string;day:string;metric:string;
 action:'keep'|'shorten'|'substitute'|'move'|'rest'|'retest';
 reasonCode:string;triggerInput:string;scope:'today'|'weekday'|'standing';
 expiresOn?:string;summary:string;
 before:StoredDecisionSnapshot;after:StoredDecisionSnapshot|null;
 undoneAt?:string;
};
export type TrainingContext={
 experience?:'new'|'under_year'|'one_to_three'|'over_three';
 equipment?:EquipmentOption[];
 days?:number;minutes?:number;routine?:string;limitations?:string;loadUnit?:'kg'|'lb';timezone?:string;
 weekdayMinutes?:Partial<Record<IsoWeekday,number>>;
 dayOverrides?:DayAvailabilityOverride[];
 pinnedMetrics?:string[];
 preferences?:CoachingPreferences;
 delegation?:DelegationGrant;
 coachDecisions?:StoredCoachDecision[];
};
export type PersonalWorkspace={version:1;context:TrainingContext;goal:PersonalGoal|null};

export const MAX_PINNED_GOALS=2;
export const DEFAULT_DELEGATION:DelegationGrant={
 exercises:true,schedule:true,target:false,deadline:false,priority:false,commitment:false,maxSessionShiftDays:3,
};
const EQUIPMENT_LIST:readonly EquipmentOption[]=['none','dumbbells','barbell','machines','pullup_bar','outdoor'];
const WEEKDAY_LIST:readonly IsoWeekday[]=['1','2','3','4','5','6','7'];
const DECISION_ACTIONS=new Set<StoredCoachDecision['action']>(['keep','shorten','substitute','move','rest','retest']);

export const emptyWorkspace=():PersonalWorkspace=>({version:1,context:{},goal:null});
export const workspaceKey=(owner:string)=>`top1-workspace-v1:${owner}`;
export const workspaceDraftKey=(owner:string)=>`top1-workspace-draft-v1:${owner}`;

function normalizeEquipment(raw:unknown):EquipmentOption[]{
 if(!Array.isArray(raw)||raw.length>6||raw.some(x=>!EQUIPMENT_LIST.includes(x as EquipmentOption)))throw Error('Choose available equipment.');
 return [...new Set(raw as EquipmentOption[])];
}
function normalizeDiscomfort(raw:unknown):DiscomfortReport{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid discomfort report.');
 const d=raw as DiscomfortReport;
 if(!['none','mild','concerning'].includes(d.severity))throw Error('Invalid discomfort level.');
 const out:DiscomfortReport={severity:d.severity};
 if(d.area!==undefined){if(typeof d.area!=='string'||d.area.length>80)throw Error('Invalid discomfort area.');if(d.area.trim())out.area=d.area.trim();}
 if(d.note!==undefined){if(typeof d.note!=='string'||d.note.length>200)throw Error('Use at most 200 characters.');if(d.note.trim())out.note=d.note.trim();}
 return out;
}
function normalizeSnapshot(raw:unknown):StoredDecisionSnapshot{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid decision snapshot.');
 const s=raw as StoredDecisionSnapshot;
 if(typeof s.exercise!=='string'||!s.exercise.trim()||s.exercise.length>160)throw Error('Invalid decision exercise.');
 if(!Number.isInteger(s.sets)||s.sets<0||s.sets>16)throw Error('Invalid decision sets.');
 if(!Number.isInteger(s.amount)||s.amount<0||s.amount>14400)throw Error('Invalid decision amount.');
 if(s.mode!=='reps'&&s.mode!=='seconds')throw Error('Invalid decision mode.');
 if(typeof s.loadKg!=='number'||!Number.isFinite(s.loadKg)||s.loadKg<0||s.loadKg>2000)throw Error('Invalid decision load.');
 if(!Number.isInteger(s.minutes)||s.minutes<0||s.minutes>240)throw Error('Invalid decision minutes.');
 if(!goalDate(s.date))throw Error('Invalid decision date.');
 return {exercise:s.exercise.trim(),sets:s.sets,amount:s.amount,mode:s.mode,loadKg:s.loadKg,minutes:s.minutes,date:s.date};
}
function normalizeStringList(raw:unknown,maxItems:number,maxLen:number):string[]{
 if(!Array.isArray(raw)||raw.length>maxItems)throw Error('Too many preference items.');
 const out:string[]=[];
 for(const item of raw){
  if(typeof item!=='string'||item.length>maxLen)throw Error('Invalid preference item.');
  const trimmed=item.trim();
  if(trimmed&&!out.includes(trimmed))out.push(trimmed);
 }
 return out;
}

export function normalizeTrainingContext(raw:unknown):TrainingContext{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid training context.');
 const r=raw as TrainingContext,out:TrainingContext={};
 if(r.experience!==undefined){if(!['new','under_year','one_to_three','over_three'].includes(r.experience))throw Error('Choose your experience.');out.experience=r.experience;}
 if(r.equipment!==undefined){out.equipment=normalizeEquipment(r.equipment);}
 if(r.days!==undefined){if(!Number.isInteger(r.days)||r.days<1||r.days>7)throw Error('Choose 1–7 days.');out.days=r.days;}
 if(r.minutes!==undefined){if(!Number.isInteger(r.minutes)||r.minutes<10||r.minutes>240)throw Error('Choose 10–240 minutes.');out.minutes=r.minutes;}
 for(const k of ['routine','limitations'] as const)if(r[k]!==undefined){if(typeof r[k]!=='string'||r[k]!.length>300)throw Error('Use at most 300 characters.');if(r[k]!.trim())out[k]=r[k]!.trim();}
 if(r.loadUnit!==undefined){if(!['kg','lb'].includes(r.loadUnit))throw Error('Invalid load unit.');out.loadUnit=r.loadUnit;}
 if(r.timezone!==undefined&&r.timezone!==''){if(typeof r.timezone!=='string'||r.timezone.length>80)throw Error('Invalid time zone.');try{new Intl.DateTimeFormat('en',{timeZone:r.timezone}).format();}catch{throw Error('Use a valid time zone, such as Africa/Casablanca.');}out.timezone=r.timezone;}
 if(r.weekdayMinutes!==undefined){
  if(!r.weekdayMinutes||typeof r.weekdayMinutes!=='object'||Array.isArray(r.weekdayMinutes))throw Error('Invalid weekday schedule.');
  const map:Partial<Record<IsoWeekday,number>>={};
  for(const [k,v] of Object.entries(r.weekdayMinutes)){
   if(!WEEKDAY_LIST.includes(k as IsoWeekday))throw Error('Invalid weekday.');
   if(v===undefined)continue;
   if(!Number.isInteger(v)||v<5||v>240)throw Error('Choose 5–240 minutes.');
   map[k as IsoWeekday]=v;
  }
  if(Object.keys(map).length)out.weekdayMinutes=map;
 }
 if(r.dayOverrides!==undefined){
  if(!Array.isArray(r.dayOverrides)||r.dayOverrides.length>14)throw Error('Too many temporary overrides.');
  const byDate=new Map<string,DayAvailabilityOverride>();
  for(const entry of r.dayOverrides){
   if(!entry||typeof entry!=='object'||Array.isArray(entry))throw Error('Invalid day override.');
   const e=entry as DayAvailabilityOverride;
   if(!goalDate(e.date))throw Error('Invalid override date.');
   const expiresOn=e.expiresOn??e.date;
   if(!goalDate(expiresOn)||expiresOn<e.date)throw Error('Invalid override expiry.');
   if(typeof e.recordedAt!=='string'||!Number.isFinite(Date.parse(e.recordedAt)))throw Error('Invalid override timestamp.');
   const item:DayAvailabilityOverride={date:e.date,recordedAt:new Date(e.recordedAt).toISOString(),expiresOn};
   if(e.minutes!==undefined){if(!Number.isInteger(e.minutes)||e.minutes<5||e.minutes>240)throw Error('Choose 5–240 minutes.');item.minutes=e.minutes;}
   if(e.equipment!==undefined)item.equipment=normalizeEquipment(e.equipment);
   if(e.discomfort!==undefined)item.discomfort=normalizeDiscomfort(e.discomfort);
   if(e.reason!==undefined){if(typeof e.reason!=='string'||e.reason.length>200)throw Error('Use at most 200 characters.');if(e.reason.trim())item.reason=e.reason.trim();}
   const prev=byDate.get(item.date);
   if(!prev||Date.parse(item.recordedAt)>=Date.parse(prev.recordedAt))byDate.set(item.date,item);
  }
  if(byDate.size)out.dayOverrides=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
 }
 if(r.pinnedMetrics!==undefined){
  if(!Array.isArray(r.pinnedMetrics))throw Error('Invalid pinned goals.');
  const pins:string[]=[];
  for(const id of r.pinnedMetrics){
   if(typeof id!=='string'||!id.trim()||id.length>60)throw Error('Invalid pinned goal.');
   const trimmed=id.trim();
   if(!pins.includes(trimmed))pins.push(trimmed);
  }
  if(pins.length>MAX_PINNED_GOALS)throw Error('Pin at most two main goals.');
  if(pins.length)out.pinnedMetrics=pins;
 }
 if(r.preferences!==undefined){
  if(!r.preferences||typeof r.preferences!=='object'||Array.isArray(r.preferences))throw Error('Invalid coaching preferences.');
  const p=r.preferences as CoachingPreferences,next:CoachingPreferences={};
  if(p.style!==undefined){if(!['direct','supportive','minimal'].includes(p.style))throw Error('Invalid coaching style.');next.style=p.style;}
  if(p.likes!==undefined){const list=normalizeStringList(p.likes,10,80);if(list.length)next.likes=list;}
  if(p.dislikes!==undefined){const list=normalizeStringList(p.dislikes,10,80);if(list.length)next.dislikes=list;}
  if(Object.keys(next).length)out.preferences=next;
 }
 if(r.delegation!==undefined){
  if(!r.delegation||typeof r.delegation!=='object'||Array.isArray(r.delegation))throw Error('Invalid delegation settings.');
  const d=r.delegation as DelegationGrant;
  for(const k of ['exercises','schedule','target','deadline','priority','commitment'] as const){
   if(typeof d[k]!=='boolean')throw Error('Invalid delegation flag.');
  }
  const next:DelegationGrant={
   exercises:d.exercises,schedule:d.schedule,target:d.target,deadline:d.deadline,priority:d.priority,commitment:d.commitment,
  };
  if(d.maxSessionShiftDays!==undefined){
   if(!Number.isInteger(d.maxSessionShiftDays)||d.maxSessionShiftDays<0||d.maxSessionShiftDays>7)throw Error('Invalid shift limit.');
   next.maxSessionShiftDays=d.maxSessionShiftDays;
  }
  if(d.updatedAt!==undefined){
   if(typeof d.updatedAt!=='string'||!Number.isFinite(Date.parse(d.updatedAt)))throw Error('Invalid delegation timestamp.');
   next.updatedAt=new Date(d.updatedAt).toISOString();
  }
  out.delegation=next;
 }
 if(r.coachDecisions!==undefined){
  if(!Array.isArray(r.coachDecisions)||r.coachDecisions.length>20)throw Error('Too many stored decisions.');
  const list:StoredCoachDecision[]=[];
  for(const item of r.coachDecisions){
   if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Invalid stored decision.');
   const d=item as StoredCoachDecision;
   if(typeof d.id!=='string'||!d.id.trim()||d.id.length>120)throw Error('Invalid decision ID.');
   if(typeof d.modelVersion!=='string'||!d.modelVersion.trim()||d.modelVersion.length>40)throw Error('Invalid model version.');
   if(typeof d.decidedAt!=='string'||!Number.isFinite(Date.parse(d.decidedAt)))throw Error('Invalid decision timestamp.');
   if(!goalDate(d.day)||typeof d.metric!=='string'||!d.metric.trim()||d.metric.length>60)throw Error('Invalid decision target.');
   if(!DECISION_ACTIONS.has(d.action))throw Error('Invalid decision action.');
   if(typeof d.reasonCode!=='string'||!d.reasonCode.trim()||d.reasonCode.length>60)throw Error('Invalid decision reason.');
   if(typeof d.triggerInput!=='string'||d.triggerInput.length>200)throw Error('Invalid decision trigger.');
   if(!['today','weekday','standing'].includes(d.scope))throw Error('Invalid decision scope.');
   if(d.expiresOn!==undefined&&!goalDate(d.expiresOn))throw Error('Invalid decision expiry.');
   if(typeof d.summary!=='string'||!d.summary.trim()||d.summary.length>300)throw Error('Invalid decision summary.');
   if(d.undoneAt!==undefined&&(typeof d.undoneAt!=='string'||!Number.isFinite(Date.parse(d.undoneAt))))throw Error('Invalid undo timestamp.');
   list.push({
    id:d.id.trim(),modelVersion:d.modelVersion.trim(),decidedAt:new Date(d.decidedAt).toISOString(),
    day:d.day,metric:d.metric.trim(),action:d.action,reasonCode:d.reasonCode.trim(),
    triggerInput:d.triggerInput.trim(),scope:d.scope,
    ...(d.expiresOn?{expiresOn:d.expiresOn}:{}),
    summary:d.summary.trim(),
    before:normalizeSnapshot(d.before),
    after:d.after===null?null:normalizeSnapshot(d.after),
    ...(d.undoneAt?{undoneAt:new Date(d.undoneAt).toISOString()}:{}),
   });
  }
  if(list.length)out.coachDecisions=list.slice(-12);
 }
 return out;
}
export function readWorkspace(raw:unknown):PersonalWorkspace{
 const r=raw as PersonalWorkspace;if(!r||r.version!==1)throw Error('Unreadable personal workspace.');
 return {version:1,context:normalizeTrainingContext(r.context),goal:r.goal===null?null:readPersonalGoal(JSON.stringify(r.goal))};
}
export const workspaceHasData=(w:PersonalWorkspace)=>!!w.goal||Object.keys(w.context).length>0;
