'use client';
import {formatRunTime} from '@/lib/run10kReference';
import {communityContext} from '@/lib/communityContext';
import {PERFORMANCE_RULES} from '@/lib/performanceRules';
import type {Metric,Demographics} from '@/lib/registry';
import {useTranslations} from './providers/LocaleProvider';

export default function BenchmarkReference({metric}:{metric:Metric;demographics?:Demographics}){
 const {t,locale}=useTranslations();
 const copy=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const rule=PERFORMANCE_RULES[metric.id],community=communityContext[metric.id];
 const number=new Intl.NumberFormat(locale,{maximumFractionDigits:2});
 return <section className="proof-block">
  <h3>{t('Benchmark basis')}</h3>
  {rule?<>
   <p>{copy('Reference game scale · ages 20–29, 75 kg, male setting. Your test-day profile personalizes the result.',
    'Barème de référence du jeu · 20–29 ans, 75 kg, référence masculine. Ton profil au moment du test personnalise ton résultat.',
    'مقياس اللعبة المرجعي · عمر ٢٠–٢٩ سنة، وزن ٧٥ كغ، مرجع ذكري. تتكيّف النتيجة مع بياناتك يوم الاختبار.')}</p>
   <div className="running-reference-tiers">{rule.anchors.filter(([,percent])=>percent===5||percent===1).map(([value,percent])=>
    <div key={percent}><strong>{t('Top')} {new Intl.NumberFormat(locale,{style:'percent'}).format(percent/100)}</strong>
     <bdi>{metric.id==='run_5k'?formatRunTime(value):number.format(value)} {t(metric.id==='run_5k'?'min:sec':metric.unit)}</bdi></div>)}</div>
  </>:<p>{copy('Use this measurement to follow your personal history. A compatible published comparison appears where available.',
   'Suis cette mesure dans ton historique personnel. Une comparaison publiée s’affiche si les conditions du test correspondent.',
   'تابع هذا القياس في سجلك الشخصي. تظهر مقارنة منشورة عند توافق شروط الاختبار.')}</p>}
  {community&&<aside><p>{t(community.summary)}</p>{community.links.map(link=>
   <a key={link.url} className="text-link" href={link.url} target="_blank" rel="noreferrer">{t(link.label)}</a>)}</aside>}
 </section>;
}
