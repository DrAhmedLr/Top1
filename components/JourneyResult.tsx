'use client';

import {gamePercentLabel} from './PushupPyramid';
import Link from 'next/link';
import {bandLabel} from '@/lib/metricStandings';
import {baselineArea,resultComparison} from '@/lib/journeyResult';
import {formatRunTime} from '@/lib/run10kReference';
import type {MeasurementDetails} from '@/lib/measurementMetadata';
import type {Demographics,Metric} from '@/lib/registry';
import {useTranslations} from './providers/LocaleProvider';

export type SavedJourneyResult={metric:Metric;value:number;details:MeasurementDetails;profile:Demographics;change:number|null;baselineStatus:'selected'|'incomplete'|'unselected';warning?:boolean;backdated?:boolean};

export default function JourneyResult({report,owner,onReview,onNext,onHistory,onFinish}:{report:SavedJourneyResult;owner:string;onReview:()=>void;onNext:()=>void;onHistory:()=>void;onFinish:()=>void}){
 const {locale,t}=useTranslations();
 const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const {metric,value,details,profile,change}=report;
 const compared=resultComparison(metric.id,value,profile,details);
 const timed=['run_5k','run_10k'].includes(metric.id),unit=timed?'min:sec':metric.id==='total_sleep'?'h/night':metric.unit;
 const show=(n:number)=>timed?formatRunTime(n):new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(metric.id==='total_sleep'?n/60:n);
 return <div className="journey-result">
  <h3 tabIndex={-1} data-journey-heading>{local('Your result','Ton résultat','نتيجتك')}</h3>
  <p>{t(metric.name)}</p>
  <strong className="journey-raw"><bdi>{show(value)}</bdi> {t(unit)}</strong>
  <p>{details.measuredAt?new Date(details.measuredAt).toLocaleString(locale):local('Test date not recorded','Date du test non renseignée','تاريخ الاختبار غير مسجّل')}</p>
  {compared?.published?<div className="journey-top"><strong><bdi>TOP {bandLabel(compared.published.band)}</bdi>{compared.published.band.kind==='upper'&&<> {t('or better')}</>}</strong><p><a href={compared.published.source} target="_blank" rel="noreferrer">{t(compared.published.reference)}</a> · {t(compared.published.cohort)}</p>{compared.published.attribution&&<small>{compared.published.attribution}</small>}</div>:compared?.challenge?<div className="journey-top"><strong><bdi>TOP {compared.challenge.modelTopPercent===undefined?compared.challenge.top:gamePercentLabel(compared.challenge.modelTopPercent,locale)}</bdi></strong><p>{local('TOP1 benchmark estimate · product challenge, not a worldwide rank','Estimation TOP1 · défi du produit, pas un rang mondial','تقدير TOP1 · تحدٍ وفق قواعد المنتج وليس ترتيبًا عالميًا')}</p></div>:<p>{local('Saved for personal tracking. No matching percentile reference is available.','Résultat conservé pour ton suivi. Aucun percentile compatible n’est disponible.','حُفظت النتيجة لتتبعك الشخصي. لا توجد مقارنة مئوية مطابقة.')}</p>}
  {!compared?.published&&compared?.challenge&&<Link href="/?view=methodology" className="text-link">{local('How this estimate works','Comment fonctionne cette estimation','كيف يعمل هذا التقدير')}</Link>}
  {report.backdated&&<p role="status">{local('This entry predates your last saved test. Open history for comparisons in measurement-date order.','Cette saisie précède ton dernier test enregistré. Ouvre l’historique pour comparer les résultats dans l’ordre des dates de mesure.','يسبق هذا السجل آخر اختبار حفظته. افتح السجل لمقارنة النتائج بترتيب تاريخ القياس.')}</p>}
  {change!==null?<p role="status">{local('Change with the same documented protocol','Évolution avec le même protocole documenté','التغير وفق البروتوكول الموثق نفسه')} · <bdi>{change<0?'−':'+'}{timed?formatRunTime(Math.abs(change)):show(Math.abs(change))}</bdi> {t(unit)}</p>:<p>{local('Personal change appears after two dated results with matching methods and protocols.','L’évolution apparaît après deux résultats datés avec la même méthode et le même protocole.','يظهر التغير الشخصي بعد نتيجتين مؤرختين بالطريقة والبروتوكول نفسيهما.')}</p>}
  {report.baselineStatus==='selected'&&<p role="status">{local('This result counts toward your balanced baseline.','Ce résultat compte pour ton profil équilibré.','تُحتسب هذه النتيجة ضمن ملف أدائك المتوازن.')}</p>}
  {report.baselineStatus==='incomplete'&&<p>{local('The result is recorded. Review its date and protocol to make it eligible for your baseline.','Le résultat est enregistré. Vérifie sa date et son protocole pour l’inclure dans ton profil équilibré.','سُجّلت النتيجة. راجع تاريخها وبروتوكولها لتصبح مؤهلة لملف أدائك.')}</p>}
  {report.baselineStatus==='unselected'&&baselineArea(metric.id)&&<p>{local('Recorded for tracking; not selected for your baseline.','Enregistré pour le suivi ; non sélectionné pour ton profil équilibré.','سُجّلت النتيجة للتتبع ولم تُختر لملف أدائك المتوازن.')}</p>}
  {report.warning&&<p role="alert">{local('This browser could not save your baseline choice. Your recorded result remains available.','Ce navigateur n’a pas pu enregistrer ton choix de test. Ton résultat reste disponible.','تعذّر حفظ اختيار الاختبار في المتصفح. تبقى نتيجتك المسجلة متاحة.')}</p>}
  <button className="text-link" onClick={onReview}>{local('Review test details','Vérifier les détails du test','راجع تفاصيل الاختبار')}</button>
  <button className="text-link" onClick={onHistory}>{t('View history')}</button>
  {owner==='guest'&&<p className="journey-account">{local('Keep going as a guest. An account can sync your saved results; you review browser data before importing it.','Continue en mode invité. Un compte permet de synchroniser tes résultats ; tu vérifieras les données avant de les importer.','تابع كضيف. يتيح الحساب مزامنة النتائج المحفوظة، وستراجع بيانات المتصفح قبل استيرادها.')} <Link href="/sign-in?mode=sign-up&next=%2F%3Fview%3Dperformance">{local('Keep my progress with an account','Garder mes progrès avec un compte','احفظ تقدمي باستخدام حساب')}</Link></p>}
  <div className="journey-actions"><button className="journey-back" onClick={onFinish}>{local('Done for now','Terminé pour le moment','انتهيت الآن')}</button><button className="journey-next" onClick={onNext}>{local('Choose the next area','Choisir le domaine suivant','اختر المجال التالي')}</button></div>
 </div>;
}
