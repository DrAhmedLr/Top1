'use client';

import {useId, useMemo, useRef, useState} from 'react';
import {
  ArrowDown, ArrowUp, Activity, ChevronRight, Dumbbell, FlaskConical,
  Footprints, Moon, PersonStanding, Plus, Ruler, Search, X,
} from 'lucide-react';
import {valid} from '@/lib/engine';
import {entryRaw, entryUnit} from '@/lib/focusedEntry';
import {translate, type Locale} from '@/lib/i18n';
import {matchesMetricSearch} from '@/lib/metricSearch';
import {performanceCategories, performanceOrder, type PerformanceCategoryId} from '@/lib/performanceCatalog';
import {type Values} from '@/lib/registry';
import {MetricIcon} from './MetricIcon';
import {useTranslations} from './providers/LocaleProvider';
import '@/app/home-metric-library.css';

const initialRows = 3;
const additionalRows = 6;
const categoryIcons = {
  bodyweight: PersonStanding, gym: Dumbbell, cardio: Footprints,
  body: Ruler, recovery: Moon, blood: FlaskConical,
};
const copy = {
  en: {
    title: 'Metric library', search: 'Search all measurements', clear: 'Clear search',
    categories: 'Measurement categories', results: 'Search results', none: 'No matching measurements.',
    more: 'Show more', less: 'Show fewer', record: 'Record', update: 'Update',
  },
  fr: {
    title: 'Bibliothèque des mesures', search: 'Rechercher dans toutes les mesures', clear: 'Effacer la recherche',
    categories: 'Catégories de mesures', results: 'Résultats de recherche', none: 'Aucune mesure correspondante.',
    more: 'Voir plus', less: 'Voir moins', record: 'Saisir', update: 'Modifier',
  },
  ar: {
    title: 'مكتبة القياسات', search: 'ابحث في جميع القياسات', clear: 'مسح البحث',
    categories: 'فئات القياسات', results: 'نتائج البحث', none: 'لا توجد قياسات مطابقة.',
    more: 'عرض المزيد', less: 'عرض أقل', record: 'تسجيل', update: 'تعديل',
  },
} satisfies Record<Locale, Record<string, string>>;

// Include all supported names so a familiar term still works after changing the interface language.
const searchEntries = performanceCategories.flatMap(category => category.metrics.map(metric => ({
  metric,
  category: category.id,
  searchable: {
    ...metric,
    name: [metric.name, translate('fr', metric.name), translate('ar', metric.name), ...category.name].join(' '),
  },
})));

function normalizeDigits(query: string) {
  return query.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0));
}

export default function HomeMetricLibrary({values, onRecord}: {values: Values; onRecord: (id: string) => void}) {
  const {locale, t} = useTranslations();
  const labels = copy[locale];
  const languageIndex = locale === 'en' ? 0 : locale === 'fr' ? 1 : 2;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const [selected, setSelected] = useState<PerformanceCategoryId>(
    () => performanceCategories.find(group => group.ids.length)?.id ?? 'bodyweight',
  );
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(initialRows);
  const searchInput = useRef<HTMLInputElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const instanceId = useId();
  const headingId = instanceId + '-heading';
  const resultsId = instanceId + '-results';
  const resultTitleId = instanceId + '-result-title';
  const searching = !!query.trim();
  const category = performanceCategories.find(group => group.id === selected)!;
  const matches = useMemo(() => {
    const term = normalizeDigits(query.trim());
    return searchEntries.filter(entry =>
      term ? matchesMetricSearch(entry.searchable, term) : entry.category === selected,
    );
  }, [query, selected]);
  const shown = matches.slice(0, limit);
  const remaining = matches.length - shown.length;
  const countLabel = `${number.format(shown.length)} / ${number.format(matches.length)}`;

  const spokenCount = {
    en: `Showing ${number.format(shown.length)} of ${number.format(matches.length)}`,
    fr: `${number.format(shown.length)} ${shown.length===1?'mesure affichée':'mesures affichées'} sur ${number.format(matches.length)}`,
    ar: `يُعرض ${number.format(shown.length)} من ${number.format(matches.length)}`,
  }[locale];
  function collapse() {
    setLimit(initialRows);
    resultHeading.current?.focus();
  }
  function changeQuery(value: string) {
    setQuery(value);
    setLimit(initialRows);
  }
  function selectCategory(id: PerformanceCategoryId) {
    changeQuery('');
    setSelected(id);
  }

  return (
    <section id="metric-library" tabIndex={-1} className="home-metric-library" aria-labelledby={headingId}>
      <header className="hml-heading">
        <span className="hml-mark" aria-hidden="true"><Activity size={22}/></span>
        <h2 id={headingId}>{labels.title}</h2>
        <span className="hml-total" aria-label={`${labels.title} · ${number.format(performanceOrder.length)}`}>
          {number.format(performanceOrder.length)}
        </span>
      </header>

      <div className="hml-search">
        <Search aria-hidden="true" size={17}/>
        <input
          ref={searchInput} type="search" aria-label={labels.search} placeholder={labels.search}
          value={query} onChange={event => changeQuery(event.currentTarget.value)}
          aria-controls={resultsId} autoComplete="off" spellCheck={false}
        />
        {query && (
          <button type="button" aria-label={labels.clear} onClick={() => {changeQuery(''); searchInput.current?.focus();}}>
            <X aria-hidden="true" size={16}/>
          </button>
        )}
      </div>

      <div className="hml-categories" role="group" aria-label={labels.categories}>
        {performanceCategories.map(group => {
          const Icon = categoryIcons[group.id];
          return (
            <button key={group.id} data-category={group.id} type="button"
              disabled={!group.ids.length} aria-pressed={!searching && selected === group.id}
              aria-controls={resultsId} onClick={() => selectCategory(group.id)}>
              <Icon size={18} aria-hidden="true" strokeWidth={1.75}/>
              <span>{group.name[languageIndex]}</span>
              <bdi>{number.format(group.ids.length)}</bdi>
            </button>
          );
        })}
      </div>

      <div id={resultsId} className="hml-results" aria-labelledby={resultTitleId}>
        <div className="hml-result-heading">
          <h3 ref={resultHeading} tabIndex={-1} id={resultTitleId}>{searching ? labels.results : category.name[languageIndex]}</h3>
          <span role="status" aria-live="polite" aria-atomic="true"><bdi aria-hidden="true">{countLabel}</bdi><span className="sr-only">{spokenCount}</span></span>
        </div>
        {matches.length === 0 ? <p className="hml-empty">{labels.none}</p> : (
          <ul className="hml-list">
            {shown.map(({metric}) => {
              const name = t(metric.name);
              const value = values[metric.id];
              const recorded = valid(metric, value);
              const id = instanceId + '-' + metric.id;
              return (
                <li key={metric.id}>
                  <button type="button" data-metric={metric.id} data-recorded={recorded}
                    aria-label={`${recorded ? labels.update : labels.record} · ${name}`}
                    aria-describedby={id} onClick={() => onRecord(metric.id)}>
                    <MetricIcon id={metric.id} size={20}/>
                    <span className="hml-name">{name}</span>
                    <span className="hml-value" id={id}>
                      {recorded && <><bdi>{entryRaw(metric, value)}</bdi>{' '}</>}
                      <small>{t(entryUnit(metric))}</small>
                    </span>
                    <span className="hml-entry-icon" aria-hidden="true">
                      {recorded ? <ChevronRight size={15}/> : <Plus size={15}/>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {(remaining > 0 || limit > initialRows) && (
          <div className="hml-disclosure">
            <button type="button" aria-controls={resultsId} onClick={remaining > 0 ? () => setLimit(limit + additionalRows) : collapse}>
              {remaining > 0 ? <>{labels.more}<ArrowDown aria-hidden="true" size={14}/></> : <>{labels.less}<ArrowUp aria-hidden="true" size={14}/></>}
            </button>
            {remaining > 0 && limit > initialRows && <button type="button" aria-controls={resultsId} onClick={collapse}>
              {labels.less}<ArrowUp aria-hidden="true" size={14}/>
            </button>}
          </div>
        )}
      </div>
    </section>
  );
}
