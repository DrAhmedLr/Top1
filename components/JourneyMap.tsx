'use client';

import { Activity, ChevronDown, ChevronRight, ClipboardList, Dumbbell, FlaskConical, Zap } from 'lucide-react';
import { activeMetrics, bloodMetricIds, type Values } from '@/lib/registry';
import { valid } from '@/lib/engine';
import { gameLevels } from '@/lib/gameLevels';
import { useTranslations } from './providers/LocaleProvider';

const categories = [
  { icon: ClipboardList, title: ['Daily Basics', 'Bases quotidiennes', 'الأساسيات اليومية'], ids: [...gameLevels[0].sections[0].ids, ...gameLevels[1].sections[1].ids, 'bp_systolic', 'body_fat'] },
  { icon: Dumbbell, title: ['Calisthenics & Strength', 'Callisthénie et force', 'تمارين وزن الجسم والقوة'], ids: [...gameLevels[0].sections[1].ids, ...gameLevels[1].sections[0].ids] },
  { icon: Zap, title: ['Power & Cardio', 'Puissance et cardio', 'القدرة واللياقة القلبية'], ids: [...gameLevels[0].sections[2].ids, 'reaction_time', 'zone2_power', 'vo2_max'] },
  { icon: FlaskConical, title: ['Biomarkers & Bloodwork', 'Biomarqueurs et analyses', 'المؤشرات الحيوية وتحاليل الدم'], ids: [...bloodMetricIds] },
];
const assigned = new Set(categories.flatMap(category => category.ids));
const additionalTests = activeMetrics.filter(metric => !assigned.has(metric.id));

export default function JourneyMap({ values, needsSetup, onStart }: {
  values: Values;
  needsSetup: boolean;
  onStart: (id: string) => void;
}) {
  const { locale, t } = useTranslations();
  const index = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  const featured = activeMetrics.find(metric => metric.id === 'pullups');
  return <div className="journey-map">
    <section className="card">
      <Activity aria-hidden="true" />
      <div>
        <p className="eyebrow">{(needsSetup ? ['Start here', 'Pour commencer', 'ابدأ هنا'] : ['Featured test', 'Test à découvrir', 'اختبار مميز'])[index]}</p>
        <h2>{needsSetup ? ['Your starting point', 'Votre point de départ', 'نقطة انطلاقك'][index] : t(featured?.name ?? 'Pull-ups')}</h2>
        <p>{(needsSetup ? ['Add your height, weight and age first.', 'Renseignez votre taille, votre poids et votre âge.', 'أضف طولك ووزنك وعمرك أولًا.'] : ['Open the protocol and record your result.', 'Consultez le protocole et notez votre résultat.', 'اطّلع على طريقة الاختبار وسجّل نتيجتك.'])[index]}</p>
      </div>
      <button className="primary-button" onClick={() => onStart(needsSetup ? 'basics' : 'pullups')}>{t('Start')} <ChevronRight size={18} aria-hidden="true" /></button>
    </section>
    {[...categories, { icon: Activity, title: ['More Tests', 'Autres tests', 'اختبارات أخرى'], ids: additionalTests.map(metric => metric.id) }].map(({ icon: Icon, title, ids }) => {
      const tests = activeMetrics.filter(metric => ids.includes(metric.id));
      if (!tests.length) return null;
      const count = tests.filter(metric => valid(metric, values[metric.id])).length;
      return <details key={title[0]} className="journey-collection">
        <summary><Icon size={20} aria-hidden="true" /><h2>{title[index]}</h2><bdi>{count}/{tests.length}</bdi><ChevronDown size={17} aria-hidden="true" /></summary>
        {tests.map(metric => <button key={metric.id} onClick={() => onStart(metric.id)}>
          <span>{t(metric.name)}</span>
          <span>{valid(metric, values[metric.id]) ? <bdi>{values[metric.id]} {t(metric.unit)}</bdi> : <ChevronRight size={18} aria-hidden="true" />}</span>
        </button>)}
      </details>;
    })}
  </div>;
}
