'use client';
import {activeMetrics} from '@/lib/registry';
import {formatRunTime} from '@/lib/run10kReference';
import type {PersonalWorkspace} from '@/lib/personalWorkspace';
import type {WorkspaceState} from '@/lib/hooks/usePersonalWorkspace';
import {useTranslations} from './providers/LocaleProvider';
export default function WorkspaceStatus({state:s}:{state:WorkspaceState}){
 const {locale,t}=useTranslations(),l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 return <div className="workspace-status">
 {s.saved&&<p role="status">{s.owner==='guest'?l('Saved on this device.','Enregistré sur cet appareil.','تم الحفظ على هذا الجهاز.'):l('Synced to your account.','Synchronisé avec ton compte.','تمت المزامنة مع حسابك.')}</p>}
 {s.busy&&<p role="status">{l('Syncing…','Synchronisation…','جارٍ المزامنة…')}</p>}
 {s.error&&<p role="alert">{t(s.error)}</p>}
 {(s.error||s.draft)&&<button className="text-link" disabled={s.busy} onClick={()=>void s.refresh()}>{l('Load latest saved version','Charger la version enregistrée','تحميل آخر نسخة محفوظة')}</button>}
 {s.draft&&<details open><summary>{l('Unsaved changes retained on this device','Modifications conservées sur cet appareil','تغييرات غير محفوظة على هذا الجهاز')}</summary>
 <p>{l('Compare the saved version with your draft. Saving applies your edited goal or preferences and keeps the other section.','Compare les versions. Seul l’objectif ou les préférences modifiés seront remplacés.','قارن النسختين. سيُستبدل الهدف أو التفضيلات المعدلة فقط.')}</p>
 <div className="workspace-versions"><details><summary>{l('Saved version','Version enregistrée','النسخة المحفوظة')}</summary><WorkspaceSummary data={s.data}/></details><details><summary>{l('Your draft','Ton brouillon','مسودتك')}</summary><WorkspaceSummary data={s.draft.data}/></details></div>
 <button className="primary-button" disabled={s.busy||!s.ready||s.conflict&&s.revision===s.draft.revision} onClick={()=>void s.retry()}>{l('Save my changes over this version','Enregistrer mes modifications sur cette version','حفظ تغييراتي فوق هذه النسخة')}</button><button className="text-link" disabled={s.busy} onClick={s.discard}>{l('Discard my draft','Supprimer mon brouillon','حذف مسودتي')}</button></details>}
 {s.guest&&s.owner!=='guest'&&<details><summary>{l('Import a goal or preferences from this device','Importer un objectif ou des préférences de cet appareil','استيراد هدف أو تفضيلات من هذا الجهاز')}</summary><p>{l('Review before importing. This replaces the account goal and preferences; your measurements are unchanged.','Vérifie avant d’importer. Cela remplace l’objectif et les préférences du compte ; les mesures restent inchangées.','راجع البيانات قبل الاستيراد. سيُستبدل هدف الحساب وتفضيلاته دون تغيير القياسات.')}</p><WorkspaceSummary data={s.guest}/><button className="secondary-button" disabled={!s.editable} onClick={()=>void s.save(s.guest!)}>{l('Import and replace','Importer et remplacer','استيراد واستبدال')}</button></details>}
 <div className="potential-actions"><button className="text-link" onClick={s.exportData}>{l('Export goal and preferences','Exporter objectif et préférences','تصدير الهدف والتفضيلات')}</button>{s.owner!=='guest'&&<button className="text-link" disabled={s.busy||!!s.draft} onClick={()=>void s.refresh()}>{l('Refresh from account','Actualiser depuis le compte','تحديث من الحساب')}</button>}</div>
 </div>;
}

function WorkspaceSummary({data}:{data:PersonalWorkspace}){
 const {locale,t}=useTranslations(),l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en,g=data.goal,c=data.context,m=activeMetrics.find(m=>m.id===g?.metric);
 const experiences={new:l('Starting out','Débutant','مبتدئ'),under_year:l('Less than one year','Moins d’un an','أقل من سنة'),one_to_three:l('1–3 years','1 à 3 ans','من سنة إلى 3 سنوات'),over_three:l('More than 3 years','Plus de 3 ans','أكثر من 3 سنوات')};
 const equipment={none:l('Bodyweight','Poids du corps','وزن الجسم'),dumbbells:l('Dumbbells','Haltères','دمبل'),barbell:l('Barbell','Barre','بار'),machines:l('Machines','Machines','الأجهزة'),pullup_bar:l('Pull-up bar','Barre de traction','بار العقلة'),outdoor:l('Outdoor','Extérieur','الخارج')};
 return <div>{g&&m?<p>{t(m.name)} · {['run_5k','run_10k'].includes(g.metric)?formatRunTime(g.target):g.target} {m.unit} · {g.date}</p>:<p>{l('No goal saved','Aucun objectif','لا يوجد هدف')}</p>}{c.experience&&<p>{experiences[c.experience]}</p>}{(c.days||c.minutes)&&<p>{c.days??'—'} {l('days/week','jours/semaine','أيام/أسبوع')} · {c.minutes??'—'} {l('min/session','min/séance','دقيقة/جلسة')}</p>}{c.equipment?.length&&<p>{c.equipment.map(e=>equipment[e]).join(' · ')}</p>}{c.routine&&<p>{l('Routine','Routine','الروتين')}: {c.routine}</p>}{c.limitations&&<p>{l('Avoid','À éviter','تجنّب')}: {c.limitations}</p>}<p>{c.loadUnit} {c.timezone}</p></div>;
}
