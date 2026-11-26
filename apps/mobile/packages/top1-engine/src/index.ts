// Single Source of Truth — re-exports directly from Top1.Fit/lib/ (zero duplicate copies)

// Core Scientific Scoring & Registry
export {
  pillars,
  pillarNames,
  accessibilityTiers,
  metrics,
  activeMetrics,
  bloodMetricIds,
  maintenanceTargets,
  demoValues,
  type PillarId,
  type AccessibilityTier,
  type Demographics,
  type Values,
  type Metric,
  type MetricDefinition,
} from '../../../../../lib/registry';

export {
  MODEL_VERSION,
  MODEL_SCORE_MIN,
  MODEL_SCORE_MAX,
  TRACKING_ONLY_METRICS,
} from '../../../../../lib/model';

export {
  clamp,
  cdf,
  inverseCdf,
  reference,
  valid,
  scoringEligibility,
  eligible,
  calculateBoundedZScore,
  calculateSkewedZScore,
  score,
  toModelScore,
  evaluate,
  comparableAssessments,
  simulate,
  cooper,
  epley,
  weightedPullupRatio,
  skinfold,
  type EligibilityStatus,
  type Scored,
  type Strategy,
} from '../../../../../lib/engine';

// Evidence Register, Calibration, Correlations, Calculation Report & Coverage
export {
  EVIDENCE_REGISTER_VERSION,
  EVIDENCE_REGISTER,
  type EvidenceEntry,
} from '../../../../../lib/evidenceRegister';

export {
  metricCalibration,
  calibrationInventory,
  vo2CohortComparison,
} from '../../../../../lib/scientificCalibration';

export { calculationReport } from '../../../../../lib/calculationReport';

export {
  pairwiseCorrelations,
  getPairwiseCorrelation,
  getScoredCorrelation,
} from '../../../../../lib/correlations';

export {
  FRIEND_REFERENCE_VERSION as FRIEND_2015_VERSION,
  FRIEND_SOURCE as FRIEND_2015_SOURCE,
  friend2015,
} from '../../../../../lib/friend2015';

export { recordedCoverage } from '../../../../../lib/coverage';

export { illustrativeTopPercent, rankingLabel } from '../../../../../lib/ranking';
export { getMetricCohortNorm } from '../../../../../lib/demographics';
export {
  protocolOptions,
  protocolComplete,
  protocolKey,
  type MeasurementProtocol,
  type ObservationWindow,
} from '../../../../../lib/protocols';
export {
  normalizeMeasurementMetadata,
  authoritativeMeasurementDetails,
  type MeasurementMetadata,
  type MeasurementDetails,
  type MeasurementMethod,
  type ExerciseMode,
} from '../../../../../lib/measurementMetadata';
export {
  calculationValue,
  normalizeDerivation,
  type CalculationDerivation,
} from '../../../../../lib/derivations';
export { entryRaw, entryUnit, isLift } from '../../../../../lib/focusedEntry';
export { countMetrics } from '../../../../../lib/measurementRules';

// Overall TOP1% Performance Rank & Challenge Standing
export {
  OVERALL_PERFORMANCE_VERSION,
  performanceAreas,
  overallPerformance,
  overallChangeForSave,
  type PerformanceArea,
  type OverallSaveChange,
} from '../../../../../lib/overallPerformance';

export {
  COMPETITIVE_CHALLENGE_METRICS,
  challengeStanding,
  challengeProgress,
  type ChallengeBasis,
  type ChallengeStanding,
  type ChallengeProgress,
} from '../../../../../lib/challengeProgress';

export {
  PERFORMANCE_RULES_VERSION,
  PERFORMANCE_RANK_FLOOR,
  PERFORMANCE_RULES,
  performanceAdjustment,
  performanceGamePercent,
  type PerformanceProfile,
} from '../../../../../lib/performanceRules';

export {
  formatGamePercent,
  performanceTier,
  performanceTierBand,
} from '../../../../../lib/performanceTiers';

export { TOP_BAND_EDGES, type TopBand } from '../../../../../lib/topBands';
export { challengeBand, referenceRank, personalPosition } from '../../../../../lib/rankExplorer';
export { benchmarkEvidence } from '../../../../../lib/benchmarkCoverage';
export { metricStandings } from '../../../../../lib/metricStandings';
export { performanceProfileAtTest } from '../../../../../lib/performanceContext';

// History & Observations
export {
  observationDate,
  absoluteLiftChange,
  comparableTest,
  comparableDelta,
  personalBest,
  historyChanges,
  latestObservation,
  historySummary,
  type Observation,
} from '../../../../../lib/history';

// Personal Workspace, Training Ledger & Adaptive Programs
export {
  DEFAULT_DELEGATION,
  MAX_PINNED_GOALS,
  normalizeTrainingContext,
  type CoachingPreferences,
  type DayAvailabilityOverride,
  type DelegationGrant,
  type DiscomfortReport,
  type EquipmentOption,
  type IsoWeekday,
  type PersonalWorkspace,
  type StoredCoachDecision,
  type StoredDecisionSnapshot,
} from '../../../../../lib/personalWorkspace';

export {
  latestTraining,
  trainingId,
  trainingProgram,
  workout,
  type TrainingEvent,
  type TrainingProgram,
  type Workout,
} from '../../../../../lib/training';

export {
  goalMetrics,
  dayInZone,
  addDays,
  goalValue,
  savedAdaptiveConfig,
  checkConfig,
  scheduledWeekdays,
  buildProgram,
  sessionResult,
  actualDose,
  guidedRecoveryDates,
  manualPrescription,
  goalProgramPeriods,
  adaptivePlans,
  currentAdaptivePlans,
  doseKey,
  scenarioResult,
  type GoalUnit,
  type Dose,
  type Prescription,
  type Scenario,
  type AdaptiveConfig,
  type SessionResult,
  type AdaptivePlan,
} from '../../../../../lib/adaptiveProgram';

export {
  datedProgram,
  expectedRetestMinutes,
  countGuidedSessions,
  isGuidedTrainingDay,
  type DatedProgram,
  type DatedSession,
} from '../../../../../lib/datedProgram';

export {
  daysBetween,
  isGuidedRetestDay,
  programFamilies,
  type GoalRotation,
  type ProgramLabel,
} from '../../../../../lib/guidedSchedule';

export { goalDate } from '../../../../../lib/personalGoal';
export { replayGoalAttempts } from '../../../../../lib/goalAttempts';
export { portfolioMaintenanceSummary } from '../../../../../lib/maintenancePlan';
export { personalForecast, type PersonalForecast } from '../../../../../lib/personalForecast';

// Athlete Dossier, Coach Decision Engine & Self-Optimization
export {
  DOSSIER_VERSION,
  isoWeekdayForDay,
  buildAthleteDossier,
  type FactSource,
  type FactScope,
  type Fact,
  type MeasuredResultFact,
  type DossierGoal,
  type EffectiveDayAvailability,
  type LedgerSummary,
  type AthleteDossier,
  type DossierInput,
} from '../../../../../lib/athleteDossier';

export {
  COACH_ENGINE_VERSION,
  TIE_BREAK_ORDER,
  requiredEquipmentFor,
  selectNextSessionDecision,
  type CoachAction,
  type SessionBreakdown,
  type EvaluatedCandidate,
  type CoachTriggerKind,
  type CoachDecision,
} from '../../../../../lib/coachDecision';

export {
  SELF_OPTIMIZATION_VERSION,
  DEFAULT_POPULATION_PARAMS,
  optimizePersonalPolicy,
  optimizePersonalPhysiology,
  runSelfOptimizationCycle,
  type ActionOutcomeStats,
  type PersonalPolicyUpdate,
  type PersonalPhysiologyCalibration,
  type PopulationModelParams,
  type SelfOptimizationCycleResult,
} from '../../../../../lib/selfOptimization';

// Exercise Ontology, Muscle Physiology, Wearable Readiness & Adaptive Workout Generator
export {
  EXERCISE_ONTOLOGY_VERSION,
  ALL_MUSCLES,
  MUSCLE_META,
  ALL_DETAILED_EQUIPMENT,
  ALL_MOVEMENT_PATTERNS,
  STIMULUS_WEIGHT,
  EXERCISE_CATALOG,
  matchExerciseByName,
  expandCoarseEquipment,
  findBiomechanicalSubstitutes,
  parseDiscomfortJoints,
  queryExercises,
  type MuscleId,
  type MuscleRegion,
  type DetailedEquipmentId,
  type MovementPattern,
  type JointId,
  type JointStressLevel,
  type StimulusRole,
  type MuscleInvolvement,
  type ExerciseDefinition,
} from '../../../../../lib/exerciseOntology';

export { type WearableSource } from '../../../../../lib/adapters/healthSync';

export {
  WEARABLE_READINESS_VERSION,
  normalizeWearableSnapshot,
  evaluateWearableReadiness,
  type WearableDailySnapshot,
  type WearableReadinessSignal,
} from '../../../../../lib/wearableReadiness';

export {
  MUSCLE_PHYSIOLOGY_VERSION,
  scoreToTier,
  buildBodyPhysiologyReport,
  type MuscleTier,
  type RecoveryBand,
  type VolumeZone,
  type MeasurementConfidence,
  type MuscleState,
  type StructuralBalanceCheck,
  type BodyPhysiologyReport,
} from '../../../../../lib/musclePhysiology';

export {
  WORKOUT_GENERATOR_VERSION,
  generateAdaptiveWorkout,
  type GeneratorMode,
  type GeneratorPreset,
  type WorkoutGenerationRequest,
  type GeneratedExerciseBlock,
  type GeneratedWorkoutPlan,
} from '../../../../../lib/workoutGenerator';

// Localization (EN / FR / AR)
export {
  LOCALE_COOKIE,
  NATIVE_LOCALE_KEY,
  localePreference,
  normalizeLocale,
  requestDeviceLocale,
  localeDirection,
  translate,
  type Locale,
  type LocalePreference,
} from '../../../../../lib/i18n';
