'use client';
import {MetricIcon,CategoryIcon} from './MetricIcon';
import {useTranslations} from '@/components/providers/LocaleProvider';
import ScientificCalibration from './ScientificCalibration';
import { ArrowUpRight } from 'lucide-react';
import { activeMetrics, pillarNames, pillars, type Metric } from '@/lib/registry';

export default function Methodology({ onEvidence }: { onEvidence: (metric: Metric) => void }) {
 const {t:tr}=useTranslations();

  return <>
    <section className="card science-intro"><span className="eyebrow">{tr('UNDERSTAND YOUR NUMBERS')}</span><h2>{tr('Published evidence. Transparent game assumptions.')}</h2><p>{tr('A TOP1 game tier is a milestone on the app’s scale. A published comparison places a result within a named study cohort.')}</p><div className="science-grid"><div><h3>{tr('Your overall rank')}</h3><p>{tr('Push, pull, lower body and running each carry equal weight once logged. Your rank shows how many areas you have tested.')}</p></div><div><h3>{tr('Published comparisons')}</h3><p>{tr('Published cohort comparisons cover direct treadmill VO₂, single-hand grip strength and countermovement jump height. Eligibility depends on the test protocol, equipment, age and reference sex.')}</p></div><div><h3>{tr('Game assumptions')}</h3><p>{tr('Each of the 13 performance tests has its own scale and profile adjustments. Your next target is the smallest result that earns the next tier. The final tier is Top 0.01% or better.')}</p></div><div><h3>{tr('Your program')}</h3><p>{tr('Choose a target and a date. Your schedule sets the sessions. As you log sessions and repeat the same test, the app can estimate your chances from your own history.')}</p></div></div><details><summary>{tr('About the stricter calculation report')}</summary><p>{tr('The downloadable scientific report retains a separate capacity-only model with protocol gates and three-observation readiness. It intentionally differs from the entertainment dashboard. Medical markers and thermal exposure are never optimized by the training planner.')}</p></details><p><a href="https://github.com/DrAhmedLr/Top1/blob/main/docs/BENCHMARK_GAME.md" target="_blank" rel="noreferrer">{tr('Read the game rules and benchmark assumptions')}</a></p></section>
    <ScientificCalibration/>
    <section className="card evidence-library"><div className="card-heading"><div><span className="eyebrow">{tr("LOOK A LITTLE CLOSER")}</span><h2>{tr("Measurement methods & evidence")}</h2></div><span className="soft-tag">{activeMetrics.length} {tr("measurements")}</span></div>{pillars.map(p => <div className="evidence-group" key={p.id}><h3><CategoryIcon id={p.id}/>{tr(pillarNames[p.id])}</h3><div>{activeMetrics.filter(m => m.pillar === p.id).map(m => <button key={m.id} onClick={() => onEvidence(m)}><MetricIcon id={m.id}/>{tr(m.name)}<ArrowUpRight size={15}/></button>)}</div></div>)}</section>
  </>;
}
