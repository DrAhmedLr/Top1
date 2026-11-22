'use client';

import {ArrowRight} from 'lucide-react';
import {pyramidLeague,PYRAMID_LEAGUES} from '@/lib/pyramid';
import BellCurveJourney from './BellCurveJourney';
import {useTranslations} from './providers/LocaleProvider';

export default function BlueBenchmarkHero({top,count,total,disabled,onStart}:{top:string|null;count:number;total:number;disabled:boolean;onStart:()=>void}){
 const {t,locale}=useTranslations();
 const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const league=count>=3?pyramidLeague(top):null;
 return <section className="blue-benchmark-hero" aria-labelledby="blue-hero-title">
  <div className="blue-hero-content">
   <p className="blue-hero-eyebrow">{local('TOP1 · Your challenge path','TOP1 · Ton parcours','TOP1 · مسار تحدّياتك')}</p>
   <h1 id="blue-hero-title">{league?t(league.name):count?local('Your baseline','Ton point de départ','نقطة بدايتك'):local('Ready for your first move?','Prêt pour ton premier défi ?','هل أنت مستعد لتحدّيك الأول؟')}</h1>
   <BellCurveJourney stage={league?PYRAMID_LEAGUES.length-PYRAMID_LEAGUES.indexOf(league):0}/>
   <button type="button" className="blue-level-button" disabled={disabled} onClick={onStart}>{count?local('Open my journey','Ouvrir mon parcours','افتح مساري'):local('Start my journey','Commencer mon parcours','ابدأ مساري')}<ArrowRight size={19}/></button>
   <div className="completeness-gauge"><div><span>{local('Tests recorded','Tests enregistrés','الاختبارات المسجّلة')}</span><strong><bdi>{count} / {total}</bdi></strong></div><progress aria-label={local('Tests recorded','Tests enregistrés','الاختبارات المسجّلة')} max={total} value={count}/></div>
   {league&&<small className="benchmark-tier-note">{local('TOP1 game tier · Your tier can change as you add tests.','Niveau du jeu TOP1 · Il peut évoluer quand tu ajoutes des tests.','مستوى لعبة TOP1 · قد يتغيّر عند إضافة اختبارات.')}</small>}
  </div>
 </section>;
}
