'use client';
import {Settings2} from 'lucide-react';
import {shortcutActions,type HomeChoice} from '@/lib/homeShortcut';
import {performanceOrder} from '@/lib/performanceCatalog';
import {useTranslations} from './providers/LocaleProvider';

export default function HomePreferences({choice,onChange,error}:{choice:HomeChoice;onChange:(patch:Partial<HomeChoice>)=>void;error?:boolean}) {
  const {locale,t}=useTranslations();
  const i=locale==='fr'?1:locale==='ar'?2:0;
  const labels={auto:['Last used action','Dernière action utilisée','آخر إجراء مستخدم'],log:['Record a result','Saisir un résultat','تسجيل نتيجة'],
    program:['Open my program','Ouvrir mon programme','فتح برنامجي'],rank:['Check my ranking','Voir mon classement','عرض ترتيبي'],history:['See history','Consulter mon historique','عرض سجلي']};
  return <section className="card home-preferences"><h2><Settings2 size={18}/> {['My home shortcut','Mon raccourci d’accueil','اختصار الرئيسية'][i]}</h2>
    <label>{['Action on this device','Action sur cet appareil','الإجراء على هذا الجهاز'][i]}<select value={choice.mode} onChange={e=>onChange({mode:e.target.value as HomeChoice['mode']})}>
      {(['auto',...shortcutActions] as const).map(key=><option key={key} value={key}>{labels[key][i]}</option>)}</select></label>
    {choice.mode!=='program'&&<label>{['Preferred measurement','Mesure favorite','القياس المفضل'][i]}<select value={choice.metric??''} onChange={e=>onChange({metric:e.target.value||undefined})}>
      <option value="">{['All measurements','Toutes les mesures','كل القياسات'][i]}</option>
      {performanceOrder.map(m=><option value={m.id} key={m.id}>{t(m.name)}</option>)}</select></label>}
    {error&&<p role="status">{['This preference is available for this visit.','Ce choix est disponible pour cette visite.','هذا الخيار متاح لهذه الزيارة.'][i]}</p>}
  </section>;
}
