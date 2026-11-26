import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@libsql/client';
import { createDatabase, type AppDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { appRouter } from './routers/index.js';

describe('@apexlift/server auth, user & rank preview API', () => {
  let client: Client;
  let db: AppDatabase;

  beforeAll(async () => {
    const conn = await createDatabase(':memory:');
    client = conn.client;
    db = conn.db;
    await seedDatabase(db);
  });

  afterAll(() => {
    client.close();
  });

  it('responds to healthCheck and lists demo rank exercises', async () => {
    const caller = appRouter.createCaller({ db });
    const health = await caller.health.healthCheck();
    expect(health.status).toBe('ok');

    const demoEx = await caller.rank.listDemoExercises();
    expect(demoEx.length).toBeGreaterThanOrEqual(8);
  });

  it('signs up, fetches profile, updates profile, refreshes token, and logs out', async () => {
    const anonCaller = appRouter.createCaller({ db });

    const preview = await anonCaller.rank.calculatePreview({
      exerciseId: 'ex_bench_press',
      weightKg: 90,
      reps: 5,
      bodyweightKg: 80,
      sex: 'Male',
    });
    expect(preview.rating).toBeGreaterThan(300);

    const signedUp = await anonCaller.auth.signUp({
      email: 'newlifter@apexlift.app',
      password: 'password123',
      username: 'new_lifter',
      displayName: 'Jordan Lee',
      rankingSex: 'Male',
      age: 25,
      heightCm: 180,
      bodyweightKg: 80,
      unitWeight: 'lbs',
      unitMeasure: 'in',
      fitnessGoal: 'build_muscle',
      experienceLevel: 'intermediate',
      weeklyWorkoutGoal: 4,
      onboardingBenchmarks: [{ exerciseId: 'ex_bench_press', weightKg: 90, reps: 5 }],
    });

    expect(signedUp.accessToken).toBeTruthy();
    expect(signedUp.refreshToken).toBeTruthy();
    expect(signedUp.user.peakAverageRating).toBeGreaterThan(300);

    const authedCaller = appRouter.createCaller({
      db,
      authorizationHeader: `Bearer ${signedUp.accessToken}`,
    });

    const me = await authedCaller.user.me();
    expect(me.username).toBe('new_lifter');

    const updated = await authedCaller.user.updateProfile({
      bio: 'Clean-room ranked lifter',
      themeId: 'theme_twilight',
    });
    expect(updated.bio).toBe('Clean-room ranked lifter');
    expect(updated.themeId).toBe('theme_twilight');

    const refreshed = await anonCaller.auth.refreshToken({
      refreshToken: signedUp.refreshToken,
    });
    expect(refreshed.accessToken).toBeTruthy();

    await anonCaller.auth.removeSession({ refreshToken: signedUp.refreshToken });
    await expect(
      anonCaller.auth.refreshToken({ refreshToken: signedUp.refreshToken })
    ).rejects.toThrow('Session not found');
  });

  it('signs in with seeded demo credentials and supports password reset', async () => {
    const caller = appRouter.createCaller({ db });
    const res = await caller.auth.signIn({
      identifier: 'demo@apexlift.app',
      password: 'demo1234',
    });
    expect(res.user.username).toBe('alexlifts');

    const req = await caller.auth.requestPasswordReset({ email: 'demo@apexlift.app' });
    expect(req.ok).toBe(true);
    expect(req.devResetToken).toBeTruthy();

    await caller.auth.resetPassword({
      token: req.devResetToken!,
      newPassword: 'newpassword123',
    });

    // Existing sessions must be revoked upon password reset
    await expect(
      caller.auth.refreshToken({ refreshToken: res.refreshToken })
    ).rejects.toThrow('Session not found');

    // In production/Vercel, devResetToken must never be leaked in the response
    const prevVercel = process.env.VERCEL;
    process.env.VERCEL = '1';
    try {
      const prodReq = await caller.auth.requestPasswordReset({ email: 'demo@apexlift.app' });
      expect(prodReq.ok).toBe(true);
      expect(prodReq.devResetToken).toBeNull();
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }

    const relogin = await caller.auth.signIn({
      identifier: 'alexlifts',
      password: 'newpassword123',
    });
    expect(relogin.user.id).toBe('usr_demo');
  });
});
