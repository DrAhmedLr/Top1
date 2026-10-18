'use client';
import Pyramid from './Pyramid';
import {useEffect,useRef,useState} from 'react';
import {pyramidTier} from '@/lib/pyramid';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowUpRight} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
export default function StandingHero({top,onAction,empty}:{top:string|null;onAction:()=>void;empty:boolean}){
 const {t}=useTranslations(),reduced=useReducedMotion(),previous=useRef(top),[celebrate,setCelebrate]=useState(false);
 useEffect(()=>{const old=previous.current;previous.current=top;if(old&&top&&pyramidTier(top)<pyramidTier(old)){setCelebrate(true);const timer=setTimeout(()=>setCelebrate(false),2400);return()=>clearTimeout(timer);}},[top]);
 return <section className="standing-hero card"><div className="standing-aura" aria-hidden="true"/><span className="eyebrow">{t('YOU’RE ON THE')}</span><motion.h2 key={top??'empty'} initial={reduced?false:{opacity:0,y:12,scale:.96}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.55}} aria-live="polite">{t('Top')} <bdi>{top??'?'}</bdi></motion.h2><div className="standing-spectrum" aria-hidden="true"/>
 <Pyramid top={top}/>{celebrate&&<div className={`tier-celebration ${reduced?'motion-still':''}`} role="status">✦ {t('New tier unlocked')} ✦</div>}
 <button className="primary-button stitch-cta" onClick={onAction}>{t(empty?'Discover my tier':'Explore Your Potential')}<ArrowUpRight size={17}/></button></section>;
}
