import {readPersonalGoal,type PersonalGoal} from './personalGoal';
export type TrainingContext={experience?:'new'|'under_year'|'one_to_three'|'over_three';equipment?:('none'|'dumbbells'|'barbell'|'machines'|'pullup_bar'|'outdoor')[];days?:number;minutes?:number;routine?:string;limitations?:string;loadUnit?:'kg'|'lb';timezone?:string};
export type PersonalWorkspace={version:1;context:TrainingContext;goal:PersonalGoal|null};
export const emptyWorkspace=():PersonalWorkspace=>({version:1,context:{},goal:null});
export const workspaceKey=(owner:string)=>`top1-workspace-v1:${owner}`;
export const workspaceDraftKey=(owner:string)=>`top1-workspace-draft-v1:${owner}`;
export function normalizeTrainingContext(raw:unknown):TrainingContext{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid training context.');
 const r=raw as TrainingContext,out:TrainingContext={};
 if(r.experience!==undefined){if(!['new','under_year','one_to_three','over_three'].includes(r.experience))throw Error('Choose your experience.');out.experience=r.experience;}
 if(r.equipment!==undefined){if(!Array.isArray(r.equipment)||r.equipment.length>6||r.equipment.some(x=>!['none','dumbbells','barbell','machines','pullup_bar','outdoor'].includes(x)))throw Error('Choose available equipment.');out.equipment=[...new Set(r.equipment)];}
 if(r.days!==undefined){if(!Number.isInteger(r.days)||r.days<1||r.days>7)throw Error('Choose 1–7 days.');out.days=r.days;}
 if(r.minutes!==undefined){if(!Number.isInteger(r.minutes)||r.minutes<10||r.minutes>240)throw Error('Choose 10–240 minutes.');out.minutes=r.minutes;}
 for(const k of ['routine','limitations'] as const)if(r[k]!==undefined){if(typeof r[k]!=='string'||r[k]!.length>300)throw Error('Use at most 300 characters.');if(r[k]!.trim())out[k]=r[k]!.trim();}
 if(r.loadUnit!==undefined){if(!['kg','lb'].includes(r.loadUnit))throw Error('Invalid load unit.');out.loadUnit=r.loadUnit;}
 if(r.timezone!==undefined&&r.timezone!==''){if(typeof r.timezone!=='string'||r.timezone.length>80)throw Error('Invalid time zone.');try{new Intl.DateTimeFormat('en',{timeZone:r.timezone}).format();}catch{throw Error('Use a valid time zone, such as Africa/Casablanca.');}out.timezone=r.timezone;}
 return out;
}
export function readWorkspace(raw:unknown):PersonalWorkspace{
 const r=raw as PersonalWorkspace;if(!r||r.version!==1)throw Error('Unreadable personal workspace.');
 return {version:1,context:normalizeTrainingContext(r.context),goal:r.goal===null?null:readPersonalGoal(JSON.stringify(r.goal))};
}
export const workspaceHasData=(w:PersonalWorkspace)=>!!w.goal||Object.keys(w.context).length>0;
