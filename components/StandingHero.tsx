'use client';
import Pyramid from './Pyramid';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowUpRight,Sparkles} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
export default function StandingHero({top,onAction,empty}:{top:string|null;onAction:()=>void;empty:boolean}){
 const {t}=useTranslations(),reduced=useReducedMotion();
 return <section className="standing-hero card"><div className="standing-aura" aria-hidden="true"/><span className="standing-badge"><Sparkles size={13}/>{t('Illustrative estimate')}</span><span className="eyebrow">{t('YOU’RE ON THE')}</span><motion.h2 key={top??'empty'} initial={reduced?false:{opacity:0,y:12,scale:.96}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.55}} aria-live="polite">{t('Top')} <bdi>{top??'—'}</bdi></motion.h2><div className="standing-spectrum" aria-hidden="true"/>
 <Pyramid top={top}/>
 <button className="primary-button stitch-cta" onClick={onAction}>{t(empty?'Get started':'Explore Your Potential')}<ArrowUpRight size={17}/></button><small>{t(top?'Model estimate · not a validated world rank':'Add a measurement to begin.')}</small></section>;
}
