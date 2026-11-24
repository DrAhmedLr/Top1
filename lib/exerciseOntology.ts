import type {EquipmentOption} from './personalWorkspace';

export const EXERCISE_ONTOLOGY_VERSION = 'exercise-ontology-v2';

/**
 * 19 anatomically distinct muscle groups (anterior + posterior).
 * Fixes flat single-muscle tagging by using fractional stimulus weights per movement.
 */
export type MuscleId =
  | 'upper_chest'
  | 'mid_chest'
  | 'lower_chest'
  | 'front_delt'
  | 'side_delt'
  | 'rear_delt'
  | 'upper_back'
  | 'lats'
  | 'traps'
  | 'erectors'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export const ALL_MUSCLES: readonly MuscleId[] = [
  'upper_chest',
  'mid_chest',
  'lower_chest',
  'front_delt',
  'side_delt',
  'rear_delt',
  'upper_back',
  'lats',
  'traps',
  'erectors',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
] as const;

export type MuscleRegion = 'upper_anterior' | 'upper_posterior' | 'core' | 'lower_body';

export const MUSCLE_META: Record<
  MuscleId,
  {
    region: MuscleRegion;
    label: [string, string, string];
    /** Recovery time constant in hours after a standard hard working stimulus (larger/eccentric-heavy = slower). */
    recoveryTauHours: number;
    /** Base weekly effective-set landmarks for intermediate adults (MEV / MAV / MRV). */
    baseLandmarks: {mev: number; mav: number; mrv: number};
  }
> = {
  upper_chest: {region: 'upper_anterior', label: ['Upper Chest', 'Haut des pectoraux', 'أعلى الصدر'], recoveryTauHours: 36, baseLandmarks: {mev: 4, mav: 10, mrv: 16}},
  mid_chest: {region: 'upper_anterior', label: ['Mid Chest', 'Pectoraux centraux', 'وسط الصدر'], recoveryTauHours: 40, baseLandmarks: {mev: 6, mav: 12, mrv: 20}},
  lower_chest: {region: 'upper_anterior', label: ['Lower Chest', 'Bas des pectoraux', 'أسفل الصدر'], recoveryTauHours: 36, baseLandmarks: {mev: 3, mav: 8, mrv: 14}},
  front_delt: {region: 'upper_anterior', label: ['Front Delt', 'Deltoïde antérieur', 'الكتف الأمامي'], recoveryTauHours: 30, baseLandmarks: {mev: 4, mav: 10, mrv: 16}},
  side_delt: {region: 'upper_anterior', label: ['Side Delt', 'Deltoïde latéral', 'الكتف الجانبي'], recoveryTauHours: 22, baseLandmarks: {mev: 6, mav: 14, mrv: 22}},
  rear_delt: {region: 'upper_posterior', label: ['Rear Delt', 'Deltoïde postérieur', 'الكتف الخلفي'], recoveryTauHours: 22, baseLandmarks: {mev: 6, mav: 14, mrv: 22}},
  upper_back: {region: 'upper_posterior', label: ['Upper Back', 'Haut du dos', 'أعلى الظهر'], recoveryTauHours: 34, baseLandmarks: {mev: 6, mav: 14, mrv: 20}},
  lats: {region: 'upper_posterior', label: ['Lats', 'Dorsaux', 'عضلات اللاتس'], recoveryTauHours: 38, baseLandmarks: {mev: 6, mav: 14, mrv: 22}},
  traps: {region: 'upper_posterior', label: ['Traps', 'Trapèzes', 'الترابيس'], recoveryTauHours: 30, baseLandmarks: {mev: 4, mav: 10, mrv: 18}},
  erectors: {region: 'upper_posterior', label: ['Lower Back / Erectors', 'Lombaires', 'أسفل الظهر'], recoveryTauHours: 46, baseLandmarks: {mev: 4, mav: 8, mrv: 14}},
  biceps: {region: 'upper_anterior', label: ['Biceps', 'Biceps', 'البايسبس'], recoveryTauHours: 24, baseLandmarks: {mev: 6, mav: 14, mrv: 20}},
  triceps: {region: 'upper_posterior', label: ['Triceps', 'Triceps', 'الترايسبس'], recoveryTauHours: 28, baseLandmarks: {mev: 6, mav: 12, mrv: 18}},
  forearms: {region: 'upper_anterior', label: ['Forearms & Grip', 'Avant-bras & poigne', 'الساعد والقبضة'], recoveryTauHours: 20, baseLandmarks: {mev: 4, mav: 10, mrv: 16}},
  abs: {region: 'core', label: ['Abdominals', 'Abdominaux', 'البطن'], recoveryTauHours: 20, baseLandmarks: {mev: 4, mav: 12, mrv: 18}},
  obliques: {region: 'core', label: ['Obliques', 'Obliques', 'الجوانب'], recoveryTauHours: 20, baseLandmarks: {mev: 3, mav: 8, mrv: 14}},
  quads: {region: 'lower_body', label: ['Quads', 'Quadriceps', 'الأفخاذ الأمامية'], recoveryTauHours: 44, baseLandmarks: {mev: 6, mav: 14, mrv: 20}},
  hamstrings: {region: 'lower_body', label: ['Hamstrings', 'Ischio-jambiers', 'الأفخاذ الخلفية'], recoveryTauHours: 46, baseLandmarks: {mev: 6, mav: 12, mrv: 18}},
  glutes: {region: 'lower_body', label: ['Glutes', 'Fessiers', 'الأرداف'], recoveryTauHours: 42, baseLandmarks: {mev: 6, mav: 14, mrv: 20}},
  calves: {region: 'lower_body', label: ['Calves', 'Mollets', 'السمانة'], recoveryTauHours: 18, baseLandmarks: {mev: 6, mav: 12, mrv: 18}},
};

/**
 * 13 granular equipment categories (superset of the 12 reference buckets + outdoor track)
 * with clean lossless mapping from TOP1's coarse EquipmentOption[].
 */
export type DetailedEquipmentId =
  | 'none'
  | 'small_weights'
  | 'bars_plates'
  | 'calisthenics_bars'
  | 'benches_racks'
  | 'cable_machines'
  | 'resistance_bands'
  | 'exercise_balls'
  | 'plated_machines'
  | 'weighted_machines'
  | 'suspension_ropes'
  | 'cardio_machines'
  | 'outdoor_track';

export const ALL_DETAILED_EQUIPMENT: readonly DetailedEquipmentId[] = [
  'none',
  'small_weights',
  'bars_plates',
  'calisthenics_bars',
  'benches_racks',
  'cable_machines',
  'resistance_bands',
  'exercise_balls',
  'plated_machines',
  'weighted_machines',
  'suspension_ropes',
  'cardio_machines',
  'outdoor_track',
] as const;

export type MovementPattern =
  | 'horizontal_push'
  | 'incline_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'hinge'
  | 'squat'
  | 'lunge_unilateral'
  | 'core_stability'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'shoulder_isolation'
  | 'calf_isolation'
  | 'aerobic_steady'
  | 'aerobic_intervals';

export const ALL_MOVEMENT_PATTERNS: readonly MovementPattern[] = [
  'horizontal_push',
  'incline_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'hinge',
  'squat',
  'lunge_unilateral',
  'core_stability',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_isolation',
  'calf_isolation',
  'aerobic_steady',
  'aerobic_intervals',
] as const;

export type JointId = 'shoulder' | 'elbow' | 'wrist' | 'lumbar' | 'hip' | 'knee' | 'ankle';
/** 0 = negligible, 1 = low, 2 = moderate, 3 = high mechanical load on that joint. */
export type JointStressLevel = 0 | 1 | 2 | 3;

export type StimulusRole = 'primary' | 'secondary' | 'stabilizer';
export const STIMULUS_WEIGHT: Record<StimulusRole, number> = {
  primary: 1.0,
  secondary: 0.5,
  stabilizer: 0.25,
};

export type MuscleInvolvement = {
  muscle: MuscleId;
  role: StimulusRole;
  weight: number;
};

export type ExerciseDefinition = {
  id: string;
  name: string;
  aliases: readonly string[];
  pattern: MovementPattern;
  isCompound: boolean;
  /** Every listed equipment bucket is required simultaneously (empty = bodyweight/none). */
  requiredAll: readonly DetailedEquipmentId[];
  /** At least one bucket from this list must be available when non-empty. */
  anyOf?: readonly DetailedEquipmentId[];
  muscles: readonly MuscleInvolvement[];
  jointStress: Partial<Record<JointId, JointStressLevel>>;
  /** Systemic/CNS & axial fatigue rating (0.15 = light isolation, 1.0 = heavy bilateral axial compound). */
  systemicFatigue: number;
  /** Accurate time physics for realistic session budgeting. */
  timePhysics: {
    mode: 'reps' | 'seconds';
    defaultRepsOrSeconds: number;
    secondsPerRep: number;
    defaultRestSeconds: number;
    setupTransitionMinutes: number;
  };
  /** Optional linked TOP1 benchmark metric so logged sets feed verified capability. */
  linkedMetric?: string;
  /** Whether this exercise works cleanly in bodyweight/hotel/travel spaces. */
  travelFriendly: boolean;
  /** Joint-sparing friendly (low shear/impingement risk). */
  jointFriendly: boolean;
};

const m = (muscle: MuscleId, role: StimulusRole): MuscleInvolvement => ({
  muscle,
  role,
  weight: STIMULUS_WEIGHT[role],
});

/**
 * Curated biomechanical exercise ontology.
 * Every entry has physiologically accurate fractional muscle weights, equipment dependency rules,
 * joint stress profiles, systemic fatigue cost, and realistic time physics.
 */
export const EXERCISE_CATALOG: readonly ExerciseDefinition[] = [
  // === HORIZONTAL PUSH ===
  {
    id: 'barbell_bench_press',
    name: 'Barbell Bench Press',
    aliases: ['bench press', 'flat bench', 'barbell bench', 'bench'],
    pattern: 'horizontal_push',
    isCompound: true,
    requiredAll: ['bars_plates', 'benches_racks'],
    muscles: [m('mid_chest', 'primary'), m('front_delt', 'secondary'), m('triceps', 'secondary'), m('upper_chest', 'stabilizer')],
    jointStress: {shoulder: 2, elbow: 2, wrist: 2},
    systemicFatigue: 0.8,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 6, secondsPerRep: 4, defaultRestSeconds: 150, setupTransitionMinutes: 3},
    linkedMetric: 'bench_1rm',
    travelFriendly: false,
    jointFriendly: false,
  },
  {
    id: 'dumbbell_bench_press',
    name: 'Dumbbell Bench Press',
    aliases: ['db bench', 'dumbbell flat press'],
    pattern: 'horizontal_push',
    isCompound: true,
    requiredAll: ['small_weights', 'benches_racks'],
    muscles: [m('mid_chest', 'primary'), m('front_delt', 'secondary'), m('triceps', 'secondary'), m('upper_chest', 'stabilizer')],
    jointStress: {shoulder: 1, elbow: 1, wrist: 1},
    systemicFatigue: 0.7,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 8, secondsPerRep: 4, defaultRestSeconds: 120, setupTransitionMinutes: 2},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'dumbbell_floor_press',
    name: 'Dumbbell Floor Press',
    aliases: ['floor press', 'db floor press'],
    pattern: 'horizontal_push',
    isCompound: true,
    requiredAll: ['small_weights'],
    muscles: [m('mid_chest', 'primary'), m('triceps', 'primary'), m('front_delt', 'secondary')],
    jointStress: {shoulder: 1, elbow: 1, wrist: 1},
    systemicFatigue: 0.6,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'machine_chest_press',
    name: 'Chest Press Machine',
    aliases: ['seated chest press', 'plated chest press'],
    pattern: 'horizontal_push',
    isCompound: true,
    requiredAll: [],
    anyOf: ['weighted_machines', 'plated_machines'],
    muscles: [m('mid_chest', 'primary'), m('triceps', 'secondary'), m('front_delt', 'secondary')],
    jointStress: {shoulder: 1, elbow: 1, wrist: 1},
    systemicFatigue: 0.55,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'push_ups',
    name: 'Strict Push-Ups',
    aliases: ['push up', 'push-up', 'pushups', 'push ups'],
    pattern: 'horizontal_push',
    isCompound: true,
    requiredAll: [],
    // Physiologically accurate: standard push-ups primarily recruit mid-chest, triceps & front delts (NOT upper chest!).
    muscles: [m('mid_chest', 'primary'), m('triceps', 'secondary'), m('front_delt', 'secondary'), m('abs', 'stabilizer')],
    jointStress: {shoulder: 1, elbow: 1, wrist: 2},
    systemicFatigue: 0.45,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 14, secondsPerRep: 3, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    linkedMetric: 'pushups',
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'parallel_bar_dips',
    name: 'Chest-Leaning Parallel Bar Dips',
    aliases: ['dips', 'chest dips', 'parallel dips'],
    pattern: 'horizontal_push',
    isCompound: true,
    requiredAll: ['calisthenics_bars'],
    muscles: [m('lower_chest', 'primary'), m('mid_chest', 'secondary'), m('triceps', 'primary'), m('front_delt', 'secondary')],
    jointStress: {shoulder: 3, elbow: 2, wrist: 1},
    systemicFatigue: 0.7,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 8, secondsPerRep: 4, defaultRestSeconds: 120, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: false,
  },

  // === INCLINE PUSH ===
  {
    id: 'incline_dumbbell_press',
    name: 'Incline Dumbbell Press',
    aliases: ['incline press', 'incline db press'],
    pattern: 'incline_push',
    isCompound: true,
    requiredAll: ['small_weights', 'benches_racks'],
    muscles: [m('upper_chest', 'primary'), m('front_delt', 'secondary'), m('triceps', 'secondary'), m('mid_chest', 'secondary')],
    jointStress: {shoulder: 2, elbow: 1, wrist: 1},
    systemicFatigue: 0.65,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 105, setupTransitionMinutes: 2},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'decline_push_ups',
    name: 'Feet-Elevated Push-Ups',
    aliases: ['decline pushups', 'elevated push ups'],
    pattern: 'incline_push',
    isCompound: true,
    requiredAll: [],
    muscles: [m('upper_chest', 'primary'), m('front_delt', 'secondary'), m('triceps', 'secondary'), m('abs', 'stabilizer')],
    jointStress: {shoulder: 2, elbow: 1, wrist: 2},
    systemicFatigue: 0.5,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'cable_chest_fly',
    name: 'Cable Chest Fly',
    aliases: ['cable fly', 'standing cable fly', 'pec fly'],
    pattern: 'horizontal_push',
    isCompound: false,
    requiredAll: ['cable_machines'],
    muscles: [m('mid_chest', 'primary'), m('lower_chest', 'secondary'), m('front_delt', 'stabilizer')],
    jointStress: {shoulder: 1, elbow: 1},
    systemicFatigue: 0.3,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },

  // === VERTICAL PUSH ===
  {
    id: 'overhead_barbell_press',
    name: 'Standing Overhead Press',
    aliases: ['ohp', 'military press', 'barbell shoulder press'],
    pattern: 'vertical_push',
    isCompound: true,
    requiredAll: ['bars_plates'],
    muscles: [m('front_delt', 'primary'), m('side_delt', 'secondary'), m('triceps', 'secondary'), m('upper_chest', 'stabilizer'), m('abs', 'stabilizer')],
    jointStress: {shoulder: 2, elbow: 1, wrist: 2, lumbar: 2},
    systemicFatigue: 0.75,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 6, secondsPerRep: 4, defaultRestSeconds: 120, setupTransitionMinutes: 2},
    travelFriendly: false,
    jointFriendly: false,
  },
  {
    id: 'dumbbell_shoulder_press',
    name: 'Seated Dumbbell Shoulder Press',
    aliases: ['db shoulder press', 'dumbbell ohp'],
    pattern: 'vertical_push',
    isCompound: true,
    requiredAll: ['small_weights'],
    muscles: [m('front_delt', 'primary'), m('side_delt', 'secondary'), m('triceps', 'secondary')],
    jointStress: {shoulder: 2, elbow: 1, wrist: 1},
    systemicFatigue: 0.6,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'pike_push_ups',
    name: 'Pike Push-Ups',
    aliases: ['pike press', 'bodyweight shoulder press'],
    pattern: 'vertical_push',
    isCompound: true,
    requiredAll: [],
    muscles: [m('front_delt', 'primary'), m('triceps', 'secondary'), m('upper_chest', 'secondary'), m('side_delt', 'stabilizer')],
    jointStress: {shoulder: 2, wrist: 2},
    systemicFatigue: 0.5,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },

  // === VERTICAL PULL ===
  {
    id: 'pull_ups',
    name: 'Pull-Ups',
    aliases: ['pullup', 'pull ups', 'chin ups', 'chin-ups'],
    pattern: 'vertical_pull',
    isCompound: true,
    requiredAll: ['calisthenics_bars'],
    muscles: [m('lats', 'primary'), m('upper_back', 'secondary'), m('biceps', 'secondary'), m('forearms', 'secondary'), m('abs', 'stabilizer')],
    jointStress: {shoulder: 2, elbow: 2},
    systemicFatigue: 0.75,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 8, secondsPerRep: 4, defaultRestSeconds: 120, setupTransitionMinutes: 1},
    linkedMetric: 'pullups',
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'lat_pulldown',
    name: 'Cable Lat Pulldown',
    aliases: ['pulldown', 'lat pull down'],
    pattern: 'vertical_pull',
    isCompound: true,
    requiredAll: [],
    anyOf: ['cable_machines', 'weighted_machines'],
    muscles: [m('lats', 'primary'), m('upper_back', 'secondary'), m('biceps', 'secondary'), m('forearms', 'stabilizer')],
    jointStress: {shoulder: 1, elbow: 1},
    systemicFatigue: 0.55,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'band_lat_pulldown',
    name: 'Resistance Band Pulldown',
    aliases: ['band pulldown', 'banded pull'],
    pattern: 'vertical_pull',
    isCompound: true,
    requiredAll: ['resistance_bands'],
    muscles: [m('lats', 'primary'), m('upper_back', 'secondary'), m('biceps', 'secondary')],
    jointStress: {shoulder: 1, elbow: 1},
    systemicFatigue: 0.35,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 14, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },

  // === HORIZONTAL PULL ===
  {
    id: 'chest_supported_db_row',
    name: 'Chest-Supported Dumbbell Row',
    aliases: ['dumbbell row', 'db row', 'incline db row', 'one-arm dumbbell row'],
    pattern: 'horizontal_pull',
    isCompound: true,
    requiredAll: ['small_weights'],
    muscles: [m('upper_back', 'primary'), m('lats', 'primary'), m('rear_delt', 'secondary'), m('biceps', 'secondary'), m('traps', 'secondary'), m('forearms', 'stabilizer')],
    jointStress: {shoulder: 1, elbow: 1, lumbar: 0},
    systemicFatigue: 0.55,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'barbell_bent_over_row',
    name: 'Barbell Bent-Over Row',
    aliases: ['barbell row', 'pendlay row', 'bb row'],
    pattern: 'horizontal_pull',
    isCompound: true,
    requiredAll: ['bars_plates'],
    muscles: [m('upper_back', 'primary'), m('lats', 'primary'), m('traps', 'secondary'), m('rear_delt', 'secondary'), m('erectors', 'secondary'), m('biceps', 'secondary')],
    jointStress: {lumbar: 2, shoulder: 1, elbow: 1},
    systemicFatigue: 0.8,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 8, secondsPerRep: 4, defaultRestSeconds: 120, setupTransitionMinutes: 2},
    travelFriendly: false,
    jointFriendly: false,
  },
  {
    id: 'seated_cable_row',
    name: 'Seated Cable Row',
    aliases: ['cable row', 'machine row'],
    pattern: 'horizontal_pull',
    isCompound: true,
    requiredAll: [],
    anyOf: ['cable_machines', 'weighted_machines', 'plated_machines'],
    muscles: [m('upper_back', 'primary'), m('lats', 'secondary'), m('rear_delt', 'secondary'), m('traps', 'secondary'), m('biceps', 'secondary')],
    jointStress: {shoulder: 1, elbow: 1, lumbar: 1},
    systemicFatigue: 0.55,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'inverted_row',
    name: 'Inverted Bodyweight Row',
    aliases: ['australian pullup', 'trx row', 'suspension row', 'table row'],
    pattern: 'horizontal_pull',
    isCompound: true,
    requiredAll: [],
    anyOf: ['calisthenics_bars', 'suspension_ropes'],
    muscles: [m('upper_back', 'primary'), m('lats', 'secondary'), m('rear_delt', 'secondary'), m('biceps', 'secondary'), m('abs', 'stabilizer')],
    jointStress: {shoulder: 1, elbow: 1},
    systemicFatigue: 0.45,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'prone_ytw_raises',
    name: 'Prone Y-T-W Floor Pulls',
    aliases: ['floor ytw', 'superman pull', 'bodyweight back'],
    pattern: 'horizontal_pull',
    isCompound: false,
    requiredAll: [],
    muscles: [m('upper_back', 'primary'), m('rear_delt', 'primary'), m('traps', 'secondary'), m('erectors', 'secondary')],
    jointStress: {shoulder: 0, lumbar: 1},
    systemicFatigue: 0.25,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 4, defaultRestSeconds: 45, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },

  // === SQUAT / KNEE DOMINANT ===
  {
    id: 'barbell_back_squat',
    name: 'Barbell Back Squat',
    aliases: ['squat', 'back squat', 'barbell squat'],
    pattern: 'squat',
    isCompound: true,
    requiredAll: ['bars_plates', 'benches_racks'],
    muscles: [m('quads', 'primary'), m('glutes', 'primary'), m('erectors', 'secondary'), m('hamstrings', 'stabilizer'), m('abs', 'stabilizer')],
    jointStress: {knee: 2, hip: 2, lumbar: 3, ankle: 1},
    systemicFatigue: 0.95,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 5, secondsPerRep: 5, defaultRestSeconds: 180, setupTransitionMinutes: 3},
    linkedMetric: 'squat_1rm',
    travelFriendly: false,
    jointFriendly: false,
  },
  {
    id: 'goblet_squat',
    name: 'Goblet Squat',
    aliases: ['db squat', 'dumbbell squat', 'kettlebell squat'],
    pattern: 'squat',
    isCompound: true,
    requiredAll: ['small_weights'],
    muscles: [m('quads', 'primary'), m('glutes', 'primary'), m('abs', 'stabilizer'), m('upper_back', 'stabilizer')],
    jointStress: {knee: 1, hip: 1, lumbar: 1},
    systemicFatigue: 0.6,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'leg_press',
    name: 'Leg Press',
    aliases: ['45 degree leg press', 'machine leg press'],
    pattern: 'squat',
    isCompound: true,
    requiredAll: [],
    anyOf: ['plated_machines', 'weighted_machines'],
    muscles: [m('quads', 'primary'), m('glutes', 'secondary'), m('hamstrings', 'stabilizer')],
    jointStress: {knee: 2, hip: 1, lumbar: 0},
    systemicFatigue: 0.7,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 120, setupTransitionMinutes: 2},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'tempo_bodyweight_squat',
    name: 'Tempo Bodyweight Squat',
    aliases: ['air squat', 'bodyweight squat', 'prisoner squat'],
    pattern: 'squat',
    isCompound: true,
    requiredAll: [],
    muscles: [m('quads', 'primary'), m('glutes', 'primary'), m('calves', 'stabilizer')],
    jointStress: {knee: 1, hip: 1},
    systemicFatigue: 0.35,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 16, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },

  // === LUNGE / UNILATERAL ===
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    aliases: ['split squat', 'rear foot elevated split squat', 'rfess'],
    pattern: 'lunge_unilateral',
    isCompound: true,
    requiredAll: [],
    muscles: [m('quads', 'primary'), m('glutes', 'primary'), m('hamstrings', 'secondary'), m('calves', 'stabilizer')],
    jointStress: {knee: 2, hip: 1, ankle: 1},
    systemicFatigue: 0.7,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 5, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'dumbbell_reverse_lunge',
    name: 'Dumbbell Reverse Lunge',
    aliases: ['reverse lunge', 'db lunge', 'walking lunge'],
    pattern: 'lunge_unilateral',
    isCompound: true,
    requiredAll: ['small_weights'],
    muscles: [m('quads', 'primary'), m('glutes', 'primary'), m('hamstrings', 'secondary')],
    jointStress: {knee: 1, hip: 1, ankle: 1},
    systemicFatigue: 0.65,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 5, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },

  // === HINGE / POSTERIOR CHAIN ===
  {
    id: 'barbell_deadlift',
    name: 'Barbell Deadlift',
    aliases: ['deadlift', 'conventional deadlift'],
    pattern: 'hinge',
    isCompound: true,
    requiredAll: ['bars_plates'],
    muscles: [m('hamstrings', 'primary'), m('glutes', 'primary'), m('erectors', 'primary'), m('traps', 'secondary'), m('forearms', 'secondary'), m('lats', 'stabilizer')],
    jointStress: {lumbar: 3, hip: 2, knee: 1},
    systemicFatigue: 1.0,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 5, secondsPerRep: 5, defaultRestSeconds: 180, setupTransitionMinutes: 3},
    linkedMetric: 'deadlift_1rm',
    travelFriendly: false,
    jointFriendly: false,
  },
  {
    id: 'dumbbell_rdl',
    name: 'Dumbbell Romanian Deadlift',
    aliases: ['rdl', 'db rdl', 'romanian deadlift', 'stiff leg deadlift'],
    pattern: 'hinge',
    isCompound: true,
    requiredAll: ['small_weights'],
    muscles: [m('hamstrings', 'primary'), m('glutes', 'primary'), m('erectors', 'secondary'), m('forearms', 'stabilizer')],
    jointStress: {lumbar: 2, hip: 1},
    systemicFatigue: 0.7,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 105, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'seated_leg_curl',
    name: 'Seated Leg Curl',
    aliases: ['leg curl', 'hamstring curl', 'lying leg curl'],
    pattern: 'hinge',
    isCompound: false,
    requiredAll: ['weighted_machines'],
    muscles: [m('hamstrings', 'primary'), m('calves', 'stabilizer')],
    jointStress: {knee: 1, lumbar: 0},
    systemicFatigue: 0.35,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'single_leg_glute_bridge',
    name: 'Single-Leg Glute Bridge',
    aliases: ['glute bridge', 'hip bridge', 'hip thrust'],
    pattern: 'hinge',
    isCompound: true,
    requiredAll: [],
    muscles: [m('glutes', 'primary'), m('hamstrings', 'primary'), m('erectors', 'stabilizer')],
    jointStress: {hip: 1, lumbar: 0, knee: 0},
    systemicFatigue: 0.35,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 4, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },

  // === ISOLATION: ARMS, SHOULDERS, CALVES, CORE ===
  {
    id: 'dumbbell_lateral_raise',
    name: 'Dumbbell Lateral Raise',
    aliases: ['lateral raise', 'side raise', 'side delt raise'],
    pattern: 'shoulder_isolation',
    isCompound: false,
    requiredAll: ['small_weights'],
    muscles: [m('side_delt', 'primary'), m('traps', 'stabilizer')],
    jointStress: {shoulder: 1},
    systemicFatigue: 0.25,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 14, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'cable_face_pull',
    name: 'Cable Face Pull',
    aliases: ['face pull', 'rear delt pull', 'band pull apart'],
    pattern: 'shoulder_isolation',
    isCompound: false,
    requiredAll: [],
    anyOf: ['cable_machines', 'resistance_bands'],
    muscles: [m('rear_delt', 'primary'), m('upper_back', 'secondary'), m('traps', 'secondary')],
    jointStress: {shoulder: 0, elbow: 0},
    systemicFatigue: 0.2,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 15, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'dumbbell_bicep_curl',
    name: 'Dumbbell Bicep Curl',
    aliases: ['bicep curl', 'hammer curl', 'db curl'],
    pattern: 'elbow_flexion',
    isCompound: false,
    requiredAll: ['small_weights'],
    muscles: [m('biceps', 'primary'), m('forearms', 'secondary')],
    jointStress: {elbow: 1, wrist: 1},
    systemicFatigue: 0.25,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'cable_tricep_pushdown',
    name: 'Cable Tricep Pushdown',
    aliases: ['tricep pushdown', 'rope pushdown', 'tricep extension'],
    pattern: 'elbow_extension',
    isCompound: false,
    requiredAll: [],
    anyOf: ['cable_machines', 'resistance_bands'],
    muscles: [m('triceps', 'primary')],
    jointStress: {elbow: 1},
    systemicFatigue: 0.25,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'standing_calf_raise',
    name: 'Single-Leg Standing Calf Raise',
    aliases: ['calf raise', 'standing calf raise', 'heel raise'],
    pattern: 'calf_isolation',
    isCompound: false,
    requiredAll: [],
    muscles: [m('calves', 'primary')],
    jointStress: {ankle: 1},
    systemicFatigue: 0.2,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 15, secondsPerRep: 3, defaultRestSeconds: 45, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'dead_bug_core',
    name: 'Controlled Dead Bug / Hollow Hold',
    aliases: ['dead bug', 'plank', 'hollow hold', 'ab wheel', 'ab wheel rollout'],
    pattern: 'core_stability',
    isCompound: false,
    requiredAll: [],
    muscles: [m('abs', 'primary'), m('obliques', 'secondary')],
    jointStress: {lumbar: 0},
    systemicFatigue: 0.2,
    timePhysics: {mode: 'seconds', defaultRepsOrSeconds: 45, secondsPerRep: 1, defaultRestSeconds: 45, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'side_plank_reach',
    name: 'Side Plank',
    aliases: ['side plank', 'pallof press', 'oblique hold'],
    pattern: 'core_stability',
    isCompound: false,
    requiredAll: [],
    muscles: [m('obliques', 'primary'), m('abs', 'secondary'), m('glutes', 'stabilizer')],
    jointStress: {shoulder: 1, lumbar: 0},
    systemicFatigue: 0.2,
    timePhysics: {mode: 'seconds', defaultRepsOrSeconds: 40, secondsPerRep: 1, defaultRestSeconds: 45, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'farmers_carry',
    name: 'Heavy Farmer’s Carry',
    aliases: ['farmers walk', 'farmer carry', 'dead hang', 'grip hold'],
    pattern: 'core_stability',
    isCompound: true,
    requiredAll: ['small_weights'],
    muscles: [m('forearms', 'primary'), m('traps', 'primary'), m('obliques', 'secondary'), m('abs', 'secondary')],
    jointStress: {wrist: 1, lumbar: 1},
    systemicFatigue: 0.5,
    timePhysics: {mode: 'seconds', defaultRepsOrSeconds: 40, secondsPerRep: 1, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    linkedMetric: 'grip_strength',
    travelFriendly: false,
    jointFriendly: true,
  },

  // === CONDITIONING / AEROBIC ===
  {
    id: 'outdoor_easy_run',
    name: 'Zone 2 Easy Run',
    aliases: ['5 km run', '5k run', 'easy run', 'aerobic run', 'jog'],
    pattern: 'aerobic_steady',
    isCompound: true,
    requiredAll: [],
    anyOf: ['outdoor_track', 'cardio_machines'],
    muscles: [m('calves', 'primary'), m('quads', 'secondary'), m('hamstrings', 'secondary'), m('glutes', 'secondary')],
    jointStress: {knee: 2, ankle: 2, hip: 1},
    systemicFatigue: 0.55,
    timePhysics: {mode: 'seconds', defaultRepsOrSeconds: 1200, secondsPerRep: 1, defaultRestSeconds: 0, setupTransitionMinutes: 2},
    linkedMetric: 'run_5k',
    travelFriendly: true,
    jointFriendly: false,
  },
  {
    id: 'low_impact_erg_intervals',
    name: 'Low-Impact Bike / Air-Bike Intervals',
    aliases: ['air bike', 'assault bike', 'cycling intervals', 'rower', 'stationary bike'],
    pattern: 'aerobic_intervals',
    isCompound: true,
    requiredAll: ['cardio_machines'],
    muscles: [m('quads', 'primary'), m('glutes', 'secondary'), m('calves', 'secondary')],
    jointStress: {knee: 1, ankle: 0, hip: 1},
    systemicFatigue: 0.65,
    timePhysics: {mode: 'seconds', defaultRepsOrSeconds: 180, secondsPerRep: 1, defaultRestSeconds: 90, setupTransitionMinutes: 2},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'brisk_incline_walk_or_march',
    name: 'Brisk Tempo Walk / Stair March',
    aliases: ['incline walk', 'brisk walk', 'recovery walk', 'cardio'],
    pattern: 'aerobic_steady',
    isCompound: true,
    requiredAll: [],
    muscles: [m('calves', 'secondary'), m('glutes', 'secondary'), m('quads', 'stabilizer')],
    jointStress: {knee: 0, ankle: 1},
    systemicFatigue: 0.25,
    timePhysics: {mode: 'seconds', defaultRepsOrSeconds: 900, secondsPerRep: 1, defaultRestSeconds: 0, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },

  // === EXPANDED BIOMECHANICAL ONTOLOGY (V2 — FULL 13-EQUIPMENT & 19-MUSCLE COVERAGE) ===
  {
    id: 'incline_barbell_bench',
    name: 'Incline Barbell Bench Press',
    aliases: ['incline bench', 'incline barbell press'],
    pattern: 'incline_push',
    isCompound: true,
    requiredAll: ['bars_plates', 'benches_racks'],
    muscles: [m('upper_chest', 'primary'), m('front_delt', 'secondary'), m('triceps', 'secondary'), m('mid_chest', 'secondary')],
    jointStress: {shoulder: 2, elbow: 2, wrist: 2},
    systemicFatigue: 0.78,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 8, secondsPerRep: 4, defaultRestSeconds: 135, setupTransitionMinutes: 3},
    travelFriendly: false,
    jointFriendly: false,
  },
  {
    id: 'suspension_push_up',
    name: 'Ring / Suspension Push-Up',
    aliases: ['trx pushup', 'ring push up', 'suspension pushup'],
    pattern: 'horizontal_push',
    isCompound: true,
    requiredAll: ['suspension_ropes'],
    muscles: [m('mid_chest', 'primary'), m('triceps', 'secondary'), m('front_delt', 'secondary'), m('abs', 'secondary')],
    jointStress: {shoulder: 1, elbow: 1, wrist: 1},
    systemicFatigue: 0.52,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'close_grip_bench_press',
    name: 'Close-Grip Barbell Bench Press',
    aliases: ['close grip bench', 'cgbp'],
    pattern: 'horizontal_push',
    isCompound: true,
    requiredAll: ['bars_plates', 'benches_racks'],
    muscles: [m('triceps', 'primary'), m('mid_chest', 'secondary'), m('front_delt', 'secondary')],
    jointStress: {shoulder: 1, elbow: 2, wrist: 2},
    systemicFatigue: 0.72,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 8, secondsPerRep: 4, defaultRestSeconds: 120, setupTransitionMinutes: 3},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'machine_shoulder_press',
    name: 'Machine Shoulder Press',
    aliases: ['overhead press machine', 'plated shoulder press'],
    pattern: 'vertical_push',
    isCompound: true,
    requiredAll: [],
    anyOf: ['weighted_machines', 'plated_machines'],
    muscles: [m('front_delt', 'primary'), m('side_delt', 'secondary'), m('triceps', 'secondary')],
    jointStress: {shoulder: 1, elbow: 1},
    systemicFatigue: 0.55,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 90, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'straight_arm_cable_pulldown',
    name: 'Straight-Arm Cable Pulldown',
    aliases: ['lat prayer', 'cable pullover', 'straight arm pulldown'],
    pattern: 'vertical_pull',
    isCompound: false,
    requiredAll: ['cable_machines'],
    muscles: [m('lats', 'primary'), m('triceps', 'stabilizer'), m('abs', 'stabilizer')],
    jointStress: {shoulder: 1, elbow: 0},
    systemicFatigue: 0.3,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 't_bar_chest_supported_row',
    name: 'Chest-Supported T-Bar / Plate Row',
    aliases: ['t bar row', 'plate loaded row', 'machine chest supported row'],
    pattern: 'horizontal_pull',
    isCompound: true,
    requiredAll: ['plated_machines'],
    muscles: [m('upper_back', 'primary'), m('lats', 'primary'), m('rear_delt', 'secondary'), m('traps', 'secondary'), m('biceps', 'secondary')],
    jointStress: {shoulder: 1, elbow: 1, lumbar: 0},
    systemicFatigue: 0.6,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 105, setupTransitionMinutes: 2},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'barbell_front_squat',
    name: 'Barbell Front Squat',
    aliases: ['front squat'],
    pattern: 'squat',
    isCompound: true,
    requiredAll: ['bars_plates', 'benches_racks'],
    muscles: [m('quads', 'primary'), m('glutes', 'primary'), m('upper_back', 'secondary'), m('abs', 'secondary'), m('erectors', 'secondary')],
    jointStress: {knee: 2, hip: 2, wrist: 2, lumbar: 2},
    systemicFatigue: 0.9,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 6, secondsPerRep: 5, defaultRestSeconds: 150, setupTransitionMinutes: 3},
    travelFriendly: false,
    jointFriendly: false,
  },
  {
    id: 'hack_squat_machine',
    name: 'Hack Squat Machine',
    aliases: ['hack squat', 'pendulum squat'],
    pattern: 'squat',
    isCompound: true,
    requiredAll: ['plated_machines'],
    muscles: [m('quads', 'primary'), m('glutes', 'secondary')],
    jointStress: {knee: 2, hip: 1, lumbar: 0},
    systemicFatigue: 0.72,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 120, setupTransitionMinutes: 2},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'barbell_hip_thrust',
    name: 'Barbell Hip Thrust',
    aliases: ['hip thrust', 'glute thrust'],
    pattern: 'hinge',
    isCompound: true,
    requiredAll: ['bars_plates', 'benches_racks'],
    muscles: [m('glutes', 'primary'), m('hamstrings', 'secondary'), m('quads', 'stabilizer')],
    jointStress: {hip: 1, lumbar: 1, knee: 0},
    systemicFatigue: 0.65,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 4, defaultRestSeconds: 120, setupTransitionMinutes: 3},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'stability_ball_hamstring_curl',
    name: 'Stability Ball Hamstring Curl',
    aliases: ['swiss ball leg curl', 'exercise ball hamstring curl'],
    pattern: 'hinge',
    isCompound: false,
    requiredAll: ['exercise_balls'],
    muscles: [m('hamstrings', 'primary'), m('glutes', 'secondary'), m('abs', 'stabilizer')],
    jointStress: {knee: 1, lumbar: 0},
    systemicFatigue: 0.3,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 14, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'back_extension_45',
    name: '45° Back Extension',
    aliases: ['hyperextension', 'back extension', 'roman chair'],
    pattern: 'hinge',
    isCompound: true,
    requiredAll: ['benches_racks'],
    muscles: [m('erectors', 'primary'), m('glutes', 'primary'), m('hamstrings', 'secondary')],
    jointStress: {lumbar: 1, hip: 1},
    systemicFatigue: 0.45,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 4, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'kettlebell_swing',
    name: 'Kettlebell Hip-Hinge Swing',
    aliases: ['kb swing', 'russian kettlebell swing'],
    pattern: 'hinge',
    isCompound: true,
    requiredAll: ['small_weights'],
    muscles: [m('glutes', 'primary'), m('hamstrings', 'primary'), m('erectors', 'secondary'), m('forearms', 'secondary'), m('abs', 'stabilizer')],
    jointStress: {hip: 1, lumbar: 2},
    systemicFatigue: 0.6,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 15, secondsPerRep: 2, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'dumbbell_step_up',
    name: 'Dumbbell Box Step-Up',
    aliases: ['step up', 'weighted step up'],
    pattern: 'lunge_unilateral',
    isCompound: true,
    requiredAll: ['small_weights', 'benches_racks'],
    muscles: [m('quads', 'primary'), m('glutes', 'primary'), m('calves', 'stabilizer')],
    jointStress: {knee: 1, hip: 1, ankle: 1},
    systemicFatigue: 0.55,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 10, secondsPerRep: 5, defaultRestSeconds: 75, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'band_lateral_raise',
    name: 'Resistance Band Lateral Raise',
    aliases: ['banded side raise', 'band lateral raise'],
    pattern: 'shoulder_isolation',
    isCompound: false,
    requiredAll: ['resistance_bands'],
    muscles: [m('side_delt', 'primary'), m('traps', 'stabilizer')],
    jointStress: {shoulder: 1},
    systemicFatigue: 0.2,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 15, secondsPerRep: 3, defaultRestSeconds: 45, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'cable_lateral_raise',
    name: 'Single-Arm Cable Lateral Raise',
    aliases: ['cable side raise', 'cable lateral raise'],
    pattern: 'shoulder_isolation',
    isCompound: false,
    requiredAll: ['cable_machines'],
    muscles: [m('side_delt', 'primary')],
    jointStress: {shoulder: 1},
    systemicFatigue: 0.22,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 14, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'cable_bicep_curl',
    name: 'Cable Bicep Curl',
    aliases: ['ez bar curl', 'barbell curl', 'cable curl'],
    pattern: 'elbow_flexion',
    isCompound: false,
    requiredAll: [],
    anyOf: ['cable_machines', 'bars_plates', 'resistance_bands'],
    muscles: [m('biceps', 'primary'), m('forearms', 'secondary')],
    jointStress: {elbow: 1, wrist: 1},
    systemicFatigue: 0.24,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'overhead_dumbbell_tricep_ext',
    name: 'Overhead Dumbbell Tricep Extension',
    aliases: ['tricep overhead extension', 'french press', 'skull crusher'],
    pattern: 'elbow_extension',
    isCompound: false,
    requiredAll: ['small_weights'],
    muscles: [m('triceps', 'primary')],
    jointStress: {elbow: 2, shoulder: 1},
    systemicFatigue: 0.25,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: false,
  },
  {
    id: 'hanging_knee_leg_raise',
    name: 'Hanging Leg / Knee Raise',
    aliases: ['hanging leg raise', 'toes to bar', 'captains chair'],
    pattern: 'core_stability',
    isCompound: false,
    requiredAll: ['calisthenics_bars'],
    muscles: [m('abs', 'primary'), m('obliques', 'secondary'), m('forearms', 'secondary')],
    jointStress: {shoulder: 1, lumbar: 0},
    systemicFatigue: 0.35,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 3, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'cable_pallof_press',
    name: 'Anti-Rotation Pallof Press',
    aliases: ['pallof press', 'band pallof press', 'cable pallof'],
    pattern: 'core_stability',
    isCompound: false,
    requiredAll: [],
    anyOf: ['cable_machines', 'resistance_bands'],
    muscles: [m('obliques', 'primary'), m('abs', 'primary')],
    jointStress: {lumbar: 0, shoulder: 0},
    systemicFatigue: 0.2,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 12, secondsPerRep: 4, defaultRestSeconds: 45, setupTransitionMinutes: 1},
    travelFriendly: true,
    jointFriendly: true,
  },
  {
    id: 'dead_hang_bar',
    name: 'Two-Arm Dead Hang',
    aliases: ['dead hang', 'bar hang', 'grip hang'],
    pattern: 'core_stability',
    isCompound: false,
    requiredAll: ['calisthenics_bars'],
    muscles: [m('forearms', 'primary'), m('lats', 'stabilizer'), m('upper_back', 'stabilizer')],
    jointStress: {shoulder: 1, elbow: 1, wrist: 1},
    systemicFatigue: 0.25,
    timePhysics: {mode: 'seconds', defaultRepsOrSeconds: 45, secondsPerRep: 1, defaultRestSeconds: 60, setupTransitionMinutes: 1},
    linkedMetric: 'dead_hang',
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'seated_calf_raise_machine',
    name: 'Seated Calf Raise',
    aliases: ['seated calf raise', 'soleus raise'],
    pattern: 'calf_isolation',
    isCompound: false,
    requiredAll: [],
    anyOf: ['plated_machines', 'weighted_machines'],
    muscles: [m('calves', 'primary')],
    jointStress: {ankle: 1},
    systemicFatigue: 0.2,
    timePhysics: {mode: 'reps', defaultRepsOrSeconds: 15, secondsPerRep: 3, defaultRestSeconds: 45, setupTransitionMinutes: 1},
    travelFriendly: false,
    jointFriendly: true,
  },
  {
    id: 'rowing_ergometer_steady',
    name: 'Rowing Ergometer Zone 2',
    aliases: ['concept2', 'erg row', 'indoor rowing'],
    pattern: 'aerobic_steady',
    isCompound: true,
    requiredAll: ['cardio_machines'],
    muscles: [m('quads', 'secondary'), m('upper_back', 'secondary'), m('lats', 'secondary'), m('hamstrings', 'stabilizer')],
    jointStress: {knee: 1, lumbar: 1, ankle: 0},
    systemicFatigue: 0.5,
    timePhysics: {mode: 'seconds', defaultRepsOrSeconds: 1200, secondsPerRep: 1, defaultRestSeconds: 0, setupTransitionMinutes: 2},
    travelFriendly: false,
    jointFriendly: true,
  },
];

export const EXERCISE_BY_ID: ReadonlyMap<string, ExerciseDefinition> = new Map(
  EXERCISE_CATALOG.map(ex => [ex.id, ex]),
);

const PATTERN_DEFAULT_JOINT_STRESS: Record<MovementPattern, Partial<Record<JointId, JointStressLevel>>> = {
  horizontal_push: {shoulder: 2, elbow: 1, wrist: 1},
  incline_push: {shoulder: 2, elbow: 1, wrist: 1},
  vertical_push: {shoulder: 2, elbow: 1, wrist: 1, lumbar: 1},
  horizontal_pull: {shoulder: 1, elbow: 1, lumbar: 1},
  vertical_pull: {shoulder: 1, elbow: 1},
  hinge: {lumbar: 2, hip: 2, knee: 1},
  squat: {knee: 2, hip: 2, lumbar: 2, ankle: 1},
  lunge_unilateral: {knee: 1, hip: 1, ankle: 1},
  core_stability: {lumbar: 0},
  elbow_flexion: {elbow: 1, wrist: 1},
  elbow_extension: {elbow: 1},
  shoulder_isolation: {shoulder: 1},
  calf_isolation: {ankle: 1},
  aerobic_steady: {knee: 1, ankle: 1},
  aerobic_intervals: {knee: 1, ankle: 1},
};

const PATTERN_DEFAULT_STABILIZERS: Partial<Record<MovementPattern, MuscleId[]>> = {
  horizontal_push: ['front_delt', 'triceps'],
  incline_push: ['front_delt', 'triceps'],
  vertical_push: ['triceps', 'abs'],
  horizontal_pull: ['rear_delt', 'biceps'],
  vertical_pull: ['biceps', 'forearms'],
  hinge: ['erectors', 'forearms'],
  squat: ['abs', 'erectors'],
  lunge_unilateral: ['calves', 'abs'],
};

export type CustomExerciseInput = {
  id?: string;
  name: string;
  pattern: MovementPattern;
  isCompound?: boolean;
  primaryMuscles: MuscleId[];
  secondaryMuscles?: MuscleId[];
  requiredAll?: DetailedEquipmentId[];
  mode?: 'reps' | 'seconds';
  defaultAmount?: number;
  defaultRestSeconds?: number;
};

export function slugifyCustomExercise(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `custom_${base || 'exercise'}`;
}

/**
 * Automatically infers fractional muscle weights (1.0 / 0.5 / 0.25), joint stress vectors,
 * systemic CNS fatigue, and realistic time physics for any user-created custom exercise.
 */
export function inferCustomExerciseProfile(input: CustomExerciseInput): ExerciseDefinition {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new RangeError('Custom exercise name must be 2–120 characters.');
  }
  const validMuscles = new Set<string>(ALL_MUSCLES);
  const validEquip = new Set<string>(ALL_DETAILED_EQUIPMENT);
  const validPatterns = new Set<string>(ALL_MOVEMENT_PATTERNS);
  if (!validPatterns.has(input.pattern)) {
    throw new RangeError('Invalid movement pattern.');
  }
  const primaries = [...new Set(input.primaryMuscles.filter(id => validMuscles.has(id)))].slice(0, 3) as MuscleId[];
  if (primaries.length === 0) {
    throw new RangeError('Select at least 1 primary muscle group.');
  }
  const secondaries = [
    ...new Set((input.secondaryMuscles ?? []).filter(id => validMuscles.has(id) && !primaries.includes(id))),
  ].slice(0, 4) as MuscleId[];

  const requiredAll = [
    ...new Set((input.requiredAll ?? []).filter(e => validEquip.has(e) && e !== 'none')),
  ].slice(0, 6) as DetailedEquipmentId[];

  const isCompound =
    input.isCompound ??
    ![
      'elbow_flexion',
      'elbow_extension',
      'shoulder_isolation',
      'calf_isolation',
      'core_stability',
    ].includes(input.pattern);

  // Build fractional muscle involvement (1.0 primary, 0.5 secondary, 0.25 inferred pattern stabilizers)
  const muscles: MuscleInvolvement[] = [
    ...primaries.map(id => m(id, 'primary')),
    ...secondaries.map(id => m(id, 'secondary')),
  ];
  const already = new Set<MuscleId>([...primaries, ...secondaries]);
  if (isCompound) {
    for (const stab of PATTERN_DEFAULT_STABILIZERS[input.pattern] ?? []) {
      if (!already.has(stab)) {
        muscles.push(m(stab, 'stabilizer'));
        already.add(stab);
      }
    }
  }

  // Infer joint stress vector from pattern + heavy axial barbell modifier
  const baseJoints: Partial<Record<JointId, JointStressLevel>> = {
    ...(PATTERN_DEFAULT_JOINT_STRESS[input.pattern] ?? {}),
  };
  const usesBarbell = requiredAll.includes('bars_plates');
  if (usesBarbell && (input.pattern === 'squat' || input.pattern === 'hinge')) {
    baseJoints.lumbar = 3;
  }
  if (!isCompound) {
    for (const k of Object.keys(baseJoints) as JointId[]) {
      if ((baseJoints[k] ?? 0) > 1) baseJoints[k] = 1;
    }
  }

  const maxStress = Math.max(0, ...Object.values(baseJoints).map(v => v ?? 0));
  const systemicFatigue = Number(
    Math.min(
      0.95,
      (isCompound ? 0.55 : 0.25) +
        (usesBarbell ? 0.2 : 0) +
        (input.pattern === 'squat' || input.pattern === 'hinge' ? 0.15 : 0),
    ).toFixed(2),
  );

  const mode = input.mode === 'seconds' ? 'seconds' : 'reps';
  const defaultRepsOrSeconds = Math.max(
    1,
    Math.min(7200, Math.round(input.defaultAmount ?? (mode === 'seconds' ? 45 : isCompound ? 8 : 12))),
  );
  const defaultRestSeconds = Math.max(
    0,
    Math.min(600, Math.round(input.defaultRestSeconds ?? (isCompound ? (usesBarbell ? 120 : 90) : 60))),
  );
  const travelFriendly = requiredAll.every(e => e === 'resistance_bands' || e === 'outdoor_track' || e === 'suspension_ropes');

  return {
    id: input.id ?? slugifyCustomExercise(name),
    name,
    aliases: [name.toLowerCase()],
    pattern: input.pattern,
    isCompound,
    requiredAll,
    muscles,
    jointStress: baseJoints,
    systemicFatigue,
    timePhysics: {
      mode,
      defaultRepsOrSeconds,
      secondsPerRep: mode === 'seconds' ? 1 : isCompound ? 4 : 3,
      defaultRestSeconds,
      setupTransitionMinutes: usesBarbell ? 2 : 1,
    },
    travelFriendly,
    jointFriendly: maxStress <= 1,
  };
}

/**
 * Lossless translation from TOP1's coarse workspace equipment list to granular equipment buckets.
 */
export function expandCoarseEquipment(coarse?: readonly EquipmentOption[]): DetailedEquipmentId[] {
  const out = new Set<DetailedEquipmentId>(['none']);
  for (const item of coarse ?? []) {
    if (item === 'dumbbells') out.add('small_weights');
    else if (item === 'barbell') {
      out.add('bars_plates');
      out.add('benches_racks');
    } else if (item === 'machines') {
      out.add('weighted_machines');
      out.add('plated_machines');
      out.add('cable_machines');
      out.add('cardio_machines');
    } else if (item === 'pullup_bar') {
      out.add('calisthenics_bars');
    } else if (item === 'outdoor') {
      out.add('outdoor_track');
    }
  }
  return [...out];
}

/** Checks whether an athlete's available equipment satisfies `requiredAll` AND `anyOf`. */
export function isExerciseFeasible(
  ex: ExerciseDefinition,
  available: readonly DetailedEquipmentId[],
): boolean {
  const set = new Set<DetailedEquipmentId>(['none', ...available]);
  for (const req of ex.requiredAll) {
    if (!set.has(req)) return false;
  }
  if (ex.anyOf && ex.anyOf.length > 0) {
    if (!ex.anyOf.some(opt => set.has(opt))) return false;
  }
  return true;
}

/** Maps a free-text discomfort area (e.g., "left shoulder", "lower back") to canonical JointIds. */
export function parseDiscomfortJoints(area?: string): JointId[] {
  if (!area) return [];
  const lower = area.toLowerCase();
  const out = new Set<JointId>();
  if (/shoulder|rotator|delt|épaule|كتف/.test(lower)) out.add('shoulder');
  if (/elbow|tricep|bicep|coude|مرفق/.test(lower)) out.add('elbow');
  if (/wrist|hand|poignet|معصم/.test(lower)) out.add('wrist');
  if (/back|lumbar|spine|dos|lombaire|ظهر/.test(lower)) out.add('lumbar');
  if (/hip|glute|groin|hanche|ورك/.test(lower)) out.add('hip');
  if (/knee|patella|genou|ركبة/.test(lower)) out.add('knee');
  if (/ankle|achilles|calf|cheville|كاحل/.test(lower)) out.add('ankle');
  return [...out];
}

/** Matches an exercise name from a logged TOP1 Workout to its canonical or custom ExerciseDefinition. */
export function matchExerciseByName(
  name: string,
  customExercises?: readonly ExerciseDefinition[],
): ExerciseDefinition | null {
  const clean = name.trim().toLowerCase();
  if (!clean) return null;
  if (customExercises) {
    const exactCustom = customExercises.find(
      ex => ex.id === clean || ex.name.toLowerCase() === clean,
    );
    if (exactCustom) return exactCustom;
  }
  if (EXERCISE_BY_ID.has(clean)) return EXERCISE_BY_ID.get(clean)!;
  const catalog = customExercises?.length
    ? [...customExercises, ...EXERCISE_CATALOG]
    : EXERCISE_CATALOG;
  let best: {ex: ExerciseDefinition; score: number} | null = null;
  for (const ex of catalog) {
    const names = [ex.name.toLowerCase(), ...ex.aliases];
    for (const alias of names) {
      if (clean === alias) return ex;
      if (clean.includes(alias) || alias.includes(clean)) {
        const score = Math.min(clean.length, alias.length);
        if (!best || score > best.score) best = {ex, score};
      }
    }
  }
  return best?.ex ?? null;
}

export type ExerciseQuery = {
  search?: string;
  equipment?: readonly DetailedEquipmentId[];
  muscles?: readonly MuscleId[];
  pattern?: MovementPattern;
  discomfortArea?: string;
  maxJointStress?: JointStressLevel;
  travelOnly?: boolean;
  excludeIds?: readonly string[];
  customExercises?: readonly ExerciseDefinition[];
};

export function queryExercises(q: ExerciseQuery = {}): ExerciseDefinition[] {
  const search = q.search?.trim().toLowerCase() ?? '';
  const exclude = new Set(q.excludeIds ?? []);
  const sensitiveJoints = parseDiscomfortJoints(q.discomfortArea);
  const maxStress = q.maxJointStress ?? (sensitiveJoints.length > 0 ? 1 : 3);
  const catalog = q.customExercises?.length
    ? [...q.customExercises, ...EXERCISE_CATALOG]
    : EXERCISE_CATALOG;

  return catalog.filter(ex => {
    if (exclude.has(ex.id)) return false;
    if (q.pattern && ex.pattern !== q.pattern) return false;
    if (q.travelOnly && !ex.travelFriendly) return false;
    if (q.equipment && !isExerciseFeasible(ex, q.equipment)) return false;
    if (q.muscles && q.muscles.length > 0) {
      const hit = ex.muscles.some(inv => inv.weight >= 0.5 && q.muscles!.includes(inv.muscle));
      if (!hit) return false;
    }
    if (sensitiveJoints.length > 0) {
      for (const j of sensitiveJoints) {
        if ((ex.jointStress[j] ?? 0) > maxStress) return false;
      }
    }
    if (search) {
      const hay = [ex.name, ex.pattern, ...ex.aliases, ...ex.muscles.map(inv => inv.muscle)].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function muscleCosineSimilarity(a: ExerciseDefinition, b: ExerciseDefinition): number {
  const mapA = new Map(a.muscles.map(inv => [inv.muscle, inv.weight]));
  const mapB = new Map(b.muscles.map(inv => [inv.muscle, inv.weight]));
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const w of mapA.values()) normA += w * w;
  for (const w of mapB.values()) normB += w * w;
  for (const [muscle, wA] of mapA) {
    const wB = mapB.get(muscle) ?? 0;
    dot += wA * wB;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type SubstituteMatch = {
  exercise: ExerciseDefinition;
  similarityScore: number;
  samePattern: boolean;
  reason: string;
};

/**
 * Finds biomechanically equivalent substitutes using muscle-vector cosine similarity,
 * movement-pattern alignment, equipment dependency checks, and joint-sparing filters.
 */
export function findBiomechanicalSubstitutes(
  sourceExerciseId: string,
  options: {
    availableEquipment?: readonly DetailedEquipmentId[];
    discomfortArea?: string;
    limit?: number;
    customExercises?: readonly ExerciseDefinition[];
  } = {},
): SubstituteMatch[] {
  const source =
    options.customExercises?.find(ex => ex.id === sourceExerciseId) ??
    EXERCISE_BY_ID.get(sourceExerciseId);
  if (!source) return [];
  const sensitiveJoints = parseDiscomfortJoints(options.discomfortArea);
  const candidates = queryExercises({
    equipment: options.availableEquipment,
    discomfortArea: options.discomfortArea,
    maxJointStress: sensitiveJoints.length > 0 ? 1 : 3,
    excludeIds: [source.id],
    customExercises: options.customExercises,
  });

  const scored: SubstituteMatch[] = [];
  for (const ex of candidates) {
    const cosine = muscleCosineSimilarity(source, ex);
    if (cosine < 0.35) continue;
    const samePattern = ex.pattern === source.pattern;
    const jointBonus = sensitiveJoints.length > 0 && ex.jointFriendly ? 0.12 : 0;
    const total = Number(Math.min(1, cosine * 0.78 + (samePattern ? 0.22 : 0) + jointBonus).toFixed(3));
    const sharedPrimary = ex.muscles
      .filter(inv => inv.role === 'primary' && source.muscles.some(s => s.muscle === inv.muscle))
      .map(inv => MUSCLE_META[inv.muscle].label[0]);
    const reason = samePattern
      ? `Same ${source.pattern.replace('_', ' ')} pattern targeting ${sharedPrimary.join(' & ') || 'matching prime movers'}${sensitiveJoints.length ? ' with lower joint stress' : ''}.`
      : `High biomechanical overlap (${Math.round(cosine * 100)}%) on ${sharedPrimary.join(' & ') || 'shared muscles'}.`;
    scored.push({exercise: ex, similarityScore: total, samePattern, reason});
  }

  return scored
    .sort((a, b) => b.similarityScore - a.similarityScore || a.exercise.id.localeCompare(b.exercise.id))
    .slice(0, options.limit ?? 5);
}
