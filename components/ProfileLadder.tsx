'use client';

import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {buildPublicSummary,normalizeUsername,type ProfileState} from '@/lib/profile';
import {ladderKey,ladderLimit,ladderUsernames} from '@/lib/profileLadder';
import {useTranslations} from './providers/LocaleProvider';

type Result=number|'unscored'|'unavailable'|'failed';

export default function ProfileLadder({owner,profile}:{owner:string;profile:ProfileState}) {
 const {locale}=useTranslations();
 const l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const [open,setOpen]=useState(false),[names,setNames]=useState<string[]>([]),[input,setInput]=useState('');
 const [results,setResults]=useState<Record<string,Result>>({}),[attempt,setAttempt]=useState(0);
 const [invalid,setInvalid]=useState(false),[storageError,setStorageError]=useState(false);
 const key=ladderKey(owner);
 useEffect(()=>{
  function load(){
   try{setNames(ladderUsernames(localStorage.getItem(key)));setStorageError(false);}
   catch{setStorageError(true);}
  }
  load();
  const changed=(event:StorageEvent)=>{if(event.key===key||event.key===null)load();};
  window.addEventListener('storage',changed);
  return ()=>window.removeEventListener('storage',changed);
 },[key]);

 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();
  setResults({});
  Promise.all(names.map(async name=>{
   let result:Result='failed';
   try{
    const response=await fetch('/api/ladder/'+name,{cache:'no-store',signal:controller.signal});
    if(response.status===404)result='unavailable';
    if(response.ok){
     const {score}=await response.json();
     if(score===null)result='unscored';
     if(typeof score==='number'&&Number.isFinite(score)&&score>=0&&score<=100)result=score;
    }
   }catch{}
   return [name,result] as const;
  })).then(rows=>{if(!controller.signal.aborted)setResults(Object.fromEntries(rows));});
  return ()=>controller.abort();
 },[open,names,attempt]);

 function save(next:string[]){
  setNames(next);
  try{localStorage.setItem(key,JSON.stringify(next));setStorageError(false);}catch{setStorageError(true);}
 }
 function add(event:FormEvent){
  event.preventDefault();
  let name='';
  try{name=normalizeUsername(input.trim().replace(/^@/,''));}catch{}
  if(!name||name===profile.username||names.includes(name)||names.length>=ladderLimit){setInvalid(true);return;}
  setInvalid(false);setInput('');save([...names,name]);
 }
 const summary=useMemo(()=>open?buildPublicSummary(profile):null,[open,profile]);
 const rows:{name:string;score:Result|undefined}[]=names.filter(name=>name!==profile.username).map(name=>({name,score:results[name]}));
 if(summary)rows.push({name:'',score:summary.ready?Number(summary.modelScore.toFixed(1)):'unscored'});
 const order=(result:Result|undefined)=>typeof result==='number'?result:-1;
 rows.sort((a,b)=>order(b.score)-order(a.score)||a.name.localeCompare(b.name));
 const label=(result:Result|undefined)=> typeof result==='number'?new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(result)+' / 100':
   result==='unavailable'?l('Private or unavailable','Privé ou indisponible','خاص أو غير متاح'):
   result==='unscored'?l('No current score','Aucun score actuel','لا توجد نقاط حالية'):
   result==='failed'?l('Could not refresh','Actualisation impossible','تعذّر التحديث'): '…';
 return <details className="card profile-ladder" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>{l('Friends ladder','Classement entre amis','ترتيب الأصدقاء')}</summary>
  {open&&<>
   <p>{l('Compare published TOP1 snapshot points. Your list stays on this device.','Compare les points des profils TOP1 publiés. Ta liste reste sur cet appareil.','قارن نقاط الملفات المنشورة على TOP1. تُحفظ قائمتك على هذا الجهاز.')}</p>
   <form onSubmit={add}><label>{l('Public username','Nom d’utilisateur public','اسم المستخدم العام')}
    <input value={input} maxLength={31} autoCapitalize="none" spellCheck={false} placeholder="@username" onChange={e=>{setInput(e.target.value);setInvalid(false);}}/>
   </label><button type="submit" className="secondary-button" disabled={!input.trim()||names.length>=ladderLimit}>{l('Add','Ajouter','إضافة')}</button></form>
   {invalid&&<p role="alert">{l('Enter a different public username (3–30 characters).','Saisis un autre nom public (3 à 30 caractères).','أدخل اسم مستخدم عامًا آخر (٣–٣٠ حرفًا).')}</p>}
   <ul>{rows.map(({name,score})=><li key={name}><strong><bdi>{name?'@'+name:l('You','Toi','أنت')}</bdi></strong><span>{label(score)}</span>{name&&<button type="button" className="text-link" onClick={()=>save(names.filter(other=>other!==name))} aria-label={l('Remove','Retirer','إزالة')+' @'+name}>{l('Remove','Retirer','إزالة')}</button>}</li>)}</ul>
   {names.length>0&&<button type="button" className="text-link" onClick={()=>setAttempt(n=>n+1)}>{l('Refresh scores','Actualiser les scores','تحديث النقاط')}</button>}
   {storageError&&<p role="status">{l('Device storage is unavailable.','Stockage de l’appareil indisponible.','مساحة التخزين المحلية غير متاحة.')}</p>}
  </>}
 </details>;
}
