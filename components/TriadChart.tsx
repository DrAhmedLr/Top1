'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { pillars, activeMetrics, type PillarId } from '@/lib/registry';
import { clamp, toModelScore } from '@/lib/engine';
export default function TriadChart({domains,counts={},small=false,onSelect}:{domains:Partial<Record<PillarId,number>>;counts?:Partial<Record<PillarId,number>>;small?:boolean;onSelect?:(pillar:PillarId)=>void}){
 const reduced=useReducedMotion();
 return <div className={`triad-chart ${small?'compact':''}`} aria-label="Three-pillar triad: BodyMarkers, Strength and Recovery">
  {pillars.map(p=>{
   const value=domains[p.id],points=value===undefined?undefined:toModelScore(value),count=counts[p.id];
   const content=<><div className="triad-heading"><span className="triad-dot"/><h3>{p.name}</h3><span>{Math.round(p.weight*100)}% base weight</span></div><p>{p.description}</p><div className="triad-value">{points===undefined?'—':points.toFixed(1)}<small>{points===undefined?'Context / tracking only':'model points'}</small></div><div className="triad-track"><motion.div initial={false} animate={{width:`${points===undefined?0:clamp(points,0,100)}%`}} transition={{duration:reduced?0:.35}}/></div><div className="triad-foot"><span>{count===undefined?'Measured subset':`${count} / ${activeMetrics.filter(m=>m.pillar===p.id).length} active measurements`}</span><span>{value===undefined?'No scored data':`${value.toFixed(2)} model units`}</span></div></>;
   return onSelect?<button key={p.id} className={`triad-panel ${p.id}`} onClick={()=>onSelect(p.id)}>{content}</button>:<section key={p.id} className={`triad-panel ${p.id}`}>{content}</section>;
  })}
 </div>;
}
