import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ratingToRank } from '@apexlift/shared';
import {
  bodyMeasurements,
  goals,
  medals,
  quests,
  userMedals,
  userQuests,
  users,
  workoutPosts,
} from '../db/schema.js';
import { generateId } from '../lib/auth.js';
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

    // Build 7-day calendar status
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

      await ctx.db
        .update(userQuests)
        .set({ claimedAt: now, updatedAt: now })
        .where(eq(userQuests.id, uq.id));

      await ctx.db
        .update(users)
        .set({
          experiencePoints: ctx.user.experiencePoints + q.rewardXp,
          credits: ctx.user.credits + q.rewardCredits,
          updatedAt: now,
        })
        .where(eq(users.id, ctx.user.id));

      return { ok: true, rewardXp: q.rewardXp, rewardCredits: q.rewardCredits };
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
