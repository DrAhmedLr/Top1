'use client';
import {useEffect,useState} from 'react';
import {useAuth} from './providers/AuthProvider';
import {useTranslations} from './providers/LocaleProvider';
import {dayInZone,normalizeTimeline,emptyTimeline,scheduledTasks,completedOn} from '@/lib/routineHistory';
export default function TodayMission({onOpen}:{onOpen:()=>void}){
 const auth=useAuth(),{t}=useTranslations(),[data,setData]=useState<{owner:string;target?:number;tasks:{label:string;done:boolean}[]}|null>(null),owner=auth.user?.id??'guest';
 useEffect(()=>{let active=true;setData(null);if(!auth.ready)return;async function load(){try{const goal=JSON.parse(localStorage.getItem(`top1-scenario-${owner}`)??'null');const b=owner==='guest'?JSON.parse(localStorage.getItem('top1-program-guest')??'null'):await fetch('/api/program',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();});const timeline=normalizeTimeline(b?.timeline??emptyTimeline()),day=dayInZone(b?.timeZone??Intl.DateTimeFormat().resolvedOptions().timeZone),weekday=((new Date(`${day}T12:00:00`).getDay()+6)%7)+1;const tasks=scheduledTasks(timeline,day).filter(t=>t.days.includes(weekday)).map(t=>({label:t.label,done:completedOn(timeline,t.id,day)}));if(active&&(goal||tasks.length))setData({owner,target:goal?.targetTop,tasks});}catch{}}void load();return()=>{active=false;};},[auth.ready,owner]);
 if(!data||data.owner!==owner)return null;
 return <section className="card today-mission"><div><span className="eyebrow">{t('Your active mission')}</span>{data.target&&<strong>{t('Top')} {data.target}%</strong>}<h2>{t('Today’s quests')}</h2>{data.tasks.length?<ul>{data.tasks.map((task,i)=><li key={i}><span aria-hidden="true">{task.done?'✓':'○'}</span> {task.label}</li>)}</ul>:<p>{t('No actions scheduled today.')}</p>}</div><button className="primary-button" onClick={onOpen}>{t('Open my quest board')}</button></section>;
}
