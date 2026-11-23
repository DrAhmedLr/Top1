import type {Observation} from './history';

export const historyFields='id,sequence,metric_id,metric_value,is_deleted,measured_at,recorded_at,method,source,age_at_measurement,exercise_mode,protocol_context,observation_window,calculation_inputs,reference_context';

type LogRow = {
  id:string; sequence:number|string; metric_id:string; metric_value:number|string|null;
  is_deleted:boolean; recorded_at:string; measured_at:string|null; method:Observation['method']|null;
  source:string|null; age_at_measurement:number|null; exercise_mode:Observation['exerciseMode']|null;
  protocol_context:Observation['protocol']|null; observation_window:Observation['window']|null;
  calculation_inputs:Observation['derivation']|null; reference_context:Observation['referenceContext']|null;
};

export function toEntries(rows:LogRow[]):Observation[] {
  return rows.map(r => ({
    id:r.id, sequence:Number(r.sequence), metricId:r.metric_id, value:r.is_deleted?null:Number(r.metric_value),
    cleared:r.is_deleted, recordedAt:r.recorded_at, measuredAt:r.measured_at??undefined, method:r.method??undefined,
    source:r.source??undefined, ageAtMeasurement:r.age_at_measurement??undefined, exerciseMode:r.exercise_mode??undefined,
    protocol:r.protocol_context??undefined, window:r.observation_window??undefined, derivation:r.calculation_inputs??undefined,
    referenceContext:r.reference_context??undefined,
  }));
}
