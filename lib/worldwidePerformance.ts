import {empiricalBenchmark, type CalibrationArtifact} from './benchmarkCalibration';
import {valid} from './engine';
import {authoritativeMeasurementDetails, type MeasurementMetadata} from './measurementMetadata';
import {performanceAreas, type PerformanceArea} from './overallPerformance';
import {protocolComplete} from './protocols';
import {activeMetrics, type Values} from './registry';

export type WorldStanding =
  | {available:false; reason:'reference'|'battery'|'precision'}
  | {available:true; population:string; version:string; topPercent:number; interval:[number,number]; confidence:number};

/** The reviewed joint sample belongs on the server. Only the small result
 * object is suitable for passing to a user's ranking view. */
export function worldwidePerformance(reference:CalibrationArtifact|null, values:Values, details:MeasurementMetadata, now=Date.now()):WorldStanding {
  if (!reference || reference.scope !== 'worldwide-adults' || reference.cohort ||
      !reference.representative || !reference.approved || reference.sourceKind !== 'probability-sample') {
    return {available:false, reason:'reference'};
  }
  // Require a frozen battery across the four eligible areas. Its reference
  // scores are calculated from participant-level measurements, independently
  // of the personalized game model.
  const ids = new Set(reference.variables.map(variable => variable.id));
  for (const area of Object.keys(performanceAreas) as PerformanceArea[]) {
    if (reference.domainWeights[area] !== 0.25 || !performanceAreas[area].some(id => ids.has(id))) {
      return {available:false, reason:'reference'};
    }
  }
  const protocols:Record<string,string> = {};
  for (const variable of reference.variables) {
    const metric = activeMetrics.find(item => item.id === variable.id);
    const area = performanceAreas[variable.domain as PerformanceArea];
    if (!metric || !Array.isArray(area) || !area.some(id => id === variable.id) || metric.polarity !== variable.direction) {
      return {available:false, reason:'reference'};
    }
    if (!valid(metric,values[metric.id])) return {available:false, reason:'battery'};
    try {
      const d = authoritativeMeasurementDetails({[metric.id]:values[metric.id]}, {[metric.id]:details[metric.id]}, now)[metric.id];
      if (!d.measuredAt || !d.method || d.protocol?.id !== variable.protocolId ||
          !protocolComplete(metric.id,d.protocol)) return {available:false, reason:'battery'};
      if (metric.id.endsWith('_1rm') && (d.method !== 'direct_1rm' ||
          !(d.derivation?.bodyWeightKg ?? d.protocol.bodyWeightKg) || d.derivation && d.derivation.inputs[1] !== 1)) {
        return {available:false, reason:'battery'};
      }
      protocols[metric.id] = d.protocol.id;
    } catch {
      return {available:false, reason:'battery'};
    }
  }
  try {
    const result = empiricalBenchmark(reference,values,protocols);
    if (!result.available) return {available:false, reason:'precision'};
    return {available:true, population:result.population, version:result.version, topPercent:100-result.percentile,
      interval:[100-result.interval[1],100-result.interval[0]], confidence:result.confidenceLevel};
  } catch {
    return {available:false, reason:'reference'};
  }
}
