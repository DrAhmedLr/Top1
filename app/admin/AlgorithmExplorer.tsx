'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {activeMetrics,maintenanceTargets,type Demographics,type Metric} from '@/lib/registry';
import {metricSpectrum,referenceSpectrum} from '@/lib/adminMetricSpectrum';
import {challengeStanding} from '@/lib/challengeProgress';
import {benchmarkEvidence} from '@/lib/benchmarkCoverage';
import {performanceAdjustment,PERFORMANCE_RULES,PERFORMANCE_RULES_VERSION} from '@/lib/performanceRules';
import {formatRunTime,parseRunTime} from '@/lib/run10kReference';
import {performanceAreas} from '@/lib/overallPerformance';
import s from './page.module.css';

const metrics=[...activeMetrics].sort((a,b)=>a.name.localeCompare(b.name,'en'));
const shortNumber=new Intl.NumberFormat('en',{maximumFractionDigits:3});
const percent=new Intl.NumberFormat('en',{maximumSignificantDigits:3});
const tierName=(tier:string)=>tier==='65%+'?'Outside Top 65%':'Top '+tier;
const reading=(metric:Metric,value:number)=>metric.id==='run_5k'?formatRunTime(value):shortNumber.format(value);
const areaNames={push:'Pushing',pull:'Pulling',lower:'Lower body',running:'Running'};

function LearningGuide() {
  return <section className={s.panel}><h2>How a programme learns</h2>
    <dl className={s.explain}>
      <div><dt>From the first measurement</dt><dd>The saved test sets the starting point. The target gap, time to the deadline and prescribed sessions drive the first simulation. The starting model assigns each remaining visit a 50% chance of a gain. The gain is 1% of baseline, rounded to a supported test increment with a minimum of one increment. It calculates the chance of enough gains to close the gap. For example, moving from 10 to 12 push-ups over four visits requires two gains of one rep. This gives an initial estimate of about 69%.</dd></div>
      <div><dt>From repeated tests</dt><dd>The personal estimate needs at least three comparable intervals with training records. The as-prescribed personal model repeatedly samples the athlete’s comparable, fully logged training intervals and their measured gains, plateaus and declines. Its percentage is the share of simulated paths that reach the target by the deadline. A measurement can move progress forward or backward.</dd></div>
      <div><dt>From the workout log</dt><dd>Completing a prescription, changing a workout and recording a skip carry different information. An unlogged session leaves attendance unknown. The plan-following forecast assumes the remaining prescription is completed. The recent-pace model simulates 1,024 paths using the athlete’s measured response and sequences of recorded attendance. It needs three trained intervals and at least three recorded slots covering 70% of recent scheduled visits. A median finish date requires half the paths to reach the target within the forecast horizon.</dd></div>
      <div><dt>From observed deadlines</dt><dd>The original prediction stays dated. On-time tests establish outcomes. A missing final test leaves the result unknown. For shared goals, the Goals report compares predictions with measured success by metric, model and adherence.</dd></div>
      <div><dt>When pooled results change a forecast</dt><dd>Each matching chronological group needs at least 70% observed follow-up and 20 independent, fully adherent participants. The correction is capped at 15 percentage points and must improve the later group’s Brier score by at least 0.002. Lower Brier scores indicate smaller probability errors.</dd></div>
    </dl><p>IP and time on screen belong to optional customer journey analytics. The forecast uses measurements, training records and the plan.</p>
    <Link className={s.appLink} prefetch={false} href="/admin?tab=goals">Open goal outcomes →</Link>
  </section>;
}

export default function AlgorithmExplorer() {
  const [id,setId]=useState('pushups');
  const [age,setAge]=useState('25'),[kg,setKg]=useState('75'),[sex,setSex]=useState<Demographics['sex']>('male');
  const [raw,setRaw]=useState('20');
  const metric=metrics.find(m=>m.id===id)!;
  const rule=PERFORMANCE_RULES[id], evidence=benchmarkEvidence(metric);
  const profile=useMemo(()=>({age:Number(age),weight:Number(kg),sex}),[age,kg,sex]);
  const validProfile=Number.isInteger(profile.age)&&profile.age>=18&&profile.age<=120&&profile.weight>=25&&profile.weight<=350;
  const bands=useMemo(()=>validProfile?metricSpectrum(metric,profile):[],[metric,profile,validProfile]);
  const published=validProfile?referenceSpectrum(metric,profile):null;
  const value=raw.trim()?Number(id==='run_5k'?parseRunTime(raw):raw):NaN;
  const result=validProfile?challengeStanding(id,value,profile):null;
  const adjustment=rule&&validProfile?performanceAdjustment(rule,profile):null;
  const unit=id==='run_5k'?'min:sec':metric.unit;
  function selectMetric(next:string) {
    const m=metrics.find(item=>item.id===next)!;
    setId(next);
    const mid=PERFORMANCE_RULES[next]?.anchors.find(a=>a[1]===50)?.[0]??m.min;
    setRaw(next==='run_5k'?formatRunTime(mid):String(mid));
  }
  return <>
    <section className={s.panel}><h2>Metric explorer</h2><p>Adjust a sample athlete to see which results unlock each tier. These inputs stay in this tab.</p>
      <div className={s.inputs}>
        <label>Metric<select value={id} onChange={e=>selectMetric(e.target.value)}>{metrics.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Test age<input type="number" min={18} max={120} value={age} onChange={e=>setAge(e.target.value)}/></label>
        <label>Test weight (kg)<input type="number" min={25} max={350} step="any" value={kg} onChange={e=>setKg(e.target.value)}/></label>
        <label>Reference sex<select value={sex} onChange={e=>setSex(e.target.value as Demographics['sex'])}><option value="male">Male</option><option value="female">Female</option><option value="unselected">Unspecified</option></select></label>
      </div>
      {!validProfile&&<p role="status">Enter a whole age from 18 to 120 and a weight from 25 to 350 kg.</p>}
      {rule&&<div className={s.preview}>
        <label>Test result ({unit})<input value={raw} type={id==='run_5k'?'text':'number'} min={metric.min} max={metric.max} step="any" onChange={e=>setRaw(e.target.value)}/></label>
        <div aria-live="polite">{result?<><strong>{tierName(result.tier)}</strong><span>{percent.format(result.modelTopPercent!)}% model position · TOP1 challenge</span></>:<span>Enter a valid test result and profile.</span>}</div>
      </div>}
      <p><b>Test protocol.</b> {metric.proofData.instructions}</p>
    </section>

    {rule&&<section className={s.panel}><h2>Every reachable challenge tier</h2>
      <p>Read from the easiest result to the strongest. Each row covers the test values that receive that displayed tier for this profile. These are TOP1 difficulty levels.</p>
      <div className={s.tableWrap}><table><thead><tr><th scope="col">Challenge tier</th><th scope="col">First result ({unit})</th><th scope="col">Through ({unit})</th></tr></thead><tbody>
        {bands.map(b=><tr key={b.tier} className={b.tier===result?.tier?s.selectedBand:undefined}><th scope="row">{tierName(b.tier)}</th><td>{reading(metric,b.from)}</td><td>{reading(metric,b.through)}</td></tr>)}
      </tbody></table></div>
      <details><summary>Profile adjustments and scoring anchors</summary>
        <dl className={s.explain}>
          <div><dt>Age</dt><dd>{shortNumber.format(100*rule.agePerYear)}% per year above {rule.ageStart}, for up to 40 years. Current multiplier {adjustment?.ageFactor.toFixed(4)??'—'}.</dd></div>
          <div><dt>Body weight</dt><dd>{rule.weightPerKg===0?'The test already uses a bodyweight ratio. Weighted pull-ups use the added load.':('Neutral range '+(rule.weightNeutralMin??65)+'–85 kg. Each kg above or below the nearest boundary applies '+shortNumber.format(100*rule.weightPerKg)+'% in that direction, up to 30 kg.')} Current multiplier {adjustment?.massFactor.toFixed(4)??'—'}.</dd></div>
          <div><dt>Reference sex</dt><dd>Female multiplier {rule.femaleFactor}. Male and unspecified use 1. Combined multiplier {adjustment?.factor.toFixed(4)??'—'}.</dd></div>
        </dl>
        <p>The scorer {metric.polarity===1?'multiplies':'divides'} the raw result by the combined factor and interpolates between anchors on a logarithmic percentage scale. The table below gives the original, unadjusted anchors. Model version {PERFORMANCE_RULES_VERSION}.</p>
        <table><thead><tr><th scope="col">Anchor ({unit})</th><th scope="col">Model position</th></tr></thead><tbody>{rule.anchors.map(([v,p])=><tr key={v}><th scope="row">{reading(metric,v)}</th><td>{p}%</td></tr>)}</tbody></table>
      </details>
    </section>}

    {evidence.kind==='published'?<section className={s.panel}><h2>Published reference bands</h2><p>{evidence.cohort}. {evidence.precision}</p><p>{evidence.protocol}</p>
      {published?.available?<table><thead><tr><th scope="col">Published percentile</th><th scope="col">Threshold ({unit})</th></tr></thead>
        <tbody>{published.thresholds.map(q=><tr key={q.percentile}><th scope="row">P{q.percentile}</th><td>{q.value}</td></tr>)}</tbody></table>:<p>No reference table matches this sample profile. Choose a supported age and reference sex.</p>}
      <a className={s.appLink} href={evidence.source} rel="noreferrer" target="_blank">Published source ↗</a>
    </section>:!rule&&<section className={s.panel}><h2>{maintenanceTargets[id]!==undefined?'Maintenance target':'Personal tracking'}</h2>
      <p>{maintenanceTargets[id]!==undefined?'The TOP1 maintenance target is '+maintenanceTargets[id]+' '+unit+'. ':''}This metric has no population ranking or TOP1 performance tiers. Its dated results remain available for personal comparisons.</p>{evidence.limitation&&<p>{evidence.limitation}</p>}
    </section>}
    <section className={s.panel}><h2>How the overall performance score works</h2>
      <p>Each eligible test contributes log₁₀(100 ÷ model position) points. TOP1 averages the tests within each measured area, then weights those areas equally. The final score can be at most one point above the weakest measured area. The displayed position is 100 × 10 raised to the negative score.</p>
      <details><summary>The four performance areas</summary><dl className={s.explain}>{Object.entries(performanceAreas).map(([area,ids])=><div key={area}><dt>{areaNames[area as keyof typeof areaNames]}</dt><dd>{ids.map(test=>metrics.find(m=>m.id===test)!.name).join(', ')}</dd></div>)}</dl></details>
    </section>
    <LearningGuide/>
  </>;
}
