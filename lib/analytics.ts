'use client';
import type { PostHog } from 'posthog-js';
export type AnalyticsEvent = 'metric_logged'|'profile_migrated'|'public_link_shared'|'simulator_used';
let analytics:PostHog|null=null;
export function setAnalyticsClient(client:PostHog|null){analytics=client;}
// Deliberately excludes health values, demographics, identity, and share slugs.
export function captureEvent(event: AnalyticsEvent, properties: Record<string,string|number|boolean>={}) {
  analytics?.capture(event,properties);
}
