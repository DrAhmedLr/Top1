import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@libsql/client';
import { createDatabase, type AppDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { appRouter } from './routers/index.js';

describe('@apexlift/server security, IDOR & crash-prevention regressions', () => {
  let client: Client;
  let db: AppDatabase;
  let aliceToken: string;
  let aliceId: string;
  let bobToken: string;

  beforeAll(async () => {
    const conn = await createDatabase(':memory:');
    client = conn.client;
    db = conn.db;
    await seedDatabase(db);

    const anon = appRouter.createCaller({ db });
    const alice = await anon.auth.signUp({
      email: 'alice.sec@top1.fit',
      password: 'strongpassword1',
      username: 'alice_sec',
      displayName: 'Alice Sec',
      rankingSex: 'Female',
      age: 26,
      heightCm: 168,
      bodyweightKg: 62,
      unitWeight: 'kg',
      unitMeasure: 'cm',
      fitnessGoal: 'get_stronger',
      experienceLevel: 'intermediate',
      weeklyWorkoutGoal: 4,
    });
    aliceToken = alice.accessToken;
    aliceId = alice.user.id;

    const bob = await anon.auth.signUp({
      email: 'bob.sec@top1.fit',
      password: 'strongpassword2',
      username: 'bob_sec',
      displayName: 'Bob Sec',
      rankingSex: 'Male',
      age: 29,
      heightCm: 180,
      bodyweightKg: 82,
      unitWeight: 'kg',
      unitMeasure: 'cm',
      fitnessGoal: 'build_muscle',
      experienceLevel: 'intermediate',
      weeklyWorkoutGoal: 4,
    });
    bobToken = bob.accessToken;
  });

  afterAll(() => {
    client.close();
  });

  const asAlice = () =>
    appRouter.createCaller({ db, authorizationHeader: `Bearer ${aliceToken}` });
  const asBob = () =>
    appRouter.createCaller({ db, authorizationHeader: `Bearer ${bobToken}` });

  it('auto-creates a tailored Day-1 starter preset on signup and handles 11-15 rep sets without crashing', async () => {
    const alice = asAlice();
    const myPresets = await alice.preset.list();
    expect(myPresets.length).toBeGreaterThanOrEqual(1);

    // 12-rep bench press & 12-rep weighted pull-up previously threw RangeError in lib/derivations.ts
    const highRepPost = await alice.post.create({
      title: 'High-Rep Hypertrophy',
      visibility: 'private',
      durationSeconds: 1800,
      exercises: [
        {
          exerciseId: 'ex_bench_press',
          notes: '',
          sets: [{ weightKg: 50, reps: 12, setType: 'normal', isCompleted: true }],
        },
        {
          exerciseId: 'ex_pull_ups',
          notes: '',
          sets: [{ weightKg: 5, reps: 12, setType: 'normal', isCompleted: true }],
        },
      ],
    });
    expect(highRepPost.postId).toBeTruthy();
    expect(highRepPost.top1Impact?.syncedBenchmarks.length).toBeGreaterThanOrEqual(1);
  });

  it('blocks cross-user IDORs on private posts, comments, reactions, physiology biometrics, and private presets', async () => {
    const alice = asAlice();
    const bob = asBob();

    const privatePost = await alice.post.create({
      title: 'Private Rehab Session',
      visibility: 'private',
      durationSeconds: 1200,
      exercises: [
        {
          exerciseId: 'ex_squat',
          notes: 'Private note',
          sets: [{ weightKg: 60, reps: 5, setType: 'normal', isCompleted: true }],
        },
      ],
    });

    await expect(bob.post.getById({ id: privatePost.postId })).rejects.toThrow(/not found/i);
    await expect(
      bob.postInteractions.listComments({ postId: privatePost.postId })
    ).rejects.toThrow(/not found/i);
    await expect(
      bob.postInteractions.commentPost({ postId: privatePost.postId, body: 'Snooping' })
    ).rejects.toThrow(/not found/i);
    await expect(
      bob.postInteractions.upsertReaction({ postId: privatePost.postId, reactionKey: '🔥' })
    ).rejects.toThrow(/not found/i);

    // Private physiology/wearables IDOR blocked
    await expect(bob.physiology.getBodyReport({ userId: aliceId })).rejects.toThrow(/private/i);

    // Private preset IDOR blocked
    const privatePreset = await alice.preset.create({
      name: 'Secret Competition Peaking',
      isPublic: false,
      exercises: [
        {
          exerciseId: 'ex_deadlift',
          restSeconds: 180,
          targetSets: [{ weightKg: 120, reps: 3, setType: 'normal' }],
        },
      ],
    });
    await expect(bob.preset.getById({ id: privatePreset.id })).rejects.toThrow(/not found/i);
    await expect(bob.preset.copyFromUser({ presetId: privatePreset.id })).rejects.toThrow(
      /not found/i
    );
  });

  it('enforces cosmetic ownership, single daily vault claim, and persistent feature requests', async () => {
    const alice = asAlice();

    // Unowned title cannot be equipped
    await expect(
      alice.shop.equip({ category: 'title', value: 'Apex Challenger' })
    ).rejects.toThrow(/unlock or purchase/i);

    // Daily Vault claims once per UTC day
    const firstVault = await alice.gamification.claimDailyVault();
    expect(firstVault.ok).toBe(true);
    expect(firstVault.rewardCredits).toBeGreaterThanOrEqual(50);

    const secondVault = await alice.gamification.claimDailyVault();
    expect(secondVault.ok).toBe(false);
    expect(secondVault.alreadyClaimed).toBe(true);

    // Feature requests persist and toggle votes cleanly
    const created = await alice.gamification.createFeatureRequest({
      title: 'Live Apple Watch Set Sync',
      description: 'Sync rest timers and completed sets from watch.',
    });
    const list1 = await alice.gamification.listFeatureRequests();
    const item1 = list1.find((r) => r.id === created.id);
    expect(item1?.votesCount).toBe(1);
    expect(item1?.votedByMe).toBe(true);

    const toggled = await alice.gamification.toggleFeatureRequestVote({ requestId: created.id });
    expect(toggled.voted).toBe(false);
    expect(toggled.votesCount).toBe(0);

    // Export data returns athlete's own archive
    const exported = await alice.user.exportData();
    expect(exported.profile.username).toBe('alice_sec');
    expect(exported.workoutPosts.length).toBeGreaterThanOrEqual(2);
  });

  it('skips seeding hardcoded demo users in production environments', async () => {
    const prevVercel = process.env.VERCEL;
    process.env.VERCEL = '1';
    const prodConn = await createDatabase(':memory:');
    try {
      await seedDatabase(prodConn.db);
      const caller = appRouter.createCaller({ db: prodConn.db });
      await expect(
        caller.auth.signIn({ identifier: 'demo@apexlift.app', password: 'demo1234' })
      ).rejects.toThrow(/Invalid email\/username or password/);
    } finally {
      prodConn.client.close();
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }
  });
});
