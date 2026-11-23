'use client';

import type {MouseEvent, ReactNode} from 'react';
import {Dumbbell, House, ListPlus, UserRound} from 'lucide-react';
import {primaryViews, viewHref, viewTitles, type AppView} from '@/lib/appViews';
import {useTranslations} from './providers/LocaleProvider';

const icons = {overview: House, performance: ListPlus, potential: Dumbbell, profile: UserRound};

export default function PerformanceShell({view, blocked, onNavigate, children}: {
  view: AppView; blocked: boolean; onNavigate: (view: AppView) => void; children: ReactNode;
}) {
  const {locale, t} = useTranslations();
  const index = locale === 'fr' ? 1 : locale === 'ar' ? 2 : 0;
  const parent = view === 'labs' ? 'performance' : ['settings','ranking','progress'].includes(view) ? 'profile' : view;
  function onLink(event: MouseEvent<HTMLAnchorElement>, destination: AppView) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(destination);
  }
  return <div className="performance-shell performance-snapshot training-shell">
    <a tabIndex={blocked ? -1 : undefined} className="skip-link" href="#main-content">{t('Skip to content')}</a>
    <header className="training-header" inert={blocked || undefined}>
      <a className="training-brand" href="/" onClick={e => onLink(e,'overview')} dir="ltr" aria-label="TOP1%">
        <span className="training-mark" aria-hidden="true"><i/><i/><i/></span>
        TOP1<span className="brand-pct">%</span>
      </a>
      <nav className="training-nav" aria-label={t('Main navigation')}>
        {primaryViews.map(destination => {
          const Icon = icons[destination];
          return <a key={destination} href={viewHref(destination)} onClick={e=>onLink(e,destination)}
            aria-current={destination===parent ? (destination===view ? 'page' : 'location') : undefined}>
            <Icon aria-hidden="true" size={19}/><span>{viewTitles[destination][index]}</span>
          </a>;
        })}
      </nav>
    </header>
    <main id="main-content" tabIndex={-1} inert={blocked || undefined}>
      {view!=='overview'&&<div className={['ranking','potential'].includes(view)?'sr-only':'training-page-title'}>
        <h1 id="performance-page-title" tabIndex={-1}>{viewTitles[view][index]}</h1>
      </div>}
      {children}
    </main>
  </div>;
}
