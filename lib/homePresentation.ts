import {activeMetrics} from './registry';
import type {referenceRank} from './rankExplorer';

export const quickLogTests = ['run_5k', 'grip_strength', 'squat_1rm'].map(id => activeMetrics.find(metric => metric.id === id)!);

// Published bounds take priority when a test supports both comparison methods.
export function referenceChart(result: ReturnType<typeof referenceRank>) {
  if (result.published) return {kind: 'curve' as const, source: result.published};
  const percent = result.progress?.modelTopPercent;
  if (percent !== undefined) return {kind: 'pyramid' as const, percent};
  return null;
}
