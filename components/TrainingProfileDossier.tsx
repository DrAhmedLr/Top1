'use client';

import {Download, FileSpreadsheet, RotateCcw, Sparkles} from 'lucide-react';
import type {AthleteDossier} from '@/lib/athleteDossier';
import {normalizeTrainingContext, type PersonalWorkspace} from '@/lib/personalWorkspace';
import {useTranslations} from './providers/LocaleProvider';

type Props = {
  dossier: AthleteDossier;
  workspace: PersonalWorkspace;
  editable: boolean;
  onSaveWorkspace: (next: PersonalWorkspace) => Promise<boolean>;
  onOpenAssessment: () => void;
};

export default function TrainingProfileDossier({
  dossier,
  workspace,
  editable,
  onSaveWorkspace,
  onOpenAssessment,
}: Props) {
  const {locale} = useTranslations();
  const l = (en: string, fr: string, ar: string) => (locale === 'fr' ? fr : locale === 'ar' ? ar : en);

  function exportDossier() {
    const {effectiveAvailability: _, ...serializable} = dossier;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(serializable, null, 2)], {type: 'application/json'}),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `TOP1-training-profile-${dossier.today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function clearTemporaryOverrides() {
    if (!editable) return;
    const nextContext = normalizeTrainingContext({
      ...workspace.context,
      dayOverrides: undefined,
    });
    await onSaveWorkspace({...workspace, context: nextContext});
  }

  const measuredList = Object.values(dossier.measuredResults);

  return (
    <section className="performance-note" aria-labelledby="dossier-heading">
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap'}}>
        <h2 id="dossier-heading" style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <FileSpreadsheet size={18} aria-hidden="true" />
          {l('My training profile', 'Mon profil d’entraînement', 'ملفي التدريبي')}
        </h2>
        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          <button type="button" className="text-link" onClick={onOpenAssessment}>
            <Sparkles size={14} aria-hidden="true" />
            {l('Review assessment', 'Revoir mon bilan', 'مراجعة التقييم')}
          </button>
          <button type="button" className="text-link" onClick={exportDossier}>
            <Download size={14} aria-hidden="true" />
            {l('Export JSON', 'Exporter JSON', 'تصدير JSON')}
          </button>
        </div>
      </div>

      <p>
        {l(
          'Private dossier reconstructed for your account. Measured results, declared constraints, temporary overrides, and inferred patterns are kept separate.',
          'Dossier privé reconstruit pour ton compte. Les mesures, contraintes déclarées, ajustements temporaires et tendances inférées restent séparés.',
          'ملف خاص مُعاد بناؤه لحسابك. تُفصل النتائج المقاسة عن القيود المعلنة والتعديلات المؤقتة والأنماط المستنتجة.',
        )}
      </p>

      <dl style={{display: 'grid', gap: 8, margin: '10px 0', fontSize: '0.84rem'}}>
        <div>
          <dt style={{opacity: 0.72}}>{l('Pinned main goals (max 2)', 'Objectifs principaux épinglés (max 2)', 'الأهداف الرئيسية المثبّتة (بحد أقصى 2)')}</dt>
          <dd style={{margin: 0, fontWeight: 600}}>
            {dossier.pinnedMetrics.length ? dossier.pinnedMetrics.join(' · ') : l('None pinned yet', 'Aucun objectif épinglé', 'لا يوجد هدف مثبّت بعد')}
          </dd>
        </div>
        <div>
          <dt style={{opacity: 0.72}}>{l('Measured results', 'Résultats mesurés', 'النتائج المقاسة')}</dt>
          <dd style={{margin: 0, fontWeight: 600}}>
            {measuredList.length
              ? measuredList.slice(0, 4).map(r => `${r.metricId}: ${r.value} ${r.unit ?? ''} (${r.freshness})`).join(' · ')
              : l('None recorded yet', 'Aucun résultat enregistré', 'لا توجد نتائج مسجّلة بعد')}
          </dd>
        </div>
        <div>
          <dt style={{opacity: 0.72}}>{l('Standing availability & equipment', 'Disponibilités et matériel', 'التفرغ والمعدات')}</dt>
          <dd style={{margin: 0, fontWeight: 600}}>
            {dossier.constraints.weeklyDays.value} {l('days/wk', 'j/sem', 'أيام/أسبوع')} ·{' '}
            {dossier.constraints.defaultMinutes.value} {l('min', 'min', 'د')} ({dossier.constraints.defaultMinutes.source}) ·{' '}
            {dossier.constraints.equipment.value.length ? dossier.constraints.equipment.value.join(', ') : l('unspecified', 'non précisé', 'غير محدد')}
          </dd>
        </div>
        <div>
          <dt style={{opacity: 0.72}}>{l('Temporary state (expiring)', 'État temporaire (avec expiration)', 'الحالة المؤقتة (تنتهي صلاحيتها)')}</dt>
          <dd style={{margin: 0, fontWeight: 600}}>
            {dossier.temporaryState.activeOverrides.length
              ? dossier.temporaryState.activeOverrides
                  .map(o => `${o.date}${o.minutes ? ` · ${o.minutes} min` : ''}${o.discomfort ? ` · ${o.discomfort.severity}` : ''} (exp. ${o.expiresOn})`)
                  .join(' | ')
              : l('None active today', 'Aucun ajustement temporaire actif', 'لا توجد تعديلات مؤقتة نشطة')}
          </dd>
        </div>
        <div>
          <dt style={{opacity: 0.72}}>{l('Stored coaching decisions', 'Décisions du coach enregistrées', 'قرارات المدرب المحفوظة')}</dt>
          <dd style={{margin: 0, fontWeight: 600}}>
            {dossier.decisionHistory.length} · {l('Ledger attendance', 'Assiduité du journal', 'الالتزام المسجل')}:{' '}
            {dossier.trainingLedger.attendanceRate !== null
              ? `${Math.round(dossier.trainingLedger.attendanceRate * 100)}% (${dossier.trainingLedger.completed + dossier.trainingLedger.modified}/${dossier.trainingLedger.totalLogged})`
              : l('No sessions logged yet', 'Aucune séance consignée', 'لم تُسجّل جلسات بعد')}
          </dd>
        </div>
      </dl>

      {dossier.temporaryState.activeOverrides.length > 0 && (
        <button
          type="button"
          className="text-link"
          disabled={!editable}
          onClick={() => void clearTemporaryOverrides()}
        >
          <RotateCcw size={14} aria-hidden="true" />
          {l('Clear temporary overrides', 'Effacer les ajustements temporaires', 'مسح التعديلات المؤقتة')}
        </button>
      )}
    </section>
  );
}
