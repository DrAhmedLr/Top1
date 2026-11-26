import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { ratingToRank } from '@apexlift/shared';
import {
  bodyMeasurements,
  dailyVaultClaims,
  featureRequests,
  featureRequestVotes,
  goals,
  medals,
  metricObservations,
  quests,
  userMedals,
  userQuests,
  users,
  workoutPosts,
} from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { nextObservationSequence } from '../lib/top1Context.js';
import { protectedProcedure, router } from '../trpc.js';

export const gamificationRouter = router({
  getWeeklyReport: protectedProcedure.query(async ({ ctx }) => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const posts = await ctx.db
      .select()
      .from(workoutPosts)
      .where(eq(workoutPosts.userId, ctx.user.id))
      .orderBy(desc(workoutPosts.completedAt));

    const recent = posts.filter((p) => p.completedAt >= weekAgo);
    const totalVolumeKg = recent.reduce((sum, p) => sum + p.totalVolumeKg, 0);
    const totalSets = recent.reduce((sum, p) => sum + p.totalSets, 0);
    const totalMinutes = Math.round(
      recent.reduce((sum, p) => sum + p.durationSeconds, 0) / 60
    );

    const days = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(Date.now() - (6 - i) * 24 * 3600 * 1000);
      const iso = dt.toISOString().slice(0, 10);
      const label = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()];
      const workedOut = posts.some((p) => p.completedAt.slice(0, 10) === iso);
      return { iso, label, workedOut };
    });

    return {
      workoutsCount: recent.length,
      weeklyGoal: ctx.user.weeklyWorkoutGoal,
      totalVolumeKg: Number(totalVolumeKg.toFixed(1)),
      totalSets,
      totalMinutes,
      streak: ctx.user.streaks,
      longestStreak: ctx.user.longestStreak,
      days,
    };
  }),

  listGoals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(goals)
      .where(eq(goals.userId, ctx.user.id))
      .orderBy(desc(goals.createdAt));
  }),

  createGoal: protectedProcedure
    .input(
      z.object({
        goalType: z.enum(['strength', 'bodyweight', 'consistency']),
        title: z.string().trim().min(2).max(60),
        exerciseId: z.string().nullable().optional(),
        startingValue: z.number().default(0),
        targetValue: z.number().positive(),
        unit: z.string().default('kg'),
        targetDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId('gol');
      const now = new Date().toISOString();
      await ctx.db.insert(goals).values({
        id,
        userId: ctx.user.id,
        goalType: input.goalType,
        title: input.title,
        exerciseId: input.exerciseId ?? null,
        startingValue: input.startingValue,
        currentValue: input.startingValue,
        targetValue: input.targetValue,
        unit: input.unit,
        targetDate: input.targetDate ?? null,
        completedAt: null,
        createdAt: now,
      });
      return { id };
    }),

  deleteGoal: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(goals)
        .where(and(eq(goals.id, input.id), eq(goals.userId, ctx.user.id)));
      return { ok: true };
    }),

  getQuests: protectedProcedure.query(async ({ ctx }) => {
    const allQ = await ctx.db.select().from(quests);
    const uqRows = await ctx.db
      .select()
      .from(userQuests)
      .where(eq(userQuests.userId, ctx.user.id));
    const uqMap = new Map(uqRows.map((u) => [u.questId, u]));

    return allQ.map((q) => {
      const uq = uqMap.get(q.id);
      const progress = Math.min(q.targetCount, uq?.progress ?? 0);
      return {
        ...q,
        progress,
        isCompleted: progress >= q.targetCount,
        isClaimed: Boolean(uq?.claimedAt),
      };
    });
  }),

  claimQuest: protectedProcedure
    .input(z.object({ questId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [q] = await ctx.db.select().from(quests).where(eq(quests.id, input.questId)).limit(1);
      if (!q) return { ok: false };
      const now = new Date().toISOString();
      const [uq] = await ctx.db
        .select()
        .from(userQuests)
        .where(and(eq(userQuests.userId, ctx.user.id), eq(userQuests.questId, q.id)))
        .limit(1);
      if (!uq || uq.progress < q.targetCount || uq.claimedAt) return { ok: false };

      // Atomic conditional update prevents concurrent double-claim
      const claimed = await ctx.db
        .update(userQuests)
        .set({ claimedAt: now, updatedAt: now })
        .where(and(eq(userQuests.id, uq.id), isNull(userQuests.claimedAt)))
        .returning({ id: userQuests.id });
      if (claimed.length === 0) return { ok: false };

      await ctx.db
        .update(users)
        .set({
          experiencePoints: sql`${users.experiencePoints} + ${q.rewardXp}`,
          credits: sql`${users.credits} + ${q.rewardCredits}`,
          updatedAt: now,
        })
        .where(eq(users.id, ctx.user.id));

      return { ok: true, rewardXp: q.rewardXp, rewardCredits: q.rewardCredits };
    }),

  getDailyVaultStatus: protectedProcedure.query(async ({ ctx }) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const [claim] = await ctx.db
      .select()
      .from(dailyVaultClaims)
      .where(and(eq(dailyVaultClaims.userId, ctx.user.id), eq(dailyVaultClaims.dateIso, todayIso)))
      .limit(1);
    const streakBonus = Math.min(60, ctx.user.streaks * 5);
    return {
      dateIso: todayIso,
      claimedToday: Boolean(claim),
      claimedAt: claim?.claimedAt ?? null,
      rewardCredits: 50 + streakBonus,
      rewardXp: 40 + Math.min(40, ctx.user.streaks * 4),
    };
  }),

  claimDailyVault: protectedProcedure.mutation(async ({ ctx }) => {
    const now = new Date().toISOString();
    const todayIso = now.slice(0, 10);
    const streakBonus = Math.min(60, ctx.user.streaks * 5);
    const rewardCredits = 50 + streakBonus;
    const rewardXp = 40 + Math.min(40, ctx.user.streaks * 4);

    try {
      const inserted = await ctx.db
        .insert(dailyVaultClaims)
        .values({
          id: generateId('dvc'),
          userId: ctx.user.id,
          dateIso: todayIso,
          rewardCredits,
          rewardXp,
          claimedAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: dailyVaultClaims.id });

      if (inserted.length === 0) {
        return { ok: false, alreadyClaimed: true, rewardCredits: 0, rewardXp: 0, credits: ctx.user.credits };
      }
    } catch {
      return { ok: false, alreadyClaimed: true, rewardCredits: 0, rewardXp: 0, credits: ctx.user.credits };
    }

    const [updated] = await ctx.db
      .update(users)
      .set({
        credits: sql`${users.credits} + ${rewardCredits}`,
        experiencePoints: sql`${users.experiencePoints} + ${rewardXp}`,
        updatedAt: now,
      })
      .where(eq(users.id, ctx.user.id))
      .returning({ credits: users.credits });

    return {
      ok: true,
      alreadyClaimed: false,
      rewardCredits,
      rewardXp,
      credits: updated?.credits ?? ctx.user.credits + rewardCredits,
    };
  }),

  listFeatureRequests: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(featureRequests)
      .orderBy(desc(featureRequests.votesCount), desc(featureRequests.createdAt));
    const myVotes = await ctx.db
      .select({ requestId: featureRequestVotes.requestId })
      .from(featureRequestVotes)
      .where(eq(featureRequestVotes.userId, ctx.user.id));
    const votedSet = new Set(myVotes.map((v) => v.requestId));

    return rows.map((r) => ({
      ...r,
      votedByMe: votedSet.has(r.id),
    }));
  }),

  createFeatureRequest: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().max(600).default(''),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId('frq');
      const now = new Date().toISOString();
      await ctx.db.insert(featureRequests).values({
        id,
        userId: ctx.user.id,
        title: input.title,
        description: input.description,
        status: 'open',
        votesCount: 1,
        createdAt: now,
      });
      await ctx.db.insert(featureRequestVotes).values({
        id: generateId('frv'),
        requestId: id,
        userId: ctx.user.id,
        createdAt: now,
      });
      return { id };
    }),

  toggleFeatureRequestVote: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [req] = await ctx.db
        .select()
        .from(featureRequests)
        .where(eq(featureRequests.id, input.requestId))
        .limit(1);
      if (!req) return { ok: false, voted: false, votesCount: 0 };

      const [existing] = await ctx.db
        .select()
        .from(featureRequestVotes)
        .where(
          and(
            eq(featureRequestVotes.requestId, input.requestId),
            eq(featureRequestVotes.userId, ctx.user.id)
          )
        )
        .limit(1);

      let nextCount: number;
      if (existing) {
        await ctx.db.delete(featureRequestVotes).where(eq(featureRequestVotes.id, existing.id));
        nextCount = Math.max(0, req.votesCount - 1);
      } else {
        await ctx.db.insert(featureRequestVotes).values({
          id: generateId('frv'),
          requestId: input.requestId,
          userId: ctx.user.id,
          createdAt: new Date().toISOString(),
        });
        nextCount = req.votesCount + 1;
      }

      await ctx.db
        .update(featureRequests)
        .set({ votesCount: nextCount })
        .where(eq(featureRequests.id, input.requestId));

      return { ok: true, voted: !existing, votesCount: nextCount };
    }),

  getMedals: protectedProcedure.query(async ({ ctx }) => {
    const allM = await ctx.db.select().from(medals);
    const umRows = await ctx.db
      .select()
      .from(userMedals)
      .where(eq(userMedals.userId, ctx.user.id));
    const umMap = new Map(umRows.map((u) => [u.medalId, u]));

    return allM.map((m) => {
      const um = umMap.get(m.id);
      let liveProgress = um?.progress ?? 0;
      if (m.metricKey === 'workouts') liveProgress = Math.max(liveProgress, ctx.user.totalWorkouts);
      if (m.metricKey === 'streak') liveProgress = Math.max(liveProgress, ctx.user.longestStreak);
      if (m.metricKey === 'rating') liveProgress = Math.max(liveProgress, ctx.user.peakAverageRating);
      const unlocked = liveProgress >= m.targetValue || Boolean(um?.unlockedAt);
      return {
        ...m,
        progress: Math.min(m.targetValue, liveProgress),
        unlocked,
      };
    });
  }),

  listMeasurements: protectedProcedure
    .input(z.object({ metricType: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(bodyMeasurements)
        .where(eq(bodyMeasurements.userId, ctx.user.id))
        .orderBy(desc(bodyMeasurements.recordedAt));
      if (input?.metricType) {
        return rows.filter((r) => r.metricType === input.metricType);
      }
      return rows;
    }),

  logMeasurement: protectedProcedure
    .input(
      z.object({
        metricType: z.string().min(1),
        value: z.number().positive(),
        unit: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId('msr');
      const now = new Date().toISOString();
      await ctx.db.insert(bodyMeasurements).values({
        id,
        userId: ctx.user.id,
        metricType: input.metricType,
        value: input.value,
        unit: input.unit,
        recordedAt: now,
      });
      if (input.metricType === 'Bodyweight') {
        const bwKg = input.unit === 'lbs' ? Number((input.value / 2.20462).toFixed(1)) : input.value;
        await ctx.db
          .update(users)
          .set({ bodyweightKg: bwKg, updatedAt: now })
          .where(eq(users.id, ctx.user.id));
      } else if (input.metricType === 'Body Fat' && input.value >= 3 && input.value <= 65) {
        const seq = await nextObservationSequence(ctx.db, ctx.user.id);
        await ctx.db.insert(metricObservations).values({
          id: generateId('obs'),
          userId: ctx.user.id,
          metricId: 'body_fat',
          value: Number(input.value.toFixed(1)),
          unit: '%',
          measuredAt: now,
          recordedAt: now,
          sequence: seq,
          method: 'manual',
          cleared: false,
          source: 'measurement_sync',
        });
      }
      return { id };
    }),

  getRecapSnapshot: protectedProcedure.query(async ({ ctx }) => {
    const rank = ratingToRank(ctx.user.peakAverageRating);
    const archetype =
      ctx.user.totalVolumeKg > 300000
        ? 'Iron Titan'
        : ctx.user.streaks >= 10
          ? 'Relentless Grinder'
          : 'Rising Challenger';

    return {
      totalWorkouts: ctx.user.totalWorkouts,
      totalVolumeKg: ctx.user.totalVolumeKg,
      longestStreak: ctx.user.longestStreak,
      currentStreak: ctx.user.streaks,
      peakRank: rank.label,
      peakTier: rank.tier,
      peakRating: ctx.user.peakAverageRating,
      archetype,
      archetypeTagline:
        archetype === 'Iron Titan'
          ? 'Heavy volume, fearless progression, and unmistakable gym presence.'
          : archetype === 'Relentless Grinder'
            ? 'You show up even when motivation fades. Consistency is your superpower.'
            : 'Building elite habits session by session.',
    };
  }),
});
