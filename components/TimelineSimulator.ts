'use client';
import type { MeasurementMetadata } from '@/lib/measurementMetadata';

import { useMemo } from 'react';
import { simulate, type Strategy } from '@/lib/engine';
import { type Values, type Demographics } from '@/lib/registry';

// Shared scenario controller. Math remains in the pure engine so imports and
// tests can run without a browser; every projection uses the V2 cohort pipeline.
export function useTimelineSimulator(values: Values, profile: Demographics, target: number, strategy: Strategy, details:MeasurementMetadata) {
  return useMemo(() => simulate(values, profile, target, strategy, details), [values, profile, target, strategy, details]);
}
