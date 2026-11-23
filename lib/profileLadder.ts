import {normalizeUsername} from './profile';

export const ladderKey=(owner:string)=>`top1-profile-ladder:${owner}`;
export const ladderLimit=8;

export function ladderUsernames(raw:string|null):string[] {
 const names:unknown=JSON.parse(raw??'[]');
 if(!Array.isArray(names))throw new Error('Invalid saved ladder.');
 const unique=new Set<string>();
 for(const value of names) {
  const name=normalizeUsername(value);
  if(name)unique.add(name);
 }
 return [...unique].slice(0,ladderLimit);
}
