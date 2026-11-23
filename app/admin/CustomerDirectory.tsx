'use client';

import {useState} from 'react';
import {ArrowRight, ChevronLeft, ChevronRight, Search} from 'lucide-react';
import Link from 'next/link';
import type {CustomerDirectory as Directory} from '@/lib/customerJourneyTypes';
import {searchCustomers} from './customerActions';
import {count, dateOnly, duration, timestamp} from './reportLabels';
import s from './page.module.css';

export default function CustomerDirectory({initial,days}:{initial:Directory;days:number}) {
  const [directory,setDirectory] = useState(initial);
  const [query,setQuery] = useState('');
  const [applied,setApplied] = useState('');
  const [cursors,setCursors] = useState<(string|null)[]>([null]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function load(search:string, pages:(string|null)[]) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await searchCustomers(days,search,pages[pages.length-1]);
      if (!result.data) {setError(result.error); return;}
      setDirectory(result.data); setApplied(search); setCursors(pages);
    } catch {setError('Could not load customers. Try again.');}
    finally {setBusy(false);}
  }
  return <section className={s.panel} aria-busy={busy}>
    <div className={s.panelHeading}><div><h2>Customer directory</h2><p>Accounts in signup order, newest first. Activity covers the selected period.</p></div>
      <form className={s.search} onSubmit={event=>{event.preventDefault();void load(query.trim(),[null]);}}>
        <label><Search size={16} aria-hidden="true"/><input aria-label="Search by email or account ID" type="search" maxLength={120} placeholder="Email or account ID" value={query} onChange={e=>setQuery(e.target.value)}/></label>
        <button className={s.solid} disabled={busy}>Search</button>
      </form>
    </div>
    {error && <p role="alert" className={s.error}>{error}</p>}
    {!directory.customers.length ? <div className={s.empty}>
      <h3>{applied?'No matching customers':'No registered customers yet'}</h3>
      <p>{applied?'Try another email or account ID.':'Registered accounts will appear here after signup.'}</p>
    </div> :
      <div className={s.tableWrap}><table className={s.directory}><thead><tr>
        <th>Customer</th><th>Journey sharing</th><th>Last activity · UTC</th><th>Sessions</th><th>Active time</th><th><span className={s.visuallyHidden}>Open journey</span></th>
      </tr></thead><tbody>{directory.customers.map(customer=>{
        const href='/admin?tab=customers&days='+days+'&customer='+customer.id;
        return <tr key={customer.id}>
          <th scope="row"><Link prefetch={false} href={href} className={s.customerLink}>{customer.email??customer.id}</Link>
            <small>Joined {dateOnly(customer.createdAt)}</small></th>
          <td><span className={customer.sharing?s.on:s.off}>{customer.sharing?'On':'Off'}</span></td>
          <td>{customer.lastSeen ? timestamp(customer.lastSeen) : '—'}</td>
          <td>{customer.sharing?count(customer.sessions):'—'}</td><td>{customer.sharing?duration(customer.activeSeconds):'—'}</td>
          <td><Link prefetch={false} href={href} aria-label={'Open journey for '+(customer.email??customer.id)} className={s.rowArrow}><ArrowRight size={16}/></Link></td>
        </tr>;
      })}</tbody></table></div>}
    {Boolean(cursors.length>1 || directory.nextAfter) && <div className={s.pagination}>
      <span>Page {count(cursors.length)}</span>
      <div><button type="button" className={s.utility} disabled={busy || cursors.length===1} onClick={()=>void load(applied,cursors.slice(0,-1))}><ChevronLeft size={15}/> Previous</button>
      <button type="button" className={s.utility} disabled={busy || !directory.nextAfter} onClick={()=>directory.nextAfter && void load(applied,[...cursors,directory.nextAfter])}>Next <ChevronRight size={15}/></button></div>
    </div>}
  </section>;
}
