'use client';

import {useEffect,useState} from 'react';
import {balancedBaseline,baselineChallenge,baselineStorageKey,baselineTests,BASELINE_VERSION,readBaselineSelection,type BaselineArea,type BaselineSelection} from '@/lib/balancedBaseline';
import {activeMetrics,type Demographics,type Values} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import {useTranslations} from './providers/LocaleProvider';

export default function BaselineProfile({values,details,demographics,owner,ready,onTest,onGuide}:{values:Values;details:MeasurementMetadata;demographics:Demographics;owner:string;ready:boolean;onTest:(id:string)=>void;onGuide?:()=>void}){
 const {locale,t}=useTranslations();
 const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const key=baselineStorageKey(owner);
 const [saved,setSaved]=useState<{key:string;choices:BaselineSelection}>();
 const [storageError,setStorageError]=useState(false);
 useEffect(()=>{
  function refresh(){try{setSaved({key,choices:readBaselineSelection(localStorage.getItem(key))});setStorageError(false);}
  catch{setSaved({key,choices:{}});setStorageError(true);}}
  refresh();window.addEventListener('top1-baseline-updated',refresh);return()=>window.removeEventListener('top1-baseline-updated',refresh);
 },[key]);
 const choices=saved?.key===key?saved.choices:{};
 const baseline=balancedBaseline(values,details,choices);
 const areaNames={push:local('Pushing','Poussée','الدفع'),pull:local('Pulling','Tirage','السحب'),lower:local('Lower body','Bas du corps','الجزء السفلي'),endurance:local('Endurance','Endurance','التحمّل')};
 function select(area:BaselineArea,id:string){
  if(!ready||saved?.key!==key||!baselineChallenge(id,values,details,demographics.sex))return;
  const next={...choices,[area]:{test:id,sex:demographics.sex}};
  try{localStorage.setItem(key,JSON.stringify({version:BASELINE_VERSION,choices:next}));setSaved({key,choices:next});setStorageError(false);}
  catch{setStorageError(true);}
 }
 function download(){
  if(!baseline.overall)return;
  const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const label=local('TOP1 overall challenge level','Niveau global du défi TOP1','مستوى تحدي TOP1 الإجمالي');
  const rows=baseline.areas.map(({area,challenge},index)=>`<text x="32" y="${200+index*38}">${escape(areaNames[area])}</text><text x="448" y="${200+index*38}" text-anchor="end">${escape(challenge!.tier)}</text>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 398" width="480" height="398"><rect width="480" height="398" rx="24" fill="#111827"/><g font-family="Arial" fill="#f3f4f6"><text x="32" y="55" font-size="32" font-weight="bold">TOP1</text><text x="32" y="97" font-size="17">${escape(label)}</text><text x="32" y="150" font-size="42" font-weight="bold">${escape(baseline.overall.tier)}</text>${rows}<text x="32" y="370" font-size="13" fill="#9ca3af">${BASELINE_VERSION}</text></g></svg>`;
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  const link=document.createElement('a');link.href=url;link.download='TOP1-baseline.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="performance-note" aria-labelledby="balanced-baseline-title">
  <h2 id="balanced-baseline-title">{local('Your balanced baseline','Ton profil équilibré','ملف أدائك المتوازن')}</h2>
  {onGuide&&<button className="text-link shell-action" onClick={onGuide}>{local('Set up my baseline','Préparer mon profil de départ','إعداد ملف أدائي')}</button>}
  <p role="status">{local(`${baseline.coverage} of 4 areas ready`,`${baseline.coverage} domaines sur 4 prêts`,`${baseline.coverage} من 4 مجالات جاهزة`)}</p>
  {baseline.overall?<><p><strong>{local('TOP1 overall challenge level','Niveau global du défi TOP1','مستوى تحدي TOP1 الإجمالي')} · <bdi>{baseline.overall.tier}</bdi></strong></p><p>{local('Limiting areas','Domaines qui fixent le niveau','المجالات التي تحدد المستوى')} · {baseline.overall.limitingAreas.map(area=>areaNames[area]).join(' · ')}</p><button className="text-link" onClick={download}>{local('Download baseline summary','Télécharger le résumé','تنزيل ملخص الأداء')}</button></>:<p>{local('Choose one dated, protocol-matched result per area to see your overall challenge level.','Choisis un résultat daté et documenté par domaine pour voir ton niveau global.','اختر نتيجة مؤرخة وموثقة لكل مجال لعرض مستواك الإجمالي.')}</p>}
  <p>{local('Your baseline choices are saved in this browser.','Tes choix sont enregistrés dans ce navigateur.','تُحفظ اختياراتك في هذا المتصفح.')}</p>
  <div className="performance-grid">{baseline.areas.map(({area,choice,challenge})=><article key={area} className="performance-result">
   <h3>{areaNames[area]}</h3>
   {challenge&&<p><bdi>{challenge.tier}</bdi> · {local('TOP1 challenge','Défi TOP1','تحدي TOP1')}</p>}
   {baselineTests[area].map(id=>{
    const name=t(activeMetrics.find(metric=>metric.id===id)!.name);
    const available=baselineChallenge(id,values,details,demographics.sex);
    const selected=choice?.test===id;
    return <div key={id} style={{display:'block'}}>
     <span>{name}{selected&&challenge?` · ${local('Selected','Sélectionné','مختار')}`:''}</span><br/>
     {available&&(!selected||!challenge)?<button className="text-link" aria-label={`${local('Use result','Utiliser le résultat','استخدم النتيجة')} · ${name}`} disabled={!ready||saved?.key!==key} onClick={()=>select(area,id)}>{local('Use result','Utiliser le résultat','استخدم النتيجة')}</button>:<button className="text-link" aria-label={`${local('Record or review','Saisir ou vérifier','سجّل أو راجع')} · ${name}`} disabled={!ready} onClick={()=>onTest(id)}>{local('Record or review','Saisir ou vérifier','سجّل أو راجع')}</button>}
    </div>;
   })}
  </article>)}</div>
  {storageError&&<p role="alert">{local('This browser could not save your baseline choices.','Ce navigateur n’a pas pu enregistrer tes choix.','تعذّر على هذا المتصفح حفظ اختياراتك.')}</p>}
 </section>;
}
