'use client';

import {recordedCoverage} from '@/lib/coverage';
import { ArrowRight, ArrowUpRight, CircleHelp, Dumbbell, FlaskConical, Moon, Plus, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { evaluate, toModelScore } from '@/lib/engine';
import { activeMetrics, pillars, type Values, type PillarId } from '@/lib/registry';
import BalanceChart from './BalanceChart';

const icons = { bodymarkers: FlaskConical, strength: Dumbbell, recovery: Moon };
export const pillarNames = { bodymarkers: 'Body markers', strength: 'Strength & fitness', recovery: 'Recovery' };
const display = (n: number) => n.toFixed(1).replace(/\.0$/, '');

export default function Overview({ result, values, needsSetup, onMeasurements, onStart, onScenarios, onScience, onCalculationReport }: {
  result: ReturnType<typeof evaluate>; values: Values; needsSetup: boolean; onMeasurements: (pillar?: PillarId) => void;
  onStart: () => void; onScenarios: () => void; onScience: () => void;onCalculationReport:()=>void;
}) {
  const focus = result.bottlenecks.slice(0, 2);
  const published=result.submitted.filter(s=>s.reference.provenance==='published').length;
  const needsContext=result.assessments.filter(a=>!['eligible','context-only'].includes(a.status)).length;
  return <>
    <section className="protocol-hero">

      <h2 aria-live="polite">{result.measured.length ? <>YOUR PERSONAL <span>BASELINE</span><small>{result.measured.length} measurements recorded</small></> : <>BUILD YOUR <span>BASELINE</span><small>Record what you know</small></>}</h2>
      <div className="spectrum-line"/>

      <div className="hero-actions"><button className="primary-button" onClick={needsSetup ? onStart : onScenarios}><Sparkles size={17}/>{needsSetup ? 'Set up my profile' : 'Open my program'}</button>{!needsSetup && <button className="secondary-button" onClick={() => onMeasurements()}><Zap size={17}/>Log a measurement</button>}</div>
      <button className="hero-disclosure" onClick={onScience}><CircleHelp size={14}/>Measurement methods & model limits</button>
    </section>
    <div className="protocol-matrix">
      <section className="card balance-card"><div className="card-heading"><h2>Your measured performance</h2><button className="icon-button" aria-label="How performance is assessed" onClick={onScience}><CircleHelp size={17}/></button></div><p>Compare repeated measurements in My metrics. Adding a new metric changes the assessment, not your past performance.</p><details className="experimental-preview"><summary>Explore the experimental model</summary>{result.ready?<><strong>{display(result.modelScore)} /100 model points</strong><p>Experimental 5–95 scale · {published} published reference {published===1?'input':'inputs'} · {result.scoredCount-published} provisional. The composite is not population calibrated.</p>{pillars.filter(p=>p.id!=='bodymarkers').map(p=><div className="recorded-pillar" key={p.id}><strong>{pillarNames[p.id]}</strong><span>{result.domains[p.id]===undefined?'No scored data':`${display(toModelScore(result.domains[p.id]!))} model points · ${Math.round((result.domainWeights[p.id]??0)*100)}% of this calculation`}</span></div>)}{!result.comparable&&<p>Record methods and dates before comparing model assessments. Test conditions still need to match.</p>}</>:<p>{result.readinessReason} All fields remain optional.</p>}{needsContext>0&&<button className="text-link" onClick={()=>onMeasurements()}>{needsContext} {needsContext===1?'observation needs':'observations need'} protocol details or corrections</button>}<button className="text-link" onClick={onScience}>Review reference provenance</button><button className="text-link" disabled={needsSetup} onClick={onCalculationReport}>Download calculation report</button></details><div className="science-note">Body markers provide context and are tracked without scoring.</div></section>
      <section className="card snapshot-card"><div className="card-heading"><div><span className="eyebrow">YOUR RECORDED DATA</span><h2>Your three measurement areas</h2></div><ShieldCheck size={20}/></div><div className="coverage-snapshot"><div className="coverage-number">{display(recordedCoverage(result.measured.length))}<small>%</small></div><div><h3>Recorded measurements</h3><p>{result.measured.length} of {activeMetrics.length} measurements recorded.</p></div></div><p className="coverage-explanation">{result.scoredCount} enter the experimental model · {result.trackingOnly.length} tracking only. Recording coverage is availability, not confidence.</p><div className="recorded-pillars">{pillars.map(p => { const Icon=icons[p.id], z=result.ready?result.domains[p.id]:undefined, count=result.measured.filter(m=>m.pillar===p.id).length, total=activeMetrics.filter(m=>m.pillar===p.id).length; return <button className={`recorded-pillar ${p.id}`} key={p.id} onClick={()=>onMeasurements(p.id)}><span className="pillar-icon"><Icon size={18}/></span><span className="recorded-pillar-copy"><strong>{pillarNames[p.id]}</strong><small>{count} of {total} recorded</small></span><span className="recorded-pillar-score">{z===undefined?'—':display(toModelScore(z))}<small>{p.id==='bodymarkers'?'Context only':z===undefined?result.ready?'No scored data':'More model inputs needed':'provisional model'}</small></span><ArrowUpRight size={14}/></button>; })}</div><button className="text-link" onClick={() => onMeasurements()}>Record a measurement <ArrowRight size={15}/></button></section>
    </div>

    {focus.length > 0 && <section className="card next-actions"><div className="card-heading"><h2>Explore a change</h2></div><div className="next-action-grid">{focus.map(({metric}) => <div key={metric.id}><h3><span className={`category-dot ${metric.pillar}`}/>{metric.name}</h3><button className="secondary-button" onClick={onScenarios}>Try a scenario <ArrowRight size={15}/></button></div>)}</div></section>}
  </>;
}
