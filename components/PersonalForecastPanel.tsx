'use client';
import {ChartNoAxesCombined} from 'lucide-react';
import type {PersonalForecast} from '@/lib/personalForecast';
import {useTranslations} from './providers/LocaleProvider';
import s from './AdaptiveProgram.module.css';

export default function PersonalForecastPanel({result,loading,failed,retry}:{
  result?:PersonalForecast;loading:boolean;failed:boolean;retry:()=>void;
}){
  const {locale}=useTranslations();
  const l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
  const format=new Intl.NumberFormat(locale);
  return <section className={s.card} aria-live="polite">
    <div className={s.heading}><ChartNoAxesCombined aria-hidden="true" size={21}/><h2>{l('From my training history','D’après mon entraînement','من سجل تدريبي')}</h2></div>
    {loading&&<p>{l('Reading your tests…','Lecture de tes tests…','جارٍ تحميل اختباراتك…')}</p>}
    {failed&&<p>{l('Your test history could not be loaded.','Ton historique de tests est indisponible.','تعذّر تحميل سجل اختباراتك.')} <button className={s.link} onClick={retry}>{l('Retry','Réessayer','أعد المحاولة')}</button></p>}
    {result?.kind==='ready'&&<>
      <div className={s.forecast}><strong><bdi>{new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:0}).format(result.probability)}</bdi></strong>
        <span>{l('Simulated paths that reached your target by its deadline','Trajectoires simulées qui atteignent ta cible dans le délai','نسبة المسارات المحاكاة التي بلغت هدفك ضمن الموعد')}</span></div>
      {result.intervals<10&&<p>{l('Early estimate. With so few intervals, one new test can change this percentage substantially.','Première estimation. Avec si peu d’intervalles, un nouveau test peut modifier sensiblement ce pourcentage.','تقدير أولي. مع هذا العدد القليل من الفترات، قد يغير اختبار واحد جديد النسبة بشكل كبير.')}</p>}
      <p>{format.format(result.intervals)} {l('comparable intervals','intervalles comparables','فترات قابلة للمقارنة')} · {format.format(result.completedSessions)} {l('completed sessions','séances réalisées','جلسات مكتملة')} · {format.format(result.remainingSessions)} {l('sessions left on the calendar','créneaux restants','جلسات متبقية في الجدول')}.</p>
      <p>{l('Observed changes','Variations observées','التغيرات المسجّلة')} · {l('gains','hausses','تحسن')} {format.format(result.improving)} · {l('plateaus','stagnations','ثبات')} {format.format(result.unchanged)} · {l('declines','baisses','تراجع')} {format.format(result.declining)}.</p>
      <details className={s.explainer}><summary>{l('How the simulation works','Comment fonctionne la simulation','كيف تعمل المحاكاة')}</summary>
        <p>{l('The model resamples your past training intervals, including gains, plateaus, losses and logged absences. It spreads the change across each interval and counts how often the target is reached.','Le modèle tire au sort des intervalles de ton historique, avec leurs progrès, stagnations, baisses et absences consignées. Il répartit chaque variation sur les créneaux de l’intervalle et compte les trajectoires qui atteignent ta cible.','يسحب النموذج فترات من سجلك بما فيها التحسن والثبات والتراجع والغياب المسجّل. يوزع كل تغير على مواعيد الفترة ثم يحسب المسارات التي بلغت الهدف.')}</p>
        <p>{format.format(result.simulations)} {l('simulated paths, assuming your past intervals represent future training. Individual predictive accuracy remains unvalidated.','trajectoires simulées, en supposant que tes périodes passées représentent le futur. La précision prédictive individuelle reste à valider.','مسارًا محاكى على افتراض أن فتراتك السابقة تمثّل التدريب القادم. ودقة التنبؤ الفردي لا تزال بحاجة إلى تحقق.')}</p>
      </details></>}
    {result?.kind==='unavailable'&&<p>{result.reason==='insufficient'?
      l('Comparable intervals in this program','Intervalles comparables dans ce programme','الفترات القابلة للمقارنة في هذا البرنامج')+' · '+format.format(result.intervals)+' / '+format.format(3)+'. '+l('Record a dated starting test and three retests with the same protocol. Log every scheduled session between them, including misses.','Date ton test de départ et répète-le trois fois avec le même protocole. Consigne chaque séance prévue entre les tests, même manquée.','سجّل اختبار بداية مؤرخًا وأعده ثلاث مرات بالطريقة نفسها. سجّل كل جلسة مقررة بين الاختبارات بما فيها الجلسات الفائتة.'):
      result.reason==='horizon'?l('This deadline is beyond the simulation horizon.','Cette échéance dépasse l’horizon de simulation.','يتجاوز الموعد أفق المحاكاة.'):
      l('An estimate is unavailable for this target and schedule.','L’estimation est indisponible pour cette cible et ce calendrier.','لا يتوفر تقدير لهذا الهدف والجدول.')}</p>}
  </section>;
}
