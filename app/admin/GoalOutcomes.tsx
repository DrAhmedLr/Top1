import type {AdminGoalReport, AdminGoalStage} from '@/lib/adminGoalReport';
import {count, metricName} from './reportLabels';
import s from './page.module.css';

const percent = new Intl.NumberFormat('en',{style:'percent',maximumFractionDigits:1});
const decimal = new Intl.NumberFormat('en',{maximumFractionDigits:1,signDisplay:'exceptZero'});
function rate(value:number|null) {return value===null?'—':percent.format(value);}
function difference(value:number|null) {return value===null?'—':decimal.format(value)+' pp';}
function score(value:number|null) {return value===null?'—':value.toFixed(3);}

function Calibration({stage}:{stage:AdminGoalStage}) {
  const recentPace=stage.modelVersion.includes('recent-pace');
  const rows = [
    {title:'Followed the plan',size:stage.scored,predicted:stage.predicted,actual:stage.actual,gap:stage.gapPoints,brier:stage.brier},
    {title:'All measured results',size:stage.observed,predicted:stage.observedPredicted,actual:stage.observedActual,gap:stage.observedGapPoints,brier:stage.observedBrier},
  ];
  if(recentPace) rows.reverse();
  return <div className={s.stage}>
    <h4>{recentPace?'At recent pace':stage.kind==='illustrative'?'Initial estimate · as prescribed':'Personal estimate · as prescribed'} <small>{stage.modelVersion} · {count(stage.forecasts)} issued</small></h4>
    <div className={s.tableWrap}><table className={s.calibration}><thead><tr>
      <th>Results included</th><th>Sample</th><th>Mean prediction</th><th>Reached on time</th><th>Gap</th><th>Brier score</th>
    </tr></thead><tbody>{rows.map(row=><tr key={row.title}>
      <th scope="row">{row.title}</th><td>{count(row.size)}</td><td>{rate(row.predicted)}</td><td>{rate(row.actual)}</td><td>{difference(row.gap)}</td><td>{score(row.brier)}</td>
    </tr>)}</tbody></table></div>
  </div>;
}

export default function GoalOutcomes({report}:{report:AdminGoalReport}) {
  const rows = [...report.metrics].sort((a,b)=>b.attempts-a.attempts || metricName(a.metric).localeCompare(metricName(b.metric)) || a.goalUnit.localeCompare(b.goalUnit));
  const totals = rows.reduce((acc,row)=>({attempts:acc.attempts+row.attempts,reached:acc.reached+row.reached,measured:acc.measured+row.reached+row.missed,completed:acc.completed+row.completed,due:acc.due+row.due}),{attempts:0,reached:0,measured:0,completed:0,due:0});
  if (!rows.length) return <section className={s.panel}><h2>Results by metric</h2><div className={s.empty}>
    <h3>No shared goals with deadlines in this period</h3><p>As goal deadlines pass, this report will show on-time results, logged training and the forecasts issued before each result.</p>
  </div></section>;
  return <>
    <div className={s.stats}>
      <div><h2>Shared goals due</h2><strong>{count(totals.attempts)}</strong><p>Each goal counted once</p></div>
      <div><h2>Reached on time</h2><strong>{count(totals.reached)}</strong><p>Of {count(totals.measured)} goals with a measured result</p></div>
      <div><h2>Plan followed</h2><strong>{rate(totals.due?totals.completed/totals.due:null)}</strong><p>{count(totals.completed)} of {count(totals.due)} due sessions completed as prescribed</p></div>
    </div>
    <section className={s.panel}><h2>Results by metric</h2><p>Each customer counts once per metric and goal unit. A customer can have several goals.</p>
      <div className={s.tableWrap}><table className={s.outcomes}><thead><tr>
        <th>Metric</th><th>Customers who reached / total</th><th>Goals</th><th>Reached</th><th>Missed</th><th>Unconfirmed</th><th>Replaced</th><th>Plan followed</th>
      </tr></thead><tbody>{rows.map(row=><tr key={row.metric+'/'+row.goalUnit}>
        <th scope="row">{metricName(row.metric)}{row.goalUnit==='kg'&&<small>Load in kg</small>}</th>
        <td>{count(row.reachedUsers)} / {count(row.users)}</td><td>{count(row.attempts)}</td><td>{count(row.reached)}</td>
        <td>{count(row.missed)}</td><td>{count(row.unknown)}</td><td>{count(row.superseded)}</td>
        <td>{rate(row.due?row.completed/row.due:null)}<small>{count(row.completed)} / {count(row.due)} sessions · {count(row.adherenceAttempts)} goals</small></td>
      </tr>)}</tbody></table></div>
      <p className={s.footnote}>Unconfirmed goals lack a comparable final result. Replaced goals ended when the customer changed targets. Attendance uses sessions due through the result or deadline.</p>
    </section>
    <section className={s.panel}><h2>Forecast accuracy</h2>
      <p>Compare the probability issued before the result with the share of goals reached on time. A positive gap means more goals succeeded than predicted. A Brier score closer to zero means smaller prediction errors.</p>
      <p className={s.footnote}>“Followed the plan” includes measured outcomes with at least one scheduled session after the forecast and every due session completed as prescribed. The main comparison for recent-pace forecasts uses all measured outcomes, including athletes who changed or skipped sessions.</p>
      <div className={s.metricList}>{rows.map(row=><details key={row.metric+'/'+row.goalUnit} className={s.metricRow}>
        <summary><span>{metricName(row.metric)}{row.goalUnit==='kg'?' · load in kg':''}</span><span>{count(row.stages.reduce((sum,stage)=>sum+stage.forecasts,0))} forecasts</span></summary>
        {row.stages.map(stage=><Calibration key={stage.kind+'/'+stage.modelVersion} stage={stage}/>)}
        {!row.stages.length&&<p className={s.emptyLine}>No forecasts available for this metric in this period.</p>}
      </details>)}</div>
    </section>
  </>;
}
