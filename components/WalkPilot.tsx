'use client';

import {useEffect,useRef,useState} from 'react';
import {parseMeasurementInput} from '@/lib/measurementInput';
import {useTranslations} from './providers/LocaleProvider';

type Walk = { metres:number; date:string };
const duration=360_000;

function readWalks(storageKey:string):Walk[]{
 try {
  const data:unknown=JSON.parse(localStorage.getItem(storageKey)??'[]');
  if(!Array.isArray(data))return [];
  return data.filter((walk):walk is Walk=>walk&&Number.isFinite(walk.metres)&&walk.metres>0&&typeof walk.date==='string'&&Number.isFinite(Date.parse(walk.date)));
 } catch { return []; }
}

export default function WalkPilot({owner,onBack}:{owner:string;onBack:()=>void}){
 const {locale}=useTranslations();
 const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const storageKey=`top1-walk-pilot:${owner}`;
 const [walks,setWalks]=useState(()=>readWalks(storageKey));
 const [raw,setRaw]=useState('');
 const [deadline,setDeadline]=useState(0);
 const [remaining,setRemaining]=useState(360);
 const [error,setError]=useState(false);
 const heading=useRef<HTMLHeadingElement>(null);
 const metres=Number(parseMeasurementInput(raw));
 const running=deadline>0&&remaining>0;
 const number=new Intl.NumberFormat(locale,{maximumFractionDigits:2});
 useEffect(()=>{heading.current?.focus();},[]);
 useEffect(()=>{
  if(!deadline)return;
  const timer=window.setInterval(()=>{
   const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
   setRemaining(seconds);
   if(!seconds)window.clearInterval(timer);
  },250);
  return ()=>window.clearInterval(timer);
 },[deadline]);

 function save(){
  if(running||!Number.isFinite(metres)||metres<=0||metres>2000)return;
  try {
   const next=[{metres,date:new Date().toISOString()},...readWalks(storageKey)].slice(0,30);
   localStorage.setItem(storageKey,JSON.stringify(next));
   setWalks(next);
   setRaw('');
   setError(false);
  } catch {setError(true);}
 }

 return <div className="benchmark-journey walk-journey">
  <h3 ref={heading} tabIndex={-1}>{local('Six-minute walk pilot','Marche de six minutes · pilote','المشي لست دقائق · تجربة')}</h3>
  <p>{local('Walk at a comfortable pace on a safe, flat route. Stop if you feel unwell. Use the same route and distance measurement method each time to compare your walks.','Marche à un rythme confortable sur un parcours plat et sûr. Arrête si tu te sens mal. Pour comparer tes marches, garde le même parcours et la même méthode de mesure.','امشِ بوتيرة مريحة على مسار آمن ومستوٍ. توقّف إذا شعرت بتوعّك. استخدم نفس المسار وطريقة قياس المسافة عند المقارنة.')}</p>
  <p>{local('Personal tracking on this browser. Your results stay outside TOP1 rankings.','Suivi personnel dans ce navigateur. Tes résultats restent en dehors du classement TOP1.','متابعة شخصية في هذا المتصفح. نتائجك خارج ترتيب TOP1.')}</p>
  <div className="journey-timer">
   <div aria-label={local('Time remaining','Temps restant','الوقت المتبقي')}><bdi>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</bdi></div>
   <button type="button" className="journey-back" onClick={()=>{setRemaining(360);setDeadline(running?0:Date.now()+duration);}}>{running?local('Cancel timer','Annuler le chrono','ألغِ المؤقت'):local('Start six-minute timer','Lancer le chrono de six minutes','ابدأ مؤقت الست دقائق')}</button>
   {remaining===0&&<p role="status">{local('Six minutes are up','Les six minutes sont écoulées','انتهت الست دقائق')}</p>}
  </div>
  <form onSubmit={event=>{event.preventDefault();save();}} className="journey-profile">
   <label>{local('Distance walked (metres)','Distance parcourue (mètres)','المسافة المقطوعة (بالمتر)')}<input inputMode="decimal" value={raw} onChange={event=>setRaw(event.target.value)}/></label>
   <button className="journey-next" disabled={running||!Number.isFinite(metres)||metres<=0||metres>2000}>{local('Save walk','Enregistrer la marche','احفظ المشي')}</button>
  </form>
  {error&&<p role="alert">{local('Browser storage is unavailable.','Le stockage du navigateur est indisponible.','التخزين في المتصفح غير متاح.')}</p>}
  {walks.length>0&&<details open><summary>{local('Recent walks','Marches récentes','جولات المشي الأخيرة')}</summary><ul>
   {walks.map((walk,index)=><li key={walk.date+index}><bdi>{number.format(walk.metres)} m</bdi> · {new Date(walk.date).toLocaleDateString(locale)}</li>)}
  </ul></details>}
  <button type="button" className="journey-back" onClick={onBack}>{local('Back to tests','Retour aux tests','العودة إلى الاختبارات')}</button>
 </div>;
}
