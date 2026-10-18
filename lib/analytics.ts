'use client';
import type {PostHog} from 'posthog-js';
import {metrics} from './registry';
export const analyticsViews=['overview','measurements','progress','scenarios','profile','settings','methodology','sign-in','sign-up','forgot-password','reset-password','account-password','share','privacy'] as const;
export type AnalyticsView=typeof analyticsViews[number];
export const analyticsEvents=['app_viewed','onboarding_started','onboarding_completed','signup_requested','signup_confirmed','login_succeeded','recovery_requested','measurement_saved','measurement_cleared','profile_migrated','public_link_shared','simulator_used','program_saved','program_task_completed'] as const;
export type AnalyticsEvent=typeof analyticsEvents[number];
let analytics:PostHog|null=null,lastView:AnalyticsView|undefined;
const pending:Array<{event:AnalyticsEvent;properties:Record<string,string>}>=[];
const configured=!!process.env.NEXT_PUBLIC_POSTHOG_KEY;
export function safeEventProperties(event:AnalyticsEvent,input:Record<string,unknown>={}){
 const out:Record<string,string>={};
 if(event==='app_viewed'&&analyticsViews.includes(input.view as AnalyticsView))out.view=String(input.view);
 if(['measurement_saved','measurement_cleared','simulator_used'].includes(event)&&metrics.some(m=>m.id===input.metric_id))out.metric_id=String(input.metric_id);
 if(event==='public_link_shared'&&['clipboard','x'].includes(String(input.channel)))out.channel=String(input.channel);
 if(['program_saved','program_task_completed'].includes(event)&&['consistency','strength','recovery'].includes(String(input.focus)))out.focus=String(input.focus);
 return out;
}
export function setAnalyticsClient(client:PostHog|null){analytics=client;if(client)while(pending.length){const e=pending.shift()!;client.capture(e.event,e.properties);}}
export function captureEvent(event:AnalyticsEvent,input:Record<string,unknown>={}){if(!analyticsEvents.includes(event))return;const properties=safeEventProperties(event,input);if(analytics)analytics.capture(event,properties);else if(configured&&pending.length<100)pending.push({event,properties});}
export function recordView(view:AnalyticsView){if(view===lastView)return;lastView=view;captureEvent('app_viewed',{view});}
