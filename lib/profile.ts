import { MODEL_VERSION, SUPPORTED_SUMMARY_VERSIONS } from './model';
import { normalizeMeasurementMetadata, type MeasurementMetadata } from './measurementMetadata';
import { metrics, activeMetrics, pillars, type Demographics, type Values, type PillarId } from './registry';
import { evaluate, valid, toModelScore } from './engine';
export const LOCAL_PROFILE_KEYS = ['top1-profile-v2','top1_profile_v2','top1-profile-v1'] as const;
export interface ProfileState { demographics: Demographics; values: Values; username: string; isPublic: boolean; measurementDetails?:MeasurementMetadata; revision?:number }
export interface PublicSummary { modelVersion:string; scoredCount:number; ready: boolean; modelScore: number; completeness: number; z: number; domains: Partial<Record<PillarId,number>>; measured: number }
export const emptyProfile: ProfileState = { demographics:{age:23,sex:'male'},values:{},username:'',isPublic:false,revision:0 };
export function normalizeDemographics(input: unknown): Demographics {
  if (!input || typeof input !== 'object') throw new Error('Profile demographics are missing.');
  const d=input as Record<string,unknown>;
  const age=d.age,sex=d.sex,weight=d.weight??d.weightKg,height=d.height??d.heightCm;
  if (typeof age!=='number'||!Number.isInteger(age)||age<18||age>120||(sex!=='male'&&sex!=='female')||weight!==undefined&&(typeof weight!=='number'||!Number.isFinite(weight)||weight<25||weight>350)||height!==undefined&&(typeof height!=='number'||!Number.isFinite(height)||height<100||height>240)) throw new Error('Check age, biological sex, weight, and height.');
  return {age,sex,...(typeof weight==='number'?{weight:Number(weight.toFixed(2))}:{}),...(typeof height==='number'?{height:Number(height.toFixed(2))}:{})};
}
export function normalizeValues(input: unknown, strict=false): Values {
  if (!input || typeof input!=='object'||Array.isArray(input)) throw new Error('Measurements must be an object.');
  const result: Values={};
  for (const [id,value] of Object.entries(input)) {
    const m=metrics.find(m=>m.id===id);
    if (value===undefined||value===null) continue;
    if (m&&typeof value==='number'&&(strict?valid(m,value):Number.isFinite(value)&&value>=m.min&&value<=m.max)) result[id]=Number(value.toFixed(3));
    else if(strict) throw new Error(`Invalid measurement: ${id}`);
  }
  return result;
}
export function normalizeUsername(input: unknown) {
  if (typeof input!=='string') throw new Error('Username is required.');
  const username=input.trim().toLowerCase();
  if (username&&!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username)) throw new Error('Use 3–30 lowercase letters, numbers, underscores, or hyphens.');
  return username;
}
export function parseLocalProfile(raw: string): ProfileState | null {
  const parsed=JSON.parse(raw);
  if(parsed.demo===true) return null; // Demo measurements must never become personal logs.
  return {demographics:normalizeDemographics(parsed.demographics),values:normalizeValues(parsed.values??parsed.measurements),username:'',isPublic:false,...(parsed.measurementDetails?{measurementDetails:normalizeMeasurementMetadata(parsed.measurementDetails,{legacy:true})}:{})};
}
export function buildPublicSummary(profile: Pick<ProfileState,'values'|'demographics'|'measurementDetails'>): PublicSummary {
  const result=evaluate(profile.values,profile.demographics,profile.measurementDetails);
  return {modelVersion:MODEL_VERSION,scoredCount:result.scoredCount,ready:result.ready,modelScore:result.modelScore,completeness:result.completeness,z:result.z,domains:result.domains,measured:result.measured.length};
}
export function parsePublicSummary(input: unknown): PublicSummary | null {
  if(!input||typeof input!=='object') return null;
  const s=input as PublicSummary;
  if(!SUPPORTED_SUMMARY_VERSIONS.has(s.modelVersion)||!Number.isInteger(s.scoredCount)||s.scoredCount<0||s.scoredCount>s.measured||s.scoredCount>activeMetrics.filter(m=>m.scoringEligible).length||typeof s.ready!=='boolean'||!Number.isFinite(s.modelScore)||s.modelScore<0||s.modelScore>100||!Number.isFinite(s.completeness)||s.completeness<0||s.completeness>100.001||!Number.isFinite(s.z)||s.z<-3||s.z>3||!Number.isInteger(s.measured)||s.measured<0||s.measured>activeMetrics.length||!s.domains||typeof s.domains!=='object'||Array.isArray(s.domains))return null;
  if(Object.keys(s.domains).some(id=>!pillars.some(p=>p.id===id)))return null;
  const domains: PublicSummary['domains']={};
  for(const p of pillars) if(s.domains[p.id]!==undefined){if(!Number.isFinite(s.domains[p.id])||s.domains[p.id]! < -3||s.domains[p.id]! > 3)return null;domains[p.id]=s.domains[p.id];}
  if(domains.bodymarkers!==undefined)return null;
  const active=pillars.filter(p=>domains[p.id]!==undefined),weight=active.reduce((sum,p)=>sum+p.weight,0);
  const expectedZ=weight?active.reduce((sum,p)=>sum+p.weight*domains[p.id]!,0)/weight:0;
  if(active.length>s.scoredCount||(s.scoredCount>0&&!active.length)||Math.abs(s.z-expectedZ)>1e-9||Math.abs(s.modelScore-toModelScore(s.z))>1e-9||s.ready!==(s.scoredCount>=3&&active.length>=2))return null;
  return {modelVersion:s.modelVersion,scoredCount:s.scoredCount,ready:s.ready,modelScore:s.modelScore,completeness:s.completeness,z:s.z,domains,measured:s.measured};
}
export function safeNextPath(next: string | null): string {
  if (!next?.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\x00-\x20\x7f]/.test(next)) return '/';
  try {
    const parsed = new URL(next, 'https://top1.invalid');
    if (parsed.origin !== 'https://top1.invalid') return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch { return '/'; }
}
