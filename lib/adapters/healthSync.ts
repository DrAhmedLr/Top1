import { normalizeTimestamp, type MeasurementMetadata } from '../measurementMetadata';
import { metrics } from '../registry';

export interface ExternalHealthPayload {
  source: 'apple_health' | 'garmin' | 'oura' | 'whoop' | 'quest_diagnostics';
  timestamp: string;
  hrvStatistic?:'rmssd'|'sdnn';
  metrics: {
    restingHeartRate?: number;
    hrvMs?: number;
    totalSleepMinutes?: number;
    sleepEfficiencyPercent?: number;
    vo2Max?: number;
    apobMgDl?: number;
    fastingInsulinUiuMl?: number;
    hscrpMgL?: number;
  };
}
const mapping = {
  restingHeartRate: 'rhr', hrvMs: 'hrv', totalSleepMinutes: 'total_sleep',
  sleepEfficiencyPercent: 'sleep_efficiency', vo2Max: 'vo2_max', apobMgDl: 'apob',
  fastingInsulinUiuMl: 'fasting_insulin', hscrpMgL: 'hscrp',
} as const;

// Providers must normalize to the units named above before calling this pure
// adapter. Timestamp is metadata; conflict resolution belongs to the sync layer.
export function transformHealthPayloadToProfile(payload: ExternalHealthPayload, existingInputs: Record<string, number>): Record<string, number>;
export function transformHealthPayloadToProfile(payload: ExternalHealthPayload, existingInputs: Record<string, number | undefined>): Record<string, number | undefined>;
export function transformHealthPayloadToProfile(
  payload: ExternalHealthPayload, existingInputs: Record<string, number | undefined>,
): Record<string, number | undefined> {
  normalizeTimestamp(payload.timestamp);
  if(payload.metrics.hrvMs!==undefined&&payload.hrvStatistic!=='rmssd')throw new RangeError('HRV imports require an explicit RMSSD definition. SDNN cannot be converted to RMSSD.');
  const updated = { ...existingInputs };
  for (const field of Object.keys(mapping) as (keyof typeof mapping)[]) {
    const value = payload.metrics[field];
    if (value === undefined) continue;
    const id = mapping[field];
    const metric = metrics.find(metric => metric.id === id)!;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < metric.min || value > metric.max) {
      throw new RangeError(`Invalid ${field} from ${payload.source}: expected ${metric.min}–${metric.max} ${metric.unit}.`);
    }
    updated[id] = value;
  }
  return updated;
}

// Preserve comparable timestamps and distinguish provider estimates from direct tests.
export function transformHealthPayload(payload:ExternalHealthPayload,existingInputs:Record<string,number|undefined>,existingDetails:MeasurementMetadata={}){
 const measuredAt=normalizeTimestamp(payload.timestamp),values={...existingInputs},measurementDetails={...existingDetails};
 const normalized=transformHealthPayloadToProfile(payload,{});
 for(const [id,value] of Object.entries(normalized)){
  const prior=existingDetails[id]?.measuredAt;
  if(prior&&Date.parse(normalizeTimestamp(prior))>Date.parse(measuredAt))continue;
  values[id]=value;
  measurementDetails[id]={measuredAt,source:payload.source,method:id==='vo2_max'?'wearable_estimate':payload.source==='quest_diagnostics'?'lab':'device'};
 }
 return {values,measurementDetails};
}
