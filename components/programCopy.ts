import {useTranslations} from './providers/LocaleProvider';
import {formatRunTime} from '@/lib/run10kReference';
export function probabilityLabel(value:number,locale:string){
 const formatter=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:0});
 if(value>0&&value<.01)return '< '+formatter.format(.01);
 if(value>.99&&value<1)return '> '+formatter.format(.99);
 return formatter.format(value);
}
export function useProgramCopy(){
 const {t,locale}=useTranslations();
 const index=locale==='fr'?1:locale==='ar'?2:0;
 const l=(en:string,fr:string,ar:string)=>[en,fr,ar][index];
 const number=(n:number,maximumFractionDigits=2)=>new Intl.NumberFormat(locale,{maximumFractionDigits}).format(n);
 const date=(day:string)=>new Intl.DateTimeFormat(locale,{weekday:'short',day:'numeric',month:'short',calendar:'gregory',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 const measure=(metric:string,value:number)=>metric==='run_5k'?formatRunTime(value,true):number(value,3);
 return {l,t,locale,index,number,date,measure};
}
