'use client';
import {useTranslations} from './providers/LocaleProvider';
import {useUsageSettings} from './providers/UsageAnalyticsProvider';

export default function UsageAnalyticsSettings() {
  const state=useUsageSettings(), {locale}=useTranslations();
  const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
  if (!state?.signedIn) return null;
  return <><section className="card">
    <h2>{local('Usage analytics','Statistiques d’utilisation','إحصاءات الاستخدام')}</h2>
    <p>{local('Share daily counts of screens opened and actions taken with the TOP1 team. Turning this off deletes the usage counts linked to your account.','Partage avec l’équipe TOP1 le nombre quotidien d’écrans ouverts et d’actions effectuées. La désactivation efface les compteurs associés à ton compte.','شارك مع فريق TOP1 أعداد الشاشات التي فتحتها والإجراءات التي اتخذتها يوميًا. يؤدي إيقاف المشاركة إلى حذف الإحصاءات المرتبطة بحسابك.')}</p>
    {state.failed ? <div role="alert"><p>{local('Unable to confirm your preference.','Impossible de vérifier ta préférence.','تعذر التحقق من تفضيلك.')}</p><button className="text-link" onClick={()=>void state.change()}>{local('Retry','Réessayer','أعد المحاولة')}</button></div> :
      <label><input type="checkbox" checked={state.enabled} disabled={state.busy} onChange={event=>void state.change(event.target.checked)}/> {local('Share usage counts','Partager mes statistiques','مشاركة إحصاءات الاستخدام')}</label>}
  </section>
  <section className="card">
    <h2>{local('Share my app journey','Partager mon parcours dans l’application','مشاركة رحلتي في التطبيق')}</h2>
    <p>{local('Let the TOP1 admin see the screens you visit, actions you take, test names and active time alongside your account email. Journey events are kept for 90 days and your connection’s IP address for 30 days. Turning this off deletes your journey and IP history.', 'Autorise l’administrateur TOP1 à voir, avec ton adresse e-mail, les écrans visités, les actions, les noms des tests et le temps actif. Le parcours est conservé 90 jours et l’adresse IP de ta connexion 30 jours. Désactiver ce partage efface ton parcours et tes adresses IP.', 'اسمح لمسؤول TOP1 برؤية الشاشات التي تزورها وإجراءاتك وأسماء الاختبارات ووقت النشاط إلى جانب بريد حسابك. تُحفظ أحداث الرحلة لمدة 90 يومًا وعنوان IP لاتصالك لمدة 30 يومًا. يؤدي إيقاف المشاركة إلى حذف سجل الرحلة وعناوين IP.')}</p>
    {state.journey.failed ? <div role="alert"><p>{local('Could not confirm your journey setting.','Impossible de vérifier ce réglage.','تعذر التحقق من إعداد مشاركة الرحلة.')}</p><button className="text-link" onClick={()=>void state.journey.change()}>{local('Retry','Réessayer','أعد المحاولة')}</button></div> :
      <label><input type="checkbox" checked={state.journey.enabled} disabled={state.journey.busy} onChange={event=>void state.journey.change(event.target.checked)}/> {local('Share my identifiable app journey','Partager mon parcours associé à mon compte','مشاركة رحلة الاستخدام المرتبطة بحسابي')}</label>}
  </section></>;
}
