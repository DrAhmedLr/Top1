import { TRPCError } from '@trpc/server';
import { eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildRankPredictionCurve,
  calculateExerciseRank,
  calculatePreviewInputSchema,
  calculateTargetWeightForRating,
  LEAGUE_TIERS,
  RANKED_MUSCLE_GROUPS,
  ratingToRank,
  type RankingSex,
} from '@apexlift/shared';
import { exerciseRanks, exercises, rankHistory, users, workoutPosts } from '../db/schema.js';
import {
  getBlockedUserIds,
  isBlockedBetween,
  PUBLIC_USER_SELECT,
  safeJsonParse,
} from '../lib/accessControl.js';
import { protectedProcedure, publicProcedure, router } from '../trpc.js';

export const rankRouter = router({
  listDemoExercises: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(exercises).where(eq(exercises.isRankable, true));
    return rows.slice(0, 12).map((e) => ({
      id: e.id,
      name: e.name,
      equipment: e.equipment,
      primaryMuscles: JSON.parse(e.primaryMusclesJson) as string[],
      maleBaseFactor: e.maleBaseFactor,
      femaleBaseFactor: e.femaleBaseFactor,
      includesBodyweight: e.includesBodyweight,
    }));
  }),

  calculatePreview: publicProcedure
    .input(calculatePreviewInputSchema)
    .mutation(async ({ ctx, input }) => {
      const [ex] = await ctx.db
        .select()
        .from(exercises)
        .where(eq(exercises.id, input.exerciseId))
        .limit(1);

      const standard = ex
        ? {
            maleBaseFactor: ex.maleBaseFactor,
            femaleBaseFactor: ex.femaleBaseFactor,
            includesBodyweight: ex.includesBodyweight,
          }
        : undefined;

      const result = calculateExerciseRank({
        weightKg: input.weightKg,
        reps: input.reps,
        bodyweightKg: input.bodyweightKg,
        sex: input.sex,
        standard,
      });

      const nextTargetWeightKg = calculateTargetWeightForRating({
        targetRating: result.nextThresholdRating,
        reps: input.reps,
        bodyweightKg: input.bodyweightKg,
        sex: input.sex,
        standard,
      });

      return {
        ...result,
        exerciseName: ex?.name ?? 'Selected Lift',
        nextTargetWeightKg,
      };
    }),

  calculateOnboardingPrediction: publicProcedure
    .input(
      z.object({
        currentRating: z.number().min(0).max(2000),
        weeklySessions: z.number().int().min(1).max(7),
      })
    )
    .query(({ input }) => {
      const curve = buildRankPredictionCurve(input.currentRating, input.weeklySessions, 12);
      return {
        points: curve,
        projectedRating: curve[curve.length - 1]?.rating ?? input.currentRating,
        projectedLabel: curve[curve.length - 1]?.label ?? 'Unranked',
      };
    }),

  getMyRanks: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(exerciseRanks)
      .where(eq(exerciseRanks.userId, ctx.user.id));
    const exs = await ctx.db.select().from(exercises);
    const exMap = new Map(exs.map((e) => [e.id, e]));

    return rows
      .map((r) => {
        const ex = exMap.get(r.exerciseId);
        const info = ratingToRank(r.peakRating);
        const nextTarget5RepKg = calculateTargetWeightForRating({
          targetRating: info.nextThresholdRating,
          reps: 5,
          bodyweightKg: ctx.user.bodyweightKg,
          sex: ctx.user.rankingSex as RankingSex,
          standard: ex
            ? {
                maleBaseFactor: ex.maleBaseFactor,
                femaleBaseFactor: ex.femaleBaseFactor,
                includesBodyweight: ex.includesBodyweight,
              }
            : undefined,
        });
        return {
          ...r,
          exerciseName: ex?.name ?? 'Exercise',
          equipment: ex?.equipment ?? 'Barbell',
          primaryMuscles: ex ? (JSON.parse(ex.primaryMusclesJson) as string[]) : [],
          rankLabel: info.label,
          progressToNext: info.progressToNext,
          nextThresholdRating: info.nextThresholdRating,
          nextTarget5RepKg,
        };
      })
      .sort((a, b) => b.peakRating - a.peakRating);
  }),

  getMuscleMap: protectedProcedure
    .input(z.object({ userId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetUserId = input?.userId ?? ctx.user.id;
      if (targetUserId !== ctx.user.id && (await isBlockedBetween(ctx.db, ctx.user.id, targetUserId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      const rows = await ctx.db
        .select()
        .from(exerciseRanks)
        .where(eq(exerciseRanks.userId, targetUserId));
      const exs = await ctx.db.select().from(exercises);
      const exMap = new Map(exs.map((e) => [e.id, e]));

      const muscleTop: Record<
        string,
        {
          muscle: string;
          rating: number;
          tier: string;
          division: number;
          label: string;
          topExerciseName: string | null;
          topExerciseId: string | null;
          exerciseCount: number;
        }
      > = {};

      for (const m of RANKED_MUSCLE_GROUPS) {
        muscleTop[m] = {
          muscle: m,
          rating: 0,
          tier: 'Unranked',
          division: 0,
          label: 'Unranked',
          topExerciseName: null,
          topExerciseId: null,
          exerciseCount: 0,
        };
      }

      for (const r of rows) {
        const ex = exMap.get(r.exerciseId);
        if (!ex) continue;
        const primaries = JSON.parse(ex.primaryMusclesJson) as string[];
        for (const m of primaries) {
          const entry = muscleTop[m];
          if (!entry) continue;
          entry.exerciseCount += 1;
          if (r.peakRating > entry.rating) {
            const info = ratingToRank(r.peakRating);
            entry.rating = r.peakRating;
            entry.tier = info.tier;
            entry.division = info.division;
            entry.label = info.label;
            entry.topExerciseName = ex.name;
            entry.topExerciseId = ex.id;
          }
        }
      }

      const rankedList = Object.values(muscleTop);
      const activeMuscles = rankedList.filter((m) => m.rating > 0);
      const avgRating =
        activeMuscles.length > 0
          ? Math.round(activeMuscles.reduce((s, m) => s + m.rating, 0) / activeMuscles.length)
          : 0;

      return {
        muscles: muscleTop,
        rankedMuscleCount: activeMuscles.length,
        totalMuscleGroups: RANKED_MUSCLE_GROUPS.length,
        overallAverageRating: avgRating,
        overallRank: ratingToRank(avgRating),
      };
    }),

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(rankHistory)
      .where(eq(rankHistory.userId, ctx.user.id));
    return rows.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  }),

  getMyLeague: protectedProcedure.query(async ({ ctx }) => {
    const blockedSet = await getBlockedUserIds(ctx.db, ctx.user.id);
    const allUsers = await ctx.db.select(PUBLIC_USER_SELECT).from(users);
    const weekAgoIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const recentPosts = await ctx.db
      .select({ userId: workoutPosts.userId, xpEarned: workoutPosts.xpEarned })
      .from(workoutPosts)
      .where(gte(workoutPosts.completedAt, weekAgoIso));

    const weeklyXpByUser = new Map<string, number>();
    for (const p of recentPosts) {
      weeklyXpByUser.set(p.userId, (weeklyXpByUser.get(p.userId) ?? 0) + p.xpEarned);
    }

    const tierIdx = Math.min(
      LEAGUE_TIERS.length - 1,
      Math.max(0, Math.floor(ctx.user.peakAverageRating / 100))
    );
    const league = LEAGUE_TIERS[tierIdx];

    const ranked = allUsers
      .filter((u) => !blockedSet.has(u.id))
      .map((u) => ({
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarConfig: safeJsonParse<Record<string, unknown>>(u.avatarConfigJson, {}),
        weeklyXp: weeklyXpByUser.get(u.id) ?? 0,
        peakAverageRank: u.peakAverageRank,
        isSelf: u.id === ctx.user.id,
      }))
      .sort((a, b) => b.weeklyXp - a.weeklyXp || (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0))
      .slice(0, 50);

    const promoteCount = Math.max(1, Math.round(ranked.length * league.promotePct));
    const demoteCount = league.demotePct > 0 ? Math.max(1, Math.round(ranked.length * league.demotePct)) : 0;

    return {
      league,
      promoteCount,
      demoteCount,
      standings: ranked.map((row, idx) => ({
        ...row,
        position: idx + 1,
        zone:
          idx < promoteCount
            ? ('promote' as const)
            : idx >= ranked.length - demoteCount
              ? ('demote' as const)
              : ('safe' as const),
      })),
    };
  }),
});
