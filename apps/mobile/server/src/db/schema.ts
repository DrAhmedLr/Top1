import {
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  bio: text('bio').notNull().default(''),
  avatarUrl: text('avatar_url').notNull().default(''),
  avatarConfigJson: text('avatar_config_json').notNull().default('{}'),
  rankingSex: text('ranking_sex').notNull().default('Male'),
  age: integer('age').notNull().default(24),
  heightCm: real('height_cm').notNull().default(178),
  bodyweightKg: real('bodyweight_kg').notNull().default(78),
  unitWeight: text('unit_weight').notNull().default('lbs'),
  unitMeasure: text('unit_measure').notNull().default('in'),
  themeId: text('theme_id').notNull().default('theme_dark'),
  language: text('language').notNull().default('en'),
  fitnessGoal: text('fitness_goal').notNull().default('build_muscle'),
  experienceLevel: text('experience_level').notNull().default('intermediate'),
  experiencePoints: integer('experience_points').notNull().default(0),
  credits: integer('credits').notNull().default(250),
  streaks: integer('streaks').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  streaksGraceHours: integer('streaks_grace_hours').notNull().default(48),
  weeklyWorkoutGoal: integer('weekly_workout_goal').notNull().default(4),
  lastWorkoutAt: text('last_workout_at'),
  peakAverageRank: text('peak_average_rank').notNull().default('Unranked'),
  peakAverageRating: integer('peak_average_rating').notNull().default(0),
  overallTopPercent: real('overall_top_percent'),
  overallTierLabel: text('overall_tier_label').notNull().default('Unranked'),
  scientificModelScore: real('scientific_model_score'),
  timeZone: text('time_zone').notNull().default('UTC'),
  totalWorkouts: integer('total_workouts').notNull().default(0),
  totalVolumeKg: real('total_volume_kg').notNull().default(0),
  equippedTitleId: text('equipped_title_id').notNull().default(''),
  equippedBorderId: text('equipped_border_id').notNull().default(''),
  equippedBannerId: text('equipped_banner_id').notNull().default(''),
  equippedMedalIdsJson: text('equipped_medal_ids_json').notNull().default('["","",""]'),
  referralCode: text('referral_code').notNull().unique(),
  isProDemo: integer('is_pro_demo', { mode: 'boolean' }).notNull().default(false),
  onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
  deviceLabel: text('device_label').notNull().default('mobile'),
  pushToken: text('push_token'),
  expiresAt: text('expires_at').notNull(),
  revokedAt: text('revoked_at'),
  createdAt: text('created_at').notNull(),
});

export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull(),
});

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  equipment: text('equipment').notNull(),
  inputType: text('input_type').notNull().default('weight_reps'),
  primaryMusclesJson: text('primary_muscles_json').notNull(),
  secondaryMusclesJson: text('secondary_muscles_json').notNull().default('[]'),
  instructions: text('instructions').notNull().default(''),
  maleBaseFactor: real('male_base_factor').notNull().default(4.0),
  femaleBaseFactor: real('female_base_factor').notNull().default(2.8),
  includesBodyweight: integer('includes_bodyweight', { mode: 'boolean' }).notNull().default(false),
  isRankable: integer('is_rankable', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

export const workoutFolders = sqliteTable('workout_folders', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const presets = sqliteTable('presets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  folderId: text('folder_id').references(() => workoutFolders.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
  downloadsCount: integer('downloads_count').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const presetExercises = sqliteTable('preset_exercises', {
  id: text('id').primaryKey(),
  presetId: text('preset_id')
    .notNull()
    .references(() => presets.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  supersetGroup: text('superset_group'),
  restSeconds: integer('rest_seconds').notNull().default(90),
  notes: text('notes').notNull().default(''),
  targetSetsJson: text('target_sets_json').notNull().default('[]'),
});

export const workoutPosts = sqliteTable('workout_posts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  presetId: text('preset_id').references(() => presets.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  caption: text('caption').notNull().default(''),
  notes: text('notes').notNull().default(''),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  totalVolumeKg: real('total_volume_kg').notNull().default(0),
  totalSets: integer('total_sets').notNull().default(0),
  visibility: text('visibility').notNull().default('public'),
  mediaUrlsJson: text('media_urls_json').notNull().default('[]'),
  muscleHeatmapJson: text('muscle_heatmap_json').notNull().default('{}'),
  xpEarned: integer('xp_earned').notNull().default(100),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at').notNull(),
  createdAt: text('created_at').notNull(),
});

export const workoutExerciseLogs = sqliteTable('workout_exercise_logs', {
  id: text('id').primaryKey(),
  postId: text('post_id')
    .notNull()
    .references(() => workoutPosts.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  supersetGroup: text('superset_group'),
  notes: text('notes').notNull().default(''),
  bestE1rmKg: real('best_e1rm_kg').notNull().default(0),
  bestRating: integer('best_rating').notNull().default(0),
  bestRankTier: text('best_rank_tier').notNull().default('Unranked'),
  bestRankDivision: integer('best_rank_division').notNull().default(0),
});

export const workoutSets = sqliteTable('workout_sets', {
  id: text('id').primaryKey(),
  exerciseLogId: text('exercise_log_id')
    .notNull()
    .references(() => workoutExerciseLogs.id, { onDelete: 'cascade' }),
  setIndex: integer('set_index').notNull(),
  setType: text('set_type').notNull().default('normal'),
  weightKg: real('weight_kg').notNull().default(0),
  reps: integer('reps').notNull().default(0),
  durationSeconds: integer('duration_seconds'),
  distanceMeters: real('distance_meters'),
  rpe: real('rpe'),
  rir: integer('rir'),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(true),
  isPr: integer('is_pr', { mode: 'boolean' }).notNull().default(false),
});

export const workoutPlans = sqliteTable('workout_plans', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal').notNull().default('build_muscle'),
  daysPerWeek: integer('days_per_week').notNull().default(4),
  durationWeeks: integer('duration_weeks').notNull().default(8),
  currentWeek: integer('current_week').notNull().default(1),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  splitJson: text('split_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});

export const scheduleRules = sqliteTable('schedule_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(), // 0=Sun..6=Sat
  presetId: text('preset_id').references(() => presets.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  isRestDay: integer('is_rest_day', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
});

export const workoutEnvironments = sqliteTable('workout_environments', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  equipmentJson: text('equipment_json').notNull().default('[]'),
  defaultDurationMin: integer('default_duration_min').notNull().default(45),
  complexity: text('complexity').notNull().default('intermediate'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const exerciseRanks = sqliteTable('exercise_ranks', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  peakE1rmKg: real('peak_e1rm_kg').notNull().default(0),
  peakRating: integer('peak_rating').notNull().default(0),
  rankTier: text('rank_tier').notNull().default('Unranked'),
  rankDivision: integer('rank_division').notNull().default(0),
  postId: text('post_id'),
  achievedAt: text('achieved_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const rankHistory = sqliteTable('rank_history', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id'),
  rating: integer('rating').notNull(),
  rankTier: text('rank_tier').notNull(),
  rankDivision: integer('rank_division').notNull(),
  recordedAt: text('recorded_at').notNull(),
});

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  goalType: text('goal_type').notNull(), // strength | bodyweight | consistency
  title: text('title').notNull(),
  exerciseId: text('exercise_id'),
  startingValue: real('starting_value').notNull().default(0),
  currentValue: real('current_value').notNull().default(0),
  targetValue: real('target_value').notNull(),
  unit: text('unit').notNull().default('kg'),
  targetDate: text('target_date'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull(),
});

export const quests = sqliteTable('quests', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // daily | weekly | initiation
  title: text('title').notNull(),
  description: text('description').notNull(),
  targetCount: integer('target_count').notNull().default(1),
  rewardXp: integer('reward_xp').notNull().default(150),
  rewardCredits: integer('reward_credits').notNull().default(50),
  metricKey: text('metric_key').notNull(), // workouts | sets | food_logs | rank_calc | social
});

export const userQuests = sqliteTable('user_quests', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  questId: text('quest_id')
    .notNull()
    .references(() => quests.id, { onDelete: 'cascade' }),
  progress: integer('progress').notNull().default(0),
  claimedAt: text('claimed_at'),
  updatedAt: text('updated_at').notNull(),
});

export const medals = sqliteTable('medals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  tierColor: text('tier_color').notNull().default('#59B9F9'),
  targetValue: integer('target_value').notNull().default(1),
  metricKey: text('metric_key').notNull(),
});

export const userMedals = sqliteTable('user_medals', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  medalId: text('medal_id')
    .notNull()
    .references(() => medals.id, { onDelete: 'cascade' }),
  progress: integer('progress').notNull().default(0),
  unlockedAt: text('unlocked_at'),
});

export const shopItems = sqliteTable('shop_items', {
  id: text('id').primaryKey(),
  category: text('category').notNull(), // title | border | banner | theme
  name: text('name').notNull(),
  description: text('description').notNull(),
  rarity: text('rarity').notNull().default('rare'), // common | rare | epic | legendary
  costCredits: integer('cost_credits').notNull().default(150),
  previewValue: text('preview_value').notNull(), // hex/title string/theme id
});

export const userInventory = sqliteTable('user_inventory', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  itemId: text('item_id')
    .notNull()
    .references(() => shopItems.id, { onDelete: 'cascade' }),
  purchasedAt: text('purchased_at').notNull(),
});

export const macroGoals = sqliteTable('macro_goals', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  dailyCaloriesGoal: integer('daily_calories_goal').notNull().default(2400),
  dailyProteinGoal: integer('daily_protein_goal').notNull().default(180),
  dailyCarbsGoal: integer('daily_carbs_goal').notNull().default(250),
  dailyFatGoal: integer('daily_fat_goal').notNull().default(70),
  updatedAt: text('updated_at').notNull(),
});

export const foods = sqliteTable('foods', {
  id: text('id').primaryKey(),
  authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  brand: text('brand').notNull().default(''),
  barcode: text('barcode'),
  servingSize: real('serving_size').notNull().default(100),
  servingUnit: text('serving_unit').notNull().default('g'),
  calories: real('calories').notNull().default(0),
  proteinG: real('protein_g').notNull().default(0),
  carbsG: real('carbs_g').notNull().default(0),
  fatG: real('fat_g').notNull().default(0),
  isCommon: integer('is_common', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

export const foodBundles = sqliteTable('food_bundles', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  itemsJson: text('items_json').notNull().default('[]'),
  totalCalories: real('total_calories').notNull().default(0),
  totalProteinG: real('total_protein_g').notNull().default(0),
  totalCarbsG: real('total_carbs_g').notNull().default(0),
  totalFatG: real('total_fat_g').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const foodLogs = sqliteTable('food_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dateIso: text('date_iso').notNull(),
  mealType: text('meal_type').notNull().default('lunch'),
  foodId: text('food_id'),
  foodName: text('food_name').notNull(),
  servings: real('servings').notNull().default(1),
  calories: real('calories').notNull().default(0),
  proteinG: real('protein_g').notNull().default(0),
  carbsG: real('carbs_g').notNull().default(0),
  fatG: real('fat_g').notNull().default(0),
  loggedAt: text('logged_at').notNull(),
});

export const healthLogs = sqliteTable('health_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dateIso: text('date_iso').notNull(),
  steps: integer('steps').notNull().default(0),
  activeCalories: integer('active_calories').notNull().default(0),
  sleepMinutes: integer('sleep_minutes').notNull().default(0),
  waterMl: integer('water_ml').notNull().default(0),
  restingHr: integer('resting_hr'),
  updatedAt: text('updated_at').notNull(),
});

export const bodyMeasurements = sqliteTable('body_measurements', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  metricType: text('metric_type').notNull(),
  value: real('value').notNull(),
  unit: text('unit').notNull(),
  recordedAt: text('recorded_at').notNull(),
});

export const friendships = sqliteTable('friendships', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  friendId: text('friend_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
});

export const friendRequests = sqliteTable('friend_requests', {
  id: text('id').primaryKey(),
  senderId: text('sender_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  receiverId: text('receiver_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull(),
});

export const blockedUsers = sqliteTable('blocked_users', {
  id: text('id').primaryKey(),
  blockerId: text('blocker_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  blockedId: text('blocked_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
});

export const postReactions = sqliteTable('post_reactions', {
  id: text('id').primaryKey(),
  postId: text('post_id')
    .notNull()
    .references(() => workoutPosts.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reactionKey: text('reaction_key').notNull(),
  createdAt: text('created_at').notNull(),
});

export const postComments = sqliteTable('post_comments', {
  id: text('id').primaryKey(),
  postId: text('post_id')
    .notNull()
    .references(() => workoutPosts.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  parentCommentId: text('parent_comment_id'),
  body: text('body').notNull(),
  likesCount: integer('likes_count').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const notificationSettings = sqliteTable('notification_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  reminder: integer('reminder', { mode: 'boolean' }).notNull().default(true),
  progress: integer('progress', { mode: 'boolean' }).notNull().default(true),
  feed: integer('feed', { mode: 'boolean' }).notNull().default(true),
  comments: integer('comments', { mode: 'boolean' }).notNull().default(true),
  reactions: integer('reactions', { mode: 'boolean' }).notNull().default(true),
  friends: integer('friends', { mode: 'boolean' }).notNull().default(true),
  slacking: integer('slacking', { mode: 'boolean' }).notNull().default(true),
  presetDownload: integer('preset_download', { mode: 'boolean' }).notNull().default(true),
  rankChallenge: integer('rank_challenge', { mode: 'boolean' }).notNull().default(true),
  announcement: integer('announcement', { mode: 'boolean' }).notNull().default(true),
  reminderWeekdaysJson: text('reminder_weekdays_json').notNull().default('[1,3,5]'),
  reminderTime: text('reminder_time').notNull().default('18:00'),
  updatedAt: text('updated_at').notNull(),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  actorId: text('actor_id'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  readAt: text('read_at'),
  createdAt: text('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// TOP1% Scientific Performance, Adaptive Coaching & Physiology Domain Tables
// ---------------------------------------------------------------------------

export const metricObservations = sqliteTable('metric_observations', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  metricId: text('metric_id').notNull(),
  value: real('value'),
  unit: text('unit').notNull().default(''),
  measuredAt: text('measured_at'),
  recordedAt: text('recorded_at').notNull(),
  sequence: integer('sequence').notNull().default(1),
  method: text('method'),
  exerciseMode: text('exercise_mode'),
  protocolJson: text('protocol_json'),
  windowJson: text('window_json'),
  derivationJson: text('derivation_json'),
  ageAtMeasurement: integer('age_at_measurement'),
  bodyWeightKg: real('body_weight_kg'),
  cleared: integer('cleared', { mode: 'boolean' }).notNull().default(false),
  source: text('source').notNull().default('manual'),
});

export const personalWorkspaces = sqliteTable('personal_workspaces', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  workspaceJson: text('workspace_json').notNull().default('{}'),
  updatedAt: text('updated_at').notNull(),
});

export const trainingLedgerEvents = sqliteTable('training_ledger_events', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').notNull(),
  sequence: integer('sequence').notNull().default(1),
  revision: integer('revision').notNull().default(1),
  kind: text('kind').notNull(), // 'program' | 'workout'
  source: text('source').notNull().default('synced'),
  deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
  dataJson: text('data_json').notNull(),
  recordedAt: text('recorded_at').notNull(),
});

export const coachDecisions = sqliteTable('coach_decisions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull(),
  targetDay: text('target_day').notNull(),
  action: text('action').notNull(),
  reasonCode: text('reason_code').notNull(),
  decisionJson: text('decision_json').notNull(),
  acceptedAt: text('accepted_at'),
  undoneAt: text('undone_at'),
  createdAt: text('created_at').notNull(),
});

export const wearableSnapshots = sqliteTable('wearable_snapshots', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  dateIso: text('date_iso').notNull(),
  source: text('source').notNull().default('apple_watch'),
  hrvRmssdMs: real('hrv_rmssd_ms'),
  restingHeartRateBpm: real('resting_heart_rate_bpm'),
  totalSleepMinutes: integer('total_sleep_minutes'),
  sleepEfficiencyPercent: real('sleep_efficiency_percent'),
  wristTempDeviationC: real('wrist_temp_deviation_c'),
  respiratoryRateBpm: real('respiratory_rate_bpm'),
  cardioLoadTrimp: real('cardio_load_trimp'),
  vo2Max: real('vo2_max'),
  gpsRun5kMinutes: real('gps_run_5k_minutes'),
  updatedAt: text('updated_at').notNull(),
});

export const customExerciseOntology = sqliteTable('custom_exercise_ontology', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id'),
  definitionJson: text('definition_json').notNull(),
  createdAt: text('created_at').notNull(),
});
