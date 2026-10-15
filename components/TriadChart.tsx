'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import { motion, useReducedMotion } from 'framer-motion';
import { pillars, activeMetrics, type PillarId } from '@/lib/registry';
import { clamp, toModelScore } from '@/lib/engine';
export default function TriadChart({domains,counts={},small=false,onSelect}:{domains:Partial<Record<PillarId,number>>;counts?:Partial<Record<PillarId,number>>;small?:boolean;onSelect?:(pillar:PillarId)=>void}){
 const {t:tr}=useTranslations();

 const reduced=useReducedMotion();
 return <div className={`triad-chart ${small?'compact':''}`} aria-label={tr("Body markers, Strength and fitness, and Recovery")}>
  {pillars.map(p=>{
   const value=domains[p.id],points=value===undefined?undefined:toModelScore(value),count=counts[p.id];
   const content=<><div className="triad-heading"><span className="triad-dot"/><h3>{tr(p.id === 'bodymarkers' ? 'Body markers' : p.id === 'strength' ? 'Strength & fitness' : 'Recovery')}</h3><span>{tr(p.id==='strength'?'Experimental capacity':'Tracking only')}</span></div><p>{tr(p.description)}</p><div className="triad-value">{tr(points===undefined?'—':points.toFixed(1))}<small>{tr(points===undefined?'Context / tracking only':'model points')}</small></div><div className="triad-track"><motion.div initial={false} animate={{width:`${points===undefined?0:clamp(points,0,100)}%`}} transition={{duration:reduced?0:.35}}/></div><div className="triad-foot"><span>{tr(count===undefined?'Measured subset':`${count} / ${activeMetrics.filter(m=>m.pillar===p.id).length} active measurements`)}</span><span>{tr(value===undefined?'No scored data':`${value.toFixed(2)} model units`)}</span></div></>;
   return onSelect?<button key={p.id} className={`triad-panel ${p.id}`} onClick={()=>onSelect(p.id)}>{content}</button>:<section key={p.id} className={`triad-panel ${p.id}`}>{content}</section>;
  })}
 </div>;
}
