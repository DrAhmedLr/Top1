import { pillars,type PillarId } from './registry';
import { clamp } from './engine';
export function radarPoints(domains:Partial<Record<PillarId,number>>,cx=100,cy=100,radius=75){
  return pillars.map((p,i)=>{
    const scale=domains[p.id]===undefined?0:clamp((domains[p.id]!+3)/6,.05,1);
    const angle=i*2*Math.PI/pillars.length;
    return `${(cx+Math.sin(angle)*radius*scale).toFixed(3)},${(cy-Math.cos(angle)*radius*scale).toFixed(3)}`;
  }).join(' ');
}
