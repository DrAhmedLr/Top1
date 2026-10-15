import catalog from './locales/catalog.json';
import patterns from './locales/patterns.json';
export type Locale='en'|'fr'|'ar';
export const LOCALE_COOKIE='top1-locale';
export function normalizeLocale(value:unknown):Locale{return value==='fr'||value==='ar'?value:'en';}
export function localeDirection(locale:Locale){return locale==='ar'?'rtl':'ltr';}
type Entry={fr:string;ar:string};
const messages:Record<string,Entry>=catalog;
const escapePattern=(text:string)=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=patterns.map(([en,fr,ar])=>({expression:new RegExp('^'+en.split(/\{\d+\}/).map(escapePattern).join('(.+?)')+'$'),fr,ar}));
/** Exact UI messages only: never translate stored data or measurement identifiers. */
export function translate(locale:Locale,input:string|undefined|null):string{
 if(input==null)return '';
 if(locale==='en'||!input.trim())return input;
 const key=input.trim(),entry=messages[key];
 if(entry)return input.replace(key,entry[locale]);
 for(const pattern of templates){const match=pattern.expression.exec(key);if(match){const result=pattern[locale].replace(/\{(\d+)\}/g,(_,index:string)=>messages[match[Number(index)+1]]?.[locale]??match[Number(index)+1]);return input.replace(key,result);}}
 return input;
}
