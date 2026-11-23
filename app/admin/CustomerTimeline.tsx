'use client';

import {useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import type {CustomerJourney} from '@/lib/customerJourneyTypes';
import {readTimeline} from './customerActions';
import {count, duration, actionName, metricName, screenName, timestamp} from './reportLabels';
import s from './page.module.css';

export default function CustomerTimeline({initial,days}:{initial:CustomerJourney;days:number}) {
  const [journey,setJourney] = useState(initial);
  const [cursors,setCursors] = useState<(number|null)[]>([null]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const {customer, screens, events} = journey;
  async function load(pages:(number|null)[]) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await readTimeline(customer.id,days,pages[pages.length-1]);
      if (!result.data) {setError(result.error);return;}
      setJourney(result.data); setCursors(result.data.customer.sharing?pages:[null]);
    } catch {setError('Could not load activity. Try again.');}
    finally {setBusy(false);}
  }
  return <>
    <div className={s.identity}><span>{customer.email??customer.id}</span><span className={customer.sharing?s.on:s.off}>Journey sharing {customer.sharing?'on':'off'}</span></div>
    <p className={s.meta}>Joined {timestamp(customer.createdAt)} UTC{customer.sharing&&customer.consentedAt&&' · Sharing since '+timestamp(customer.consentedAt)+' UTC'}</p>
    {customer.sharing ? <>
      <div className={s.stats}>
        <div><h2>Active time</h2><strong>{duration(customer.activeSeconds)}</strong><p>Foreground activity recorded</p></div>
        <div><h2>Sessions</h2><strong>{count(customer.sessions)}</strong><p>Sessions with shared activity</p></div>
        <div><h2>Actions &amp; screen views</h2><strong>{count(customer.eventCount)}</strong><p>{customer.lastSeen?'Last activity '+timestamp(customer.lastSeen)+' UTC':'No activity in this period'}</p></div>
      </div>
      {screens.some(row=>row.seconds>0) && <section className={s.panel}><h2>Time by screen</h2>
        <ul className={s.timeList}>{screens.filter(row=>row.seconds>0).map(row=><li key={row.view}>
          <span>{screenName(row.view)}</span><div aria-hidden="true"><i style={{width:Math.min(100,100*row.seconds/Math.max(1,customer.activeSeconds))+'%'}}/></div><strong>{duration(row.seconds)}</strong>
        </li>)}</ul>
      </section>}
      <section className={s.panel} aria-busy={busy}><div className={s.panelHeading}><div>
        <h2>Activity timeline</h2><p>Actions and screen views, latest received first. Times use UTC.</p>
        <p className={s.footnote}>Latest recorded IP in this period · {journey.recentIp?<><code>{journey.recentIp.address}</code> · {timestamp(journey.recentIp.at)} UTC</>:'Unavailable'}. IP addresses expire after 30 days.</p>
      </div></div>
        {error&&<p role="alert" className={s.error}>{error}</p>}
        {!events.length ? <div className={s.empty}><h3>No actions in this period</h3><p>Shared actions and screen views appear here as the customer uses the app.</p></div> :
          <ol className={s.timeline}>{events.map(ev=><li key={ev.seq}>
            <span className={s.timelineDot} aria-hidden="true"/>
            <div className={s.timelineBody}><div className={s.timelineHead}><strong>{actionName(ev.event)}</strong><time dateTime={ev.at}>{timestamp(ev.at)}</time></div>
            <div className={s.eventMeta}>{ev.view&&<span>{screenName(ev.view)}</span>}{ev.metric&&<span>{metricName(ev.metric)}</span>}{ev.seconds>0&&<span>{duration(ev.seconds)} active</span>}</div>
            <details className={s.connection}><summary>Session &amp; connection</summary>
              <dl><div><dt>Session</dt><dd>{ev.sessionId}</dd></div><div><dt>IP address</dt><dd>{ev.ip??'Unavailable'}</dd></div>{ev.ip&&ev.ipSeenAt&&<div><dt>Address recorded</dt><dd>{timestamp(ev.ipSeenAt)} UTC</dd></div>}</dl>
            </details></div>
          </li>)}</ol>}
        {Boolean(cursors.length>1 || journey.nextBefore) && <div className={s.pagination}><span>Page {count(cursors.length)}</span>
          <div><button type="button" className={s.utility} disabled={busy||cursors.length===1} onClick={()=>void load(cursors.slice(0,-1))}><ChevronLeft size={15}/> Newer</button>
          <button type="button" className={s.utility} disabled={busy||!journey.nextBefore} onClick={()=>journey.nextBefore&&void load([...cursors,journey.nextBefore])}>Older <ChevronRight size={15}/></button></div>
        </div>}
      </section>
    </> : <section className={s.panel}><h2>No shared journey</h2><p>This customer can enable journey sharing in Settings.</p></section>}
  </>;
}
