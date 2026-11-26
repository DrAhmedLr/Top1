import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@libsql/client';
import { createDatabase, type AppDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { appRouter } from './routers/index.js';

describe('@apexlift/server full feature integration (Phases 3-7)', () => {
  let client: Client;
  let db: AppDatabase;
  let token: string;

  beforeAll(async () => {
    const conn = await createDatabase(':memory:');
    client = conn.client;
    db = conn.db;
    await seedDatabase(db);

    const anon = appRouter.createCaller({ db });
    const login = await anon.auth.signIn({
      identifier: 'demo@apexlift.app',
      password: 'demo1234',
    });
    token = login.accessToken;
  });

  afterAll(() => {
    client.close();
  });

  const authed = () =>
    appRouter.createCaller({ db, authorizationHeader: `Bearer ${token}` });

  it('Phase 3: exercises, custom exercise, presets, workout generation, schedule & workout logging', async () => {
    const caller = authed();

    const list = await caller.exercise.list({ muscle: 'Upper Chest' });
    expect(list.length).toBeGreaterThanOrEqual(2);

    const custom = await caller.exercise.create({
      name: 'Weighted Ring Dips',
      equipment: 'Bodyweight',
      inputType: 'bodyweight_reps',
      primaryMuscles: ['Lower Chest', 'Triceps'],
    });
    expect(custom.isCustom).toBe(true);

    const preset = await caller.preset.create({
      name: 'Test Blitz',
      exercises: [{ exerciseId: 'ex_bench_press', restSeconds: 120, targetSets: [{ weightKg: 100, reps: 5, setType: 'normal' }] }],
    });
    expect(preset.id).toBeTruthy();

    const generated = await caller.workoutGeneration.generateWorkout({
      split: 'push',
      durationMin: 45,
      equipment: ['Barbell', 'Dumbbell', 'Cable'],
      intensity: 'hypertrophy',
    });
    expect(generated.exercises.length).toBeGreaterThanOrEqual(3);

    const sched = await caller.workoutSchedule.getSchedule();
    expect(sched).toHaveLength(7);

    const logged = await caller.post.create({
      title: 'Integration PR Session',
      caption: 'Crushed bench press!',
      durationSeconds: 2400,
      exercises: [
        {
          exerciseId: 'ex_bench_press',
          notes: 'Felt explosive',
          sets: [
            { setType: 'normal', weightKg: 115, reps: 5, rpe: 9, rir: 1, isCompleted: true },
          ],
        },
      ],
    });
    expect(logged.totalSets).toBe(1);
    expect(logged.totalVolumeKg).toBe(575);
    expect(logged.xpEarned).toBeGreaterThan(100);
  });

  it('Phase 4: bodygraph muscle map, weekly league, weekly report, goals, quests, medals & recap', async () => {
    const caller = authed();

    const map = await caller.rank.getMuscleMap();
    expect(map.rankedMuscleCount).toBeGreaterThan(5);
    expect(map.overallAverageRating).toBeGreaterThan(300);

    const league = await caller.rank.getMyLeague();
    expect(league.standings.length).toBeGreaterThanOrEqual(4);

    const weekly = await caller.gamification.getWeeklyReport();
    expect(weekly.days).toHaveLength(7);

    const q = await caller.gamification.getQuests();
    expect(q.length).toBeGreaterThanOrEqual(3);

    const m = await caller.gamification.getMedals();
    expect(m.some((x) => x.unlocked)).toBe(true);

    const recap = await caller.gamification.getRecapSnapshot();
    expect(recap.archetype).toBeTruthy();
  });

  it('Phase 5: macro goals, food search/barcode, custom food, bundles, food logs & health logs', async () => {
    const caller = authed();
    const today = new Date().toISOString().slice(0, 10);

    const updatedMacros = await caller.food.updateMacroGoals({
      dailyCaloriesGoal: 2800,
      dailyProteinGoal: 200,
      dailyCarbsGoal: 310,
      dailyFatGoal: 80,
    });
    expect(updatedMacros.dailyCaloriesGoal).toBe(2800);

    const barcodeItem = await caller.food.byBarcode({ barcode: '0011110000011' });
    expect(barcodeItem?.name).toContain('Chicken');

    await caller.food.logFood({
      dateIso: today,
      mealType: 'dinner',
      foodName: 'Salmon & Rice',
      servings: 1,
      calories: 520,
      proteinG: 38,
      carbsG: 50,
      fatG: 18,
    });
    const dayLogs = await caller.food.getLogsByDate({ dateIso: today });
    expect(dayLogs.totals.calories).toBeGreaterThanOrEqual(520);

    await caller.food.upsertHealthLog({
      dateIso: today,
      steps: 10500,
      activeCalories: 640,
      sleepMinutes: 480,
      waterMl: 3000,
      restingHr: 54,
    });
    const health = await caller.food.getHealthLog({ dateIso: today });
    expect(health.steps).toBe(10500);
  });

  it('Phase 6 & 7: feed, reactions, comments, friends, leaderboards, shop & notifications', async () => {
    const caller = authed();

    const feed = await caller.post.feed({ scope: 'all', limit: 10 });
    expect(feed.length).toBeGreaterThanOrEqual(2);

    const rx = await caller.postInteractions.upsertReaction({
      postId: feed[0].id,
      reactionKey: '🔥',
    });
    expect(rx.activeReaction).toBe('🔥');

    await caller.postInteractions.commentPost({
      postId: feed[0].id,
      body: 'Monster lift!',
    });
    const comments = await caller.postInteractions.listComments({ postId: feed[0].id });
    expect(comments.some((c) => c.body === 'Monster lift!')).toBe(true);

    const friends = await caller.friends.list();
    expect(friends.length).toBeGreaterThanOrEqual(3);

    const board = await caller.leaderboard.getBoard({ category: 'ranks', scope: 'global' });
    expect(board.rows.length).toBeGreaterThanOrEqual(4);
    expect(board.selfRow).not.toBeNull();

    const catalog = await caller.shop.listCatalog();
    expect(catalog.items.length).toBeGreaterThanOrEqual(5);
    await caller.shop.purchase({ itemId: 'shp_banner_crimson' });
    await caller.shop.equip({ category: 'banner', value: '#B92323' });

    await caller.notifications.updateSettings({ slacking: false, reminderTime: '17:30' });
    const nSettings = await caller.notifications.getSettings();
    expect(nSettings.slacking).toBe(false);
    expect(nSettings.reminderTime).toBe('17:30');
  });
});
