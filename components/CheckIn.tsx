'use client';
import {useEffect,useState} from 'react';
import {useAuth} from './providers/AuthProvider';
import {activeMetrics,type Values} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
const choices=['pushups','sit_to_stand','single_leg_balance','grip_strength','total_sleep'];
export default function CheckIn({values,details,onRecord}:{values:Values;details:MeasurementMetadata;onRecord:(id:string)=>void}){
 const auth=useAuth(),owner=auth.user?.id??'guest',key=`top1-checkin-${owner}`;
 const [id,setId]=useState('sit_to_stand'),[days,setDays]=useState(7),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setReady(false);setId('sit_to_stand');setDays(7);try{const p=JSON.parse(localStorage.getItem(key)??'null');if(p&&choices.includes(p.metricId)&&[7,14,30].includes(p.days)){setId(p.metricId);setDays(p.days);}}catch{setError('Check-in preference could not be loaded.');}setReady(true);},[key]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem(key,JSON.stringify({metricId:id,days}));setError('');}catch{setError('This preference could not be saved in this browser.');}},[key,id,days,ready]);
 const measuredAt=details[id]?.measuredAt,next=measuredAt&&Number.isFinite(Date.parse(measuredAt))?new Date(Date.parse(measuredAt)+days*86400000):null;
 return <section className="card checkin-card"><h2>{Object.values(values).some(v=>v!==undefined)?'Your next check-in':'Choose your first check-in'}</h2><p>Choose a measurement that suits you. Skip tests you cannot perform; no value is filled for you.</p><div className="measurement-context"><label>Measurement<select value={id} onChange={e=>setId(e.target.value)}>{choices.map(id=><option key={id} value={id}>{activeMetrics.find(m=>m.id===id)!.name}</option>)}</select></label><label>Your chosen repeat interval<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>Weekly</option><option value={14}>Every two weeks</option><option value={30}>Every month</option></select></label></div><p>{next?`Next date: ${next.toLocaleDateString()}`:'No dated observation yet.'} This preference stays in this browser; no notification is sent.</p><button className="secondary-button" onClick={()=>onRecord(id)}>Record this measurement</button>{error&&<p role="status">{error}</p>}</section>;
}
