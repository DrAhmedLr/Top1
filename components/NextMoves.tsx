'use client';
import {ArrowUpRight,Sparkles} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
import {MetricIcon} from './MetricIcon';
import {nextMoves} from '@/lib/nextMoves';
import {pyramidLeague} from '@/lib/pyramid';
import {formatRunTime} from '@/lib/run10kReference';
import type {Values,Demographics} from '@/lib/registry';
export default function NextMoves({values,demographics,onRecord}:{values:Values;demographics:Demographics;onRecord:(id:string)=>void}){
 const {t}=useTranslations(),moves=nextMoves(values,demographics).slice(0,1);
 return <section className="glass-next-moves" aria-labelledby="next-moves-heading"><div className="glass-panel-icon"><Sparkles size={20}/></div><p className="glass-eyebrow">{t('YOUR NEXT LEVEL')}</p><h2 id="next-moves-heading">{t('Your next challenge')}</h2><div className="next-moves-list">{moves.map(({metric,current,target,tier})=>{const format=(n:number)=>metric.id==='run_5k'?formatRunTime(n):String(Number(n.toFixed(2)));return <button type="button" className="next-move" key={metric.id} onClick={()=>onRecord(metric.id)}><span className="next-move-icon"><MetricIcon id={metric.id}/></span><span className="next-move-content"><span>{t(metric.name)}</span><strong>{current!==undefined&&target!==undefined?<><bdi>{format(current)}</bdi><span className="next-move-arrow"> → </span><bdi>{format(target)}</bdi> <small>{t(metric.id==='run_5k'?'min:sec':metric.unit)}</small></>:t('Start challenge')}</strong>{tier&&<small>{t('Next tier')} · {t(pyramidLeague(tier)?.name??'')}</small>}</span><ArrowUpRight size={17}/></button>;})}</div>{moves.length===0&&<p className="next-moves-caption">{t('Your recorded tests are at their current top tier. Add another baseline or update a result.')}</p>}</section>;
}
