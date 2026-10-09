'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { pillars, type PillarId } from '@/lib/registry';
import { clamp } from '@/lib/engine';

export default function RadarChart({domains,small=false}:{domains:Partial<Record<PillarId,number>>;small?:boolean}){
  const reducedMotion=useReducedMotion();
  const cx=170,cy=143,r=90;const point=(i:number,scale:number)=>[Number((cx+Math.sin(i*2*Math.PI/5)*r*scale).toFixed(4)),Number((cy-Math.cos(i*2*Math.PI/5)*r*scale).toFixed(4))];
  const polygon=(scale:number)=>pillars.map((_,i)=>point(i,scale).join(',')).join(' ');
  return <svg viewBox="0 0 340 285" className={small?'radar small':'radar'} role="img" aria-label="Five pillar scores; gray points indicate unmeasured pillars">
    {[.25,.5,.75,1].map(v=><polygon key={v} points={polygon(v)} fill="none" stroke="#e8e8e1" strokeWidth="1"/>)}
    {pillars.map((p,i)=>{const [x,y]=point(i,1);return <line key={p.id} x1={cx} y1={cy} x2={x} y2={y} stroke="#e8e8e1"/>;})}
    <motion.polygon initial={false} transition={{duration:reducedMotion?0:.45}} animate={{points:pillars.map((p,i)=>point(i,domains[p.id]===undefined?0:clamp((domains[p.id]!+3)/6,.05,1)).join(',')).join(' ')}} fill="#ea754b" fillOpacity=".14" stroke="#e87950" strokeWidth="2"/>
    {pillars.map((p,i)=>{const [x,y]=point(i,domains[p.id]===undefined?0:clamp((domains[p.id]!+3)/6,.05,1));const [tx,ty]=point(i,1.32);return <g key={p.id}><motion.circle initial={false} animate={{cx:x,cy:y}} transition={{duration:reducedMotion?0:.45}} r="3.5" fill={domains[p.id]===undefined?'#c5c7bf':'#e87950'}/><text x={tx} y={ty} textAnchor="middle" fontSize="11" fill="#777c70">{p.short}</text></g>;})}
    <circle cx={cx} cy={cy} r="2" fill="#e87950"/>
  </svg>;
}

