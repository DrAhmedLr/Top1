'use client';

import {CalendarCheck, CheckCircle2, Plus, ShieldCheck} from 'lucide-react';
import {evidenceById} from '@/lib/evidenceRegister';
import type {MaintenancePlan} from '@/lib/maintenancePlan';
import type {GoalUnit} from '@/lib/adaptiveProgram';
import {useTranslations} from './providers/LocaleProvider';
import s from './AdaptiveProgram.module.css';

type Props = {
  plan: MaintenancePlan;
  onRetest: (metric: string, unit: GoalUnit) => void;
  onOptionalNewGoal?: () => void;
  compact?: boolean;
};

export default function MaintenanceCard({plan, onRetest, onOptionalNewGoal, compact = false}: Props) {
  const {locale} = useTranslations();
  const l = (en: string, fr: string, ar: string) => (locale === 'fr' ? fr : locale === 'ar' ? ar : en);
  const idx = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  const numbers = new Intl.NumberFormat(locale, {maximumFractionDigits: 2});
  const formatDate = (day: string) =>
    new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', year: 'numeric', calendar: 'gregory', timeZone: 'UTC'})
      .format(new Date(day + 'T12:00:00Z'));

  const unit = plan.dose.mode === 'seconds' ? l('s', 's', 'ث') : l('reps', 'rép.', 'تكرارات');
  const doseText = `${numbers.format(plan.dose.sets)} × ${numbers.format(plan.dose.amount)} ${unit}${plan.dose.loadKg > 0 ? ` · ${numbers.format(plan.dose.loadKg)} kg` : ''}`;
  const sources = plan.evidenceIds.map(evidenceById).filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (compact) {
    return (
      <div className="th-session" data-maintenance="true">
        <span>
          {l('Maintenance plan', 'Plan de maintien', 'خطة الصيانة')} · {l('Achieved', 'Atteint le', 'تحقق في')}{' '}
          <time dateTime={plan.achievedOn}>{formatDate(plan.achievedOn)}</time>
        </span>
        <strong>
          {plan.exercise[idx]} · <bdi>{doseText}</bdi> · {numbers.format(plan.sessionsPerWeek)}×/
          {l('wk', 'sem.', 'أسبوع')} ({numbers.format(plan.estimatedMinutesPerSession)} {l('min', 'min', 'د')})
        </strong>
        <p className="th-coach-reason">
          <ShieldCheck size={13} aria-hidden="true" />
          <span>{plan.summary[idx]}</span>
        </p>
      </div>
    );
  }

  return (
    <section className={s.card} aria-labelledby="maintenance-heading" data-retention-status={plan.retentionStatus}>
      <div className={s.heading}>
        <CheckCircle2 size={20} aria-hidden="true" />
        <h2 id="maintenance-heading">
          {l('Maintenance plan', 'Plan de maintien', 'خطة الحفاظ على المستوى')}
        </h2>
        <span className={s.coachBadge}>
          {plan.retentionStatus === 'below-achieved'
            ? l('Retest dip · achievement preserved', 'Baisse ponctuelle · acquis conservé', 'انخفاض مؤقت · الإنجاز محفوظ')
            : plan.retentionStatus === 'retest-due'
              ? l('Maintenance check due', 'Contrôle de maintien dû', 'موعد فحص الصيانة')
              : l('Goal maintained', 'Niveau maintenu', 'المستوى محفوظ')}
        </span>
      </div>

      <div className={s.coachSummary}>
        <strong>{plan.exercise[idx]}</strong>
        <span className={s.coachDose}>
          <bdi>{doseText}</bdi> · {numbers.format(plan.sessionsPerWeek)}×/{l('week', 'semaine', 'أسبوع')} ·{' '}
          {numbers.format(plan.estimatedMinutesPerSession)} {l('min', 'min', 'د')}
        </span>
        <small>
          {l('Achieved on', 'Atteint le', 'تحقق في')} <time dateTime={plan.achievedOn}>{formatDate(plan.achievedOn)}</time> ·{' '}
          {l('Next maintenance retest', 'Prochain contrôle', 'فحص الصيانة القادم')}{' '}
          <time dateTime={plan.nextRetestDate}>{formatDate(plan.nextRetestDate)}</time>
        </small>
      </div>

      <p className={s.coachSentence}>{plan.summary[idx]}</p>

      <details className={s.explainer}>
        <summary>{l('Why this low-burden dose', 'Pourquoi cette dose légère', 'لماذا هذه الجرعة الخفيفة')}</summary>
        <p>{plan.minimumDoseNote[idx]}</p>
        {sources.map(src => (
          <p key={src.id}>
            <a href={src.url} target="_blank" rel="noreferrer">
              {src.citation} ({src.year})
            </a>
          </p>
        ))}
      </details>

      <div className={s.actions} style={{marginTop: 12}}>
        <button
          type="button"
          className={s.primary}
          onClick={() => onRetest(plan.metric, plan.goalUnit)}
        >
          <CalendarCheck size={15} aria-hidden="true" />
          {l('Record maintenance retest', 'Consigner le contrôle', 'تسجيل فحص الصيانة')}
        </button>
        {onOptionalNewGoal && (
          <button type="button" className={s.link} onClick={onOptionalNewGoal}>
            <Plus size={14} aria-hidden="true" />
            {l('Optional: aim for a higher target', 'Facultatif : viser une nouvelle cible', 'اختياري: تحديد هدف أعلى')}
          </button>
        )}
      </div>
    </section>
  );
}
