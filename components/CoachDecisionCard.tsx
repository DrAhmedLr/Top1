'use client';

import {useState} from 'react';
import {AlertTriangle, Clock, RotateCcw, SlidersHorizontal, Sparkles} from 'lucide-react';
import {
  applyDayAvailabilityOverride,
  applyWeekdayMinutesRule,
  selectNextSessionDecision,
  toStoredDecision,
  undoCoachAdjustment,
  weekdayLabel,
  type CoachDecision,
} from '@/lib/coachDecision';
import {
  buildAthleteDossier,
  isoWeekdayForDay,
  type AthleteDossier,
} from '@/lib/athleteDossier';
import type {AdaptivePlan} from '@/lib/adaptiveProgram';
import type {DatedProgram} from '@/lib/datedProgram';
import type {
  DiscomfortSeverity,
  EquipmentOption,
  PersonalWorkspace,
} from '@/lib/personalWorkspace';
import {useTranslations} from './providers/LocaleProvider';
import s from './AdaptiveProgram.module.css';

type Props = {
  decision: CoachDecision;
  dossier: AthleteDossier;
  plan: AdaptivePlan;
  calendar?: DatedProgram;
  allPlans?: AdaptivePlan[];
  workspace: PersonalWorkspace;
  editable: boolean;
  onSaveWorkspace: (next: PersonalWorkspace) => Promise<boolean>;
  compact?: boolean;
};

export default function CoachDecisionCard({
  decision,
  dossier,
  plan,
  calendar,
  allPlans,
  workspace,
  editable,
  onSaveWorkspace,
  compact = false,
}: Props) {
  const {locale} = useTranslations();
  const l = (en: string, fr: string, ar: string) =>
    locale === 'fr' ? fr : locale === 'ar' ? ar : en;
  const idx = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  const numbers = new Intl.NumberFormat(locale, {maximumFractionDigits: 2});

  const [openAdjust, setOpenAdjust] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('20');
  const [followUpMinutes, setFollowUpMinutes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const wdName = weekdayLabel(decision.targetDay, locale);
  const adapted = decision.action !== 'keep' && decision.action !== 'retest';
  const storedHistory = dossier.decisionHistory.filter(
    item => item.metric === plan.config.metric,
  );

  function recomputeFor(nextWorkspace: PersonalWorkspace, at: Date): CoachDecision {
    const nextDossier = buildAthleteDossier({
      owner: dossier.identity.owner,
      workspace: nextWorkspace,
      trainingEvents: allPlans?.flatMap(p => [p.event, ...p.sessions]) ?? [plan.event, ...plan.sessions],
      asOf: at,
      timeZone: dossier.identity.timeZone,
    });
    return selectNextSessionDecision(nextDossier, {
      plan,
      targetDay: decision.targetDay,
      calendar,
      allPlans,
    });
  }

  async function applyTodayMinutes(minutes: number) {
    if (!editable || saving) return;
    setSaving(true);
    setError('');
    try {
      const now = new Date();
      const draft = applyDayAvailabilityOverride(workspace, {
        date: decision.targetDay,
        minutes,
        reason: `${minutes} min available on ${decision.targetDay}`,
        now,
      });
      const nextDecision = recomputeFor(draft, now);
      const nextWorkspace = applyDayAvailabilityOverride(workspace, {
        date: decision.targetDay,
        minutes,
        reason: `${minutes} min available on ${decision.targetDay}`,
        now,
        decision: toStoredDecision(nextDecision, locale),
      });
      const ok = await onSaveWorkspace(nextWorkspace);
      if (ok) {
        setFollowUpMinutes(minutes < decision.scheduled.slotMinutes ? minutes : null);
        setOpenAdjust(false);
      } else {
        setError(l('Could not save adjustment.', 'Impossible d’enregistrer l’ajustement.', 'تعذّر حفظ التعديل.'));
      }
    } catch {
      setError(l('Enter 5 to 240 minutes.', 'Indique entre 5 et 240 minutes.', 'أدخل بين 5 و240 دقيقة.'));
    } finally {
      setSaving(false);
    }
  }

  async function confirmRecurringWeekday(minutes: number) {
    if (!editable || saving) return;
    setSaving(true);
    setError('');
    try {
      const now = new Date();
      const weekday = isoWeekdayForDay(decision.targetDay);
      const draft = applyWeekdayMinutesRule(workspace, {
        weekday,
        minutes,
        clearDateOverride: decision.targetDay,
      });
      const nextDecision = recomputeFor(draft, now);
      const nextWorkspace = applyWeekdayMinutesRule(workspace, {
        weekday,
        minutes,
        clearDateOverride: decision.targetDay,
        decision: toStoredDecision(nextDecision, locale),
      });
      const ok = await onSaveWorkspace(nextWorkspace);
      if (ok) {
        setFollowUpMinutes(null);
      } else {
        setError(l('Could not save weekday rule.', 'Impossible d’enregistrer la règle hebdomadaire.', 'تعذّر حفظ قاعدة اليوم.'));
      }
    } finally {
      setSaving(false);
    }
  }

  async function applyEquipmentToday(equipment: EquipmentOption[], reason: string) {
    if (!editable || saving) return;
    setSaving(true);
    setError('');
    try {
      const now = new Date();
      const draft = applyDayAvailabilityOverride(workspace, {
        date: decision.targetDay,
        equipment,
        reason,
        now,
      });
      const nextDecision = recomputeFor(draft, now);
      const nextWorkspace = applyDayAvailabilityOverride(workspace, {
        date: decision.targetDay,
        equipment,
        reason,
        now,
        decision: toStoredDecision(nextDecision, locale),
      });
      const ok = await onSaveWorkspace(nextWorkspace);
      if (ok) {
        setFollowUpMinutes(null);
        setOpenAdjust(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function applyDiscomfortToday(severity: DiscomfortSeverity) {
    if (!editable || saving) return;
    setSaving(true);
    setError('');
    try {
      const now = new Date();
      const reason =
        severity === 'concerning'
          ? 'Concerning discomfort reported'
          : 'Mild discomfort reported';
      const draft = applyDayAvailabilityOverride(workspace, {
        date: decision.targetDay,
        discomfort: {severity},
        reason,
        now,
      });
      const nextDecision = recomputeFor(draft, now);
      const nextWorkspace = applyDayAvailabilityOverride(workspace, {
        date: decision.targetDay,
        discomfort: {severity},
        reason,
        now,
        decision: toStoredDecision(nextDecision, locale),
      });
      const ok = await onSaveWorkspace(nextWorkspace);
      if (ok) {
        setFollowUpMinutes(null);
        setOpenAdjust(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUndo() {
    if (!editable || saving) return;
    setSaving(true);
    setError('');
    try {
      const scope = decision.scope === 'weekday' ? 'weekday' : 'today';
      const nextWorkspace = undoCoachAdjustment(workspace, {
        day: decision.targetDay,
        scope,
        decisionId: decision.id,
      });
      const ok = await onSaveWorkspace(nextWorkspace);
      if (ok) setFollowUpMinutes(null);
    } finally {
      setSaving(false);
    }
  }

  const doseSummary = (item: NonNullable<CoachDecision['recommended']>) => (
    <>
      <bdi>
        {numbers.format(item.sets)} × {numbers.format(item.amount)}{' '}
        {item.mode === 'seconds' ? l('s', 's', 'ث') : l('reps', 'rép.', 'تكرارات')}
        {item.loadKg > 0 ? ` · ${numbers.format(item.loadKg)} kg` : ''}
      </bdi>{' '}
      · {numbers.format(item.totalMinutes)} {l('min', 'min', 'د')}
    </>
  );

  const scopeBadge =
    decision.scope === 'today'
      ? l('Today only', 'Aujourd’hui seulement', 'اليوم فقط')
      : decision.scope === 'weekday'
        ? l(`Every ${wdName}`, `Chaque ${wdName}`, `كل ${wdName}`)
        : null;

  const adjusterControls = (
    <div className={compact ? 'th-coach-adjust' : s.coachAdjust}>
      <div className={compact ? 'th-coach-presets' : s.coachPresets}>
        {[20, 15, 10].map(mins => (
          <button
            key={mins}
            type="button"
            disabled={!editable || saving}
            className={compact ? 'th-chip' : s.choice}
            onClick={() => void applyTodayMinutes(mins)}
          >
            <Clock size={14} aria-hidden="true" />
            {numbers.format(mins)} {l('min', 'min', 'د')}
          </button>
        ))}
        <button
          type="button"
          disabled={!editable || saving}
          className={compact ? 'th-chip' : s.choice}
          onClick={() => void applyEquipmentToday(['none'], 'Bodyweight only today')}
        >
          {l('No barbell today', 'Pas de barre aujourd’hui', 'لا يوجد بار اليوم')}
        </button>
        <button
          type="button"
          disabled={!editable || saving}
          className={compact ? 'th-chip' : s.choice}
          onClick={() => void applyDiscomfortToday('mild')}
        >
          {l('Mild discomfort', 'Gêne légère', 'انزعاج خفيف')}
        </button>
        <button
          type="button"
          disabled={!editable || saving}
          className={compact ? 'th-chip' : s.choice}
          onClick={() => void applyDiscomfortToday('concerning')}
        >
          {l('Pain / stop', 'Douleur / pause', 'ألم / إيقاف')}
        </button>
      </div>
      <div className={compact ? 'th-coach-custom' : s.coachCustom}>
        <label>
          <span>{l('Minutes available', 'Minutes disponibles', 'الدقائق المتاحة')}</span>
          <input
            type="number"
            min={5}
            max={240}
            step={5}
            value={customMinutes}
            onChange={e => setCustomMinutes(e.target.value)}
            aria-label={l('Minutes available', 'Minutes disponibles', 'الدقائق المتاحة')}
          />
        </label>
        <button
          type="button"
          disabled={!editable || saving}
          className={compact ? 'th-chip th-chip-primary' : s.primary}
          onClick={() => {
            const n = Math.round(Number(customMinutes));
            if (Number.isInteger(n) && n >= 5 && n <= 240) void applyTodayMinutes(n);
            else setError(l('Enter 5 to 240 minutes.', 'Indique entre 5 et 240 minutes.', 'أدخل بين 5 و240 دقيقة.'));
          }}
        >
          {l('Adapt session', 'Adapter la séance', 'تعديل الحصة')}
        </button>
      </div>
    </div>
  );

  const followUpBanner = followUpMinutes !== null && decision.scope === 'today' && (
    <div className={compact ? 'th-coach-followup' : s.coachFollowUp} role="region" aria-label={l('Schedule follow-up', 'Question de suivi', 'سؤال متابعة')}>
      <p>
        {l(
          `Just today, or are ${wdName}s usually ${followUpMinutes} min?`,
          `Juste aujourd’hui, ou les ${wdName}s durent-ils habituellement ${followUpMinutes} min ?`,
          `اليوم فقط، أم أن أيام ${wdName} عادةً ما تكون ${followUpMinutes} دقيقة؟`,
        )}
      </p>
      <div className={compact ? 'th-coach-presets' : s.coachPresets}>
        <button
          type="button"
          className={compact ? 'th-chip th-chip-primary' : s.choice}
          aria-pressed={true}
          disabled={saving}
          onClick={() => setFollowUpMinutes(null)}
        >
          {l('Just today', 'Juste aujourd’hui', 'اليوم فقط')}
        </button>
        <button
          type="button"
          className={compact ? 'th-chip' : s.choice}
          disabled={!editable || saving}
          onClick={() => void confirmRecurringWeekday(followUpMinutes)}
        >
          {l(`Every ${wdName}`, `Chaque ${wdName}`, `كل ${wdName}`)}
        </button>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="th-coach-block" data-adapted={adapted}>
        {adapted && (
          <p className="th-coach-reason">
            <Sparkles size={13} aria-hidden="true" />
            <span>
              {scopeBadge && <b className="th-coach-badge">{scopeBadge}</b>}{' '}
              {decision.athleteSentence[idx]}
            </span>
          </p>
        )}
        {decision.clinicalNotice && (
          <p className="th-coach-alert" role="alert">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{decision.clinicalNotice[idx]}</span>
          </p>
        )}
        <div className="th-coach-controls">
          <button
            type="button"
            className="th-text-action"
            aria-expanded={openAdjust}
            disabled={!editable || saving}
            onClick={() => setOpenAdjust(v => !v)}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            {openAdjust
              ? l('Close', 'Fermer', 'إغلاق')
              : l('Short on time or state changed?', 'Moins de temps aujourd’hui ?', 'وقتك أقصر اليوم؟')}
          </button>
          {adapted && decision.delegation.canUndo && (
            <button
              type="button"
              className="th-text-action"
              disabled={!editable || saving}
              onClick={() => void handleUndo()}
            >
              <RotateCcw size={13} aria-hidden="true" />
              {l('Undo', 'Annuler', 'تراجع')}
            </button>
          )}
        </div>
        {openAdjust && adjusterControls}
        {followUpBanner}
        {error && <p role="alert" className="th-coach-error">{error}</p>}
      </div>
    );
  }

  return (
    <section className={s.card} aria-labelledby="coach-decision-heading" data-coach-action={decision.action}>
      <div className={s.heading}>
        <Sparkles size={20} aria-hidden="true" />
        <h2 id="coach-decision-heading">
          {adapted
            ? l('Adapted next session', 'Prochaine séance adaptée', 'الحصة القادمة المعدّلة')
            : l('Next session', 'Prochaine séance', 'الحصة القادمة')}
        </h2>
        {scopeBadge && <span className={s.coachBadge}>{scopeBadge}</span>}
      </div>

      {decision.recommended ? (
        <div className={s.coachSummary}>
          <strong>{decision.recommended.exercise[idx]}</strong>
          <span className={s.coachDose}>{doseSummary(decision.recommended)}</span>
          <small>
            {l('Warm-up', 'Échauffement', 'إحماء')} {numbers.format(decision.recommended.warmupMinutes)} {l('min', 'min', 'د')} ·{' '}
            {l('Setup', 'Installation', 'تجهيز')} {numbers.format(decision.recommended.transitionMinutes)} {l('min', 'min', 'د')} ·{' '}
            {l('Rest', 'Repos', 'راحة')} {numbers.format(decision.recommended.restSeconds)} {l('s', 's', 'ث')} ·{' '}
            {l('Cool-down', 'Retour au calme', 'تهدئة')} {numbers.format(decision.recommended.cooldownMinutes)} {l('min', 'min', 'د')}
          </small>
        </div>
      ) : (
        <div className={s.coachSummary}>
          <strong>{l('Rest / hold session', 'Repos / séance en pause', 'راحة / إيقاف مؤقت')}</strong>
        </div>
      )}

      {adapted && (
        <p className={s.coachBefore}>
          {l('Original plan', 'Plan initial', 'الخطة الأصلية')}: {decision.scheduled.exercise[idx]} ·{' '}
          <bdi>
            {numbers.format(decision.scheduled.sets)} × {numbers.format(decision.scheduled.amount)}{' '}
            {decision.scheduled.mode === 'seconds' ? l('s', 's', 'ث') : l('reps', 'rép.', 'تكرارات')}
            {decision.scheduled.loadKg > 0 ? ` · ${numbers.format(decision.scheduled.loadKg)} kg` : ''}
          </bdi>{' '}
          · {numbers.format(decision.scheduled.slotMinutes)} {l('min', 'min', 'د')}
        </p>
      )}

      <p className={s.coachSentence}>{decision.athleteSentence[idx]}</p>

      {decision.clinicalNotice && (
        <div className={s.coachAlert} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <p>{decision.clinicalNotice[idx]}</p>
        </div>
      )}

      <div className={s.actions}>
        <button
          type="button"
          className={s.secondary}
          aria-expanded={openAdjust}
          disabled={!editable || saving}
          onClick={() => setOpenAdjust(v => !v)}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          {openAdjust
            ? l('Hide adjustments', 'Masquer les ajustements', 'إخفاء التعديلات')
            : l('Change time or state', 'Ajuster le temps ou l’état', 'تعديل الوقت أو الحالة')}
        </button>
        {adapted && decision.delegation.canUndo && (
          <button
            type="button"
            className={s.link}
            disabled={!editable || saving}
            onClick={() => void handleUndo()}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {l('Undo adjustment', 'Annuler l’ajustement', 'تراجع عن التعديل')}
          </button>
        )}
      </div>

      {openAdjust && adjusterControls}
      {followUpBanner}
      {error && <p role="alert" className={s.error}>{error}</p>}

      {storedHistory.length > 0 && (
        <details className={s.explainer}>
          <summary>
            {l('Coaching decision history', 'Historique des ajustements', 'سجل قرارات المدرب')} ({numbers.format(storedHistory.length)})
          </summary>
          <ol className={s.journal}>
            {storedHistory.slice().reverse().map(entry => (
              <li key={entry.id + entry.decidedAt}>
                <div>
                  <strong>{entry.day} · {entry.action}</strong>
                  <b>{entry.undoneAt ? l('Undone', 'Annulé', 'تم التراجع') : entry.scope}</b>
                </div>
                <small>{entry.triggerInput}</small>
                <span>{entry.summary}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
