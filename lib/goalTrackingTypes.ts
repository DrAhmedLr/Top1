import type {GoalAttempt} from './goalAttempts';

export interface GoalCalibration {
  planId: string;
  revision: number;
  probability: number;
  baseProbability: number;
  participants: number;
}

export interface GoalTracking {
  owner: string;
  attempts: (Omit<GoalAttempt, 'deadlineMissCandidate'> & {firstForecast?:IssuedGoalForecast})[];
  sharing: boolean;
  sharingAvailable?: boolean;
  calibration: GoalCalibration | null;
  calibrations?: GoalCalibration[];
}

export interface IssuedGoalForecast {
  probability:number;
  issuedAt:string;
  kind:'illustrative'|'personal';
}
