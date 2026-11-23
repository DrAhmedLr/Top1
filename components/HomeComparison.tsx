'use client';

import type {referenceChart} from '@/lib/homePresentation';
import type {Metric} from '@/lib/registry';
import RankCurve from './RankCurve';
import PerformancePyramid from './PushupPyramid';
import {gameTierLabel} from './GameTierResult';
import {useTranslations} from './providers/LocaleProvider';

export default function HomeComparison({metric, chart}: {
  metric: Metric;
  chart: NonNullable<ReturnType<typeof referenceChart>>;
}) {
  const {locale, t} = useTranslations();
  const l = (en: string, fr: string, ar: string) => locale === 'fr' ? fr : locale === 'ar' ? ar : en;
  if (chart.kind === 'pyramid') return <div className="th-comparison" data-chart="pyramid">
    <span>{t(metric.name)} · {l('TOP1 scale', 'Barème TOP1', 'سلّم TOP1')}</span>
    <strong><bdi>{gameTierLabel(chart.percent + '%', locale)}</bdi></strong>
    <PerformancePyramid percent={chart.percent}/>
  </div>;

  const {band, cohort, reference} = chart.source;
  const percent = (n: number) => new Intl.NumberFormat(locale, {style:'percent'}).format(n / 100);
  const range = band.kind === 'upper'
    ? l('Top ' + percent(band.to) + ' or better', 'Top ' + percent(band.to) + ' ou mieux', 'ضمن أعلى ' + percent(band.to) + ' أو أفضل')
    : band.kind === 'lower'
      ? l('Outside top ', 'Au-delà du top ', 'خارج أعلى ') + percent(band.from)
      : l('Top ', 'Top ', 'أعلى ') + percent(band.from) + '–' + percent(band.to);
  return <div className="th-comparison" data-chart="curve">
    <span>{t(metric.name)} · {t(reference)}</span>
    <strong><bdi>{range}</bdi></strong>
    <RankCurve band={band} caption={l('Schematic range', 'Intervalle schématique', 'نطاق توضيحي') + ' · ' + cohort.split(' · ').map(t).join(' · ')} axisLabels={['P10','P50','P90']}/>
  </div>;
}
