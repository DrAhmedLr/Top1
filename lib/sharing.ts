import type {Demographics} from './registry';
export type PublicFields={referenceSex:boolean;bodySize:boolean};
export const minimalPublicFields:PublicFields={referenceSex:false,bodySize:false};
/** Mirror the existing projection when reading legacy snapshots. Writes use
 * strict booleans; malformed owner-managed preferences cannot block reading. */
export function readPublicFields(value:unknown,wasPublic:boolean):PublicFields{
 if(value===undefined)return wasPublic?{referenceSex:true,bodySize:true}:{...minimalPublicFields};
 if(!value||typeof value!=='object'||Array.isArray(value))return {...minimalPublicFields};
 const fields=value as Record<string,unknown>;
 return {referenceSex:fields.referenceSex===true||fields.referenceSex==='true',bodySize:fields.bodySize===true||fields.bodySize==='true'};
}
export function normalizePublicFields(value:unknown):PublicFields{
 if(value===undefined)return {...minimalPublicFields};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Review your public fields.');
 const fields=value as PublicFields;
 if(typeof fields.referenceSex!=='boolean'||typeof fields.bodySize!=='boolean')throw new Error('Review your public fields.');
 return {referenceSex:fields.referenceSex,bodySize:fields.bodySize};
}
export function disclosedDemographics(d:Demographics,fields:PublicFields):Demographics{
 return {age:d.age,sex:fields.referenceSex?d.sex:'unselected',...(fields.bodySize&&d.weight!==undefined?{weight:d.weight}:{}),...(fields.bodySize&&d.height!==undefined?{height:d.height}:{})};
}
