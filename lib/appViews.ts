export type AppView = 'overview' | 'potential' | 'performance' | 'ranking' | 'progress' | 'profile' | 'settings' | 'methodology' | 'labs';
export const primaryViews = ['overview', 'performance', 'potential', 'ranking'] as const;

export const viewTitles = {
  overview: ['Home', 'Accueil', 'الرئيسية'],
  performance: ['Measurements', 'Mesures', 'القياسات'],
  potential: ['Program', 'Programme', 'البرنامج'],
  ranking: ['Ranking', 'Classement', 'الترتيب'],
  progress: ['My history', 'Mon historique', 'سجلي'],
  profile: ['My profile', 'Mon profil', 'ملفي'],
  settings: ['Settings', 'Paramètres', 'الإعدادات'],
  methodology: ['Methodology', 'Méthodologie', 'المنهجية'],
  labs: ['Additional tracking', 'Suivi complémentaire', 'التتبع الإضافي'],
} satisfies Record<AppView, readonly [string, string, string]>;

export function appView(search: URLSearchParams): AppView {
  const value = search.get('view');
  if (value === 'journey' || value === 'measurements') return 'performance';
  if (value === 'program' || value === 'training') return 'potential';
  return value && Object.hasOwn(viewTitles, value) ? value as AppView : 'overview';
}

export function viewHref(view: AppView, metric?: string, aimForNextTier=false) {
  const query = new URLSearchParams();
  if (view !== 'overview') query.set('view', view === 'potential' ? 'program' : view);
  if (['progress', 'ranking', 'potential'].includes(view) && metric) query.set('metric', metric);
  if (view === 'potential' && metric && aimForNextTier) query.set('aim', 'next');
  return query.size ? `/?${query}` : '/';
}
