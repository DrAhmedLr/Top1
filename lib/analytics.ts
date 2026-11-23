'use client';

import {analyticsEvents, analyticsViews, type AnalyticsEvent, type AnalyticsView, type JourneyAction} from './analyticsVocabulary';
export {analyticsEvents, analyticsViews, type AnalyticsEvent, type AnalyticsView, type JourneyAction} from './analyticsVocabulary';


type Collector = {capture: (event: AnalyticsEvent, properties: {view?: AnalyticsView}) => void};
type JourneyCollector = {view: (view: AnalyticsView) => void; action: (event: JourneyAction, metric?: string) => void};
let journey: JourneyCollector | null = null;
export function setJourneyClient(client: JourneyCollector | null) { journey = client; }
export function recordJourneyAction(event: JourneyAction, metric?: string) { journey?.action(event, metric); }
let collector: Collector | null = null;
let lastView: AnalyticsView | undefined;

export function safeEventProperties(event: AnalyticsEvent, input: Record<string, unknown> = {}): {view?: AnalyticsView} {
  if (event === 'app_viewed' && analyticsViews.includes(input.view as AnalyticsView)) return {view: input.view as AnalyticsView};
  return {};
}

export function setAnalyticsClient(client: Collector | null) {
  collector = client;
  lastView = undefined;
}

export function captureEvent(event: AnalyticsEvent, input: Record<string, unknown> = {}) {
  if (!analyticsEvents.includes(event)) return;
  if (event !== 'app_viewed') recordJourneyAction(event, typeof input.metric_id === 'string' ? input.metric_id : undefined);
  if (!collector) return;
  const properties = safeEventProperties(event, input);
  if (event !== 'app_viewed' || properties.view) collector.capture(event, properties);
}

export function recordView(view: AnalyticsView) {
  if (!analyticsViews.includes(view)) return;
  journey?.view(view);
  if (!collector || view === lastView) return;
  lastView = view;
  captureEvent('app_viewed', {view});
}
