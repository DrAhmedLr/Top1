'use client';
import {accountReadOptions} from '@/lib/accountSession';
import {useEffect,useMemo,useRef,useState} from 'react';
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import {useTranslations} from './providers/LocaleProvider';
import {useAuth} from './providers/AuthProvider';
import {metrics,type Values} from '@/lib/registry';
import {absoluteLiftChange,historySummary,observationDate,type Observation} from '@/lib/history';
import {historyStanding} from '@/lib/historyStanding';
import {observationSeries} from '@/lib/observationPresentation';
import {protocolOptions} from '@/lib/protocols';
import {measurementMethodLabels} from '@/lib/measurementRules';
import {formatRunTime} from '@/lib/run10kReference';
import type {BodyweightState} from '@/lib/hooks/useBodyweight';
import {PERFORMANCE_RANK_FLOOR} from '@/lib/performanceRules';
import {gamePercentLabel} from './PushupPyramid';
import BodyweightTracker from './BodyweightTracker';

type Props={metricId:string;onSelect:(id:string)=>void;guestEntries:Observation[];values:Values;revision?:number;onRecord:(id:string)=>void;disabled:boolean;weights:BodyweightState;profileWeight?:number;onUseWeight?:(kg:number)=>void;onSettings:()=>void};
type Summary=ReturnType<typeof historySummary>;
type Loaded={key:string;entries:Observation[];summary:Summary;next:number|null;busy:boolean;error:string};
const emptySummary:Summary={latest:undefined,previous:undefined,best:undefined,comparison:[]};

function MeasurementProgress({metricId,guestEntries,revision,onRecord,values,disabled}:Props){
 const {t,locale}=useTranslations(),auth=useAuth();
 const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const metric=metrics.find(row=>row.id===metricId)!;
 const key=[auth.user?.id??'guest',metric.id,revision??0].join(':'),activeKey=useRef(key);activeKey.current=key;
 const [guestLimit,setGuestLimit]=useState(50),[attempt,setAttempt]=useState(0);
 const [loaded,setLoaded]=useState<Loaded>({key:'',entries:[],summary:emptySummary,next:null,busy:false,error:''});
 useEffect(()=>setGuestLimit(50),[key]);
 useEffect(()=>{
  if(!auth.ready||!auth.user)return;
  let active=true;
  setLoaded({key,entries:[],summary:emptySummary,next:null,busy:true,error:''});
  const controller=new AbortController();
  void fetch('/api/history?metric='+encodeURIComponent(metric.id),accountReadOptions(auth.user.id,controller.signal)).then(async response=>{
   const body=await response.json();if(!response.ok)throw new Error(body.error??'Unable to load history.');
   if(active&&activeKey.current===key)setLoaded({key,entries:body.entries,summary:{latest:body.latest,previous:body.previous,best:body.best,comparison:body.comparison??[]},next:body.next,busy:false,error:''});
  }).catch(reason=>{if(active&&activeKey.current===key)setLoaded({key,entries:[],summary:emptySummary,next:null,busy:false,error:reason instanceof Error?reason.message:'Unable to load history.'});});
  return()=>{active=false;controller.abort();};
 },[auth.user?.id,auth.ready,key,revision,attempt]);
 const guest=useMemo(()=>guestEntries.filter(entry=>entry.metricId===metric.id),[guestEntries,metric.id]);
 const data=auth.user?(loaded.key===key?loaded:{key,entries:[],summary:emptySummary,next:null,busy:true,error:''}):{key,entries:guest.slice().sort((a,b)=>(b.sequence??0)-(a.sequence??0)||Date.parse(b.recordedAt)-Date.parse(a.recordedAt)||b.id.localeCompare(a.id)).slice(0,guestLimit),summary:historySummary(guest),next:null,busy:false,error:''};
 const orderedEntries=data.entries.slice().sort((a,b)=>Date.parse(observationDate(b))-Date.parse(observationDate(a))||(b.sequence??0)-(a.sequence??0)||Date.parse(b.recordedAt)-Date.parse(a.recordedAt)||b.id.localeCompare(a.id));
 const {latest,previous,best,comparison}=data.summary;
 const fallback=!data.busy&&!data.error&&!data.entries.length?values[metric.id]:undefined;
 const currentValue=latest?.value??fallback;
 const latestStanding=latest?historyStanding(latest):null;
 const standingLabel=(label:string,modeled?:number)=>modeled!==undefined?local('Top ','Top ','أعلى ')+gamePercentLabel(modeled,locale)+(modeled<=PERFORMANCE_RANK_FLOOR?' '+t('or better'):''):label.endsWith(' or better')?label.slice(0,-10)+' '+t('or better'):label;
 const delta=comparison.length===2?comparison[0].value!-comparison[1].value!:null;
 const absolute=comparison.length===2?absoluteLiftChange(comparison[1],comparison[0]):null;
 const timed=['run_5k','run_10k'].includes(metric.id),unit=timed?'min:sec':metric.id==='total_sleep'?'h/night':metric.unit;
 const display=(value:number)=>timed?formatRunTime(value):new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(metric.id==='total_sleep'?value/60:value);
 const series=observationSeries(data.entries),keys=[...new Set(series.map(point=>point.series))];
 const plotted=series.map(({entry,series:segment})=>({time:Date.parse(observationDate(entry)),[segment]:entry.cleared?null:metric.id==='total_sleep'?entry.value!/60:entry.value!}));
 async function older(){
  if(!auth.user||!data.next||data.busy)return;
  const target=key;
  setLoaded(current=>({...current,busy:true,error:''}));
  try{
   const response=await fetch('/api/history?'+new URLSearchParams({metric:metric.id,before:String(data.next)}),accountReadOptions(auth.user.id)),body=await response.json();
   if(!response.ok)throw new Error(body.error??'Unable to load older observations.');
   if(activeKey.current===target)setLoaded(current=>({...current,entries:[...current.entries,...body.entries.filter((row:Observation)=>!current.entries.some(old=>old.id===row.id))],next:body.next,busy:false}));
  }catch(reason){if(activeKey.current===target)setLoaded(current=>({...current,busy:false,error:reason instanceof Error?reason.message:'Unable to load older observations.'}));}
 }
 return <section className="card profile-history-card tracker-card" aria-labelledby="history-heading">
  <div className="tracker-heading"><div><h2 id="history-heading" tabIndex={-1}>{t(metric.name)}</h2></div>
   {!metric.archived&&<button className="primary-button" disabled={disabled} onClick={()=>onRecord(metric.id)}>{currentValue===undefined?local('Record a result','Saisir un résultat','سجّل نتيجة'):local('Record another result','Enregistrer un nouveau résultat','سجّل نتيجة جديدة')}</button>}
  </div>
  <div className="history-summary tracker-summary">
   <article><span>{fallback!==undefined?local('Current profile value','Valeur du profil','قيمة الملف الحالية'):local('Latest result','Dernier résultat','أحدث نتيجة')}</span>
    <strong><bdi>{currentValue!==undefined?display(currentValue):'—'}</bdi> <small>{currentValue!==undefined?t(unit):''}</small></strong>
    {latest&&<small>{latest.measuredAt?local('Measured','Mesuré le','تاريخ القياس'):local('Saved','Saisi le','تاريخ الحفظ')} <time dateTime={observationDate(latest)}>{new Date(observationDate(latest)).toLocaleString(locale)}</time></small>}
    {fallback!==undefined&&<small>{local('No dated entry for this value','Aucune saisie datée pour cette valeur','لا يوجد سجل مؤرخ لهذه القيمة')}</small>}
    {data.entries[0]?.cleared&&!latest&&<small>{t('Latest result cleared')}</small>}
   </article>
   {previous&&<article><span>{local('Previous entry','Saisie précédente','السجل السابق')}</span><strong><bdi>{display(previous.value!)}</bdi> <small>{t(unit)}</small></strong><small>{previous.measuredAt?local('Measured','Mesuré le','تاريخ القياس'):local('Saved','Saisi le','تاريخ الحفظ')} <time dateTime={observationDate(previous)}>{new Date(observationDate(previous)).toLocaleString(locale)}</time></small></article>}
   {delta!==null&&<article><span>{t('Comparable change')}</span><strong><bdi>{delta<0?'−':'+'}{display(Math.abs(delta))}</bdi> <small>{t(unit)}</small></strong><small>{t('Same recorded method')}</small></article>}
  </div>
  {latestStanding&&<article className="performance-note progress-current"><div><h3>{local('Latest test benchmark','Repère du dernier test','مستوى أحدث اختبار')}</h3></div><div className="test-comparison"><strong><bdi>{standingLabel(latestStanding.label,latestStanding.modelTopPercent)}</bdi></strong><small>{latestStanding.source?<a href={latestStanding.source} target="_blank" rel="noreferrer">{t(latestStanding.reference)}</a>:(latestStanding.modelTopPercent===undefined?t(latestStanding.reference):local('Modeled game position','Position estimée dans le jeu','ترتيب اللعبة التقديري'))}</small></div></article>}
  {best&&<p>{local('Personal best with the same setup','Record personnel avec le même protocole','أفضل نتيجة شخصية بنفس البروتوكول')} · <bdi>{display(best.value!)} {t(unit)}</bdi></p>}
  {absolute&&<p>{t(absolute.kind)} · <bdi>{absolute.changeKg>0?'+':''}{absolute.changeKg.toFixed(2)} kg</bdi>. {local('A ratio change can also reflect bodyweight at the test.','Un changement de ratio peut aussi refléter le poids au test.','قد يعكس تغير النسبة تغير وزن الجسم عند الاختبار أيضًا.')}</p>}
  {data.entries.length>0&&<details className="history-comparison-details"><summary>{t('How comparisons work')}</summary><p>{t('Comparable change needs two dated observations with matching methods, protocols, equipment and non-overlapping averaging windows.')}</p><p>{local('Historical TOP% is recalculated with current references using recorded age and reference group. Missing context stays unknown.','Le TOP% historique est recalculé avec les références actuelles et le contexte enregistré. Les informations manquantes restent inconnues.','يُعاد حساب TOP% للسجلات السابقة بالمراجع الحالية وفق العمر والمجموعة المسجلين. يبقى السياق الناقص غير معروف.')}</p><p>{t('Lines connect only documented comparable tests. Isolated points retain unknown or changed context; unknown measurement dates use the saved date.')}</p></details>}

  {plotted.length>1&&<div className="progress-chart" role="img" aria-label={local('Loaded observations, with exact values in the table below.','Mesures affichées, avec les valeurs exactes dans le tableau.','القياسات المعروضة، مع القيم الدقيقة في الجدول أدناه.')}><ResponsiveContainer width="100%" height={170}><LineChart data={plotted} margin={{left:2,right:20,top:12,bottom:4}}><CartesianGrid vertical={false} stroke="#334553" strokeDasharray="3 5"/><XAxis type="number" dataKey="time" domain={['dataMin','dataMax']} tickCount={3} minTickGap={28} tickFormatter={n=>new Date(n).toLocaleDateString(locale,{month:'short',day:'numeric'})} tick={{fill:'#bdc8d6',fontSize:11}}/><YAxis width={50} domain={['auto','auto']} tickFormatter={n=>timed?formatRunTime(n):new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(n)} tick={{fill:'#bdc8d6',fontSize:11}}/><Tooltip labelFormatter={n=>new Date(Number(n)).toLocaleString(locale)} formatter={value=>[((timed?formatRunTime(Number(value)):new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(Number(value)))+' '+t(unit)),t(metric.name)]} contentStyle={{backgroundColor:'#0b141d',borderColor:'#3b5148',color:'#e7f1ea'}}/>{keys.map(segment=><Line key={segment} dataKey={segment} name={t(metric.name)} stroke="#88cfa3" connectNulls={false} dot={{r:3,fill:'#88cfa3'}} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></div>}
  {data.busy&&<p role="status">{t('Loading observations…')}</p>}{data.error&&<p className="field-error" role="alert">{t(data.error)}</p>}
  {data.error&&<button className="secondary-button" onClick={()=>setAttempt(value=>value+1)}>{t('Retry')}</button>}
  {!data.entries.length&&!data.busy&&!data.error&&fallback===undefined&&<p>{t('No history recorded for this measurement yet.')}</p>}
  {data.entries.length>0&&<div className="weight-table-wrap"><table className="performance-history-table"><caption>{t(metric.name)} · {local('loaded observations','observations chargées','السجلات المحملة')}</caption><thead><tr><th scope="col">{local('Date','Date','التاريخ')}</th><th scope="col">{local('Result / TOP%','Résultat / TOP%','النتيجة / TOP%')}</th><th scope="col">{local('Context','Contexte','السياق')}</th></tr></thead><tbody>{orderedEntries.map(entry=>{
   const standing=historyStanding(entry);
   return <tr key={entry.id}><td><time dateTime={observationDate(entry)}>{new Date(observationDate(entry)).toLocaleString(locale)}</time><small>{t(entry.cleared?'Cleared date':entry.measuredAt?'Measured date':'Measurement date unknown · saved date shown')}</small></td><td><strong><bdi>{entry.cleared?t('Cleared'):display(entry.value!)} {entry.cleared?'':t(unit)}</bdi></strong>{standing&&<><bdi className="historical-top">{standingLabel(standing.label,standing.modelTopPercent)}</bdi><small>{standing.source?<a href={standing.source} target="_blank" rel="noreferrer">{t(standing.reference)}</a>:(standing.modelTopPercent===undefined?t(standing.reference):local('Modeled game position','Position estimée dans le jeu','ترتيب اللعبة التقديري'))}</small><details><summary>{local('Reference details','Détails de la référence','تفاصيل المرجع')}</summary><small>{standing.cohort&&t(standing.cohort)} · {local('Current rules','Règles actuelles','القواعد الحالية')} · {standing.version}</small></details></>}</td><td><small>{entry.method?t(measurementMethodLabels[entry.method]??entry.method):t('Method unknown')}{entry.exerciseMode?` · ${entry.exerciseMode}`:''}{entry.protocol?' · '+t(protocolOptions[entry.metricId]?.find(option=>option.id===entry.protocol?.id)?.label??'Protocol unknown'):''}</small>{entry.derivation&&['epley_ratio_v1','pullup_ratio_v1'].includes(entry.derivation.formula)&&<small>{entry.metricId==='pullup_1rm'?local('Added load','Charge ajoutée','الوزن الإضافي'):local('Weight lifted','Charge soulevée','الوزن المرفوع')} · <bdi>{new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(entry.derivation.inputs[0])} kg × {entry.derivation.inputs[1]}</bdi></small>}{entry.derivation?.bodyWeightKg!==undefined&&<small>{local('Test bodyweight','Poids au test','الوزن عند الاختبار')} · <bdi>{entry.derivation.bodyWeightKg} kg</bdi></small>}{entry.ageAtMeasurement!==undefined&&<small>{local('Age at test','Âge au test','العمر عند الاختبار')} · {entry.ageAtMeasurement}</small>}</td></tr>;
  })}</tbody></table></div>}
  {(!auth.user&&guest.length>guestLimit||data.next!==null)&&<button className="secondary-button" disabled={data.busy} onClick={()=>auth.user?void older():setGuestLimit(limit=>limit+50)}>{t('Load older observations')}</button>}
  {!auth.user&&<p className="tracker-storage">{local('Saved in this browser','Enregistré dans ce navigateur','محفوظ في هذا المتصفح')}</p>}
 </section>;
}

export default function Progress(props:Props){
 const {t,locale}=useTranslations();
 const orderedMetrics=[...metrics].sort((a,b)=>Number(!!a.archived)-Number(!!b.archived)||Number(props.values[b.id]!==undefined)-Number(props.values[a.id]!==undefined));
 const bodyLabel=locale==='fr'?'Poids corporel':locale==='ar'?'وزن الجسم':'Bodyweight';
 return <><label className="progress-selector">{t('Measurement')}<select aria-label={t('History measurement')} value={props.metricId} onChange={event=>props.onSelect(event.target.value)}>
 <option value="bodyweight">{bodyLabel}</option>{orderedMetrics.map(metric=><option key={metric.id} value={metric.id}>{t(metric.name)}{metric.archived?` · ${t('Archived')}`:''}</option>)}
 </select></label>{props.metricId==='bodyweight'?<BodyweightTracker key={props.weights.owner} state={props.weights} profileWeight={props.profileWeight} onUseCurrent={props.onUseWeight} onSettings={props.onSettings}/>:<MeasurementProgress key={props.metricId} {...props}/>}</>;
}
