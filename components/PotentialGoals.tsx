'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {RefreshCw,ArrowUpRight,Check} from 'lucide-react';
import StandingHero from './StandingHero';
import PotentialCoverage from './PotentialCoverage';
import {MetricIcon} from './MetricIcon';
import {useTranslations} from './providers/LocaleProvider';
import {activeMetrics,type Values,type Demographics} from '@/lib/registry';
import {benchmarkGame} from '@/lib/benchmarkGame';
import {valid} from '@/lib/engine';
import {parseMeasurementInput} from '@/lib/measurementInput';
import {TOP_BAND_EDGES} from '@/lib/topBands';
import {goalChoices,rotateGoals,normalizeGoalBoard,objectiveFor,goalProjection,type GoalBoardState} from '@/lib/potentialGoals';

function ObjectiveCard({goal,choices,onReplace,onTarget,onRecord}:{goal:NonNullable<ReturnType<typeof objectiveFor>>;choices:string[];onReplace:(id:string)=>void;onTarget:(n:number)=>void;onRecord:()=>void}){
 const {t}=useTranslations(),id=useId(),[choosing,setChoosing]=useState(false),[raw,setRaw]=useState(''),[editing,setEditing]=useState(false);
 const changeButton=useRef<HTMLButtonElement>(null);
 const {metric,current,target,currentTop,targetTop,achieved}=goal,sleep=metric.id==='total_sleep',factor=sleep?60:1,display=(n:number)=>Number((n/factor).toFixed(3)),unit=t(sleep?'h/night':metric.unit);
 useEffect(()=>{setRaw(target===undefined?'':String(display(target)));setEditing(false);},[metric.id,target,factor]);
 const parsedText=parseMeasurementInput(raw,factor),parsed=parsedText===''?NaN:Number(parsedText),bad=editing&&!valid(metric,parsed);
 function choose(next:string){onReplace(next);setChoosing(false);requestAnimationFrame(()=>changeButton.current?.focus());}
 return <article className={`objective-card ${metric.pillar}`} data-goal-metric={metric.id}>
  <div className="objective-card-heading"><span className="metric-title"><MetricIcon id={metric.id}/>{t(metric.name)}</span><button type="button" className="goal-change" ref={changeButton} aria-expanded={choosing} aria-controls={`${id}-choices`} onClick={()=>setChoosing(v=>!v)} aria-label={t('Change goal: {metric}').replace('{metric}',t(metric.name))}><RefreshCw size={13}/>{t('Change')}</button></div>
  {choosing&&<div id={`${id}-choices`} className="goal-metric-picker"><label htmlFor={`${id}-metric`}>{t('Choose a different goal')}</label><select id={`${id}-metric`} value={metric.id} onChange={e=>{choose(e.target.value);}}>{choices.map(choice=>{const m=activeMetrics.find(m=>m.id===choice)!;return <option key={choice} value={choice}>{t(m.name)}</option>;})}</select><button type="button" onClick={()=>{const next=choices[(choices.indexOf(metric.id)+1)%choices.length];choose(next);}}>{t('Suggest another')} →</button></div>}
  {current!==undefined?<>
   <div className="objective-rating"><span>{t('Current')}<strong>{t('Top')} <bdi>{currentTop??'?'}</bdi></strong></span><ArrowUpRight aria-hidden="true" size={20}/><span>{t('Goal')}<strong>{t('Top')} <bdi>{targetTop??'?'}</bdi></strong></span></div>
   <div className="objective-values"><span><bdi>{display(current)}</bdi> {unit}</span><span aria-hidden="true">→</span><label htmlFor={`${id}-target`}><span className="sr-only">{t('Target for {metric}').replace('{metric}',t(metric.name))}</span><input id={`${id}-target`} inputMode="decimal" type="text" value={raw} aria-invalid={bad} aria-describedby={bad?`${id}-error`:undefined} onChange={e=>{setRaw(e.target.value);setEditing(true);}} onBlur={()=>{if(valid(metric,parsed)){onTarget(parsed);setEditing(false);}}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/><small>{unit}</small></label></div>
   {bad&&<p className="field-error" id={`${id}-error`}>{t('Enter a valid target within the measurement range.')}</p>}
   <div className="objective-card-footer">{achieved?<span className="goal-achieved"><Check size={13}/>{t('Goal reached · maintain it or change your target')}</span>:<span>{t('Edit the target to make it yours')}</span>}<button type="button" onClick={onRecord}>{t('Update result')} <ArrowUpRight size={13}/></button></div>
  </>:<div className="objective-baseline"><span className="objective-baseline-badge">{t('First objective')}</span><h3>{t('Find your starting point')}</h3><p>{t('Record this measurement to reveal your rating and set a personal target.')}</p><button type="button" className="secondary-button" onClick={onRecord}>{t('Record baseline')} <ArrowUpRight size={15}/></button></div>}
 </article>;
}
export default function PotentialGoals({values,demographics,owner,onRecordMetric}:{values:Values;demographics:Demographics;owner:string;onRecordMetric:(id:string)=>void}){
 const {t}=useTranslations(),standing=benchmarkGame(values,demographics),current=standing.total;
 const next=current?([...TOP_BAND_EDGES].reverse().find(n=>current==='65%+'||n<Number.parseFloat(current))??1):1;
 const [board,setBoard]=useState<GoalBoardState|null>(null),[ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);
 const key=`top1-goal-board-v1-${owner}`;
 useEffect(()=>{try{setBoard(normalizeGoalBoard(JSON.parse(localStorage.getItem(key)??'null')));}catch{setStorageError(true);}setReady(true);},[key]);
 useEffect(()=>{if(!ready||!board)return;try{localStorage.setItem(key,JSON.stringify(board));setStorageError(false);}catch{setStorageError(true);}},[board,key,ready]);
 const targetTop=board?.targetTop??next,choices=goalChoices(values,demographics,targetTop),ids=board?.ids??choices.slice(0,3),targets=board?.targets??{},projection=goalProjection(ids,targets,values,demographics,targetTop);
 function update(change:Partial<GoalBoardState>){setBoard({version:1,targetTop,ids,targets,...change});}
 function refresh(){update({ids:rotateGoals(ids,choices),targets:{}});}
 function replace(slot:number,id:string){const nextIds=[...ids];nextIds[slot]=id;const nextTargets={...targets};delete nextTargets[ids[slot]];delete nextTargets[id];update({ids:nextIds,targets:nextTargets});}
 return <div className="potential-flow goal-oriented-potential">
  <div className="dashboard-summary stitch-dashboard potential-dashboard">
   <StandingHero potential top={current} empty={!current} recordedCount={standing.rows.length} selectedTier={targetTop} onChooseTier={tier=>update({targetTop:tier,targets:{}})} onAction={refresh} actionLabel="Change all goals" actionDisabled={!ready}/>
   <div className="dashboard-right"><section className="recorded-data-card stitch-recorded goal-board" aria-label={t('Your goals')}>
    <div className="card-heading"><h2>{t('Your goals')}</h2><strong className="potential-target-top">{t('Top')} <bdi>{targetTop}%</bdi></strong></div>
    <p className="goal-board-intro">{t('Choose what you want to improve. Change any card or adjust its target.')}</p>
    <div className="objective-grid">{ids.map((id,i)=>{const goal=objectiveFor(id,values,demographics,targetTop,targets[id]);return goal?<ObjectiveCard key={i} goal={goal} choices={choices.filter(choice=>choice===id||!ids.includes(choice))} onReplace={choice=>replace(i,choice)} onTarget={n=>update({targets:{...targets,[id]:n}})} onRecord={()=>onRecordMetric(id)}/>:null;})}</div>
    <div className="goal-projection" aria-live="polite"><span>{t('With these goals')}<small>{t('Based on recorded metrics. New measurements may change this preview.')}</small></span><strong>{t('Top')} <bdi>{projection??'?'}</bdi></strong></div>
    {storageError&&<p role="alert" className="field-error">{t('Your goals could not be saved on this device.')}</p>}
   </section></div>
  </div>
  <PotentialCoverage values={values} demographics={demographics} onRecord={onRecordMetric}/>
  <details className="scenario-disclaimer"><summary>{t('How goals work')}</summary><p>{t('Goals are editable what-if targets, not a training program or a promised timeline. Ratings use the game model, not a validated world rank. Unmeasured metrics stay out of the combined preview until you record them.')}</p></details>
 </div>;
}
