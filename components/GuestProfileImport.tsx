'use client';

import {useId,type ReactNode} from 'react';
import {ArrowRight, CloudUpload, ListChecks, ShieldCheck, Smartphone} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
import Modal from './Modal';
import styles from './GuestProfileImport.module.css';

const copy={
 en:{
  title:'Guest profile on this device',
  description:'Review this profile before adding it to your account.',
  review:'Review guest profile',
  count:'Measurements in the guest profile',
  priority:'Your existing account measurements and profile details take priority.'
 },
 fr:{
  title:'Profil invité sur cet appareil',
  description:'Vérifie ce profil avant de l’ajouter à ton compte.',
  review:'Vérifier le profil invité',
  count:'Mesures du profil invité',
  priority:'Les mesures et les informations déjà enregistrées dans ton compte sont prioritaires.'
 },
 ar:{
  title:'ملف ضيف على هذا الجهاز',
  description:'راجع هذا الملف قبل إضافته إلى حسابك.',
  review:'مراجعة ملف الضيف',
  count:'القياسات في ملف الضيف',
  priority:'تُعطى الأولوية للقياسات وتفاصيل الملف المحفوظة في حسابك.'
 }
};

export function GuestImportPrompt({onReview,onKeepSeparate,importing}:{
 onReview:(trigger:HTMLButtonElement)=>void;
 onKeepSeparate:()=>void;
 importing:boolean;
}){
 const {locale,t}=useTranslations();
 const titleId=useId();
 return <section className={styles.prompt} aria-labelledby={titleId}>
  <span className={styles.device}><Smartphone size={21} aria-hidden="true"/></span>
  <div className={styles.summary}>
   <h2 id={titleId}>{copy[locale].title}</h2>
   <p>{copy[locale].description}</p>
  </div>
  <div className={styles.actions}>
   <button type="button" aria-haspopup="dialog" className={styles.primary} disabled={importing} onClick={event=>onReview(event.currentTarget)}>
    {t('Review import')}<ArrowRight size={16} className={styles.arrow} aria-hidden="true"/>
   </button>
   <button type="button" className={styles.secondary} disabled={importing} onClick={onKeepSeparate}>{t('Keep separate')}</button>
  </div>
 </section>;
}

export function GuestImportReview({count,importing,error,onImport,onCancel,returnFocus,safetyAction}:{
 count:number;
 importing:boolean;
 error:string;
 onImport:()=>void;
 onCancel:()=>void;
 returnFocus?:HTMLElement|null;
 safetyAction?:ReactNode;
}){
 const {locale,t}=useTranslations();
 return <Modal title={copy[locale].review} onClose={onCancel} returnFocus={returnFocus}><div className={styles.review}>
  <dl className={styles.inventory}>
   <div>
    <dt><ListChecks size={20} aria-hidden="true"/>{copy[locale].count}</dt>
    <dd>{count.toLocaleString(locale)}</dd>
   </div>
  </dl>
  <p className={styles.priority}>{copy[locale].priority}</p>
  <p className={styles.ownership}><ShieldCheck size={19} aria-hidden="true"/>{t('Import only if this is your data. Guest measurements are removed from this browser only after a successful, verified import.')}</p>
  {error&&<p className={styles.error} role="alert">{t(error)}</p>}
  <div className={styles.actions}>
   <button type="button" className={styles.primary} disabled={importing} onClick={onImport}><CloudUpload size={17} aria-hidden="true"/>{t(importing?'Importing…':'Import into my account')}</button>
   <button type="button" className={styles.secondary} onClick={onCancel}>{t('Back')}</button>
  </div>
  <span className="sr-only" role="status">{importing?t('Importing…'):''}</span>
  {safetyAction&&<div className={styles.accountAction}>{safetyAction}</div>}
 </div></Modal>;
}
