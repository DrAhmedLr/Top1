import {activeMetrics} from './registry';
/** Availability only; never statistical confidence or validated benchmark coverage. */
export function recordedCoverage(count:number){if(!Number.isInteger(count)||count<0||count>activeMetrics.length)throw new RangeError('Invalid recorded count.');return 100*count/activeMetrics.length;}
