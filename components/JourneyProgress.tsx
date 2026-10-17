'use client';
import {useEffect,useState} from 'react';
import {useAuth} from './providers/AuthProvider';
import {useTranslations} from './providers/LocaleProvider';
import {journeyChanges,rankCardSvg} from '@/lib/journey';
import {pyramidLeague} from '@/lib/pyramid';
import {benchmarkGame} from '@/lib/benchmarkGame';
import type {Observation} from '@/lib/history';
import type {Values,Demographics} from '@/lib/registry';
const pillarNames={bodymarkers:'Body markers',strength:'Strength & fitness',recovery:'Recovery'};
export default function JourneyProgress({values,demographics,guestEntries,revision,onRecord,weekly=false}:{values:Values;demographics:Demographics;guestEntries:Observation[];revision?:number;weekly?:boolean;onRecord:()=>void}){
 const {t}=useTranslations(),auth=useAuth(),[historyOwner,setHistoryOwner]=useState(''),[history,setHistory]=useState<Observation[]>([]),[error,setError]=useState(false),[sharing,setSharing]=useState(false),[selected,setSelected]=useState<string[]>([]);
 const game=benchmarkGame(values,demographics),ids=game.rows.map(r=>r.id).sort().join(',');
 useEffect(()=>{let active=true;setHistory([]);setHistoryOwner('');setError(false);if(!auth.ready)return;if(!auth.user){setHistory(guestEntries);setHistoryOwner('guest');return;}const controller=new AbortController();
 Promise.all(ids?ids.split(',').map(async id=>{const r=await fetch(`/api/history?metric=${encodeURIComponent(id)}`,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const b=await r.json();return [...(b.entries??[]),...(b.comparison??[])];}):[]).then(groups=>{if(active){setHistory([...new Map(groups.flat().map(e=>[e.id,e])).values()] as Observation[]);setHistoryOwner(auth.user!.id);}}).catch(()=>{if(active)setError(true);});return()=>{active=false;controller.abort();};
 },[auth.ready,auth.user?.id,ids,revision,guestEntries]);
 const monday=new Date();monday.setDate(monday.getDate()-((monday.getDay()+6)%7));monday.setHours(0,0,0,0);
 const changes=journeyChanges(historyOwner===(auth.user?.id??'guest')?history:[],values,demographics).filter(c=>!weekly||c.improved&&Date.parse(c.date)>=monday.getTime());
 function download(){if(!game.total)return;const svg=rankCardSvg(t('My TOP1 standing'),`${t('Top')} ${game.total}`,t(pyramidLeague(game.total)?.name??''),t('Illustrative estimate · not a world rank'),selected.flatMap(id=>{const top=game.sections[id as keyof typeof game.sections];return top?[{name:t(pillarNames[id as keyof typeof pillarNames]),top:`${t('Top')} ${top}`}]:[]}));const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download='TOP1-rank-card.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 if(!game.total)return null;
 return <section className="card journey-progress"><div className="card-heading"><h2>{t(weekly?'Results improved this week':'Your progress')}</h2>{!weekly&&<button className="secondary-button" onClick={()=>setSharing(v=>!v)} aria-expanded={sharing}>{t('Create share card')}</button>}</div>
 {sharing&&<div className="share-card-options"><p>{t('Choose what appears. No name or raw measurements are included. Downloading does not publish your card.')}</p><strong>{t('Top')} {game.total} · {t(pyramidLeague(game.total)?.name??'')}</strong><div>{Object.entries(pillarNames).filter(([id])=>game.sections[id as keyof typeof game.sections]).map(([id,name])=><label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>setSelected(old=>e.target.checked?[...old,id]:old.filter(x=>x!==id))}/>{t(name)}</label>)}</div><small>{t('Illustrative estimate · not a world rank')}</small><button className="primary-button" onClick={download}>{t('Download rank card')}</button></div>}
 {changes.length?<div className="personal-best-grid">{changes.map(c=><article key={c.id}><span className="achievement-badge">{t(c.personalBest?'Personal best':c.improved?'Improved result':'Recorded change')}</span><h3>{t(c.name)}</h3><strong><bdi>{c.previous} → {c.current}</bdi> <small>{t(c.unit)}</small></strong><p>{t('Top')} <bdi>{c.previousTop} → {c.top}</bdi></p></article>)}</div>:<p>{t(error?'Progress history could not load. Your measurements are retained.':weekly?'No comparable improvements recorded this week yet.':'Repeat a measurement with the same method and date it to reveal your progress and earn personal-best badges.')}</p>}
 <p className="muted">{t('Badges use available matching history. Adding a measurement can change your global estimate without a performance improvement.')}</p><button className="text-link" onClick={onRecord}>{t('Record a new result')}</button></section>;
}
