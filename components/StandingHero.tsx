'use client';
import Pyramid from './Pyramid';
import {activeMetrics} from '@/lib/registry';
import {useEffect,useRef,useState} from 'react';
import {pyramidTier} from '@/lib/pyramid';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowUpRight} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
export default function StandingHero({top,onAction,empty,actionLabel,selectedTier,potential=false,onChooseTier,actionDisabled=false,recordedCount}:{top:string|null;onAction:()=>void;empty:boolean;actionLabel?:string;selectedTier?:number;potential?:boolean;onChooseTier?:(tier:number)=>void;actionDisabled?:boolean;recordedCount?:number}){
 const {t}=useTranslations(),reduced=useReducedMotion(),previous=useRef(top),[celebrate,setCelebrate]=useState(false),headline=potential?(selectedTier!==undefined?`${selectedTier}%`:'?'):top??'?';
 useEffect(()=>{const old=previous.current;previous.current=top;if(old&&top&&pyramidTier(top)<pyramidTier(old)){setCelebrate(true);const timer=setTimeout(()=>setCelebrate(false),2400);return()=>clearTimeout(timer);}},[top]);
 return <section className="standing-hero card"><div className="standing-aura" aria-hidden="true"/><span className="eyebrow">{t(potential?'YOU CAN BE':'YOU’RE ON THE')}</span><motion.h2 key={headline} initial={reduced?false:{opacity:0,y:12,scale:.96}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.55}} aria-live="polite">{t('Top')} <bdi>{headline}</bdi></motion.h2>{potential&&<p className="current-standing-line">{t('Here you are')} · {t('Top')} <bdi>{top??'?'}</bdi>{recordedCount!==undefined&&<span className="current-standing-coverage">{t('Based on {count} of {total} metrics').replace('{count}',String(recordedCount)).replace('{total}',String(activeMetrics.length))}</span>}</p>}<div className="standing-spectrum" aria-hidden="true"/>
 <Pyramid top={top} selected={selectedTier} onChoose={onChooseTier} controls="select"/>{celebrate&&<div className={`tier-celebration ${reduced?'motion-still':''}`} role="status">✦ {t('New tier unlocked')} ✦</div>}
 <button className="primary-button stitch-cta" onClick={onAction} disabled={actionDisabled}>{t(actionLabel??(empty?'Discover my tier':'Explore Your Potential'))}<ArrowUpRight size={17}/></button></section>;
}
