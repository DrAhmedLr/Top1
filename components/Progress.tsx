'use client';
import {useEffect,useRef,useState} from 'react';
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import {useAuth} from './providers/AuthProvider';
import {activeMetrics,type Values} from '@/lib/registry';
import {comparableDelta,observationDate,absoluteLiftChange,type Observation} from '@/lib/history';
export default function Progress({metricId,onSelect,guestEntries,values,revision,onRecord,onMeasurements,disabled}:{metricId:string;onSelect:(id:string)=>void;guestEntries:Observation[];values:Values;revision?:number;onRecord:(id:string)=>void;onMeasurements:()=>void;disabled:boolean}){
 const auth=useAuth(),context=useRef(''),[guestLimit,setGuestLimit]=useState(50),[entries,setEntries]=useState<Observation[]>([]),[comparison,setComparison]=useState<Observation[]>([]),[next,setNext]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const m=activeMetrics.find(m=>m.id===metricId)??activeMetrics[0];
 context.current=`${auth.user?.id??'guest'}:${m.id}`;
 useEffect(()=>{setGuestLimit(50);},[m.id,auth.user?.id]);
 useEffect(()=>{let active=true;setEntries([]);setComparison([]);setNext(null);setError('');setBusy(false);if(!auth.ready)return;
  if(!auth.user){setEntries(guestEntries.filter(e=>e.metricId===m.id).reverse().slice(0,guestLimit));return;}
  setBusy(true);fetch(`/api/history?metric=${encodeURIComponent(m.id)}`,{cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);if(active){setEntries(b.entries);setComparison(b.comparison);setNext(b.next);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};
 },[m.id,auth.user?.id,auth.ready,guestEntries,revision,guestLimit]);
 async function older(){if(!next||busy)return;const requested=context.current;setBusy(true);setError('');try{const r=await fetch(`/api/history?metric=${encodeURIComponent(m.id)}&before=${next}`,{cache:'no-store'}),b=await r.json();if(!r.ok)throw new Error(b.error);if(context.current!==requested)return;setEntries(old=>[...old,...b.entries]);setNext(b.next);}catch(e){if(context.current===requested)setError(e instanceof Error?e.message:'Unable to load older observations.');}finally{if(context.current===requested)setBusy(false);}}
 const delta=comparableDelta(auth.user?comparison:guestEntries.filter(e=>e.metricId===m.id)),shown=(v:number)=>m.id==='total_sleep'?v/60:v,unit=m.id==='total_sleep'?'h/night':m.unit;
 const absolute=delta?absoluteLiftChange(delta.previous,delta.latest):null;
 const plotted=entries.slice().sort((a,b)=>Date.parse(observationDate(a))-Date.parse(observationDate(b))).map(e=>({date:new Date(observationDate(e)).toLocaleDateString(),value:e.cleared?null:shown(e.value!)}));
 return <section className="card progress-card"><div className="card-heading"><div><h2>Your measurement history</h2><p>Compare repeated observations using the same method.</p></div><button className="secondary-button" onClick={onMeasurements}>Measurements</button></div><label>Measurement<select aria-label="History measurement" value={m.id} onChange={e=>onSelect(e.target.value)}>{activeMetrics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
 {!auth.user&&<p>History recorded in this browser stays on this device. Earlier observations were not reconstructed.</p>}
 {(next||!auth.user&&guestEntries.filter(e=>e.metricId===m.id).length>guestLimit)&&<p>The chart shows loaded observations; the comparison uses the complete measurement history. Loading pages does not change it.</p>}
 {delta?<p role="status">Recorded change: {delta.change>0?'+':''}{shown(delta.change).toFixed(2)} {unit} since {new Date(delta.previous.measuredAt!).toLocaleDateString()} · {delta.latest.method?.replaceAll('_',' ')}. Same recorded method; this does not verify identical testing conditions.</p>:<p>Comparable change needs two dated observations with matching methods, protocols, equipment and non-overlapping averaging windows.</p>}
 {absolute&&<p>{absolute.kind}: {absolute.changeKg>0?'+':''}{absolute.changeKg.toFixed(2)} kg. A ratio change can also reflect a change in body weight.</p>}
 {plotted.length>1&&<div className="progress-chart" role="img" aria-label={`Recorded ${m.name} values. Full observations are listed below.`}><ResponsiveContainer width="100%" height={230}><LineChart data={plotted}><CartesianGrid stroke="#29344a"/><XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:11}}/><YAxis domain={['auto','auto']} tick={{fill:'#9ca3af',fontSize:11}}/><Tooltip/><Line type="linear" dataKey="value" stroke="#60a5fa" connectNulls={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>}
 {busy&&<p role="status">Loading observations…</p>}{error&&<p role="alert" className="field-error">{error}</p>}
 {!entries.length&&!busy&&!error&&<p>No history recorded for this measurement yet.</p>}
 <div className="history-list">{entries.map(e=><div key={e.id}><time dateTime={observationDate(e)}>{new Date(observationDate(e)).toLocaleString()}</time><strong>{e.cleared?'Cleared':`${shown(e.value!).toFixed(2).replace(/\.00$/,'')} ${unit}`}</strong><small>{e.cleared?'Cleared date':e.measuredAt&&Number.isFinite(Date.parse(e.measuredAt))?'Measured date':'Measurement date unknown · saved date shown'} · {e.method?.replaceAll('_',' ')??'Method unknown'}{e.exerciseMode&&` · ${e.exerciseMode}`}{e.protocol&&` · ${e.protocol.id.replaceAll('_',' ')}`}{e.derivation?.bodyWeightKg!==undefined&&` · test weight ${e.derivation.bodyWeightKg} kg`}{e.referenceContext&&` · reference at entry: ${e.referenceContext.profileAgeAtEntry}, ${e.referenceContext.referenceSexAtEntry}`}</small></div>)}</div>
 {!auth.user&&guestEntries.filter(e=>e.metricId===m.id).length>guestLimit&&<button className="secondary-button" onClick={()=>setGuestLimit(n=>n+50)}>Load older observations</button>}
 {next&&<button className="secondary-button" disabled={busy} onClick={()=>void older()}>Load older observations</button>}
 <button className="primary-button" disabled={disabled||values[m.id]===undefined} onClick={()=>onRecord(m.id)}>Record this value again today</button><p>Use this only after repeating the measurement. To change the result, open Measurements.</p>
 </section>;
}
