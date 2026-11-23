'use client';

import {analyticsViews, setJourneyClient, type AnalyticsView, type JourneyAction} from './analytics';
import {activeMetrics} from './registry';
import {JourneyClock} from './journeyClock';

type Entry = {
  id: string; sessionId: string; event: JourneyAction | 'screen_time'; view: AnalyticsView;
  at: string; seconds?: number; metric?: string;
};
const metrics = new Set(activeMetrics.map(metric => metric.id));

export function startCustomerJourney(owner: string, consentId: string, initialView?: AnalyticsView) {
  let view: AnalyticsView | undefined;
  let sessionId = crypto.randomUUID();
  let lastActivity = Date.now();
  const now = () => performance.now();
  let nativeInactive = false;
  const foreground = () => !nativeInactive && !document.hidden && document.hasFocus();
  const clock = new JourneyClock(now(), foreground());
  const controller = new AbortController();
  let queued: Entry[] = [];
  let sending = false;

  function append(event: Entry['event'], details: Pick<Entry, 'seconds' | 'metric'> = {}) {
    if (!view || queued.length >= 150) return;
    queued.push({id: crypto.randomUUID(), at: new Date().toISOString(), sessionId, view, event, ...details});
  }
  function recordTime() {
    const seconds = clock.take(now());
    for (let left = seconds; left > 0 && queued.length < 150; left -= 60) append('screen_time', {seconds: Math.min(60,left)});
  }
  async function flush() {
    if (sending || controller.signal.aborted || !queued.length) return;
    sending = true;
    const batch = queued.slice(0, 25);
    try {
      const response = await fetch('/api/customer-journey', {
        method: 'POST', cache: 'no-store', keepalive: true, signal: controller.signal,
        headers: {'Content-Type': 'application/json', 'X-Profile-User': owner},
        body: JSON.stringify({consentId, events: batch})
      });
      if (response.ok) queued.splice(0, batch.length);
      else if ([400,401,403,409,413].includes(response.status)) queued = [];
    } catch { /* Retry the same IDs on the next flush while this account is open. */ }
    finally { sending = false; }
  }
  function activity() {
    if (!foreground()) return;
    const time = Date.now();
    if (time - lastActivity >= 30 * 60_000) {
      recordTime();
      sessionId = crypto.randomUUID();
      if (view) append('app_viewed');
    }
    lastActivity = time;
    clock.interact(now());
  }
  function focusChanged() {
    recordTime();
    const active = foreground();
    clock.focus(now(), active);
    if (active) activity();
    else void flush();
  }
  function nativeState(event:Event) { nativeInactive = event.type === 'top1-native-inactive'; focusChanged(); }
  function pageHidden() { recordTime(); clock.focus(now(), false); void flush(); }
  const client = {
    view(next: AnalyticsView) {
      if (!analyticsViews.includes(next) || next === view) return;
      recordTime(); clock.resetFraction(); view = next;
      if (foreground()) activity();
      append('app_viewed');
      void flush();
    },
    action(event: JourneyAction, metric?: string) {
      if (!view || !foreground()) return;
      activity();
      append(event, metric && metrics.has(metric) ? {metric} : {});
      void flush();
    }
  };
  setJourneyClient(client);
  if (initialView) client.view(initialView);
  const timer = window.setInterval(() => { recordTime(); void flush(); }, 15_000);
  // The activity signal reads no keys, pointer coordinates or form values.
  const interactions = ['pointerdown', 'keydown', 'scroll'] as const;
  interactions.forEach(name => document.addEventListener(name, activity, {passive:true, capture:true}));
  document.addEventListener('visibilitychange', focusChanged);
  window.addEventListener('focus', focusChanged);
  window.addEventListener('blur', focusChanged);
  window.addEventListener('pagehide', pageHidden);
  window.addEventListener('pageshow', focusChanged);
  window.addEventListener('top1-native-active', nativeState);
  window.addEventListener('top1-native-inactive', nativeState);
  return () => {
    setJourneyClient(null);
    controller.abort();
    queued = [];
    clearInterval(timer);
    interactions.forEach(name => document.removeEventListener(name, activity, true));
    document.removeEventListener('visibilitychange', focusChanged);
    window.removeEventListener('focus', focusChanged);
    window.removeEventListener('blur', focusChanged);
    window.removeEventListener('pagehide', pageHidden);
    window.removeEventListener('pageshow', focusChanged);
    window.removeEventListener('top1-native-active', nativeState);
    window.removeEventListener('top1-native-inactive', nativeState);
  };
}
