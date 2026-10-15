'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {useRef,useState} from 'react';
import {LOCAL_PROFILE_KEYS} from '@/lib/profile';
import Modal from './Modal';
const keys=[...LOCAL_PROFILE_KEYS,'top1-history-guest','top1-program-guest','top1-program-draft-guest','top1-program-composer-guest','top1-checkin-guest','top1-favorites-guest'];
export default function BrowserDataControls({onCleared}:{onCleared:()=>void}){
 const {t:tr}=useTranslations();

 const [open,setOpen]=useState(false),[confirmation,setConfirmation]=useState(''),[error,setError]=useState('');const trigger=useRef<HTMLElement|null>(null);
 function exportData(){try{const data=Object.fromEntries(keys.flatMap(key=>{const raw=localStorage.getItem(key);return raw===null?[]:[[key,raw]];})),url=URL.createObjectURL(new Blob([JSON.stringify({schemaVersion:2,exportedAt:new Date().toISOString(),scope:'guest-browser',records:data},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='TOP1-browser-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setError('');}catch{setError('Browser data could not be exported.');}}
 function clear(){if(confirmation!=='DELETE BROWSER DATA')return;try{keys.forEach(key=>localStorage.removeItem(key));setOpen(false);setConfirmation('');onCleared();}catch{setError('Some browser data could not be removed. Keep the page open and retry.');}}
 return <section className="card account-data"><h2>{tr("Browser data")}</h2><p>{tr("Guest measurements, history, routine and drafts stay in this browser.")}</p><div className="modal-actions"><button className="secondary-button" onClick={exportData}>{tr("Export browser data")}</button><button className="text-link" onClick={()=>{trigger.current=document.activeElement as HTMLElement;setOpen(true);setConfirmation('');}}>{tr("Delete guest data")}</button></div>{error&&<p role="alert">{tr(error)}</p>}{open&&<Modal title={tr("Delete guest data in this browser?")} returnFocus={trigger.current} onClose={()=>setOpen(false)}><p>{tr("This permanently removes the guest profile, measurements, history, routine and guest drafts. Saved cloud accounts and account drafts are separate.")}</p><button className="secondary-button" onClick={exportData}>{tr("Export a copy first")}</button><label>{tr("Type DELETE BROWSER DATA")}<input value={confirmation} autoComplete="off" onChange={e=>setConfirmation(e.target.value)}/></label><button className="primary-button" disabled={confirmation!=='DELETE BROWSER DATA'} onClick={clear}>{tr("Delete guest browser data")}</button></Modal>}</section>;
}
