'use client';
import {useEffect,useId,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {useAuth} from './providers/AuthProvider';
import {useTranslations} from './providers/LocaleProvider';
import {MetricIcon} from './MetricIcon';
import {benchmarkGame} from '@/lib/benchmarkGame';
import {valid} from '@/lib/engine';
import {parseMeasurementInput} from '@/lib/measurementInput';
import {TOP_BAND_EDGES} from '@/lib/topBands';
import {goalChoices,normalizeGoalBoard,objectiveFor,goalProjection,type GoalBoardState} from '@/lib/potentialGoals';
import {activeMetrics,type Metric,type Values,type Demographics} from '@/lib/registry';

function TargetInput({metric,target,onTarget,disabled}:{metric:Metric;target:number;onTarget:(value:number)=>void;disabled:boolean}){
 const {t}=useTranslations(),id=useId(),factor=metric.id==='total_sleep'?60:1;
 const [raw,setRaw]=useState(String(Number((target/factor).toFixed(3))));
 useEffect(()=>{setRaw(String(Number((target/factor).toFixed(3))));},[target,factor]);
 const parsed=parseMeasurementInput(raw,factor),value=parsed===''?NaN:Number(parsed),bad=!valid(metric,value);
 return <div className="mission-target-input"><label className="sr-only" htmlFor={id}>{t('Target for {metric}').replace('{metric}',t(metric.name))}</label><input id={id} type="text" inputMode="decimal" value={raw} disabled={disabled} aria-invalid={bad} aria-describedby={bad?`${id}-error`:undefined} onChange={e=>setRaw(e.target.value)} onBlur={()=>{if(!bad)onTarget(value);}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape')setRaw(String(Number((target/factor).toFixed(3))));}}/>{bad&&<small id={`${id}-error`} className="field-error">{t('Enter a valid target within the measurement range.')}</small>}</div>;
}

export default function TodayMission({values,demographics,onRecord}:{values:Values;demographics:Demographics;onRecord:(id:string)=>void}){
 const auth=useAuth(),{t}=useTranslations(),owner=auth.user?.id??'guest',key=`top1-goal-board-v1-${owner}`,id=useId();
 const [saved,setSaved]=useState<{key:string;board:GoalBoardState|null}|null>(null),[storageError,setStorageError]=useState(false);
 useEffect(()=>{if(!auth.ready)return;try{setSaved({key,board:normalizeGoalBoard(JSON.parse(localStorage.getItem(key)??'null'))});setStorageError(false);}catch{setSaved({key,board:null});setStorageError(true);}},[auth.ready,key]);
 const ready=auth.ready&&saved?.key===key,board=ready?saved.board:null,current=benchmarkGame(values,demographics).total;
 const next=current?([...TOP_BAND_EDGES].reverse().find(n=>current==='65%+'||n<Number.parseFloat(current))??1):1;
 const targetTop=board?.targetTop??next,choices=goalChoices(values,demographics,targetTop),ids=board?.ids??choices.slice(0,3),targets=board?.targets??{};
 const projection=goalProjection(ids,targets,values,demographics,targetTop);
 function update(change:Partial<GoalBoardState>){
  if(!ready)return;
  const updated:GoalBoardState={version:1,targetTop,ids,targets,...change};
  setSaved({key,board:updated});
  try{localStorage.setItem(key,JSON.stringify(updated));setStorageError(false);}catch{setStorageError(true);}
 }
 function replace(slot:number,metricId:string){const nextIds=[...ids],nextTargets={...targets};delete nextTargets[nextIds[slot]];delete nextTargets[metricId];nextIds[slot]=metricId;update({ids:nextIds,targets:nextTargets});}
 return <section id="mission" className="card today-mission mission-summary mission-inline" aria-labelledby={`${id}-heading`}>
  <header className="mission-inline-header"><div><span className="eyebrow">{t('Your active mission')}</span><h2 id={`${id}-heading`}>{t('Your Potential')}</h2></div><div className="mission-preview"><span>{t('With these goals')}</span><strong aria-live="polite">{projection?<>{t('Top')} <bdi>{projection}</bdi></>:'—'}</strong></div></header>
  <div className="mission-inline-toolbar"><label htmlFor={`${id}-tier`}>{t('Goal')}</label><select id={`${id}-tier`} value={targetTop} disabled={!ready} onChange={e=>update({targetTop:Number(e.target.value),targets:{}})}>{TOP_BAND_EDGES.map(tier=><option key={tier} value={tier}>{t('Top')} {tier}%</option>)}</select></div>
  <div className="mission-inline-goals">{ids.map((metricId,slot)=>{const goal=objectiveFor(metricId,values,demographics,targetTop,targets[metricId]);if(!goal)return null;const {metric,current:measurement,target,achieved}=goal,factor=metricId==='total_sleep'?60:1,unit=t(metricId==='total_sleep'?'h/night':metric.unit);
   return <article className={`mission-inline-goal ${metric.pillar}`} key={slot}><div className="mission-inline-name"><MetricIcon id={metricId}/><label className="sr-only" htmlFor={`${id}-${slot}`}>{t('Change goal: {metric}').replace('{metric}',t(metric.name))}</label><select id={`${id}-${slot}`} value={metricId} disabled={!ready} onChange={e=>replace(slot,e.target.value)}>{choices.filter(choice=>choice===metricId||!ids.includes(choice)).map(choice=>{const m=activeMetrics.find(m=>m.id===choice);return m?<option key={choice} value={choice}>{t(m.name)}</option>:null;})}</select>{achieved&&<span className="mission-reached">{t('Target reached')}</span>}</div>
    <div className="mission-inline-result">{measurement!==undefined&&target!==undefined?<><span className="mission-current"><bdi>{Number((measurement/factor).toFixed(2))}</bdi></span><span className="mission-arrow" aria-hidden="true">→</span><TargetInput key={metricId} metric={metric} target={target} disabled={!ready} onTarget={value=>update({targets:{...targets,[metricId]:value}})}/><span className="mission-unit">{unit}</span></>:<span className="mission-baseline">{t('Record baseline')}</span>}<button type="button" className="mission-record" onClick={()=>onRecord(metricId)} aria-label={`${t(measurement===undefined?'Record baseline':'Update result')}: ${t(metric.name)}`}><ArrowUpRight size={18}/></button></div>
   </article>;
  })}</div>
  {storageError&&<p role="alert" className="field-error">{t('Your goals could not be saved on this device.')}</p>}
 </section>;
}
