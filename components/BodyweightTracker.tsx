'use client';

import {useEffect,useRef,useState} from 'react';
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import {formatWeight,fromKg,localWeightDate,parseWeight,weightMutation,type WeightEvent,type WeightUnit} from '@/lib/bodyweight';
import type {BodyweightState} from '@/lib/hooks/useBodyweight';
import {useTranslations} from './providers/LocaleProvider';

export default function BodyweightTracker({state,profileWeight,onUseCurrent,onSettings}:{state:BodyweightState;profileWeight?:number;onUseCurrent?: (kg:number)=>void;onSettings:()=>void}){
 const {locale,t}=useTranslations();
 const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const [editing,setEditing]=useState<WeightEvent>(),[value,setValue]=useState(''),[unit,setUnit]=useState<WeightUnit>('kg'),[displayUnit,setDisplayUnit]=useState<WeightUnit>('kg'),[date,setDate]=useState(()=>localWeightDate());
 const [formError,setFormError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[importConfirmed,setImportConfirmed]=useState(false);
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{setEditing(undefined);setValue('');setDate(localWeightDate());setFormError('');setNotice('');},[state.owner]);
 const latest=state.page.latest[0],prior=state.page.latest[1];
 const difference=latest&&prior&&latest.measuredAt!==prior.measuredAt?fromKg(latest.kg-prior.kg,displayUnit):null;
 const shown=(row:WeightEvent)=>formatWeight(fromKg(row.kg,displayUnit),displayUnit,locale);
 const waiting=state.pending.length>0;
 const rows=state.page.entries;
 const plotted=rows.filter(row=>!row.deleted).slice().reverse().map(row=>({time:Date.parse(row.measuredAt),value:fromKg(row.kg,displayUnit)}));
 function changeUnit(next:WeightUnit){
  try{if(value.trim())setValue(String(Number(fromKg(parseWeight(value,unit).kg,next).toFixed(6))));}catch{/* Keep unfinished input visible. */}
  setUnit(next);
 }
 function exportCopy(){try{state.exportBrowser();}catch(reason){setFormError(reason instanceof Error?reason.message:'Unable to export browser weights.');}}
 function edit(row:WeightEvent){
  setEditing(row);setValue(String(row.value));setUnit(row.unit);setDate(localWeightDate(new Date(row.measuredAt)));setFormError('');setNotice('');requestAnimationFrame(()=>{input.current?.scrollIntoView({block:'center',behavior:'instant'});input.current?.focus();});
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();setFormError('');setNotice('');setSaving(true);
  try{
   const parsed=parseWeight(value,unit);
   const mutation=weightMutation({id:editing?.id??crypto.randomUUID(),requestId:crypto.randomUUID(),expectedRevision:editing?.revision??0,action:'save',value:parsed.value,unit,measuredAt:date?new Date(date).toISOString():undefined,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone});
   const done=await state.mutate(mutation);
   if(done){setEditing(undefined);setValue('');setDate(localWeightDate());setNotice(local('Weight recorded.','Poids enregistré.','تم تسجيل الوزن.'));}
   else setNotice(local('Change saved in this browser, awaiting account sync.','Modification conservée ici, en attente de synchronisation.','حُفظ التغيير في المتصفح بانتظار المزامنة مع الحساب.'));
  }catch(reason){setFormError(reason instanceof Error?reason.message:'Unable to record weight.');}
  finally{setSaving(false);}
 }
 async function action(row:WeightEvent,kind:'delete'|'restore'){
  setNotice('');setFormError('');setSaving(true);
  try{
   const done=await state.mutate({id:row.id,requestId:crypto.randomUUID(),expectedRevision:row.revision,action:kind});
   if(done)setNotice(kind==='delete'?local('Entry removed. Show removed entries to restore it.','Entrée retirée. Affiche les entrées retirées pour la restaurer.','أُزيل السجل. اعرض السجلات المزالة لاستعادته.'):local('Entry restored.','Entrée restaurée.','تمت استعادة السجل.'));
  }catch(reason){setFormError(reason instanceof Error?reason.message:'Unable to change entry.');}
  finally{setSaving(false);}
 }
 return <section className="card bodyweight-tracker" aria-labelledby="bodyweight-heading">
  <div className="card-heading"><div><h2 id="bodyweight-heading">{local('Your bodyweight history','Ton historique de poids','سجل وزن جسمك')}</h2><p>{local('A dated record of your weigh-ins. Weight changes are context, not a fitness ranking.','Des pesées datées. Leur évolution donne du contexte, pas un classement de forme physique.','سجل مؤرخ لقياسات وزنك. التغير يوفر سياقًا ولا يمثل ترتيبًا للياقة.')}</p></div></div>
  {profileWeight!==undefined&&<p>{local('Current profile context','Contexte actuel du profil','سياق الملف الحالي')} · <bdi>{formatWeight(profileWeight,'kg',locale)}</bdi> · {local('not a dated weigh-in','ce n’est pas une pesée datée','ليس قياس وزن مؤرخًا')}</p>}
  <div className="weight-summary">
   <article><span>{local('Latest weigh-in','Dernière pesée','آخر قياس للوزن')}</span><strong><bdi>{latest?shown(latest):'—'}</bdi></strong><small>{latest?new Date(latest.measuredAt).toLocaleString(locale):local('No dated weigh-ins yet','Aucune pesée datée','لا توجد قياسات وزن مؤرخة بعد')}</small></article>
   <article><span>{local('Change since previous weigh-in','Écart avec la pesée précédente','التغير منذ القياس السابق')}</span><strong><bdi>{difference===null?'—':`${difference>0?'+':''}${formatWeight(difference,displayUnit,locale)}`}</bdi></strong><small>{prior?new Date(prior.measuredAt).toLocaleString(locale):local('Two dated weigh-ins are needed','Deux pesées datées sont nécessaires','يلزم قياسان مؤرخان')}</small></article>
  </div>
  {latest&&onUseCurrent&&<button className="text-link" onClick={()=>{onUseCurrent(latest.kg);setNotice(local('Profile context updated. Historical lift calculations are unchanged.','Contexte du profil actualisé. Les anciens calculs de force sont conservés.','تم تحديث سياق الملف. تبقى حسابات الرفع السابقة كما هي.'));}}>{local('Use latest weight as profile context','Utiliser le dernier poids pour le profil','استخدم آخر وزن كسياق للملف')}</button>}
  <form onSubmit={event=>void submit(event)} className="weight-form">
   <h3>{editing?local('Correct this entry','Corriger cette entrée','صحّح هذا السجل'):local('Record a weigh-in','Enregistrer une pesée','سجّل قياس وزن')}</h3>
   <p>{editing?local('The previous version remains in your export.','La version précédente reste dans ton export.','تبقى النسخة السابقة ضمن بيانات التصدير.'):local('Existing profile weight is never turned into past weigh-ins.','Le poids du profil ne crée jamais de pesées passées.','لا يتحول وزن الملف إلى قياسات سابقة افتراضية.')}</p>
   <fieldset disabled={!state.storageReady||saving||state.busy||waiting}><div className="weight-fields">
    <label>{local('Weight','Poids','الوزن')}<input ref={input} aria-invalid={!!formError} aria-describedby={formError?'weight-form-error':undefined} type="text" inputMode="decimal" maxLength={30} value={value} onChange={event=>setValue(event.target.value)} required/></label>
    <label>{local('Unit','Unité','الوحدة')}<select value={unit} onChange={event=>changeUnit(event.target.value as WeightUnit)}><option value="kg">kg</option><option value="lb">lb</option></select></label>
    <label>{local('When weighed','Date de la pesée','وقت قياس الوزن')}<input type="datetime-local" value={date} onChange={event=>setDate(event.currentTarget.value)} onBlur={event=>setDate(event.currentTarget.value)} required/></label>
   </div><small>{local('Times shown in','Heures affichées dans','الأوقات معروضة حسب')} <bdi>{Intl.DateTimeFormat().resolvedOptions().timeZone}</bdi></small>
   <div className="weight-actions"><button className="primary-button" type="submit" disabled={!value||!date}>{local('Save weigh-in','Enregistrer la pesée','احفظ قياس الوزن')}</button>{editing&&<button className="text-link" type="button" onClick={()=>{setEditing(undefined);setValue('');setDate(localWeightDate());}}>{local('Cancel correction','Annuler la correction','إلغاء التصحيح')}</button>}</div></fieldset>
  </form>
  {formError&&<p id="weight-form-error" role="alert" className="field-error">{t(formError)}</p>}{notice&&<p role="status">{notice}</p>}
  {state.error&&<p role="alert" className="field-error">{t(state.error)}</p>}
  {state.busy&&<p role="status">{local('Syncing weight history…','Synchronisation des pesées…','تجري مزامنة سجل الوزن…')}</p>}
  {state.owner!=='guest'&&!state.fresh&&<p>{local('Showing cached records until the account reconnects.','Les données en cache s’affichent jusqu’à la reconnexion.','تُعرض البيانات المخزنة مؤقتًا حتى إعادة الاتصال بالحساب.')}</p>}
  {waiting&&<div className="weight-pending"><p>{local('A pending change is stored for this account in this browser. Resolve it before adding another.','Une modification est en attente pour ce compte dans ce navigateur. Résous-la avant d’en ajouter une autre.','يوجد تغيير معلق لهذا الحساب في المتصفح. عالجه قبل إضافة تغيير آخر.')}</p><button className="secondary-button" disabled={state.busy} onClick={()=>void state.flush()}>{local('Retry sync','Réessayer la synchronisation','أعد محاولة المزامنة')}</button><button className="text-link" disabled={state.busy} onClick={exportCopy}>{local('Export browser copy','Exporter la copie locale','صدّر نسخة المتصفح')}</button><button className="text-link" disabled={state.busy} onClick={()=>{if(state.discardPending()){setEditing(undefined);setValue('');setDate(localWeightDate());}}}>{local('Discard pending edit and reload','Abandonner la modification et recharger','تجاهل التعديل المعلق وأعد التحميل')}</button></div>}
  {!waiting&&state.error&&state.owner!=='guest'&&<button className="secondary-button" disabled={state.busy} onClick={()=>void state.refresh()}>{local('Retry loading','Réessayer le chargement','أعد محاولة التحميل')}</button>}
  <div className="weight-history-controls"><label>{local('Display unit','Unité affichée','وحدة العرض')}<select value={displayUnit} onChange={event=>setDisplayUnit(event.target.value as WeightUnit)}><option value="kg">kg</option><option value="lb">lb</option></select></label><label><input type="checkbox" checked={state.showDeleted} onChange={event=>state.setShowDeleted(event.target.checked)}/>{local('Show removed entries','Afficher les entrées retirées','اعرض السجلات المزالة')}</label></div>
  {plotted.length>0&&<><p>{local('The chart shows loaded weigh-ins. Exact dates and values are listed below.','Le graphique montre les pesées chargées. Les dates et valeurs exactes suivent.','يعرض الرسم قياسات الوزن المحملة. ترد التواريخ والقيم الدقيقة أدناه.')}</p><div className="progress-chart" role="img" aria-label={local('Loaded dated weigh-ins; accessible table follows.','Pesées datées chargées ; tableau accessible ci-dessous.','قياسات الوزن المؤرخة المحملة، يتبعها جدول قابل للوصول.')}><ResponsiveContainer width="100%" height={220}><LineChart data={plotted}><CartesianGrid stroke="#475569"/><XAxis type="number" dataKey="time" domain={['dataMin','dataMax']} tickFormatter={n=>new Date(n).toLocaleDateString(locale)} tick={{fill:'#bdc8d6',fontSize:11}}/><YAxis domain={['auto','auto']} tick={{fill:'#bdc8d6',fontSize:11}}/><Tooltip labelFormatter={n=>new Date(Number(n)).toLocaleString(locale)} formatter={n=>formatWeight(Number(n),displayUnit,locale)}/><Line dataKey="value" stroke="#93c5fd" dot isAnimationActive={false}/></LineChart></ResponsiveContainer></div></>}
  {!rows.length&&!state.busy&&<p>{local('No entries to show. Add your first dated weigh-in above.','Aucune entrée à afficher. Ajoute ta première pesée datée ci-dessus.','لا توجد سجلات للعرض. أضف أول قياس وزن مؤرخ أعلاه.')}</p>}
  <div className="weight-table-wrap"><table><caption>{local('Loaded weigh-ins','Pesées chargées','قياسات الوزن المحملة')}</caption><thead><tr><th scope="col">{local('Measured','Mesuré','وقت القياس')}</th><th scope="col">{local('Weight','Poids','الوزن')}</th><th scope="col">{local('Actions','Actions','الإجراءات')}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><time dateTime={row.measuredAt}>{new Date(row.measuredAt).toLocaleString(locale)}</time><small>{row.timeZone} · {local('version','version','نسخة')} {row.revision}{row.deleted?` · ${local('Removed','Retiré','مزال')}`:''}</small></td><td><bdi>{shown(row)}</bdi><small>{local('Entered','Saisi','القيمة المدخلة')} <bdi>{formatWeight(row.value,row.unit,locale)}</bdi></small></td><td>{row.deleted?<button className="text-link" disabled={state.busy||saving||waiting} onClick={()=>void action(row,'restore')}>{local('Restore','Restaurer','استعد')}</button>:<><button className="text-link" disabled={state.busy||saving||waiting} onClick={()=>edit(row)}>{local('Correct','Corriger','صحّح')}</button><button className="text-link" disabled={state.busy||saving||waiting} onClick={()=>void action(row,'delete')}>{local('Remove','Retirer','أزل')}</button></>}</td></tr>)}</tbody></table></div>
  {state.page.next&&<button className="secondary-button" disabled={state.busy} onClick={()=>void state.loadOlder()}>{local('Load older weigh-ins','Charger les anciennes pesées','حمّل قياسات الوزن الأقدم')}</button>}
  {state.guestCount>0&&<section className="weight-import"><h3>{local('Weights in this browser','Pesées dans ce navigateur','قياسات الوزن في هذا المتصفح')}</h3><p>{state.guestCount} · {local('Import only if these are your weigh-ins. Account entries take priority; browser originals are retained.','Importe uniquement tes propres pesées. Les entrées du compte sont prioritaires et les originaux locaux sont conservés.','استوردها فقط إذا كانت قياساتك. تبقى الأولوية لسجلات الحساب وتُحتفظ بالأصول في المتصفح.')}</p><label><input type="checkbox" checked={importConfirmed} onChange={event=>setImportConfirmed(event.target.checked)}/>{local('These are my weigh-ins','Ce sont mes pesées','هذه قياسات وزني')}</label><button className="secondary-button" disabled={!importConfirmed||state.busy||waiting} onClick={()=>void state.importGuest().catch(reason=>setFormError(reason instanceof Error?reason.message:'Weight import failed.'))}>{local('Import browser weigh-ins','Importer les pesées locales','استورد قياسات المتصفح')}</button></section>}
  <div className="weight-actions"><button className="text-link" onClick={exportCopy}>{local('Export browser copy','Exporter la copie locale','صدّر نسخة المتصفح')}</button><button className="text-link" onClick={onSettings}>{local('Account export and privacy','Export du compte et confidentialité','تصدير الحساب والخصوصية')}</button></div>
 </section>;
}
