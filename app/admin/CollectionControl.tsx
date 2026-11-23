'use client';
import {useState} from 'react';
import s from './page.module.css';

export type CollectionState={enabled:boolean;revision:number};

export default function CollectionControl({initial,owner}:{initial:CollectionState;owner:string}) {
  const [state,setState]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function change() {
    if (busy) return;
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/admin/analytics',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','X-Profile-User':owner},
        body:JSON.stringify({enabled:!state.enabled,revision:state.revision})});
      const next=await response.json();
      if (!response.ok) throw new Error(next.error);
      setState(next);
    } catch(reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change collection. Reload to verify its status.');
    } finally {setBusy(false);}
  }
  return <section className={s.control}><div><h2>Event collection</h2><p role="status">{state.enabled?'Collecting events from opted-in accounts.':'Collection is paused for all accounts.'}</p></div>
    <button type="button" disabled={busy} onClick={()=>void change()}>{busy?'Updating…':state.enabled?'Pause collection':'Resume collection'}</button>
    {error&&<p role="alert">{error}</p>}</section>;
}
