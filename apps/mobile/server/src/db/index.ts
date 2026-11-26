import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema.js';

export type AppDatabase = LibSQLDatabase<typeof schema>;

const DDL_STATEMENTS = [
  `PRAGMA foreign_keys = ON;`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    avatar_config_json TEXT NOT NULL DEFAULT '{}',
    ranking_sex TEXT NOT NULL DEFAULT 'Male',
    age INTEGER NOT NULL DEFAULT 24,
    height_cm REAL NOT NULL DEFAULT 178,
    bodyweight_kg REAL NOT NULL DEFAULT 78,
    unit_weight TEXT NOT NULL DEFAULT 'lbs',
    unit_measure TEXT NOT NULL DEFAULT 'in',
    theme_id TEXT NOT NULL DEFAULT 'theme_dark',
    language TEXT NOT NULL DEFAULT 'en',
    fitness_goal TEXT NOT NULL DEFAULT 'build_muscle',
    experience_level TEXT NOT NULL DEFAULT 'intermediate',
    experience_points INTEGER NOT NULL DEFAULT 0,
    credits INTEGER NOT NULL DEFAULT 250,
    streaks INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    streaks_grace_hours INTEGER NOT NULL DEFAULT 48,
    weekly_workout_goal INTEGER NOT NULL DEFAULT 4,
    last_workout_at TEXT,
    peak_average_rank TEXT NOT NULL DEFAULT 'Unranked',
    peak_average_rating INTEGER NOT NULL DEFAULT 0,
    total_workouts INTEGER NOT NULL DEFAULT 0,
    total_volume_kg REAL NOT NULL DEFAULT 0,
    equipped_title_id TEXT NOT NULL DEFAULT '',
    equipped_border_id TEXT NOT NULL DEFAULT '',
    equipped_banner_id TEXT NOT NULL DEFAULT '',
    equipped_medal_ids_json TEXT NOT NULL DEFAULT '["","",""]',
    referral_code TEXT NOT NULL UNIQUE,
    is_pro_demo INTEGER NOT NULL DEFAULT 0,
    onboarding_completed INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    device_label TEXT NOT NULL DEFAULT 'mobile',
    push_token TEXT,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY,
    author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    equipment TEXT NOT NULL,
    input_type TEXT NOT NULL DEFAULT 'weight_reps',
    primary_muscles_json TEXT NOT NULL,
    secondary_muscles_json TEXT NOT NULL DEFAULT '[]',
    instructions TEXT NOT NULL DEFAULT '',
    male_base_factor REAL NOT NULL DEFAULT 4.0,
    female_base_factor REAL NOT NULL DEFAULT 2.8,
    includes_bodyweight INTEGER NOT NULL DEFAULT 0,
    is_rankable INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS workout_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id TEXT REFERENCES workout_folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_public INTEGER NOT NULL DEFAULT 1,
    downloads_count INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS preset_exercises (
    id TEXT PRIMARY KEY,
    preset_id TEXT NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    superset_group TEXT,
    rest_seconds INTEGER NOT NULL DEFAULT 90,
    notes TEXT NOT NULL DEFAULT '',
    target_sets_json TEXT NOT NULL DEFAULT '[]'
  );`,
  `CREATE TABLE IF NOT EXISTS workout_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preset_id TEXT REFERENCES presets(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    total_volume_kg REAL NOT NULL DEFAULT 0,
    total_sets INTEGER NOT NULL DEFAULT 0,
    visibility TEXT NOT NULL DEFAULT 'public',
    media_urls_json TEXT NOT NULL DEFAULT '[]',
    muscle_heatmap_json TEXT NOT NULL DEFAULT '{}',
    xp_earned INTEGER NOT NULL DEFAULT 100,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS workout_exercise_logs (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES workout_posts(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    superset_group TEXT,
    notes TEXT NOT NULL DEFAULT '',
    best_e1rm_kg REAL NOT NULL DEFAULT 0,
    best_rating INTEGER NOT NULL DEFAULT 0,
    best_rank_tier TEXT NOT NULL DEFAULT 'Unranked',
    best_rank_division INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS workout_sets (
    id TEXT PRIMARY KEY,
    exercise_log_id TEXT NOT NULL REFERENCES workout_exercise_logs(id) ON DELETE CASCADE,
    set_index INTEGER NOT NULL,
    set_type TEXT NOT NULL DEFAULT 'normal',
    weight_kg REAL NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    distance_meters REAL,
    rpe REAL,
    rir INTEGER,
    is_completed INTEGER NOT NULL DEFAULT 1,
    is_pr INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS exercise_ranks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    peak_e1rm_kg REAL NOT NULL DEFAULT 0,
    peak_rating INTEGER NOT NULL DEFAULT 0,
    rank_tier TEXT NOT NULL DEFAULT 'Unranked',
    rank_division INTEGER NOT NULL DEFAULT 0,
    post_id TEXT,
    achieved_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS rank_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id TEXT,
    rating INTEGER NOT NULL,
    rank_tier TEXT NOT NULL,
    rank_division INTEGER NOT NULL,
    recorded_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS macro_goals (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    daily_calories_goal INTEGER NOT NULL DEFAULT 2400,
    daily_protein_goal INTEGER NOT NULL DEFAULT 180,
    daily_carbs_goal INTEGER NOT NULL DEFAULT 250,
    daily_fat_goal INTEGER NOT NULL DEFAULT 70,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS foods (
    id TEXT PRIMARY KEY,
    author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    barcode TEXT,
    serving_size REAL NOT NULL DEFAULT 100,
    serving_unit TEXT NOT NULL DEFAULT 'g',
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    is_common INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS food_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_iso TEXT NOT NULL,
    meal_type TEXT NOT NULL DEFAULT 'lunch',
    food_id TEXT,
    food_name TEXT NOT NULL,
    servings REAL NOT NULL DEFAULT 1,
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    logged_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS health_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_iso TEXT NOT NULL,
    steps INTEGER NOT NULL DEFAULT 0,
    active_calories INTEGER NOT NULL DEFAULT 0,
    sleep_minutes INTEGER NOT NULL DEFAULT 0,
    water_ml INTEGER NOT NULL DEFAULT 0,
    resting_hr INTEGER,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS body_measurements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    recorded_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS post_reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES workout_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_key TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS post_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES workout_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id TEXT,
    body TEXT NOT NULL,
    likes_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS notification_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    reminder INTEGER NOT NULL DEFAULT 1,
    progress INTEGER NOT NULL DEFAULT 1,
    feed INTEGER NOT NULL DEFAULT 1,
    comments INTEGER NOT NULL DEFAULT 1,
    reactions INTEGER NOT NULL DEFAULT 1,
    friends INTEGER NOT NULL DEFAULT 1,
    slacking INTEGER NOT NULL DEFAULT 1,
    preset_download INTEGER NOT NULL DEFAULT 1,
    rank_challenge INTEGER NOT NULL DEFAULT 1,
    announcement INTEGER NOT NULL DEFAULT 1,
    reminder_weekdays_json TEXT NOT NULL DEFAULT '[1,3,5]',
    reminder_time TEXT NOT NULL DEFAULT '18:00',
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    read_at TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS workout_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal TEXT NOT NULL DEFAULT 'build_muscle',
    days_per_week INTEGER NOT NULL DEFAULT 4,
    duration_weeks INTEGER NOT NULL DEFAULT 8,
    current_week INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 0,
    split_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS schedule_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL,
    preset_id TEXT REFERENCES presets(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    is_rest_day INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS workout_environments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    equipment_json TEXT NOT NULL DEFAULT '[]',
    default_duration_min INTEGER NOT NULL DEFAULT 45,
    complexity TEXT NOT NULL DEFAULT 'intermediate',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL,
    title TEXT NOT NULL,
    exercise_id TEXT,
    starting_value REAL NOT NULL DEFAULT 0,
    current_value REAL NOT NULL DEFAULT 0,
    target_value REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    target_date TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 1,
    reward_xp INTEGER NOT NULL DEFAULT 150,
    reward_credits INTEGER NOT NULL DEFAULT 50,
    metric_key TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS user_quests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0,
    claimed_at TEXT,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS medals (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    tier_color TEXT NOT NULL DEFAULT '#59B9F9',
    target_value INTEGER NOT NULL DEFAULT 1,
    metric_key TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS user_medals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    medal_id TEXT NOT NULL REFERENCES medals(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0,
    unlocked_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS shop_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'rare',
    cost_credits INTEGER NOT NULL DEFAULT 150,
    preview_value TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS user_inventory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    purchased_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS food_bundles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    items_json TEXT NOT NULL DEFAULT '[]',
    total_calories REAL NOT NULL DEFAULT 0,
    total_protein_g REAL NOT NULL DEFAULT 0,
    total_carbs_g REAL NOT NULL DEFAULT 0,
    total_fat_g REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS blocked_users (
    id TEXT PRIMARY KEY,
    blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS metric_observations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_id TEXT NOT NULL,
    value REAL,
    unit TEXT NOT NULL DEFAULT '',
    measured_at TEXT,
    recorded_at TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 1,
    method TEXT,
    exercise_mode TEXT,
    protocol_json TEXT,
    window_json TEXT,
    derivation_json TEXT,
    age_at_measurement INTEGER,
    body_weight_kg REAL,
    cleared INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual'
  );`,
  `CREATE TABLE IF NOT EXISTS personal_workspaces (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    workspace_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS training_ledger_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 1,
    revision INTEGER NOT NULL DEFAULT 1,
    kind TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'synced',
    deleted INTEGER NOT NULL DEFAULT 0,
    data_json TEXT NOT NULL,
    recorded_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS coach_decisions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    target_day TEXT NOT NULL,
    action TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    decision_json TEXT NOT NULL,
    accepted_at TEXT,
    undone_at TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS wearable_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_iso TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'apple_watch',
    hrv_rmssd_ms REAL,
    resting_heart_rate_bpm REAL,
    total_sleep_minutes INTEGER,
    sleep_efficiency_percent REAL,
    wrist_temp_deviation_c REAL,
    respiratory_rate_bpm REAL,
    cardio_load_trimp REAL,
    vo2_max REAL,
    gps_run_5k_minutes REAL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS custom_exercise_ontology (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id TEXT,
    definition_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS comment_likes (
    id TEXT PRIMARY KEY,
    comment_id TEXT NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE(comment_id, user_id)
  );`,
  `CREATE TABLE IF NOT EXISTS daily_vault_claims (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_iso TEXT NOT NULL,
    reward_credits INTEGER NOT NULL DEFAULT 50,
    reward_xp INTEGER NOT NULL DEFAULT 50,
    claimed_at TEXT NOT NULL,
    UNIQUE(user_id, date_iso)
  );`,
  `CREATE TABLE IF NOT EXISTS feature_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    votes_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS feature_request_votes (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE(request_id, user_id)
  );`,
];

const SAFE_ALTER_STATEMENTS = [
  `ALTER TABLE users ADD COLUMN overall_top_percent REAL;`,
  `ALTER TABLE users ADD COLUMN overall_tier_label TEXT NOT NULL DEFAULT 'Unranked';`,
  `ALTER TABLE users ADD COLUMN scientific_model_score REAL;`,
  `ALTER TABLE users ADD COLUMN time_zone TEXT NOT NULL DEFAULT 'UTC';`,
];

export async function createDatabase(dbUrl?: string, authToken?: string): Promise<{
  client: Client;
  db: AppDatabase;
}> {
  const defaultFile = path.resolve(process.cwd(), 'data/top1-mobile.db');
  const url =
    dbUrl ??
    process.env.TOP1_MOBILE_DATABASE_URL ??
    process.env.TURSO_DATABASE_URL ??
    process.env.DATABASE_URL ??
    `file:${defaultFile}`;
  const token =
    authToken ??
    process.env.TOP1_MOBILE_DATABASE_AUTH_TOKEN ??
    process.env.TURSO_AUTH_TOKEN;

  if (url.startsWith('file:')) {
    const filePath = url.replace(/^file:/, '');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  const client = createClient(token ? { url, authToken: token } : { url });
  for (const sql of DDL_STATEMENTS) {
    await client.execute(sql);
  }
  for (const sql of SAFE_ALTER_STATEMENTS) {
    try {
      await client.execute(sql);
    } catch {
      // Column already exists on upgraded databases
    }
  }
  const db = drizzle(client, { schema });
  return { client, db };
}
