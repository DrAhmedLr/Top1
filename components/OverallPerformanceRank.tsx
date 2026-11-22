'use client';
import {useMemo} from 'react';
import {overallPerformance} from '@/lib/overallPerformance';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import type {Demographics, Values} from '@/lib/registry';
import type {WorldStanding} from '@/lib/worldwidePerformance';
import {useTranslations} from './providers/LocaleProvider';
import {gameTierLabel} from './GameTierResult';
import css from './RankExplorer.module.css';

type Props = {values:Values; details:MeasurementMetadata; profile?:Demographics; world?:WorldStanding};

export default function OverallPerformanceRank({values, details, profile, world}:Props) {
  const {locale} = useTranslations();
  const l = (en:string,fr:string,ar:string) => locale === 'fr' ? fr : locale === 'ar' ? ar : en;
  const result = useMemo(() => overallPerformance(values, details, profile), [values, details, profile]);
  const names = {
    push:l('Push','Poussée','الدفع'), pull:l('Pull and grip','Tirage et poigne','السحب والقبضة'),
    lower:l('Lower body','Bas du corps','الجزء السفلي'), running:l('Running','Course','الجري'),
  };
  const number = new Intl.NumberFormat(locale);
  const percent = (n:number) => new Intl.NumberFormat(locale,{style:'percent',maximumSignificantDigits:3}).format(n/100);
  const provisional=result.coverage<4;
  const coverage=l(`${number.format(result.coverage)} of 4 areas`,`${number.format(result.coverage)} domaines sur 4`,`${number.format(result.coverage)} من ٤ مجالات`);
  return <section data-overall-performance className={css.panel} aria-label={l('Overall performance','Performance globale','الأداء الإجمالي')}>
    <div className={css.ranking}>
      <span className={css.overline}>{provisional&&result.overall
        ?l('Provisional overall rank','Classement global provisoire','الترتيب الإجمالي المبدئي')
        :l('Overall game rank','Classement global du jeu','الترتيب الإجمالي في اللعبة')}</span>
      <h3 className={result.overall ? css.rangeValue : css.noRank}><bdi>{result.overall ? gameTierLabel(result.overall.percent+'%',locale)
        :l('Log a performance test','Enregistre un test de performance','سجّل اختبار أداء')}</bdi></h3>
      <p>{coverage}</p>
    </div>
    <details className={css.method}><summary>{l('How your rank adds up','Comment ton rang est calculé','كيف يُحسب ترتيبك')}</summary>
      <ul>{result.areas.map(area => <li key={area.area}>
        {names[area.area]} · {area.points===null?'—':<bdi>{gameTierLabel((100 * 10 ** -area.points)+'%',locale)}</bdi>}
      </li>)}</ul>
      <p>{l('Your latest result in each test contributes to its area. Each recorded area has equal weight. Your overall percentage can be up to ten times smaller than the percentage in your weakest area.',
        'Ton dernier résultat de chaque test compte dans son domaine. Chaque domaine renseigné a le même poids. Le pourcentage global peut être jusqu’à dix fois plus petit que celui du domaine le plus faible.',
        'تُحتسب أحدث نتيجة لكل اختبار ضمن مجاله. تتساوى أوزان المجالات المسجّلة. يمكن أن تبلغ النسبة الإجمالية عُشر نسبة أضعف مجال.')}</p>
      <p>{l('The 13 performance tests use TOP1 game rules. Health and recovery measurements stay in your journal.',
        'Les 13 tests de performance utilisent le barème du jeu TOP1. Les mesures de santé et de récupération restent dans ton journal.',
        'تستخدم اختبارات الأداء الثلاثة عشر قواعد اللعبة. تبقى قياسات الصحة والتعافي في سجلك.')}</p>
    {world?.available ? <div className={css.cohort}>
      <strong>{l('Worldwide estimate','Estimation mondiale','التقدير العالمي')} · <bdi>{gameTierLabel(world.topPercent+'%',locale)}</bdi></strong>
      <p>{world.population} · <bdi>{percent(world.confidence*100)}</bdi> {l('interval','intervalle','نطاق')} · <bdi>{percent(world.interval[0])}–{percent(world.interval[1])}</bdi></p>
    </div> : <p className={css.cohort}>{world?.reason === 'battery'
      ? l('Worldwide rank · complete the reference test protocols.','Rang mondial · renseigne les protocoles des épreuves.','الترتيب العالمي · أكمل بروتوكولات الاختبارات المرجعية.')
      : world?.reason === 'precision' ? l('Worldwide rank · beyond the supported reference precision.','Rang mondial · précision de la référence dépassée.','الترتيب العالمي · يتجاوز الدقة التي تدعمها العينة.')
      : l('Worldwide rank · awaiting a representative comparison group.',
      'Rang mondial · en attente d’une population de comparaison représentative.',
      'الترتيب العالمي · بانتظار عينة مقارنة ممثلة للسكان.')}</p>}
    </details>
  </section>;
}
