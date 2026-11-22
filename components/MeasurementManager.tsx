'use client';

import {useState, type ComponentProps} from 'react';
import {activeMetrics} from '@/lib/registry';
import {captureEvent} from '@/lib/analytics';
import {useTranslations} from './providers/LocaleProvider';
import MetricEditor from './MetricEditor';

type Editor = ComponentProps<typeof MetricEditor>;
type Props = Pick<Editor,'demographics'|'onValue'|'onDetails'|'onEvidence'|'onCalculate'|'onContextError'|'onEditingChange'|'onProfile'> & {
  values: Record<string,number|undefined>;
  details: Record<string,Editor['details']>;
  additional: boolean;
  needsSetup: boolean;
  hasErrors: boolean;
};

export default function MeasurementManager({values, details, additional, needsSetup, hasErrors, ...editor}: Props){
  const {locale,t}=useTranslations();
  const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
  const [choice,setChoice]=useState('');
  const options=activeMetrics.filter(metric=>(metric.pillar!=='strength')===additional);
  const selected=options.find(metric=>metric.id===choice);
  return <details id="measurements" className="measurement-library simplified-library measurement-manager" onToggle={event=>{if(event.currentTarget.open)captureEvent('game_library_opened');}}>
    <summary>{local('Manage saved measurements','Gérer les mesures enregistrées','إدارة القياسات المحفوظة')}</summary>
    {needsSetup?<p>{local('Record a test or create your profile to edit measurements here.','Enregistre un test ou crée ton profil pour modifier tes mesures ici.','سجّل اختبارًا أو أنشئ ملفك الشخصي لتعديل القياسات هنا.')}</p>:<>
      <label className="measurement-manager-select">{t('Measurement')}<select value={choice} onChange={event=>setChoice(event.target.value)}>
        <option value="">{local('Choose a measurement','Choisir une mesure','اختر قياسًا')}</option>
        {options.map(metric=><option key={metric.id} value={metric.id}>{t(metric.name)}</option>)}
      </select></label>
      {hasErrors&&<p className="field-error" role="alert">{local('Correct invalid values before changes can be saved.','Corrige les valeurs invalides avant l’enregistrement.','صحّح القيم غير الصالحة قبل حفظ التغييرات.')}</p>}
      {selected&&<MetricEditor key={selected.id} {...editor} dashboardCard showDetails metric={selected} value={values[selected.id]} details={details[selected.id]}/>}
    </>}
  </details>;
}
