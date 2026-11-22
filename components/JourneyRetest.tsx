'use client';
import {useState} from 'react';
import {readCheckpoint,writeCheckpoint} from '@/lib/journeyProgress';
import {useTranslations} from './providers/LocaleProvider';

export default function JourneyRetest({owner,metric}:{owner:string;metric:string}){
 const {locale}=useTranslations();
 const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const [due,setDue]=useState(()=>{const saved=readCheckpoint(owner);return saved?.metric===metric?saved.due:undefined;});
 function plan(){const date=new Date();date.setDate(date.getDate()+7);const next=date.toISOString();writeCheckpoint(owner,{collection:0,metric,due:next});setDue(next);}
 function download(){
  if(!due)return;
  const date=new Date(due),stamp=(value:Date)=>value.toISOString().replace(/[-:]|\.\d{3}/g,'');
  const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('');
  const event=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TOP1 Fit//Retest//EN','BEGIN:VEVENT',`UID:retest-${metric}-${day}@top1.fit`,`DTSTAMP:${stamp(new Date())}`,`DTSTART;VALUE=DATE:${day}`,'SUMMARY:TOP1 Fit retest','URL:https://top1.fit/','END:VEVENT','END:VCALENDAR',''].join('\r\n');
  const url=URL.createObjectURL(new Blob([event],{type:'text/calendar;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='top1-retest.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <div className="journey-retest">{due?<><p>{local('Suggested retest','Nouveau test conseillé','موعد إعادة الاختبار المقترح')} · {new Date(due).toLocaleDateString(locale)}</p><button className="text-link" onClick={download}>{local('Add retest to calendar','Ajouter le test au calendrier','أضف إعادة الاختبار إلى التقويم')}</button></>:<button className="text-link" onClick={plan}>{local('Plan a retest','Planifier un nouveau test','خطّط لإعادة الاختبار')}</button>}</div>;
}
