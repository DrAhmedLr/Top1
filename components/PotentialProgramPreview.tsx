'use client';
import {MetricIcon} from './MetricIcon';
import TrainingDetails from './TrainingDetails';
import {useTranslations} from './providers/LocaleProvider';
import {trainingPrescription} from '@/lib/trainingPrescription';
import type {weeklyCoach} from '@/lib/weeklyCoach';
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export default function PotentialProgramPreview({coach}:{coach:ReturnType<typeof weeklyCoach>}){
 const {t}=useTranslations(),session=trainingPrescription(coach);
 return <div className="potential-program-preview" aria-live="polite">
  <div className="potential-session-meta"><span>{t(coach.baselines.length&&!session.exercises.length&&!session.habits.length?'Start with a baseline':'Preview')}</span><strong>{session.exercises.length?`${session.estimatedMinutes} ${t('min')}`:coach.baselines.length?'—':`5 ${t('min')}`}</strong><small>{session.exercises.length?coach.days.map(d=>t(days[d-1])).join(' · '):t(coach.baselines.length?'Record baseline':'Daily habits')}</small></div>
  {session.exercises.map(e=><article key={e.metricId} data-preview-exercise={e.metricId}><span className="metric-title"><MetricIcon id={e.metricId}/>{t(e.exercise)}</span><strong><bdi>{e.sets} × {e.dose}</bdi> {t(e.unit)}{e.perSide&&` · ${t('each side')}`}</strong><small>{e.workingKg!==undefined&&<><bdi>{e.workingKg} kg</bdi> · </>}{t('Rest')} · {e.restSeconds} {t('seconds between sets')}</small></article>)}
  {session.habits.map(h=><article key={h.metricId} data-preview-habit={h.metricId}><span className="metric-title"><MetricIcon id={h.metricId}/>{t(h.title)}</span><strong>{h.minutes} {t('min')} · {t('daily')}</strong><small>{t(h.steps[0])}</small></article>)}
  {(session.exercises.length>0||session.habits.length>0)&&<details className="potential-preview-details"><summary>{t('Mission & training details')}</summary><TrainingDetails coach={coach}/></details>}
 </div>;
}
