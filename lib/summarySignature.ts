import { MODEL_VERSION } from './model';
import type { PublicSummary } from './profile';
import type { Demographics } from './registry';
export interface SignedSummary extends PublicSummary { signedAt:string; signature:string }
function keyValue(override?:string){const key=override??process.env.PUBLIC_SUMMARY_SIGNING_KEY;if(!key||key.length<32)throw new Error('Public snapshot signing is not configured.');return key;}
async function key(override?:string){return crypto.subtle.importKey('raw',new TextEncoder().encode(keyValue(override)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
function canonical(summary:PublicSummary,subject:string,d:Demographics,signedAt:string){return new TextEncoder().encode(JSON.stringify({subject,demographics:d,modelVersion:summary.modelVersion,ready:summary.ready,modelScore:summary.modelScore,completeness:summary.completeness,z:summary.z,domains:summary.domains,measured:summary.measured,scoredCount:summary.scoredCount,signedAt}));}
export async function signSummary(summary:PublicSummary,subject:string,d:Demographics,override?:string):Promise<SignedSummary>{
  const signedAt=new Date().toISOString();const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',await key(override),canonical(summary,subject,d,signedAt)));
  return {...summary,signedAt,signature:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')};
}
export async function verifySummary(summary:PublicSummary,raw:unknown,subject:string,d:Demographics,override?:string):Promise<string|null>{
  if(!raw||typeof raw!=='object'||summary.modelVersion!==MODEL_VERSION)return null;
  const signed=raw as Partial<SignedSummary>;
  if(typeof signed.signature!=='string'||!(/^[a-f0-9]{64}$/).test(signed.signature)||typeof signed.signedAt!=='string'||!Number.isFinite(Date.parse(signed.signedAt)))return null;
  const bytes=Uint8Array.from(signed.signature.match(/../g)!,part=>parseInt(part,16));
  try{return await crypto.subtle.verify('HMAC',await key(override),bytes,canonical(summary,subject,d,signed.signedAt))?signed.signedAt:null;}catch{return null;}
}
