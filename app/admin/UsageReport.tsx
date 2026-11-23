import CollectionControl, {type CollectionState} from './CollectionControl';
import {count, dateOnly, actionName, screenName} from './reportLabels';
import s from './page.module.css';

type Breakdown = {event:string; view:string; accounts:number; events:number};
export type UsageReportData = {
  collection:CollectionState; active:number; returning:number; events:number;
  daily:{day:string; accounts:number; events:number}[]; breakdown:Breakdown[];
};

function BreakdownTable({name, rows, screens=false}:{name:string; rows:Breakdown[]; screens?:boolean}) {
  return <section className={s.panel}><h2>{name}</h2>
    {!rows.length ? <p className={s.emptyLine}>No activity recorded in this period.</p> :
      <div className={s.tableWrap}><table>
        <thead><tr><th>{screens?'Screen':'Action'}</th><th>Accounts</th><th>{screens?'Views':'Events'}</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.event + '/' + row.view}>
          <th scope="row">{screens ? screenName(row.view) : actionName(row.event)}</th><td>{count(row.accounts)}</td><td>{count(row.events)}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

const features = [
  ['quick_log_opened','Opened quick log'], ['measurement_saved','Saved a measurement'],
  ['goal_saved','Saved a goal'], ['workout_logged','Logged a workout'],
];

export default function UsageReport({report, owner}:{report:UsageReportData; owner:string}) {
  const peak = Math.max(1, ...report.daily.map(day => day.accounts));
  return <>
    <div className={s.stats}>
      <div><h2>Active accounts</h2><strong>{count(report.active)}</strong><p>At least one event</p></div>
      <div><h2>Returning accounts</h2><strong>{count(report.returning)}</strong><p>Active on two or more days</p></div>
      <div><h2>Total events</h2><strong>{count(report.events)}</strong><p>Screen views and actions</p></div>
    </div>
    <section className={s.panel}><h2>Daily active accounts</h2>
      {report.active===0 || !report.daily.length ? <p className={s.emptyLine}>No accounts shared activity in this period.</p> : <>
        <div aria-hidden="true" className={s.chart}>{report.daily.map(row => <span key={row.day} style={{height:row.accounts/peak*100+'%'}} title={dateOnly(row.day)+' · '+count(row.accounts)}/>)}</div>
        <div className={s.axis}><span>{dateOnly(report.daily[0].day)}</span><span>{dateOnly(report.daily[report.daily.length-1].day)}</span></div>
        <details><summary>Daily counts</summary><div className={s.tableWrap}><table><thead><tr><th>Date</th><th>Accounts</th><th>Events</th></tr></thead>
          <tbody>{report.daily.map(row => <tr key={row.day}><th scope="row">{row.day}</th><td>{count(row.accounts)}</td><td>{count(row.events)}</td></tr>)}</tbody>
        </table></div></details>
      </>}
    </section>
    <section className={s.panel}><h2>Feature adoption</h2><p>Each account counts once per feature during the selected period.</p>
      <div className={s.tableWrap}><table><thead><tr><th>Feature</th><th>Accounts</th></tr></thead><tbody>
        {features.map(([event, title]) => <tr key={event}><th scope="row">{title}</th><td>{count(report.breakdown.find(row => row.event===event)?.accounts??0)}</td></tr>)}
      </tbody></table></div>
    </section>
    <div className={s.grid}>
      <BreakdownTable name="Actions taken" rows={report.breakdown.filter(row=>row.event!=='app_viewed')}/>
      <BreakdownTable name="Screens opened" rows={report.breakdown.filter(row=>row.event==='app_viewed')} screens/>
    </div>
    <CollectionControl key={report.collection.revision} owner={owner} initial={report.collection}/>
  </>;
}
