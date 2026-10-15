import type { Metric } from './registry';

const normalize = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[_-]+/g, ' ').trim();

/** Search matches ordinary keyboard input, scientific typography and registry IDs. */
export function matchesMetricSearch(metric: Pick<Metric, 'id' | 'name' | 'proofData'>, query: string): boolean {
  const searchable = normalize(`${metric.name} ${metric.id} ${metric.proofData.rationale}`);
  return normalize(query).split(/\s+/).every(term => searchable.includes(term));
}
