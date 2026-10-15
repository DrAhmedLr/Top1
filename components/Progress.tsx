'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {useEffect,useRef,useState} from 'react';
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import {observationSeries} from '@/lib/observationPresentation';
import {useAuth} from './providers/AuthProvider';
import {activeMetrics,type Values} from '@/lib/registry';
import {comparableDelta,observationDate,absoluteLiftChange,type Observation} from '@/lib/history';
export default function Progress({metricId,onSelect,guestEntries,values,revision,onRecord,onMeasurements,disabled}:{metricId:string;onSelect:(id:string)=>void;guestEntries:Observation[];values:Values;revision?:number;onRecord:(id:string)=>void;onMeasurements:()=>void;disabled:boolean}){
 const {t:tr,locale}=useTranslations();

 const auth=useAuth(),context=useRef(''),[guestLimit,setGuestLimit]=useState(50),[entries,setEntries]=useState<Observation[]>([]),[comparison,setComparison]=useState<Observation[]>([]),[next,setNext]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const m=activeMetrics.find(m=>m.id===metricId)??activeMetrics[0];
 useEffect(()=>{const heading=document.getElementById('history-heading');heading?.scrollIntoView({block:'start',behavior:'smooth'});heading?.focus({preventScroll:true});},[]);
 context.current=`${auth.user?.id??'guest'}:${m.id}`;
 useEffect(()=>{setGuestLimit(50);},[m.id,auth.user?.id]);
 useEffect(()=>{let active=true;setEntries([]);setComparison([]);setNext(null);setError('');setBusy(false);if(!auth.ready)return;
  if(!auth.user){setEntries(guestEntries.filter(e=>e.metricId===m.id).reverse().slice(0,guestLimit));return;}
  setBusy(true);fetch(`/api/history?metric=${encodeURIComponent(m.id)}`,{cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);if(active){setEntries(b.entries);setComparison(b.comparison);setNext(b.next);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};
 },[m.id,auth.user?.id,auth.ready,guestEntries,revision,guestLimit]);
 async function older(){if(!next||busy)return;const requested=context.current;setBusy(true);setError('');try{const r=await fetch(`/api/history?metric=${encodeURIComponent(m.id)}&before=${next}`,{cache:'no-store'}),b=await r.json();if(!r.ok)throw new Error(b.error);if(context.current!==requested)return;setEntries(old=>[...old,...b.entries]);setNext(b.next);}catch(e){if(context.current===requested)setError(e instanceof Error?e.message:'Unable to load older observations.');}finally{if(context.current===requested)setBusy(false);}}
 const delta=comparableDelta(auth.user?comparison:guestEntries.filter(e=>e.metricId===m.id)),shown=(v:number)=>m.id==='total_sleep'?v/60:v,unit=m.id==='total_sleep'?'h/night':m.unit;
 const absolute=delta?absoluteLiftChange(delta.previous,delta.latest):null;
 const series=observationSeries(entries);
 const keys=[...new Set(series.map(p=>p.series))];
 const plotted=series.map(({entry:e,series:key})=>({date:new Date(observationDate(e)).toLocaleDateString(locale),[key]:e.cleared?null:shown(e.value!)}));
 return <section className="card progress-card"><div className="card-heading"><div><h2 id="history-heading" tabIndex={-1}>{tr("Your measurement history")}</h2><p>{tr("Compare repeated observations using the same method.")}</p></div><button className="secondary-button" onClick={onMeasurements}>{tr("Measurements")}</button></div><label>{tr("Measurement")}<select aria-label={tr("History measurement")} value={m.id} onChange={e=>onSelect(e.target.value)}>{activeMetrics.map(x=><option key={x.id} value={x.id}>{tr(x.name)}</option>)}</select></label>
 {!auth.user&&<p>{tr("History recorded in this browser stays on this device. Earlier observations were not reconstructed.")}</p>}
 {(next||!auth.user&&guestEntries.filter(e=>e.metricId===m.id).length>guestLimit)&&<p>{tr("The chart shows loaded observations; the comparison uses the complete measurement history. Loading pages does not change it.")}</p>}
 {delta?<p role="status">{tr("Recorded change: ")}{tr(delta.change>0?'+':'')}{tr(shown(delta.change).toFixed(2))} {tr(unit)} {tr("since ")}{tr(new Date(delta.previous.measuredAt!).toLocaleDateString(locale))} · {delta.latest.method?.replaceAll('_',' ')}{tr(". Same recorded method; this does not verify identical testing conditions.")}</p>:<p>{tr("Comparable change needs two dated observations with matching methods, protocols, equipment and non-overlapping averaging windows.")}</p>}
 {absolute&&<p>{tr(absolute.kind)}: {tr(absolute.changeKg>0?'+':'')}{tr(absolute.changeKg.toFixed(2))} {tr("kg. A ratio change can also reflect a change in body weight.")}</p>}
 <p>{tr("Lines connect only documented comparable tests. Isolated points retain unknown or changed context; unknown measurement dates use the saved date.")}</p>{plotted.length>0&&<div className="progress-chart" role="img" aria-label={tr(`Recorded ${m.name} values. Full observations are listed below.`)}><ResponsiveContainer width="100%" height={230}><LineChart data={plotted}><CartesianGrid stroke="#29344a"/><XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:11}}/><YAxis domain={['auto','auto']} tick={{fill:'#9ca3af',fontSize:11}}/><Tooltip/>{keys.map(key=><Line key={key} type="linear" dataKey={key} name={m.name} stroke="#60a5fa" connectNulls={false} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></div>}
 {busy&&<p role="status">{tr("Loading observations…")}</p>}{error&&<p role="alert" className="field-error">{tr(error)}</p>}
 {!entries.length&&!busy&&!error&&<p>{tr("No history recorded for this measurement yet.")}</p>}
 <div className="history-list">{entries.map(e=><div key={e.id}><time dateTime={observationDate(e)}>{tr(new Date(observationDate(e)).toLocaleString(locale))}</time><strong>{tr(e.cleared?'Cleared':`${shown(e.value!).toFixed(2).replace(/\.00$/,'')} ${unit}`)}</strong><small>{tr(e.cleared?'Cleared date':e.measuredAt&&Number.isFinite(Date.parse(e.measuredAt))?'Measured date':'Measurement date unknown · saved date shown')} · {e.method?.replaceAll('_',' ')??'Method unknown'}{tr(e.exerciseMode&&` · ${e.exerciseMode}`)}{tr(e.protocol&&` · ${e.protocol.id.replaceAll('_',' ')}`)}{e.derivation?.bodyWeightKg!==undefined&&` · test weight ${e.derivation.bodyWeightKg} kg`}{tr(e.referenceContext&&` · reference at entry: ${e.referenceContext.profileAgeAtEntry}, ${e.referenceContext.referenceSexAtEntry}`)}</small></div>)}</div>
 {!auth.user&&guestEntries.filter(e=>e.metricId===m.id).length>guestLimit&&<button className="secondary-button" onClick={()=>setGuestLimit(n=>n+50)}>{tr("Load older observations")}</button>}
 {next&&<button className="secondary-button" disabled={busy} onClick={()=>void older()}>{tr("Load older observations")}</button>}
 <button className="primary-button" disabled={disabled||values[m.id]===undefined} onClick={()=>onRecord(m.id)}>{tr("Record this value again today")}</button><p>{tr("Use this only after repeating the measurement. To change the result, open Measurements.")}</p>
 </section>;
}
