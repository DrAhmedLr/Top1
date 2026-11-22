'use client';
import {ArrowRight} from 'lucide-react';
import type {OverallSaveChange} from '@/lib/overallPerformance';
import {useTranslations} from './providers/LocaleProvider';
import {gameTierLabel} from './GameTierResult';
import styles from './OverallChangeResult.module.css';

export default function OverallChangeResult({change}:{change:OverallSaveChange}){
 const {locale}=useTranslations();
 const l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const number=new Intl.NumberFormat(locale);
 const previous=change.previous===null?null:gameTierLabel(change.previous+'%',locale);
 const current=gameTierLabel(change.current+'%',locale);
 const provisional=change.coverage<4;
 const coverage=l(`${number.format(change.coverage)} of 4 areas`,`${number.format(change.coverage)} domaines sur 4`,`${number.format(change.coverage)} من ٤ مجالات`);
 return <section className={previous===null?styles.first:styles.change} aria-live="polite" data-overall-change>
  <div className={styles.title}>{provisional
   ?l('Provisional overall rank','Classement global provisoire','الترتيب الإجمالي المبدئي')
   :l('Overall game rank','Classement global du jeu','الترتيب الإجمالي في اللعبة')}</div>
  <div className={styles.numbers}>
   {previous&&previous!==current&&<><span className={styles.previous}><bdi>{previous}</bdi></span><ArrowRight size={17} aria-hidden="true"/></>}
   <strong><bdi>{current}</bdi></strong>
  </div>
  <div className={styles.status}><span>{coverage}</span>
   {previous===current&&<span> · {l('Same rank','Rang inchangé','الترتيب نفسه')}</span>}
  </div>
 </section>;
}
