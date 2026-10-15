'use client';
import {MetricIcon,CategoryIcon} from './MetricIcon';
import {useTranslations} from '@/components/providers/LocaleProvider';
import ScientificCalibration from './ScientificCalibration';
import { ArrowUpRight } from 'lucide-react';
import { activeMetrics, pillars, type Metric } from '@/lib/registry';
import { pillarNames } from './Overview';

export default function Methodology({ onEvidence }: { onEvidence: (metric: Metric) => void }) {
 const {t:tr}=useTranslations();

  return <>
    <section className="card science-intro"><span className="eyebrow">{tr('UNDERSTAND YOUR NUMBERS')}</span><h2>{tr('Published evidence. Transparent game assumptions.')}</h2><p>{tr('TOP1 mixes published test comparisons with illustrative benchmark estimates. A Top X% game label is not a measured world rank, diagnosis or claim of universal agreement.')}</p><div className="science-grid"><div><h3>{tr('Every measurement counts')}</h3><p>{tr('Each valid recorded measurement gets an illustrative game estimate. Blank fields are excluded. Each category averages its recorded scores, and populated categories receive equal weight in the global estimate.')}</p></div><div><h3>{tr('Published comparisons')}</h3><p>{tr('Four tests have independent published references: eligible treadmill VO₂, international grip, Canadian combined grip and Canadian jump height. Protocol, equipment, age and sex determine compatibility. Published bands remain separate from game estimates.')}</p></div><div><h3>{tr('Game assumptions')}</h3><p>{tr('Game scores use provisional anchors and a normal-distribution display, capped at three model units in either direction. Some health-related readings use a plateau rather than rewarding extremes. Thermal exposure gets a neutral game estimate. These choices are product rules, not validated health targets.')}</p></div><div><h3>{tr('Your program')}</h3><p>{tr('Routes change recorded physical performance measurements only. Programs use available days, session time, experience, recovery preference and dated completion history. Completing actions does not prove physical improvement. No duration to a target is predicted.')}</p></div></div><details><summary>{tr('About the stricter calculation report')}</summary><p>{tr('The downloadable scientific report retains a separate capacity-only model with protocol gates and three-observation readiness. It intentionally differs from the entertainment dashboard. Medical markers and thermal exposure are never optimized by the training planner.')}</p></details><p><a href="https://github.com/DrAhmedLr/Top1/blob/main/docs/BENCHMARK_GAME.md" target="_blank" rel="noreferrer">{tr('Read the game rules and benchmark assumptions')}</a></p></section>
    <ScientificCalibration/>
    <section className="card evidence-library"><div className="card-heading"><div><span className="eyebrow">{tr("LOOK A LITTLE CLOSER")}</span><h2>{tr("Measurement methods & evidence")}</h2></div><span className="soft-tag">{activeMetrics.length} {tr("measurements")}</span></div>{pillars.map(p => <div className="evidence-group" key={p.id}><h3><CategoryIcon id={p.id}/>{tr(pillarNames[p.id])}</h3><div>{activeMetrics.filter(m => m.pillar === p.id).map(m => <button key={m.id} onClick={() => onEvidence(m)}><MetricIcon id={m.id}/>{tr(m.name)}<ArrowUpRight size={15}/></button>)}</div></div>)}</section>
  </>;
}
