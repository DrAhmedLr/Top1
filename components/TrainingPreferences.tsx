'use client';
import {useState,type FormEvent} from 'react';
import {useWorkspaceEditor} from '@/lib/hooks/useWorkspaceEditor';
import {normalizeTrainingContext,type IsoWeekday,type TrainingContext} from '@/lib/personalWorkspace';
import type {WorkspaceState} from '@/lib/hooks/usePersonalWorkspace';
import {useTranslations} from './providers/LocaleProvider';
import WorkspaceStatus from './WorkspaceStatus';
export default function TrainingPreferences({state:s}:{state:WorkspaceState}){
 const {locale}=useTranslations(),l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 return <section className="performance-note training-preferences"><h2>{l('Training preferences','Préférences d’entraînement','تفضيلات التدريب')}</h2><p>{l('Your available time and equipment guide the first session of a new program.','Ton temps disponible et ton matériel guident la première séance d’un nouveau programme.','تُقترح الجلسة الأولى للبرنامج الجديد وفق وقتك المتاح ومعداتك.')}</p>
 {s.ready&&<PreferenceForm key={s.owner} state={s}/>}
 <WorkspaceStatus state={s}/></section>;
}
function PreferenceForm({state:s}:{state:WorkspaceState}){
 const {locale}=useTranslations(),l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const c=s.data.context,[error,setError]=useState('');
 const editor=useWorkspaceEditor(s,'context',{experience:c.experience??'',equipment:c.equipment??[],days:String(c.days??''),minutes:String(c.minutes??''),routine:c.routine??'',limitations:c.limitations??'',loadUnit:c.loadUnit??'kg',timezone:c.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone}),v=editor.values;
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{const context=normalizeTrainingContext({...s.data.context,experience:f.get('experience')||undefined,equipment:f.getAll('equipment'),days:f.get('days')?Number(f.get('days')):undefined,minutes:f.get('minutes')?Number(f.get('minutes')):undefined,routine:f.get('routine'),limitations:f.get('limitations'),loadUnit:f.get('loadUnit'),timezone:f.get('timezone')});if(await s.save({...editor.data,context},editor.revision,'context'))setError('');}catch(e){setError(e instanceof Error?e.message:'Check the form.');}}
 const equipment:[NonNullable<TrainingContext['equipment']>[number],string][]=[['none',l('Bodyweight','Poids du corps','وزن الجسم')],['dumbbells',l('Dumbbells','Haltères','دمبل')],['barbell',l('Barbell','Barre','بار')],['machines',l('Gym machines','Machines','أجهزة النادي')],['pullup_bar',l('Pull-up bar','Barre de traction','بار العقلة')],['outdoor',l('Outdoor running','Course extérieure','الجري في الخارج')]];
 const weekdayRules=Object.entries(c.weekdayMinutes??{}) as [IsoWeekday,number][];
 const weekdayNames:Record<IsoWeekday,string>={
  '1':l('Monday','Lundi','الإثنين'),'2':l('Tuesday','Mardi','الثلاثاء'),'3':l('Wednesday','Mercredi','الأربعاء'),
  '4':l('Thursday','Jeudi','الخميس'),'5':l('Friday','Vendredi','الجمعة'),'6':l('Saturday','Samedi','السبت'),'7':l('Sunday','Dimanche','الأحد'),
 };
 async function clearWeekday(day:IsoWeekday){
  const next={...(c.weekdayMinutes??{})};delete next[day];
  const context=normalizeTrainingContext({...c,weekdayMinutes:Object.keys(next).length?next:undefined});
  await s.save({...s.data,context},s.revision,'context');
 }
 return <form onSubmit={submit}><fieldset disabled={!s.editable||!editor.loaded} className="potential-fields">
 {weekdayRules.length>0&&<div className="weekday-rules"><small>{l('Saved weekday time limits','Limites enregistrées par jour','حدود الوقت المحفوظة حسب اليوم')}</small>{weekdayRules.map(([day,mins])=><span key={day}>{weekdayNames[day]} · {mins} {l('min','min','د')} <button type="button" className="text-link" onClick={()=>void clearWeekday(day)}>{l('Reset','Réinitialiser','إعادة ضبط')}</button></span>)}</div>}
 <label>{l('Training experience','Expérience','خبرة التدريب')}<select name="experience" value={v.experience} onChange={e=>editor.update({...v,experience:e.target.value})}><option value="">{l('Choose later','Choisir plus tard','اختيار لاحقًا')}</option>{[['new',l('Starting out','Je débute','مبتدئ')],['under_year',l('Less than a year','Moins d’un an','أقل من سنة')],['one_to_three',l('1–3 years','1 à 3 ans','من سنة إلى 3 سنوات')],['over_three',l('More than 3 years','Plus de 3 ans','أكثر من 3 سنوات')]].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
 <div className="preference-schedule"><label>{l('Days per week','Jours par semaine','أيام أسبوعيًا')}<input name="days" type="number" min={1} max={7} step={1} value={v.days} onChange={e=>editor.update({...v,days:e.target.value})}/></label><label>{l('Minutes per session','Minutes par séance','دقائق لكل جلسة')}<input name="minutes" type="number" min={10} max={240} step={1} value={v.minutes} onChange={e=>editor.update({...v,minutes:e.target.value})}/></label></div>
 <details><summary>{l('Equipment and current routine','Matériel et routine actuelle','المعدات والروتين الحالي')}</summary><fieldset className="equipment-options"><legend>{l('Available equipment','Matériel disponible','المعدات المتاحة')}</legend>{equipment.map(([v,label])=><label key={v}><input type="checkbox" name="equipment" value={v} checked={editor.values.equipment.includes(v)} onChange={e=>editor.update({...editor.values,equipment:e.target.checked?[...editor.values.equipment,v]:editor.values.equipment.filter(item=>item!==v)})}/>{label}</label>)}</fieldset>
 <label>{l('What do you currently do?','Quelle est ta routine actuelle ?','ما روتينك الحالي؟')}<textarea name="routine" maxLength={300} rows={3} value={v.routine} onChange={e=>editor.update({...v,routine:e.target.value})}/></label>
 <label>{l('Movements or activities to avoid','Mouvements ou activités à éviter','حركات أو أنشطة يجب تجنبها')}<textarea name="limitations" maxLength={300} rows={2} value={v.limitations} onChange={e=>editor.update({...v,limitations:e.target.value})}/><small>{l('Optional. Share only what you want stored in your private profile.','Facultatif. Indique seulement ce que tu souhaites conserver dans ton profil privé.','اختياري. شارك فقط ما تريد حفظه في ملفك الخاص.')}</small></label></details>
 <details><summary>{l('Units and time zone','Unités et fuseau horaire','الوحدات والمنطقة الزمنية')}</summary><label>{l('Preferred lifting unit','Unité pour les charges','وحدة أوزان التدريب')}<select name="loadUnit" value={v.loadUnit} onChange={e=>editor.update({...v,loadUnit:e.target.value as 'kg'|'lb'})}><option value="kg">kg</option><option value="lb">lb</option></select></label><label>{l('Time zone','Fuseau horaire','المنطقة الزمنية')}<input name="timezone" maxLength={80} placeholder="Africa/Casablanca" value={v.timezone} onChange={e=>editor.update({...v,timezone:e.target.value})}/></label></details>
 <button className="primary-button" type="submit">{l('Save preferences','Enregistrer mes préférences','حفظ التفضيلات')}</button></fieldset>{error&&<p role="alert">{error}</p>}{editor.error&&<p role="alert">{editor.error}</p>}{editor.dirty&&<button type="button" className="text-link" onClick={editor.clear}>{l('Discard form changes','Annuler les modifications','إلغاء تغييرات النموذج')}</button>}</form>;
}
