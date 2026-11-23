import catalog from './locales/catalog.json';
import patterns from './locales/patterns.json';
export type Locale='en'|'fr'|'ar';
export const LOCALE_COOKIE='top1-locale';
export type LocalePreference = Locale | 'device';
export const NATIVE_LOCALE_KEY = 'top1-mobile-locale';

export function localePreference(value:unknown):LocalePreference {
 return value === 'en' || value === 'fr' || value === 'ar' ? value : 'device';
}

export function normalizeLocale(value:unknown):Locale {
 const language = typeof value === 'string' ? value.trim().toLowerCase().split('-')[0] : '';
 return language === 'ar' || language === 'fr' ? language : 'en';
}

/** Use the device's primary preference. Unsupported primary languages start in English. */
export function requestDeviceLocale(header:string|null):Locale {
 let preferred = '', highest = 0;
 for (const entry of header?.split(',') ?? []) {
  const [tag, ...parameters] = entry.trim().split(';');
  const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
  const weight = quality === undefined ? 1 : Number(quality.trim().slice(2));
  if (tag && weight <= 1 && weight > highest) {
   preferred = tag;
   highest = weight;
  }
 }
 return normalizeLocale(preferred);
}
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
