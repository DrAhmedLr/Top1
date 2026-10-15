'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {activeMetrics,type PillarId} from '@/lib/registry';
const axes=[{id:'bodymarkers',label:'Body markers',x:200,y:25,color:'#34d399'},{id:'strength',label:'Strength & fitness',x:45,y:260,color:'#f87171'},{id:'recovery',label:'Recovery',x:355,y:260,color:'#60a5fa'}] as const;
export default function RecordedDataChart({counts,onSelect}:{counts:Partial<Record<PillarId,number>>;onSelect:(id:PillarId)=>void}){
 const {t:tr}=useTranslations();

 const points=axes.map(a=>{const total=activeMetrics.filter(m=>m.pillar===a.id).length,count=counts[a.id]??0,r=count/total;return {...a,count,total,px:Number((200+(a.x-200)*r).toFixed(2)),py:Number((180+(a.y-180)*r).toFixed(2))};});
 return <div className="recorded-radar"><svg viewBox="0 0 400 285" role="img" aria-label={`${tr('Recording coverage')} · ${points.map(p=>`${tr(p.label)}: ${p.count}/${p.total}`).join('; ')}. ${tr('This graph shows recorded data, not performance.')}`}>
 {[.25,.5,.75,1].map(r=><polygon key={r} points={axes.map(a=>`${200+(a.x-200)*r},${180+(a.y-180)*r}`).join(' ')} fill="none" stroke="#334155"/>)}{axes.map(a=><line key={a.id} x1="200" y1="180" x2={a.x} y2={a.y} stroke="#334155"/>)}
 <polygon points={points.map(p=>`${p.px},${p.py}`).join(' ')} fill="#6366f133" stroke="#a5b4fc" strokeWidth="2"/>{points.map(p=><circle key={p.id} cx={p.px} cy={p.py} r="4" fill={p.color}/>)}
 </svg><div className="recorded-radar-legend">{points.map(p=><button key={p.id} onClick={()=>onSelect(p.id)}><i style={{background:p.color}}/><span>{tr(p.label)}<small>{p.count}/{p.total} {tr("recorded")}</small></span></button>)}</div></div>;
}
