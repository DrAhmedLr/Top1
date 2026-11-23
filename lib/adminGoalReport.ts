export interface AdminGoalReport {
  metrics: AdminGoalMetric[];
}

export interface AdminGoalMetric {
  metric: string;
  goalUnit: 'metric' | 'kg';
  users: number;
  attempts: number;
  reachedUsers: number;
  reached: number;
  missed: number;
  unknown: number;
  superseded: number;
  adherenceAttempts: number;
  completed: number;
  due: number;
  stages: AdminGoalStage[];
}

export interface AdminGoalStage {
  kind: 'illustrative' | 'personal';
  modelVersion: string;
  forecasts: number;
  observed: number;
  scored: number;
  predicted: number | null;
  actual: number | null;
  gapPoints: number | null;
  brier: number | null;
  observedPredicted: number | null;
  observedActual: number | null;
  observedGapPoints: number | null;
  observedBrier: number | null;
}
