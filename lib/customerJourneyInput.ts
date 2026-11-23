import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {analyticsViews, journeyActions, type AnalyticsView, type JourneyAction} from './analyticsVocabulary';
import {activeMetrics} from './registry';

type Event = {id: string; sessionId: string; at: string; view: AnalyticsView; event: JourneyAction | 'screen_time'; metric?: string | null; seconds?: number};
type Input = {enabled: boolean} | {consentId: string; events: Event[]};
const actions = new Set<string>([...journeyActions,'screen_time']);
const screens = new Set<string>(analyticsViews);
const metrics = new Set(activeMetrics.map(metric=>metric.id));
const eventFields = new Set(['id','sessionId','at','view','event','metric','seconds']);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const record = (value: unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function validEvent(value: unknown): value is Event {
  if (!record(value) || Object.keys(value).some(k=>!eventFields.has(k))) return false;
  if (typeof value.id !== 'string' || !uuid.test(value.id) || typeof value.sessionId !== 'string' || !uuid.test(value.sessionId)) return false;
  if (typeof value.event !== 'string' || !actions.has(value.event) || typeof value.view !== 'string' || !screens.has(value.view)) return false;
  if (typeof value.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d{1,3})?Z$/.test(value.at) || !Number.isFinite(Date.parse(value.at))) return false;
  if (value.metric != null && (typeof value.metric !== 'string' || !metrics.has(value.metric))) return false;
  return value.event === 'screen_time'
    ? typeof value.seconds === 'number' && Number.isInteger(value.seconds) && value.seconds>=1 && value.seconds<=60
    : value.seconds === undefined || value.seconds === 0;
}

export function journeyInput(value: unknown): Input | null {
  if (!record(value)) return null;
  const keys = Object.keys(value);
  if (keys.length===1 && typeof value.enabled==='boolean') return {enabled:value.enabled};
  if (keys.length!==2 || typeof value.consentId!=='string' || !uuid.test(value.consentId) ||
      !Array.isArray(value.events) || value.events.length<1 || value.events.length>25 || !value.events.every(validEvent)) return null;
  return {consentId:value.consentId,events:value.events};
}

export function journeyRequestIp(headers: Headers, onVercel: boolean) {
  const ip = onVercel ? headers.get('x-vercel-forwarded-for')?.trim() : null;
  return ip && !ip.includes('%') && isIP(ip) ? ip : null;
}

export function journeyWriteProof(secret: string | undefined) {
  if (!secret) return null;
  const verifier = createHash('sha256').update(secret,'utf8').digest();
  return createHash('sha256').update(verifier).update('TOP1/customer-journey/v1','utf8').digest('hex');
}
