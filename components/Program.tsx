'use client';
import {useEffect,useRef,useState} from 'react';
import {captureEvent} from '@/lib/analytics';
import {discardAcknowledgedDraft} from '@/lib/drafts';
import {useAuth} from './providers/AuthProvider';
import Scenarios from './Scenarios';
import {dayKey,emptyPlan,normalizePlan,planProgress,type WeeklyPlan,type PlanFocus} from '@/lib/program';
import type {Values,Demographics} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
const names=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export default function Program({values,demographics,details,onMeasurements}:{values:Values;demographics:Demographics;details:MeasurementMetadata;onMeasurements:()=>void;onScience:()=>void}){
 const auth=useAuth(),owner=auth.user?.id??'guest',ownerRef=useRef(owner);ownerRef.current=owner;
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [attempt,setAttempt]=useState(0);
 const [plan,setPlan]=useState<WeeklyPlan>(emptyPlan),[revision,setRevision]=useState(0),[readyOwner,setReadyOwner]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[label,setLabel]=useState('');
 const ready=readyOwner===owner;
 const saved=useRef(''),today=dayKey(),weekday=((new Date().getDay()+6)%7)+1;
 useEffect(()=>{if(!auth.ready)return;let active=true;setReadyOwner(null);setBusy(false);setError('');setNotice('');setPlan(emptyPlan());setLabel('');
  async function load(){try{
   let next=emptyPlan(),rev=0;
   if(owner==='guest'){const raw=localStorage.getItem('top1-program-guest');if(raw)next=normalizePlan(JSON.parse(raw));}
   else{const r=await fetch('/api/program',{cache:'no-store'}),b=await r.json();if(!r.ok)throw new Error(b.error);if(b.plan)next=normalizePlan(b.plan);rev=b.revision;}
   if(!active)return;saved.current=JSON.stringify(next);const draft=localStorage.getItem(`top1-program-draft-${owner}`);
   if(draft&&draft!==saved.current){next=normalizePlan(JSON.parse(draft),true);setNotice('Unsaved program draft restored. Review it before saving.');}
   setPlan(next);setRevision(rev);setReadyOwner(owner);
  }catch(e){if(active)setError(e instanceof Error?e.message:'Unable to load your plan.');}}
  void load();return()=>{active=false;};
 },[owner,auth.ready,attempt]);
 const dirty=JSON.stringify(plan)!==saved.current;
 useEffect(()=>{if(!dirty&&!label.trim()&&!busy)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,label,busy]);
 useEffect(()=>{if(!ready||!dirty)return;try{localStorage.setItem(`top1-program-draft-${owner}`,JSON.stringify(plan));}catch{setError('Draft storage is unavailable. Keep this page open.');}},[plan,owner,ready,dirty]);
 async function save(next=plan){if(!ready||busy)return;const account=owner;setBusy(true);setError('');setNotice('');try{
  const valid=normalizePlan(next);let rev=revision;
  if(account==='guest')localStorage.setItem('top1-program-guest',JSON.stringify(valid));
  else{const r=await fetch('/api/program',{method:'POST',headers:{'Content-Type':'application/json','X-Profile-User':account},body:JSON.stringify({plan:valid,revision})}),b=await r.json();if(!r.ok)throw new Error(b.error);rev=b.revision;}
  if(!mounted.current||ownerRef.current!==account)return;saved.current=JSON.stringify(valid);setPlan(valid);setRevision(rev);captureEvent('program_saved',{focus:valid.focus});setNotice(account==='guest'?'Program saved in this browser.':'Program saved.');
  try{discardAcknowledgedDraft(localStorage,`top1-program-draft-${account}`,JSON.stringify(next));}catch{setNotice('Program saved. Local draft cleanup is unavailable.');}return true;
 }catch(e){if(mounted.current&&ownerRef.current===account)setError(e instanceof Error?e.message:'Save failed; your draft is retained.');}finally{if(mounted.current&&ownerRef.current===account)setBusy(false);}}
 function complete(id:string){const next={...plan,tasks:plan.tasks.map(t=>t.id===id?{...t,completed:t.completed.includes(today)?t.completed.filter(d=>d!==today):[...t.completed,today]}:t)};setPlan(next);void save(next).then(ok=>{if(ok&&next.tasks.find(t=>t.id===id)?.completed.includes(today))captureEvent('program_task_completed',{focus:plan.focus});});}
 const progress=planProgress(plan),todays=plan.tasks.filter(t=>t.days.includes(weekday));
 return <><section className="card weekly-program"><div className="card-heading"><div><h2>Your weekly plan</h2><p>Choose your actions and check them off. This is your routine; the model does not prescribe a training dose.</p></div><strong>{progress.done}/{progress.total} this week</strong></div>
 {!ready?<p role="status">{error||'Loading your plan…'}</p>:<>
 <label>Focus<select aria-label="Program focus" value={plan.focus} disabled={busy} onChange={e=>setPlan({...plan,focus:e.target.value as PlanFocus})}><option value="consistency">Consistency</option><option value="strength">Strength & fitness</option><option value="recovery">Recovery</option></select></label>
 <h3>Today</h3>{todays.length?todays.map(t=><label className="program-task" key={t.id}><input type="checkbox" checked={t.completed.includes(today)} disabled={busy||dirty} onChange={()=>complete(t.id)}/><span>{t.label}</span></label>):<p>No actions scheduled today.</p>}{dirty&&<p>Save your plan before recording completions.</p>}
 <details className="program-edit" open={!plan.tasks.length}><summary>Edit your routine</summary>{plan.tasks.map(t=><div className="program-action" key={t.id}><label>Action<input value={t.label} maxLength={160} disabled={busy} onChange={e=>setPlan({...plan,tasks:plan.tasks.map(x=>x.id===t.id?{...x,label:e.target.value}:x)})}/></label><div role="group" aria-label={`Days for ${t.label}`}>{names.map((n,i)=><button key={n} aria-label={`${n} for ${t.label}`} aria-pressed={t.days.includes(i+1)} disabled={busy} onClick={()=>setPlan({...plan,tasks:plan.tasks.map(x=>x.id===t.id?{...x,days:x.days.includes(i+1)?x.days.filter(d=>d!==i+1):[...x.days,i+1]}:x)})}>{n}</button>)}</div><button className="text-link" disabled={busy} onClick={()=>setPlan({...plan,tasks:plan.tasks.filter(x=>x.id!==t.id)})}>Remove action</button></div>)}
 <form onSubmit={e=>{e.preventDefault();if(label.trim()&&plan.tasks.length<8){setPlan({...plan,tasks:[...plan.tasks,{id:crypto.randomUUID(),label:label.trim(),days:[weekday],completed:[]}]});setLabel('');}}}><label>New action<input placeholder="An action you want to repeat" value={label} maxLength={160} disabled={busy||plan.tasks.length>=8} onChange={e=>setLabel(e.target.value)}/></label><button className="secondary-button" disabled={busy||!label.trim()||plan.tasks.length>=8}>Add action</button></form></details>
 <div className="modal-actions"><button className="primary-button" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Saving…':'Save program'}</button><button className="secondary-button" onClick={onMeasurements}>Record a check-in</button></div>
 </>}{error&&!ready&&<button className="secondary-button" onClick={()=>setAttempt(n=>n+1)}>Retry loading</button>}{error&&ready&&<p role="alert" className="field-error">{error}</p>}{notice&&<p role="status">{notice}</p>}</section><details className="card program-scenarios"><summary>Explore hypothetical scenarios</summary><Scenarios values={values} demographics={demographics} details={details} onMeasurements={onMeasurements}/></details></>;
}
