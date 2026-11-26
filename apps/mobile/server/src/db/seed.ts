import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import {
  addDays,
  buildProgram,
  dayInZone,
  evaluate,
  overallPerformance,
  type AdaptiveConfig,
  type PersonalWorkspace,
} from '@top1/engine';
import {
  buildTop1WorkoutEventFromPost,
  calculateExerciseRank,
  ratingToRank,
  topPercentToBadge,
  topPercentToRating,
} from '@apexlift/shared';
import { createDatabase, type AppDatabase } from './index.js';
import {
  bodyMeasurements,
  exerciseRanks,
  exercises,
  foodBundles,
  foodLogs,
  foods,
  friendships,
  goals,
  healthLogs,
  macroGoals,
  medals,
  metricObservations,
  notificationSettings,
  notifications,
  personalWorkspaces,
  presetExercises,
  presets,
  quests,
  rankHistory,
  shopItems,
  trainingLedgerEvents,
  userInventory,
  userQuests,
  users,
  wearableSnapshots,
  workoutExerciseLogs,
  workoutFolders,
  workoutPlans,
  workoutPosts,
  workoutSets,
} from './schema.js';
import { hashPassword } from '../lib/auth.js';

export const SEED_EXERCISES = [
  { id: 'ex_bench_press', name: 'Barbell Bench Press', equipment: 'Barbell', primary: ['Upper Chest', 'Lower Chest'], secondary: ['Front Delt', 'Triceps'], m: 4.9, f: 3.0, bw: false },
  { id: 'ex_incline_db_press', name: 'Incline Dumbbell Press', equipment: 'Dumbbell', primary: ['Upper Chest'], secondary: ['Front Delt', 'Triceps'], m: 3.9, f: 2.4, bw: false },
  { id: 'ex_cable_fly', name: 'Cable Chest Fly', equipment: 'Cable', primary: ['Lower Chest', 'Upper Chest'], secondary: ['Front Delt'], m: 2.2, f: 1.5, bw: false },
  { id: 'ex_push_ups', name: 'Push-Ups', equipment: 'Bodyweight', primary: ['Lower Chest', 'Upper Chest'], secondary: ['Triceps', 'Front Delt'], m: 4.5, f: 3.4, bw: true },
  { id: 'ex_squat', name: 'Barbell Back Squat', equipment: 'Barbell', primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings', 'Lower Back'], m: 6.4, f: 4.5, bw: false },
  { id: 'ex_hack_squat', name: 'Hack Squat', equipment: 'Machine', primary: ['Quadriceps'], secondary: ['Glutes'], m: 7.2, f: 5.0, bw: false },
  { id: 'ex_leg_extension', name: 'Leg Extension', equipment: 'Machine', primary: ['Quadriceps'], secondary: [], m: 4.2, f: 3.1, bw: false },
  { id: 'ex_deadlift', name: 'Conventional Deadlift', equipment: 'Barbell', primary: ['Hamstrings', 'Lower Back', 'Glutes'], secondary: ['Upper Back', 'Traps', 'Forearms'], m: 7.6, f: 5.4, bw: false },
  { id: 'ex_rdl', name: 'Romanian Deadlift', equipment: 'Barbell', primary: ['Hamstrings', 'Glutes'], secondary: ['Lower Back'], m: 5.5, f: 3.9, bw: false },
  { id: 'ex_hip_thrust', name: 'Barbell Hip Thrust', equipment: 'Barbell', primary: ['Glutes'], secondary: ['Hamstrings'], m: 6.8, f: 5.8, bw: false },
  { id: 'ex_hip_abduction', name: 'Hip Abduction Machine', equipment: 'Machine', primary: ['Abductors'], secondary: ['Glutes'], m: 3.5, f: 3.2, bw: false },
  { id: 'ex_hip_adduction', name: 'Hip Adduction Machine', equipment: 'Machine', primary: ['Adductors'], secondary: [], m: 3.5, f: 3.2, bw: false },
  { id: 'ex_calf_raise', name: 'Standing Calf Raise', equipment: 'Machine', primary: ['Calves'], secondary: [], m: 5.0, f: 3.8, bw: false },
  { id: 'ex_pull_ups', name: 'Pull-Ups', equipment: 'Bodyweight', primary: ['Lats'], secondary: ['Biceps', 'Upper Back'], m: 5.0, f: 3.6, bw: true },
  { id: 'ex_lat_pulldown', name: 'Lat Pulldown', equipment: 'Cable', primary: ['Lats'], secondary: ['Biceps', 'Upper Back'], m: 3.9, f: 2.7, bw: false },
  { id: 'ex_barbell_row', name: 'Bent-Over Barbell Row', equipment: 'Barbell', primary: ['Upper Back', 'Lats'], secondary: ['Rear Delt', 'Biceps', 'Lower Back'], m: 4.4, f: 2.9, bw: false },
  { id: 'ex_seated_cable_row', name: 'Seated Cable Row', equipment: 'Cable', primary: ['Upper Back'], secondary: ['Lats', 'Biceps'], m: 4.1, f: 2.8, bw: false },
  { id: 'ex_barbell_shrug', name: 'Barbell Shrug', equipment: 'Barbell', primary: ['Traps'], secondary: ['Forearms'], m: 5.8, f: 3.8, bw: false },
  { id: 'ex_overhead_press', name: 'Barbell Overhead Press', equipment: 'Barbell', primary: ['Front Delt'], secondary: ['Triceps', 'Middle Delt'], m: 3.2, f: 2.0, bw: false },
  { id: 'ex_lateral_raise', name: 'Dumbbell Lateral Raise', equipment: 'Dumbbell', primary: ['Middle Delt'], secondary: ['Traps'], m: 1.4, f: 0.9, bw: false },
  { id: 'ex_face_pull', name: 'Cable Face Pull', equipment: 'Cable', primary: ['Rear Delt'], secondary: ['Upper Back', 'Rotator Cuff'], m: 2.1, f: 1.5, bw: false },
  { id: 'ex_barbell_curl', name: 'Barbell Bicep Curl', equipment: 'Barbell', primary: ['Biceps'], secondary: ['Forearms'], m: 2.4, f: 1.5, bw: false },
  { id: 'ex_hammer_curl', name: 'Dumbbell Hammer Curl', equipment: 'Dumbbell', primary: ['Biceps', 'Forearms'], secondary: [], m: 2.2, f: 1.4, bw: false },
  { id: 'ex_tricep_pushdown', name: 'Cable Tricep Pushdown', equipment: 'Cable', primary: ['Triceps'], secondary: [], m: 2.6, f: 1.7, bw: false },
  { id: 'ex_skull_crusher', name: 'EZ-Bar Skull Crusher', equipment: 'EZ Bar', primary: ['Triceps'], secondary: [], m: 2.3, f: 1.5, bw: false },
  { id: 'ex_wrist_curl', name: 'Barbell Wrist Curl', equipment: 'Barbell', primary: ['Forearms'], secondary: [], m: 2.0, f: 1.3, bw: false },
  { id: 'ex_cable_crunch', name: 'Cable Crunch', equipment: 'Cable', primary: ['Abdominals'], secondary: [], m: 3.0, f: 2.3, bw: false },
  { id: 'ex_cable_woodchopper', name: 'Cable Woodchopper', equipment: 'Cable', primary: ['Obliques'], secondary: ['Abdominals'], m: 2.2, f: 1.7, bw: false },
  // Expanded 1:1 Catalog (+28 Iconic Illustrated Exercises = 56 Total)
  { id: 'ex_incline_bench', name: 'Incline Barbell Bench Press', equipment: 'Barbell', primary: ['Upper Chest'], secondary: ['Front Delt', 'Triceps'], m: 4.3, f: 2.6, bw: false },
  { id: 'ex_db_bench_press', name: 'Dumbbell Bench Press', equipment: 'Dumbbell', primary: ['Lower Chest', 'Upper Chest'], secondary: ['Triceps', 'Front Delt'], m: 4.4, f: 2.7, bw: false },
  { id: 'ex_dips', name: 'Chest Dips', equipment: 'Bodyweight', primary: ['Lower Chest', 'Triceps'], secondary: ['Front Delt'], m: 5.2, f: 3.8, bw: true },
  { id: 'ex_pec_deck', name: 'Pec Deck Fly', equipment: 'Machine', primary: ['Upper Chest', 'Lower Chest'], secondary: ['Front Delt'], m: 3.6, f: 2.5, bw: false },
  { id: 'ex_front_squat', name: 'Barbell Front Squat', equipment: 'Barbell', primary: ['Quadriceps'], secondary: ['Glutes', 'Abdominals'], m: 5.3, f: 3.7, bw: false },
  { id: 'ex_leg_press', name: 'Leg Press', equipment: 'Machine', primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'], m: 11.5, f: 8.2, bw: false },
  { id: 'ex_bulgarian_split_squat', name: 'Bulgarian Split Squat', equipment: 'Dumbbell', primary: ['Quadriceps', 'Glutes'], secondary: ['Hamstrings'], m: 3.6, f: 2.7, bw: false },
  { id: 'ex_leg_curl', name: 'Seated Leg Curl', equipment: 'Machine', primary: ['Hamstrings'], secondary: ['Calves'], m: 3.8, f: 2.8, bw: false },
  { id: 'ex_lying_leg_curl', name: 'Lying Leg Curl', equipment: 'Machine', primary: ['Hamstrings'], secondary: [], m: 3.4, f: 2.5, bw: false },
  { id: 'ex_sumo_deadlift', name: 'Sumo Deadlift', equipment: 'Barbell', primary: ['Glutes', 'Hamstrings', 'Adductors'], secondary: ['Quadriceps', 'Lower Back'], m: 7.7, f: 5.6, bw: false },
  { id: 'ex_seated_calf_raise', name: 'Seated Calf Raise', equipment: 'Machine', primary: ['Calves'], secondary: [], m: 3.8, f: 2.9, bw: false },
  { id: 'ex_chin_ups', name: 'Chin-Ups', equipment: 'Bodyweight', primary: ['Lats', 'Biceps'], secondary: ['Upper Back'], m: 5.1, f: 3.7, bw: true },
  { id: 'ex_t_bar_row', name: 'T-Bar Row', equipment: 'Barbell', primary: ['Upper Back', 'Lats'], secondary: ['Biceps', 'Rear Delt'], m: 4.5, f: 3.0, bw: false },
  { id: 'ex_db_row', name: 'Single-Arm Dumbbell Row', equipment: 'Dumbbell', primary: ['Lats', 'Upper Back'], secondary: ['Biceps', 'Rear Delt'], m: 3.1, f: 2.1, bw: false },
  { id: 'ex_straight_arm_pulldown', name: 'Straight-Arm Lat Pulldown', equipment: 'Cable', primary: ['Lats'], secondary: ['Triceps'], m: 2.6, f: 1.8, bw: false },
  { id: 'ex_back_extension', name: 'Back Extension', equipment: 'Bodyweight', primary: ['Lower Back', 'Glutes'], secondary: ['Hamstrings'], m: 3.8, f: 3.0, bw: true },
  { id: 'ex_db_shoulder_press', name: 'Dumbbell Shoulder Press', equipment: 'Dumbbell', primary: ['Front Delt'], secondary: ['Triceps', 'Middle Delt'], m: 3.1, f: 2.0, bw: false },
  { id: 'ex_arnold_press', name: 'Arnold Press', equipment: 'Dumbbell', primary: ['Front Delt', 'Middle Delt'], secondary: ['Triceps'], m: 2.8, f: 1.8, bw: false },
  { id: 'ex_cable_lateral_raise', name: 'Cable Lateral Raise', equipment: 'Cable', primary: ['Middle Delt'], secondary: [], m: 1.2, f: 0.8, bw: false },
  { id: 'ex_reverse_pec_deck', name: 'Reverse Pec Deck', equipment: 'Machine', primary: ['Rear Delt'], secondary: ['Upper Back'], m: 2.8, f: 1.9, bw: false },
  { id: 'ex_db_shrug', name: 'Dumbbell Shrug', equipment: 'Dumbbell', primary: ['Traps'], secondary: ['Forearms'], m: 4.8, f: 3.2, bw: false },
  { id: 'ex_preacher_curl', name: 'Preacher Curl', equipment: 'EZ Bar', primary: ['Biceps'], secondary: ['Forearms'], m: 2.2, f: 1.4, bw: false },
  { id: 'ex_incline_db_curl', name: 'Incline Dumbbell Curl', equipment: 'Dumbbell', primary: ['Biceps'], secondary: [], m: 1.9, f: 1.2, bw: false },
  { id: 'ex_overhead_tricep_ext', name: 'Overhead Cable Tricep Extension', equipment: 'Cable', primary: ['Triceps'], secondary: [], m: 2.4, f: 1.6, bw: false },
  { id: 'ex_close_grip_bench', name: 'Close-Grip Bench Press', equipment: 'Barbell', primary: ['Triceps'], secondary: ['Upper Chest', 'Front Delt'], m: 4.2, f: 2.6, bw: false },
  { id: 'ex_hanging_leg_raise', name: 'Hanging Leg Raise', equipment: 'Bodyweight', primary: ['Abdominals'], secondary: ['Obliques', 'Forearms'], m: 4.0, f: 3.2, bw: true },
  { id: 'ex_russian_twist', name: 'Weighted Russian Twist', equipment: 'Bodyweight', primary: ['Obliques'], secondary: ['Abdominals'], m: 2.4, f: 1.9, bw: false },
  { id: 'ex_neck_curl', name: 'Neck Curl', equipment: 'Barbell', primary: ['Neck'], secondary: [], m: 1.5, f: 1.1, bw: false },
] as const;

export const SEED_FOODS = [
  { id: 'fd_chicken_breast', name: 'Grilled Chicken Breast', brand: 'Whole Foods', barcode: '0011110000011', servingSize: 100, servingUnit: 'g', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, isCommon: true },
  { id: 'fd_white_rice', name: 'Cooked Jasmine Rice', brand: 'Generic', barcode: '0011110000028', servingSize: 150, servingUnit: 'g', calories: 195, proteinG: 4, carbsG: 43, fatG: 0.4, isCommon: true },
  { id: 'fd_whey_isolate', name: 'Whey Protein Isolate (Vanilla)', brand: 'TOP1 Fuel', barcode: '0011110000035', servingSize: 32, servingUnit: 'g', calories: 120, proteinG: 26, carbsG: 2, fatG: 1, isCommon: true },
  { id: 'fd_greek_yogurt', name: 'Nonfat Greek Yogurt', brand: 'PureDairy', barcode: '0011110000042', servingSize: 170, servingUnit: 'g', calories: 100, proteinG: 18, carbsG: 6, fatG: 0, isCommon: true },
  { id: 'fd_oats', name: 'Rolled Oats', brand: 'Harvest', barcode: '0011110000059', servingSize: 40, servingUnit: 'g', calories: 150, proteinG: 5, carbsG: 27, fatG: 3, isCommon: true },
  { id: 'fd_eggs', name: 'Large Whole Eggs (2)', brand: 'Pasture Farm', barcode: '0011110000066', servingSize: 100, servingUnit: 'g', calories: 144, proteinG: 12.6, carbsG: 0.7, fatG: 9.5, isCommon: true },
  { id: 'fd_salmon', name: 'Atlantic Salmon Fillet', brand: 'Nordic Sea', barcode: '0011110000073', servingSize: 140, servingUnit: 'g', calories: 290, proteinG: 28, carbsG: 0, fatG: 19, isCommon: true },
  { id: 'fd_banana', name: 'Medium Banana', brand: 'Fresh Produce', barcode: '0011110000080', servingSize: 118, servingUnit: 'g', calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, isCommon: true },
  { id: 'fd_avocado', name: 'Hass Avocado (Half)', brand: 'Fresh Produce', barcode: '0011110000097', servingSize: 75, servingUnit: 'g', calories: 120, proteinG: 1.5, carbsG: 6, fatG: 11, isCommon: true },
  { id: 'fd_sweet_potato', name: 'Baked Sweet Potato', brand: 'Fresh Produce', barcode: '0011110000103', servingSize: 150, servingUnit: 'g', calories: 135, proteinG: 3, carbsG: 31, fatG: 0.2, isCommon: true },
  { id: 'fd_lean_beef', name: '93% Lean Ground Beef', brand: 'Butcher Cut', barcode: '0011110000110', servingSize: 115, servingUnit: 'g', calories: 170, proteinG: 23, carbsG: 0, fatG: 8, isCommon: true },
  { id: 'fd_turkey_breast', name: 'Roasted Turkey Breast', brand: 'Whole Foods', barcode: '0011110000127', servingSize: 100, servingUnit: 'g', calories: 135, proteinG: 29, carbsG: 0, fatG: 1.5, isCommon: true },
  { id: 'fd_egg_whites', name: 'Liquid Egg Whites', brand: 'Pasture Farm', barcode: '0011110000134', servingSize: 184, servingUnit: 'g', calories: 100, proteinG: 20, carbsG: 0, fatG: 0, isCommon: true },
  { id: 'fd_cottage_cheese', name: 'Low-Fat Cottage Cheese (2%)', brand: 'PureDairy', barcode: '0011110000141', servingSize: 113, servingUnit: 'g', calories: 90, proteinG: 13, carbsG: 4, fatG: 2.5, isCommon: true },
  { id: 'fd_tuna', name: 'Wild Skipjack Tuna (Water)', brand: 'Ocean Select', barcode: '0011110000158', servingSize: 112, servingUnit: 'g', calories: 110, proteinG: 25, carbsG: 0, fatG: 1, isCommon: true },
  { id: 'fd_shrimp', name: 'Steamed Shrimp', brand: 'Ocean Select', barcode: '0011110000165', servingSize: 100, servingUnit: 'g', calories: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3, isCommon: true },
  { id: 'fd_tofu', name: 'Extra-Firm Organic Tofu', brand: 'PlantCraft', barcode: '0011110000172', servingSize: 100, servingUnit: 'g', calories: 120, proteinG: 13, carbsG: 2.5, fatG: 6.5, isCommon: true },
  { id: 'fd_quinoa', name: 'Cooked Quinoa', brand: 'Harvest', barcode: '0011110000189', servingSize: 185, servingUnit: 'g', calories: 222, proteinG: 8, carbsG: 39, fatG: 3.6, isCommon: true },
  { id: 'fd_pasta', name: 'Cooked Durum Wheat Pasta', brand: 'Artisan', barcode: '0011110000196', servingSize: 140, servingUnit: 'g', calories: 220, proteinG: 8, carbsG: 43, fatG: 1.3, isCommon: true },
  { id: 'fd_sourdough', name: 'Sourdough Bread (2 Slices)', brand: 'Bakery', barcode: '0011110000202', servingSize: 100, servingUnit: 'g', calories: 260, proteinG: 9, carbsG: 52, fatG: 1.5, isCommon: true },
  { id: 'fd_blueberries', name: 'Fresh Blueberries', brand: 'Fresh Produce', barcode: '0011110000219', servingSize: 148, servingUnit: 'g', calories: 84, proteinG: 1.1, carbsG: 21, fatG: 0.5, isCommon: true },
  { id: 'fd_apple', name: 'Honeycrisp Apple', brand: 'Fresh Produce', barcode: '0011110000226', servingSize: 182, servingUnit: 'g', calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, isCommon: true },
  { id: 'fd_broccoli', name: 'Steamed Broccoli Florets', brand: 'Fresh Produce', barcode: '0011110000233', servingSize: 150, servingUnit: 'g', calories: 52, proteinG: 3.7, carbsG: 10.5, fatG: 0.6, isCommon: true },
  { id: 'fd_spinach', name: 'Baby Spinach', brand: 'Fresh Produce', barcode: '0011110000240', servingSize: 85, servingUnit: 'g', calories: 20, proteinG: 2.4, carbsG: 3.1, fatG: 0.3, isCommon: true },
  { id: 'fd_peanut_butter', name: 'Natural Peanut Butter', brand: 'Harvest', barcode: '0011110000257', servingSize: 32, servingUnit: 'g', calories: 190, proteinG: 8, carbsG: 6, fatG: 16, isCommon: true },
  { id: 'fd_almonds', name: 'Roasted Almonds', brand: 'Harvest', barcode: '0011110000264', servingSize: 28, servingUnit: 'g', calories: 164, proteinG: 6, carbsG: 6, fatG: 14, isCommon: true },
  { id: 'fd_olive_oil', name: 'Extra-Virgin Olive Oil (1 Tbsp)', brand: 'Mediterranean', barcode: '0011110000271', servingSize: 14, servingUnit: 'g', calories: 120, proteinG: 0, carbsG: 0, fatG: 14, isCommon: true },
  { id: 'fd_milk_skim', name: 'Ultra-Filtered Skim Milk', brand: 'PureDairy', barcode: '0011110000288', servingSize: 240, servingUnit: 'ml', calories: 80, proteinG: 13, carbsG: 6, fatG: 0, isCommon: true },
  { id: 'fd_creatine_shake', name: 'Post-Workout Protein & Berry Shake', brand: 'TOP1 Fuel', barcode: '0011110000295', servingSize: 350, servingUnit: 'ml', calories: 280, proteinG: 32, carbsG: 30, fatG: 3, isCommon: true },
  { id: 'fd_lentils', name: 'Cooked Green Lentils', brand: 'Harvest', barcode: '0011110000301', servingSize: 198, servingUnit: 'g', calories: 230, proteinG: 18, carbsG: 40, fatG: 0.8, isCommon: true },
] as const;

export async function seedDatabase(db: AppDatabase): Promise<void> {
  const now = new Date().toISOString();

  // 1. Seed core curated exercises idempotently
  const seededNames = new Set<string>();
  for (const ex of SEED_EXERCISES) {
    seededNames.add(ex.name.toLowerCase().trim());
    await db
      .insert(exercises)
      .values({
        id: ex.id,
        name: ex.name,
        equipment: ex.equipment,
        inputType: ex.bw ? 'bodyweight_reps' : 'weight_reps',
        primaryMusclesJson: JSON.stringify(ex.primary),
        secondaryMusclesJson: JSON.stringify(ex.secondary),
        instructions: `Control the eccentric phase and drive smoothly through full range of motion on ${ex.name}.`,
        maleBaseFactor: ex.m,
        femaleBaseFactor: ex.f,
        includesBodyweight: ex.bw,
        isRankable: true,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  // 1b. Seed all 630 illustrated APK exercises from apkExercisesCatalog.json idempotently
  try {
    const catalogUrl = new URL('./apkExercisesCatalog.json', import.meta.url);
    if (fs.existsSync(catalogUrl)) {
      const apkCatalog = JSON.parse(fs.readFileSync(catalogUrl, 'utf8')) as Array<{
        id: string;
        slug: string;
        name: string;
        equipment: string;
        primaryMuscle: string;
        secondaryMuscles: string[];
        isBodyweight: boolean;
        maleFactor: number;
        femaleFactor: number;
        instructions: string;
      }>;
      const toInsert = apkCatalog
        .filter((item) => !seededNames.has(item.name.toLowerCase().trim()))
        .map((item) => ({
          id: item.id,
          name: item.name,
          equipment: item.equipment,
          inputType: item.isBodyweight ? 'bodyweight_reps' : 'weight_reps',
          primaryMusclesJson: JSON.stringify([item.primaryMuscle]),
          secondaryMusclesJson: JSON.stringify(item.secondaryMuscles),
          instructions: item.instructions,
          maleBaseFactor: Number((item.maleFactor * 3.2).toFixed(2)),
          femaleBaseFactor: Number((item.femaleFactor * 2.8).toFixed(2)),
          includesBodyweight: item.isBodyweight,
          isRankable: item.primaryMuscle !== 'Cardio',
          createdAt: now,
        }));

      // Insert in fast chunks of 100
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        await db.insert(exercises).values(chunk).onConflictDoNothing();
      }
    }
  } catch {
    // Non-fatal if catalog json is absent in minimal test builds
  }

  // 2. Seed foods idempotently
  for (const food of SEED_FOODS) {
    await db
      .insert(foods)
      .values({
        ...food,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  // 2b. Seed quests, medals & shop items idempotently
  await db
    .insert(quests)
    .values([
      { id: 'qst_1', category: 'daily', title: 'Complete a Workout', description: 'Log at least 1 finished workout session today.', targetCount: 1, rewardXp: 200, rewardCredits: 75, metricKey: 'workouts' },
      { id: 'qst_2', category: 'weekly', title: 'Volume Builder', description: 'Complete 30 working sets across the week.', targetCount: 30, rewardXp: 450, rewardCredits: 150, metricKey: 'sets' },
      { id: 'qst_3', category: 'weekly', title: 'Consistency Champion', description: 'Log 4 workouts this week.', targetCount: 4, rewardXp: 600, rewardCredits: 200, metricKey: 'workouts' },
    ])
    .onConflictDoNothing();

  await db
    .insert(medals)
    .values([
      { id: 'mdl_first', name: 'First Session', description: 'Complete your first ranked workout.', icon: 'rocket', tierColor: '#59B9F9', targetValue: 1, metricKey: 'workouts' },
      { id: 'mdl_streak7', name: '7-Day Fire', description: 'Hold a 7-day training streak.', icon: 'flame', tierColor: '#F59E0B', targetValue: 7, metricKey: 'streak' },
      { id: 'mdl_gold', name: 'Gold Standard', description: 'Reach 400+ SR overall Bodyrank.', icon: 'trophy', tierColor: '#D3A313', targetValue: 400, metricKey: 'rating' },
      { id: 'mdl_plat', name: 'Platinum Club', description: 'Reach 500+ SR overall Bodyrank.', icon: 'diamond', tierColor: '#5EDED6', targetValue: 500, metricKey: 'rating' },
      { id: 'mdl_50w', name: '50 Sessions', description: 'Log 50 lifetime workouts.', icon: 'barbell', tierColor: '#B465D0', targetValue: 50, metricKey: 'workouts' },
    ])
    .onConflictDoNothing();

  await db
    .insert(shopItems)
    .values([
      { id: 'shp_title_titan', category: 'title', name: 'Iron Vanguard', description: 'Display the Iron Vanguard title on your profile & feed.', rarity: 'rare', costCredits: 150, previewValue: 'Iron Vanguard' },
      { id: 'shp_title_apex', category: 'title', name: 'Apex Challenger', description: 'Prestigious title for top ranked lifters.', rarity: 'epic', costCredits: 300, previewValue: 'Apex Challenger' },
      { id: 'shp_border_sky', category: 'border', name: 'Electric Halo', description: 'Glowing electric-sky avatar frame.', rarity: 'rare', costCredits: 180, previewValue: '#59B9F9' },
      { id: 'shp_border_gold', category: 'border', name: 'Champion Gold Frame', description: 'Molten gold avatar ring.', rarity: 'epic', costCredits: 320, previewValue: '#D3A313' },
      { id: 'shp_border_amethyst', category: 'border', name: 'Amethyst Pulse', description: 'Champion purple avatar border.', rarity: 'legendary', costCredits: 450, previewValue: '#B465D0' },
      { id: 'shp_banner_cyber', category: 'banner', name: 'Neon Horizon Banner', description: 'Vibrant indigo-to-sky profile banner.', rarity: 'epic', costCredits: 250, previewValue: '#2552D9' },
      { id: 'shp_banner_crimson', category: 'banner', name: 'Crimson Forge Banner', description: 'High-intensity crimson profile header.', rarity: 'rare', costCredits: 200, previewValue: '#B92323' },
    ])
    .onConflictDoNothing();

  // 3. Never seed demo accounts with hardcoded credentials in production/Vercel unless explicitly opted in
  const allowDemoSeed =
    process.env.TOP1_SEED_DEMO_USERS === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1');
  if (!allowDemoSeed) {
    return;
  }

  const [existingDemo] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, 'usr_demo'))
    .limit(1);

  if (existingDemo) {
    await seedTop1DemoData(db, now);
    return;
  }

  const demoPass = hashPassword('demo1234');
  const seedUsers = [
    {
      id: 'usr_demo',
      email: 'demo@apexlift.app',
      username: 'alexlifts',
      displayName: 'Alex Mercer',
      bio: 'Chasing Diamond Bench & 5x/week consistency.',
      sex: 'Male' as const,
      bw: 82,
      xp: 4820,
      streaks: 14,
      longestStreak: 28,
      totalWorkouts: 64,
      totalVolumeKg: 412500,
      peakRating: 565,
      referralCode: 'ALEX901',
      avatar: { skinTone: '#E0AC69', hairStyle: 'fade', hairColor: '#1F1A17', outfitColor: '#59B9F9', accessory: 'headphones', backgroundColor: '#1A1524' },
    },
    {
      id: 'usr_maya',
      email: 'maya@apexlift.app',
      username: 'maya_strong',
      displayName: 'Maya Chen',
      bio: 'Powerbuilding + macro precision.',
      sex: 'Female' as const,
      bw: 62,
      xp: 7350,
      streaks: 23,
      longestStreak: 41,
      totalWorkouts: 112,
      totalVolumeKg: 540200,
      peakRating: 675,
      referralCode: 'MAYA204',
      avatar: { skinTone: '#F1C27D', hairStyle: 'long', hairColor: '#111111', outfitColor: '#B465D0', accessory: 'none', backgroundColor: '#252031' },
    },
    {
      id: 'usr_marcus',
      email: 'marcus@apexlift.app',
      username: 'marcus_pr',
      displayName: 'Marcus Vance',
      bio: 'Heavy compounds only.',
      sex: 'Male' as const,
      bw: 91,
      xp: 9400,
      streaks: 9,
      longestStreak: 19,
      totalWorkouts: 148,
      totalVolumeKg: 980400,
      peakRating: 745,
      referralCode: 'MARC330',
      avatar: { skinTone: '#8D5524', hairStyle: 'buzz', hairColor: '#0F0F0F', outfitColor: '#D3A313', accessory: 'headband', backgroundColor: '#1A1524' },
    },
    {
      id: 'usr_elena',
      email: 'elena@apexlift.app',
      username: 'elena_fit',
      displayName: 'Elena Brooks',
      bio: 'Hypertrophy & lower-body strength.',
      sex: 'Female' as const,
      bw: 59,
      xp: 3100,
      streaks: 6,
      longestStreak: 15,
      totalWorkouts: 45,
      totalVolumeKg: 215000,
      peakRating: 485,
      referralCode: 'ELEN412',
      avatar: { skinTone: '#FFDBAC', hairStyle: 'wavy', hairColor: '#6B3E26', outfitColor: '#5EDED6', accessory: 'glasses', backgroundColor: '#1A1524' },
    },
  ];

  for (const u of seedUsers) {
    const rankLabel = ratingToRank(u.peakRating).label;
    await db
      .insert(users)
      .values({
        id: u.id,
        email: u.email,
        passwordHash: demoPass,
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        avatarConfigJson: JSON.stringify(u.avatar),
        rankingSex: u.sex,
        bodyweightKg: u.bw,
        experiencePoints: u.xp,
        credits: 650,
        streaks: u.streaks,
        longestStreak: u.longestStreak,
        lastWorkoutAt: now,
        peakAverageRank: rankLabel,
        peakAverageRating: u.peakRating,
        totalWorkouts: u.totalWorkouts,
        totalVolumeKg: u.totalVolumeKg,
        referralCode: u.referralCode,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    await db
      .insert(macroGoals)
      .values({
        userId: u.id,
        dailyCaloriesGoal: u.sex === 'Male' ? 2650 : 2050,
        dailyProteinGoal: Math.round(u.bw * 2.2),
        dailyCarbsGoal: u.sex === 'Male' ? 290 : 215,
        dailyFatGoal: u.sex === 'Male' ? 75 : 60,
        updatedAt: now,
      })
      .onConflictDoNothing();

    await db
      .insert(notificationSettings)
      .values({ userId: u.id, updatedAt: now })
      .onConflictDoNothing();
  }

  // 4. Friendships for demo user
  for (const friendId of ['usr_maya', 'usr_marcus', 'usr_elena']) {
    await db
      .insert(friendships)
      .values([
        { id: `fr_${friendId}_a`, userId: 'usr_demo', friendId, createdAt: now },
        { id: `fr_${friendId}_b`, userId: friendId, friendId: 'usr_demo', createdAt: now },
      ])
      .onConflictDoNothing();
  }

  // 5. Starter Folder & Presets for demo user
  await db
    .insert(workoutFolders)
    .values({ id: 'fld_ppl', userId: 'usr_demo', name: 'Push / Pull / Legs', sortOrder: 0, createdAt: now })
    .onConflictDoNothing();

  await db
    .insert(presets)
    .values([
      { id: 'prs_push', userId: 'usr_demo', folderId: 'fld_ppl', name: 'Heavy Push Day', description: 'Chest, shoulders & triceps strength focus', sortOrder: 0, createdAt: now, updatedAt: now },
      { id: 'prs_pull', userId: 'usr_demo', folderId: 'fld_ppl', name: 'Back & Biceps Pull', description: 'Lats, upper back, rear delts & arms', sortOrder: 1, createdAt: now, updatedAt: now },
      { id: 'prs_legs', userId: 'usr_demo', folderId: 'fld_ppl', name: 'Lower Strength & Hypertrophy', description: 'Quads, hamstrings, glutes & calves', sortOrder: 2, createdAt: now, updatedAt: now },
    ])
    .onConflictDoNothing();

  await db
    .insert(presetExercises)
    .values([
      { id: 'pe_1', presetId: 'prs_push', exerciseId: 'ex_bench_press', sortOrder: 0, restSeconds: 150, targetSetsJson: JSON.stringify([{ weightKg: 95, reps: 5 }, { weightKg: 95, reps: 5 }, { weightKg: 95, reps: 5 }]) },
      { id: 'pe_2', presetId: 'prs_push', exerciseId: 'ex_incline_db_press', sortOrder: 1, restSeconds: 120, targetSetsJson: JSON.stringify([{ weightKg: 34, reps: 8 }, { weightKg: 34, reps: 8 }, { weightKg: 34, reps: 8 }]) },
      { id: 'pe_3', presetId: 'prs_push', exerciseId: 'ex_lateral_raise', sortOrder: 2, restSeconds: 60, targetSetsJson: JSON.stringify([{ weightKg: 14, reps: 12 }, { weightKg: 14, reps: 12 }, { weightKg: 14, reps: 12 }]) },
      { id: 'pe_4', presetId: 'prs_push', exerciseId: 'ex_tricep_pushdown', sortOrder: 3, restSeconds: 75, targetSetsJson: JSON.stringify([{ weightKg: 32, reps: 12 }, { weightKg: 32, reps: 12 }, { weightKg: 32, reps: 10 }]) },
      { id: 'pe_5', presetId: 'prs_pull', exerciseId: 'ex_pull_ups', sortOrder: 0, restSeconds: 120, targetSetsJson: JSON.stringify([{ weightKg: 10, reps: 8 }, { weightKg: 10, reps: 8 }, { weightKg: 10, reps: 7 }]) },
      { id: 'pe_6', presetId: 'prs_pull', exerciseId: 'ex_barbell_row', sortOrder: 1, restSeconds: 120, targetSetsJson: JSON.stringify([{ weightKg: 85, reps: 8 }, { weightKg: 85, reps: 8 }, { weightKg: 85, reps: 8 }]) },
      { id: 'pe_7', presetId: 'prs_pull', exerciseId: 'ex_barbell_curl', sortOrder: 2, restSeconds: 75, targetSetsJson: JSON.stringify([{ weightKg: 40, reps: 10 }, { weightKg: 40, reps: 10 }]) },
      { id: 'pe_8', presetId: 'prs_legs', exerciseId: 'ex_squat', sortOrder: 0, restSeconds: 180, targetSetsJson: JSON.stringify([{ weightKg: 130, reps: 5 }, { weightKg: 130, reps: 5 }, { weightKg: 130, reps: 5 }]) },
      { id: 'pe_9', presetId: 'prs_legs', exerciseId: 'ex_rdl', sortOrder: 1, restSeconds: 120, targetSetsJson: JSON.stringify([{ weightKg: 110, reps: 8 }, { weightKg: 110, reps: 8 }, { weightKg: 110, reps: 8 }]) },
    ])
    .onConflictDoNothing();

  // 6. Seed Demo Exercise Ranks & History
  const demoLifts = [
    { exId: 'ex_bench_press', weightKg: 105, reps: 5 },
    { exId: 'ex_squat', weightKg: 142.5, reps: 5 },
    { exId: 'ex_deadlift', weightKg: 175, reps: 3 },
    { exId: 'ex_overhead_press', weightKg: 65, reps: 5 },
    { exId: 'ex_pull_ups', weightKg: 15, reps: 8 },
    { exId: 'ex_barbell_row', weightKg: 95, reps: 6 },
    { exId: 'ex_barbell_curl', weightKg: 45, reps: 8 },
    { exId: 'ex_tricep_pushdown', weightKg: 40, reps: 10 },
    { exId: 'ex_lateral_raise', weightKg: 16, reps: 12 },
    { exId: 'ex_calf_raise', weightKg: 100, reps: 12 },
    { exId: 'ex_cable_crunch', weightKg: 55, reps: 15 },
  ];

  for (const lift of demoLifts) {
    const ex = SEED_EXERCISES.find((e) => e.id === lift.exId)!;
    const r = calculateExerciseRank({
      weightKg: lift.weightKg,
      reps: lift.reps,
      bodyweightKg: 82,
      sex: 'Male',
      standard: { maleBaseFactor: ex.m, femaleBaseFactor: ex.f, includesBodyweight: ex.bw },
    });
    await db
      .insert(exerciseRanks)
      .values({
        id: `rnk_demo_${lift.exId}`,
        userId: 'usr_demo',
        exerciseId: lift.exId,
        peakE1rmKg: r.estimatedOneRmKg,
        peakRating: r.rating,
        rankTier: r.tier,
        rankDivision: r.division,
        achievedAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  for (let i = 5; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 7 * 24 * 3600 * 1000).toISOString();
    const rating = 490 + (5 - i) * 15;
    const rank = ratingToRank(rating);
    await db
      .insert(rankHistory)
      .values({
        id: `rh_demo_${i}`,
        userId: 'usr_demo',
        exerciseId: null,
        rating,
        rankTier: rank.tier,
        rankDivision: rank.division,
        recordedAt: dt,
      })
      .onConflictDoNothing();
  }

  // 7. Seed a sample workout post & welcome notification
  const postTime = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
  await db
    .insert(workoutPosts)
    .values({
      id: 'pst_demo_1',
      userId: 'usr_demo',
      presetId: 'prs_push',
      title: 'Heavy Push Day — New Bench PR',
      caption: 'Locked in 105 kg x 5 clean reps. Platinum III feels close!',
      durationSeconds: 3420,
      totalVolumeKg: 8420,
      totalSets: 14,
      visibility: 'public',
      muscleHeatmapJson: JSON.stringify({ 'Upper Chest': 580, 'Lower Chest': 580, 'Front Delt': 520, 'Triceps': 540 }),
      xpEarned: 240,
      startedAt: postTime,
      completedAt: postTime,
      createdAt: postTime,
    })
    .onConflictDoNothing();

  await db
    .insert(workoutExerciseLogs)
    .values({
      id: 'wel_demo_1',
      postId: 'pst_demo_1',
      exerciseId: 'ex_bench_press',
      sortOrder: 0,
      bestE1rmKg: 121.5,
      bestRating: 580,
      bestRankTier: 'Veteran',
      bestRankDivision: 3,
    })
    .onConflictDoNothing();

  await db
    .insert(workoutSets)
    .values([
      { id: 'ws_demo_1', exerciseLogId: 'wel_demo_1', setIndex: 0, setType: 'warmup', weightKg: 60, reps: 10, rpe: 6, isCompleted: true, isPr: false },
      { id: 'ws_demo_2', exerciseLogId: 'wel_demo_1', setIndex: 1, setType: 'normal', weightKg: 100, reps: 5, rpe: 8, isCompleted: true, isPr: false },
      { id: 'ws_demo_3', exerciseLogId: 'wel_demo_1', setIndex: 2, setType: 'normal', weightKg: 105, reps: 5, rpe: 9, isCompleted: true, isPr: true },
    ])
    .onConflictDoNothing();

  await db
    .insert(notifications)
    .values({
      id: 'ntf_welcome',
      userId: 'usr_demo',
      actorId: 'usr_maya',
      type: 'reaction',
      title: 'Maya reacted to your workout',
      body: 'Maya cheered on your Heavy Push Day — New Bench PR!',
      createdAt: now,
    })
    .onConflictDoNothing();

  // 8. Seed demo goals, quest progress, measurements, food logs, health log, plan & inventory
  const todayIso = now.slice(0, 10);
  await db
    .insert(goals)
    .values([
      { id: 'gol_demo_1', userId: 'usr_demo', goalType: 'strength', title: '130 kg Bench Press 1RM', exerciseId: 'ex_bench_press', startingValue: 105, currentValue: 121.5, targetValue: 130, unit: 'kg', createdAt: now },
      { id: 'gol_demo_2', userId: 'usr_demo', goalType: 'consistency', title: 'Log 20 Workouts This Month', exerciseId: null, startingValue: 0, currentValue: 14, targetValue: 20, unit: 'workouts', createdAt: now },
    ])
    .onConflictDoNothing();

  await db
    .insert(userQuests)
    .values([
      { id: 'uq_demo_1', userId: 'usr_demo', questId: 'qst_1', progress: 1, updatedAt: now },
      { id: 'uq_demo_2', userId: 'usr_demo', questId: 'qst_2', progress: 22, updatedAt: now },
      { id: 'uq_demo_3', userId: 'usr_demo', questId: 'qst_3', progress: 3, updatedAt: now },
    ])
    .onConflictDoNothing();

  await db
    .insert(bodyMeasurements)
    .values([
      { id: 'msr_demo_1', userId: 'usr_demo', metricType: 'Bodyweight', value: 83.2, unit: 'kg', recordedAt: new Date(Date.now() - 21 * 86400000).toISOString() },
      { id: 'msr_demo_2', userId: 'usr_demo', metricType: 'Bodyweight', value: 82.6, unit: 'kg', recordedAt: new Date(Date.now() - 10 * 86400000).toISOString() },
      { id: 'msr_demo_3', userId: 'usr_demo', metricType: 'Bodyweight', value: 82.0, unit: 'kg', recordedAt: now },
      { id: 'msr_demo_4', userId: 'usr_demo', metricType: 'Body Fat', value: 14.2, unit: '%', recordedAt: now },
      { id: 'msr_demo_5', userId: 'usr_demo', metricType: 'Waist', value: 81.5, unit: 'cm', recordedAt: now },
    ])
    .onConflictDoNothing();

  await db
    .insert(foodLogs)
    .values([
      { id: 'flg_demo_1', userId: 'usr_demo', dateIso: todayIso, mealType: 'breakfast', foodId: 'fd_oats', foodName: 'Rolled Oats + Whey Shake', servings: 1, calories: 420, proteinG: 34, carbsG: 54, fatG: 6, loggedAt: now },
      { id: 'flg_demo_2', userId: 'usr_demo', dateIso: todayIso, mealType: 'lunch', foodId: 'fd_chicken_breast', foodName: 'Chicken Breast & Jasmine Rice', servings: 1, calories: 580, proteinG: 54, carbsG: 68, fatG: 8, loggedAt: now },
    ])
    .onConflictDoNothing();

  await db
    .insert(foodBundles)
    .values({
      id: 'bnd_demo_1',
      userId: 'usr_demo',
      name: 'Post-Workout Anabolic Bowl',
      itemsJson: JSON.stringify([
        { foodId: 'fd_chicken_breast', foodName: 'Grilled Chicken Breast', servings: 2 },
        { foodId: 'fd_white_rice', foodName: 'Cooked Jasmine Rice', servings: 1.5 },
      ]),
      totalCalories: 622.5,
      totalProteinG: 68,
      totalCarbsG: 64.5,
      totalFatG: 7.8,
      createdAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(healthLogs)
    .values({
      id: 'hlg_demo_1',
      userId: 'usr_demo',
      dateIso: todayIso,
      steps: 8420,
      activeCalories: 540,
      sleepMinutes: 465,
      waterMl: 2250,
      restingHr: 56,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(workoutPlans)
    .values({
      id: 'pln_demo_1',
      userId: 'usr_demo',
      name: 'Push / Pull / Legs Powerbuilding',
      goal: 'build_muscle',
      daysPerWeek: 4,
      durationWeeks: 8,
      currentWeek: 3,
      isActive: true,
      splitJson: JSON.stringify([
        { day: 'Mon', focus: 'Heavy Push Day' },
        { day: 'Tue', focus: 'Back & Biceps Pull' },
        { day: 'Thu', focus: 'Lower Strength & Hypertrophy' },
        { day: 'Fri', focus: 'Upper Power Mix' },
      ]),
      createdAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(userInventory)
    .values([
      { id: 'inv_demo_1', userId: 'usr_demo', itemId: 'shp_title_titan', purchasedAt: now },
      { id: 'inv_demo_2', userId: 'usr_demo', itemId: 'shp_border_sky', purchasedAt: now },
    ])
    .onConflictDoNothing();

  // Also seed a friend workout post so Social Feed has rich multi-user content
  const mayaTime = new Date(Date.now() - 9 * 3600 * 1000).toISOString();
  await db
    .insert(workoutPosts)
    .values({
      id: 'pst_maya_1',
      userId: 'usr_maya',
      presetId: null,
      title: 'Diamond Squat Session',
      caption: 'Hit 115 kg x 5 on back squat! Legs are cooked.',
      durationSeconds: 3780,
      totalVolumeKg: 9240,
      totalSets: 16,
      visibility: 'public',
      muscleHeatmapJson: JSON.stringify({ Quadriceps: 685, Glutes: 670, Hamstrings: 620 }),
      xpEarned: 290,
      startedAt: mayaTime,
      completedAt: mayaTime,
      createdAt: mayaTime,
    })
    .onConflictDoNothing();

  await db
    .insert(workoutExerciseLogs)
    .values({
      id: 'wel_maya_1',
      postId: 'pst_maya_1',
      exerciseId: 'ex_squat',
      sortOrder: 0,
      bestE1rmKg: 131.2,
      bestRating: 685,
      bestRankTier: 'Elite',
      bestRankDivision: 3,
    })
    .onConflictDoNothing();

  await db
    .insert(workoutSets)
    .values([
      { id: 'ws_maya_1', exerciseLogId: 'wel_maya_1', setIndex: 0, setType: 'normal', weightKg: 110, reps: 5, rpe: 8, isCompleted: true, isPr: false },
      { id: 'ws_maya_2', exerciseLogId: 'wel_maya_1', setIndex: 1, setType: 'normal', weightKg: 115, reps: 5, rpe: 9, isCompleted: true, isPr: true },
    ])
    .onConflictDoNothing();

  await seedTop1DemoData(db, now);
}

async function seedTop1DemoData(db: AppDatabase, now: string): Promise<void> {
  const [existingObs] = await db
    .select({ id: metricObservations.id })
    .from(metricObservations)
    .where(eq(metricObservations.userId, 'usr_demo'))
    .limit(1);

  if (existingObs) return;

  // 9. Seed TOP1% Scientific Observations, Personal Workspace, Adaptive Goal Programs, Training Ledger & Wearable Readiness
  const daysAgoIso = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  const demoObsSeed: Array<{
    id: string;
    metricId: string;
    value: number;
    unit: string;
    daysAgo: number;
    seq: number;
    method: string;
    exerciseMode?: string;
    bodyWeightKg?: number;
  }> = [
    // Historical progression on pushups & bench_1rm so Personal Monte Carlo Forecast is active immediately
    { id: 'obs_demo_push_1', metricId: 'pushups', value: 30, unit: 'reps', daysAgo: 28, seq: 1, method: 'manual', bodyWeightKg: 82 },
    { id: 'obs_demo_push_2', metricId: 'pushups', value: 36, unit: 'reps', daysAgo: 14, seq: 2, method: 'manual', bodyWeightKg: 82 },
    { id: 'obs_demo_push_3', metricId: 'pushups', value: 42, unit: 'reps', daysAgo: 3, seq: 3, method: 'manual', bodyWeightKg: 82 },
    { id: 'obs_demo_bench_1', metricId: 'bench_1rm', value: 1.32, unit: '× BW', daysAgo: 30, seq: 4, method: 'direct_1rm', bodyWeightKg: 82 },
    { id: 'obs_demo_bench_2', metricId: 'bench_1rm', value: 1.44, unit: '× BW', daysAgo: 2, seq: 5, method: 'direct_1rm', bodyWeightKg: 82 },
    { id: 'obs_demo_dips_1', metricId: 'dips', value: 22, unit: 'reps', daysAgo: 5, seq: 6, method: 'manual', bodyWeightKg: 82 },
    { id: 'obs_demo_pullups_1', metricId: 'pullups', value: 18, unit: 'reps', daysAgo: 4, seq: 7, method: 'manual', bodyWeightKg: 82 },
    { id: 'obs_demo_hang_1', metricId: 'dead_hang', value: 105, unit: 's', daysAgo: 6, seq: 8, method: 'manual', bodyWeightKg: 82 },
    { id: 'obs_demo_grip_1', metricId: 'grip_strength', value: 57, unit: 'kg', daysAgo: 9, seq: 9, method: 'dynamometer_single_hand', bodyWeightKg: 82 },
    { id: 'obs_demo_squat_1', metricId: 'squat_1rm', value: 1.78, unit: '× BW', daysAgo: 5, seq: 10, method: 'direct_1rm', bodyWeightKg: 82 },
    { id: 'obs_demo_dead_1', metricId: 'deadlift_1rm', value: 2.12, unit: '× BW', daysAgo: 7, seq: 11, method: 'direct_1rm', bodyWeightKg: 82 },
    { id: 'obs_demo_cmj_1', metricId: 'cmj', value: 49, unit: 'cm', daysAgo: 10, seq: 12, method: 'manual', bodyWeightKg: 82 },
    { id: 'obs_demo_run5k_1', metricId: 'run_5k', value: 23.4, unit: 'min', daysAgo: 6, seq: 13, method: 'device', bodyWeightKg: 82 },
    { id: 'obs_demo_400m_1', metricId: 'sprint_400m', value: 64.5, unit: 's', daysAgo: 12, seq: 14, method: 'manual', bodyWeightKg: 82 },
    { id: 'obs_demo_sleep_1', metricId: 'total_sleep', value: 455, unit: 'min', daysAgo: 1, seq: 15, method: 'device' },
    { id: 'obs_demo_rhr_1', metricId: 'rhr', value: 53, unit: 'bpm', daysAgo: 1, seq: 16, method: 'device' },
    { id: 'obs_demo_hrv_1', metricId: 'hrv', value: 74, unit: 'ms', daysAgo: 1, seq: 17, method: 'device' },
    { id: 'obs_demo_bf_1', metricId: 'body_fat', value: 14.2, unit: '%', daysAgo: 4, seq: 18, method: 'dexa' },
    { id: 'obs_demo_whr_1', metricId: 'waist_height_ratio', value: 0.45, unit: 'ratio', daysAgo: 4, seq: 19, method: 'manual' },
    { id: 'obs_demo_apob_1', metricId: 'apob', value: 68, unit: 'mg/dL', daysAgo: 18, seq: 20, method: 'lab' },
    { id: 'obs_demo_hba1c_1', metricId: 'hba1c', value: 5.0, unit: '%', daysAgo: 18, seq: 21, method: 'lab' },
    { id: 'obs_demo_glucose_1', metricId: 'fasting_glucose', value: 84, unit: 'mg/dL', daysAgo: 18, seq: 22, method: 'lab' },
    { id: 'obs_demo_insulin_1', metricId: 'fasting_insulin', value: 4.1, unit: 'µIU/mL', daysAgo: 18, seq: 23, method: 'lab' },
    { id: 'obs_demo_hscrp_1', metricId: 'hscrp', value: 0.45, unit: 'mg/L', daysAgo: 18, seq: 24, method: 'lab' },
    { id: 'obs_demo_lpa_1', metricId: 'lpa', value: 38, unit: 'nmol/L', daysAgo: 18, seq: 25, method: 'lab' },
    { id: 'obs_demo_homo_1', metricId: 'homocysteine', value: 7.8, unit: 'µmol/L', daysAgo: 18, seq: 26, method: 'lab' },
    { id: 'obs_demo_cysc_1', metricId: 'cystatin_c', value: 0.74, unit: 'mg/L', daysAgo: 18, seq: 27, method: 'lab' },
    { id: 'obs_demo_ggt_1', metricId: 'ggt', value: 17, unit: 'U/L', daysAgo: 18, seq: 28, method: 'lab' },
    { id: 'obs_demo_bp_1', metricId: 'bp_systolic', value: 114, unit: 'mmHg', daysAgo: 5, seq: 29, method: 'device' },
    { id: 'obs_demo_vo2_1', metricId: 'vo2_max', value: 54.6, unit: 'mL/kg/min', daysAgo: 12, seq: 30, method: 'direct_cpet', exerciseMode: 'treadmill' },
  ];

  for (const o of demoObsSeed) {
    const ts = daysAgoIso(o.daysAgo);
    await db
      .insert(metricObservations)
      .values({
        id: o.id,
        userId: 'usr_demo',
        metricId: o.metricId,
        value: o.value,
        unit: o.unit,
        measuredAt: ts,
        recordedAt: ts,
        sequence: o.seq,
        method: o.method,
        exerciseMode: o.exerciseMode ?? null,
        bodyWeightKg: o.bodyWeightKg ?? null,
        cleared: false,
        source: 'seed',
      })
      .onConflictDoNothing();
  }

  // Compute & persist demo athlete's live TOP1% Overall Standing + Scientific Model Score
  const demoProfile = { age: 27, sex: 'male' as const, weight: 82, height: 181 };
  const demoValuesMap: Record<string, number> = {};
  const demoDetailsMap: Record<string, { method: 'manual' | 'direct_1rm' | 'device' | 'dexa' | 'lab' | 'dynamometer_single_hand'; measuredAt: string }> = {};
  for (const o of demoObsSeed) {
    demoValuesMap[o.metricId] = o.value;
    demoDetailsMap[o.metricId] = {
      method: o.method as 'manual',
      measuredAt: daysAgoIso(o.daysAgo),
    };
  }
  const demoOverall = overallPerformance(demoValuesMap, demoDetailsMap, demoProfile);
  const demoSci = evaluate(demoValuesMap, demoProfile, demoDetailsMap);
  const demoBadge = topPercentToBadge(demoOverall.overall?.percent ?? null);
  await db
    .update(users)
    .set({
      overallTopPercent: demoOverall.overall?.percent ?? null,
      overallTierLabel: demoBadge.topLabel,
      scientificModelScore: Number(demoSci.modelScore.toFixed(1)),
      peakAverageRating: Math.max(640, topPercentToRating(demoOverall.overall?.percent ?? null)),
      peakAverageRank: demoBadge.topLabel,
    })
    .where(eq(users.id, 'usr_demo'));

  // Also set TOP1% standings for seeded friends so Leaderboards look authentic
  await db
    .update(users)
    .set({ overallTopPercent: 3.8, overallTierLabel: 'Top 5%', scientificModelScore: 76.4 })
    .where(eq(users.id, 'usr_maya'));
  await db
    .update(users)
    .set({ overallTopPercent: 1.9, overallTierLabel: 'Top 2.5%', scientificModelScore: 81.2 })
    .where(eq(users.id, 'usr_marcus'));
  await db
    .update(users)
    .set({ overallTopPercent: 7.4, overallTierLabel: 'Top 10%', scientificModelScore: 71.5 })
    .where(eq(users.id, 'usr_elena'));

  // Seed default PersonalWorkspace for demo athlete
  const demoToday = dayInZone(new Date(), 'UTC');
  const demoWorkspace: PersonalWorkspace = {
    version: 1,
    goal: {
      version: 1,
      metric: 'pushups',
      baseline: 30,
      target: 60,
      date: addDays(demoToday, 42),
      createdAt: daysAgoIso(28),
    },
    context: {
      experience: 'one_to_three',
      days: 4,
      minutes: 45,
      equipment: ['barbell', 'dumbbells', 'pullup_bar', 'machines', 'outdoor'],
      timezone: 'UTC',
      pinnedMetrics: ['pushups', 'bench_1rm'],
      preferences: {
        style: 'direct',
      },
      delegation: {
        exercises: true,
        schedule: true,
        target: false,
        deadline: false,
        priority: false,
        commitment: false,
        maxSessionShiftDays: 3,
      },
      dayOverrides: [],
      coachDecisions: [],
    },
  };

  await db
    .insert(personalWorkspaces)
    .values({
      userId: 'usr_demo',
      workspaceJson: JSON.stringify(demoWorkspace),
      updatedAt: now,
    })
    .onConflictDoNothing();

  // Seed 2 guided adaptive goal programs + recent training ledger workouts so Coach Decision & Physiology Recovery are live
  const demoGroupId = '11111111-1111-4111-8111-111111111111';
  const pushupConfig: AdaptiveConfig = {
    metric: 'pushups',
    goalUnit: 'metric',
    baseline: 30,
    target: 60,
    deadline: addDays(demoToday, 42),
    createdAt: daysAgoIso(28),
    days: 3,
    minutes: 35,
    exercise: 'Strict push-ups',
    dose: { sets: 4, amount: 22, mode: 'reps', loadKg: 0 },
    routineId: 'rtn_demo_pushups',
    guidedVersion: 1,
    scheduleStart: addDays(demoToday, -28),
    exerciseLabels: ['Strict push-ups', 'Pompes strictes', 'تمارين ضغط كاملة'],
    groupId: demoGroupId,
  };
  const benchConfig: AdaptiveConfig = {
    metric: 'bench_1rm',
    goalUnit: 'kg',
    baseline: 108,
    target: 130,
    deadline: addDays(demoToday, 56),
    createdAt: daysAgoIso(28),
    days: 2,
    minutes: 45,
    exercise: 'Barbell Bench Press',
    dose: { sets: 4, amount: 5, mode: 'reps', loadKg: 95 },
    routineId: 'rtn_demo_bench',
    bodyWeightKg: 82,
    guidedVersion: 1,
    scheduleStart: addDays(demoToday, -28),
    exerciseLabels: ['Barbell Bench Press', 'Développé couché barre', 'ضغط الصدر بالبار'],
    groupId: demoGroupId,
  };

  const pushupProgram = buildProgram(pushupConfig, 'UTC');
  const benchProgram = buildProgram(benchConfig, 'UTC');

  await db
    .insert(trainingLedgerEvents)
    .values([
      {
        id: 'tle_demo_prog_pushups',
        userId: 'usr_demo',
        entityId: '22222222-2222-4222-8222-222222222221',
        sequence: 1,
        revision: 1,
        kind: 'program',
        source: 'personal',
        deleted: false,
        dataJson: JSON.stringify(pushupProgram),
        recordedAt: daysAgoIso(28),
      },
      {
        id: 'tle_demo_prog_bench',
        userId: 'usr_demo',
        entityId: '22222222-2222-4222-8222-222222222222',
        sequence: 2,
        revision: 1,
        kind: 'program',
        source: 'personal',
        deleted: false,
        dataJson: JSON.stringify(benchProgram),
        recordedAt: daysAgoIso(28),
      },
    ])
    .onConflictDoNothing();

  // Seed 2 recent completed workouts (18h ago Push, 42h ago Pull) into trainingLedgerEvents so Bodygraph Recovery % shows real gradient variation!
  const recentPush = buildTop1WorkoutEventFromPost({
    postId: 'wrk_demo_push_recent',
    sequence: 3,
    title: 'Heavy Push & Upper Power',
    startedAt: new Date(Date.now() - 19 * 3600 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    exercises: [
      {
        exerciseId: 'ex_bench_press',
        exerciseName: 'Barbell Bench Press',
        equipment: 'Barbell',
        sets: [
          { weightKg: 97.5, reps: 5, rpe: 8, isCompleted: true },
          { weightKg: 100, reps: 5, rpe: 8.5, isCompleted: true },
          { weightKg: 102.5, reps: 5, rpe: 9, isCompleted: true },
          { weightKg: 102.5, reps: 4, rpe: 9.5, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_overhead_press',
        exerciseName: 'Barbell Overhead Press',
        equipment: 'Barbell',
        sets: [
          { weightKg: 60, reps: 6, rpe: 8, isCompleted: true },
          { weightKg: 62.5, reps: 6, rpe: 8.5, isCompleted: true },
          { weightKg: 62.5, reps: 6, rpe: 9, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_tricep_pushdown',
        exerciseName: 'Cable Tricep Pushdown',
        equipment: 'Cable',
        sets: [
          { weightKg: 32, reps: 12, rpe: 8, isCompleted: true },
          { weightKg: 35, reps: 10, rpe: 9, isCompleted: true },
          { weightKg: 35, reps: 10, rpe: 9, isCompleted: true },
        ],
      },
    ],
  });

  const recentPull = buildTop1WorkoutEventFromPost({
    postId: 'wrk_demo_pull_recent',
    sequence: 4,
    title: 'Back & Pulling Density',
    startedAt: new Date(Date.now() - 44 * 3600 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 43 * 3600 * 1000).toISOString(),
    exercises: [
      {
        exerciseId: 'ex_pull_ups',
        exerciseName: 'Pull-Ups',
        equipment: 'Bodyweight',
        sets: [
          { weightKg: 0, reps: 14, rpe: 8, isCompleted: true },
          { weightKg: 0, reps: 13, rpe: 8.5, isCompleted: true },
          { weightKg: 0, reps: 12, rpe: 9, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_barbell_row',
        exerciseName: 'Bent-Over Barbell Row',
        equipment: 'Barbell',
        sets: [
          { weightKg: 85, reps: 8, rpe: 8, isCompleted: true },
          { weightKg: 85, reps: 8, rpe: 8.5, isCompleted: true },
          { weightKg: 85, reps: 8, rpe: 9, isCompleted: true },
        ],
      },
      {
        exerciseId: 'ex_barbell_curl',
        exerciseName: 'Barbell Bicep Curl',
        equipment: 'Barbell',
        sets: [
          { weightKg: 37.5, reps: 10, rpe: 8.5, isCompleted: true },
          { weightKg: 37.5, reps: 10, rpe: 9, isCompleted: true },
        ],
      },
    ],
  });

  await db
    .insert(trainingLedgerEvents)
    .values([
      {
        id: 'tle_demo_wrk_push',
        userId: 'usr_demo',
        entityId: recentPush.id,
        sequence: 3,
        revision: 1,
        kind: 'workout',
        source: 'personal',
        deleted: false,
        dataJson: JSON.stringify(recentPush.data),
        recordedAt: recentPush.recordedAt,
      },
      {
        id: 'tle_demo_wrk_pull',
        userId: 'usr_demo',
        entityId: recentPull.id,
        sequence: 4,
        revision: 1,
        kind: 'workout',
        source: 'personal',
        deleted: false,
        dataJson: JSON.stringify(recentPull.data),
        recordedAt: recentPull.recordedAt,
      },
    ])
    .onConflictDoNothing();

  // Seed 14 days of smartwatch readiness snapshots (rolling personal HRV RMSSD + RHR baseline)
  const wearableRows = Array.from({ length: 14 }, (_, idx) => {
    const daysBack = 13 - idx;
    const dateIso = addDays(demoToday, -daysBack);
    const hrvBase = 71 + Math.round(Math.sin(idx * 0.7) * 5);
    const rhrBase = 53 + (idx % 3 === 0 ? 1 : 0);
    const sleepMin = 440 + (idx % 4) * 15;
    return {
      id: `wbl_demo_${dateIso}`,
      userId: 'usr_demo',
      dateIso,
      source: 'apple_watch',
      hrvRmssdMs: idx === 13 ? 76 : hrvBase,
      restingHeartRateBpm: idx === 13 ? 52 : rhrBase,
      totalSleepMinutes: idx === 13 ? 465 : sleepMin,
      sleepEfficiencyPercent: 92.5,
      wristTempDeviationC: 0.05,
      respiratoryRateBpm: 13.8,
      cardioLoadTrimp: 65 + (idx % 3) * 15,
      vo2Max: 52.4,
      gpsRun5kMinutes: idx === 7 ? 23.4 : null,
      updatedAt: now,
    };
  });
  for (const wr of wearableRows) {
    await db.insert(wearableSnapshots).values(wr).onConflictDoNothing();
  }
}

// Allow direct invocation via `npm run seed`
const isDirect = process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');
if (isDirect) {
  createDatabase()
    .then(async ({ db, client }) => {
      await seedDatabase(db);
      console.log('[ApexLift Seed] Database seeded successfully.');
      client.close();
    })
    .catch((err) => {
      console.error('[ApexLift Seed] Error:', err);
      process.exit(1);
    });
}
