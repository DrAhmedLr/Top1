import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildTop1WorkoutEventFromPost,
  calculateExerciseRank,
  detectTop1BenchmarkFromSets,
  ratingToRank,
  type RankingSex,
} from '@apexlift/shared';
import {
  blockedUsers,
  exerciseRanks,
  exercises,
  friendships,
  goals,
  metricObservations,
  postComments,
  postReactions,
  rankHistory,
  trainingLedgerEvents,
  userQuests,
  quests,
  users,
  workoutExerciseLogs,
  workoutPosts,
  workoutSets,
} from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import {
  nextLedgerSequence,
  nextObservationSequence,
  syncUserTop1Standings,
} from '../lib/top1Context.js';
import { protectedProcedure, router } from '../trpc.js';

const setInputSchema = z.object({
  setType: z.enum(['normal', 'warmup', 'drop', 'failure']).default('normal'),
  weightKg: z.number().min(0),
  reps: z.number().int().min(0),
  rpe: z.number().min(5).max(10).nullable().optional(),
  rir: z.number().int().min(0).max(10).nullable().optional(),
  isCompleted: z.boolean().default(true),
});

const exerciseLogInputSchema = z.object({
  exerciseId: z.string(),
  supersetGroup: z.string().nullable().optional(),
  notes: z.string().default(''),
  sets: z.array(setInputSchema).min(1),
});

export const postRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(80),
        caption: z.string().max(120).default(''),
        notes: z.string().max(400).default(''),
        presetId: z.string().nullable().optional(),
        durationSeconds: z.number().int().min(0).default(1800),
        visibility: z.enum(['public', 'friends', 'private']).default('public'),
        startedAt: z.string().optional(),
        exercises: z.array(exerciseLogInputSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const postId = generateId('pst');
      const sex = ctx.user.rankingSex as RankingSex;
      const bwKg = ctx.user.bodyweightKg;

      // Load exercise metadata + existing user peak ranks
      const allExs = await ctx.db.select().from(exercises);
      const exMap = new Map(allExs.map((e) => [e.id, e]));
      const existingRanks = await ctx.db
        .select()
        .from(exerciseRanks)
        .where(eq(exerciseRanks.userId, ctx.user.id));
      const rankMap = new Map(existingRanks.map((r) => [r.exerciseId, r]));

      let totalVolumeKg = 0;
      let totalCompletedSets = 0;
      const muscleHeatmap: Record<string, number> = {};
      const rankUps: Array<{
        exerciseId: string;
        exerciseName: string;
        oldLabel: string;
        newLabel: string;
        newTier: string;
        newDivision: number;
        newRating: number;
      }> = [];
      let prCount = 0;

      const preparedLogs: Array<{
        logId: string;
        input: z.infer<typeof exerciseLogInputSchema>;
        sortOrder: number;
        bestE1rmKg: number;
        bestRating: number;
        bestRankTier: string;
        bestRankDivision: number;
        prFlags: boolean[];
      }> = [];

      for (let i = 0; i < input.exercises.length; i++) {
        const exIn = input.exercises[i];
        const exMeta = exMap.get(exIn.exerciseId);
        const prevRank = rankMap.get(exIn.exerciseId);
        let bestE1rm = 0;
        let bestRating = 0;
        let bestTier = 'Unranked';
        let bestDiv = 0;
        const prFlags: boolean[] = [];

        for (const s of exIn.sets) {
          let isPr = false;
          if (s.isCompleted) {
            totalCompletedSets += 1;
            totalVolumeKg += s.weightKg * s.reps;

            if (s.setType !== 'warmup' && s.reps > 0) {
              const res = calculateExerciseRank({
                weightKg: s.weightKg,
                reps: s.reps,
                bodyweightKg: bwKg,
                sex,
                standard: exMeta
                  ? {
                      maleBaseFactor: exMeta.maleBaseFactor,
                      femaleBaseFactor: exMeta.femaleBaseFactor,
                      includesBodyweight: exMeta.includesBodyweight,
                    }
                  : undefined,
              });
              if (res.rating > bestRating) {
                bestRating = res.rating;
                bestE1rm = res.estimatedOneRmKg;
                bestTier = res.tier;
                bestDiv = res.division;
              }
              if (res.estimatedOneRmKg > (prevRank?.peakE1rmKg ?? 0) && res.estimatedOneRmKg > 0) {
                isPr = true;
              }
            }
          }
          prFlags.push(isPr);
        }

        if (prFlags.some(Boolean)) prCount += 1;

        if (exMeta) {
          const primaries = JSON.parse(exMeta.primaryMusclesJson) as string[];
          for (const m of primaries) {
            muscleHeatmap[m] = Math.max(muscleHeatmap[m] ?? 0, bestRating || 200);
          }
        }

        // Upsert peak exercise rank if improved
        if (bestRating > (prevRank?.peakRating ?? 0)) {
          const oldLabel = prevRank
            ? ratingToRank(prevRank.peakRating).label
            : 'Unranked';
          const newLabel = ratingToRank(bestRating).label;
          if (newLabel !== oldLabel) {
            rankUps.push({
              exerciseId: exIn.exerciseId,
              exerciseName: exMeta?.name ?? 'Exercise',
              oldLabel,
              newLabel,
              newTier: bestTier,
              newDivision: bestDiv,
              newRating: bestRating,
            });
          }

          if (prevRank) {
            await ctx.db
              .update(exerciseRanks)
              .set({
                peakE1rmKg: bestE1rm,
                peakRating: bestRating,
                rankTier: bestTier,
                rankDivision: bestDiv,
                postId,
                achievedAt: now,
                updatedAt: now,
              })
              .where(eq(exerciseRanks.id, prevRank.id));
          } else {
            await ctx.db.insert(exerciseRanks).values({
              id: generateId('rnk'),
              userId: ctx.user.id,
              exerciseId: exIn.exerciseId,
              peakE1rmKg: bestE1rm,
              peakRating: bestRating,
              rankTier: bestTier,
              rankDivision: bestDiv,
              postId,
              achievedAt: now,
              updatedAt: now,
            });
          }
        }

        preparedLogs.push({
          logId: generateId('wel'),
          input: exIn,
          sortOrder: i,
          bestE1rmKg: bestE1rm,
          bestRating,
          bestRankTier: bestTier,
          bestRankDivision: bestDiv,
          prFlags,
        });
      }

      const xpEarned = 120 + totalCompletedSets * 10 + prCount * 40 + rankUps.length * 60;
      const creditsEarned = 35 + prCount * 15 + rankUps.length * 25;

      await ctx.db.insert(workoutPosts).values({
        id: postId,
        userId: ctx.user.id,
        presetId: input.presetId ?? null,
        title: input.title,
        caption: input.caption,
        notes: input.notes,
        durationSeconds: input.durationSeconds,
        totalVolumeKg: Number(totalVolumeKg.toFixed(1)),
        totalSets: totalCompletedSets,
        visibility: input.visibility,
        mediaUrlsJson: '[]',
        muscleHeatmapJson: JSON.stringify(muscleHeatmap),
        xpEarned,
        startedAt: input.startedAt ?? now,
        completedAt: now,
        createdAt: now,
      });

      for (const pl of preparedLogs) {
        await ctx.db.insert(workoutExerciseLogs).values({
          id: pl.logId,
          postId,
          exerciseId: pl.input.exerciseId,
          sortOrder: pl.sortOrder,
          supersetGroup: pl.input.supersetGroup ?? null,
          notes: pl.input.notes,
          bestE1rmKg: pl.bestE1rmKg,
          bestRating: pl.bestRating,
          bestRankTier: pl.bestRankTier,
          bestRankDivision: pl.bestRankDivision,
        });

        for (let si = 0; si < pl.input.sets.length; si++) {
          const s = pl.input.sets[si];
          await ctx.db.insert(workoutSets).values({
            id: generateId('ws'),
            exerciseLogId: pl.logId,
            setIndex: si,
            setType: s.setType,
            weightKg: s.weightKg,
            reps: s.reps,
            rpe: s.rpe ?? null,
            rir: s.rir ?? null,
            isCompleted: s.isCompleted,
            isPr: pl.prFlags[si] ?? false,
          });
        }
      }

      // Recompute user overall peak average rank
      const allUserRanks = await ctx.db
        .select()
        .from(exerciseRanks)
        .where(eq(exerciseRanks.userId, ctx.user.id));

      const avgRating =
        allUserRanks.length > 0
          ? Math.round(
              allUserRanks.reduce((sum, r) => sum + r.peakRating, 0) / allUserRanks.length
            )
          : ctx.user.peakAverageRating;
      const avgRankInfo = ratingToRank(avgRating);

      // Update streak (increment if last workout wasn't today)
      const todayIso = now.slice(0, 10);
      const lastIso = ctx.user.lastWorkoutAt?.slice(0, 10);
      const nextStreak = lastIso === todayIso ? Math.max(1, ctx.user.streaks) : ctx.user.streaks + 1;
      const nextLongest = Math.max(ctx.user.longestStreak, nextStreak);

      await ctx.db
        .update(users)
        .set({
          experiencePoints: ctx.user.experiencePoints + xpEarned,
          credits: ctx.user.credits + creditsEarned,
          streaks: nextStreak,
          longestStreak: nextLongest,
          lastWorkoutAt: now,
          totalWorkouts: ctx.user.totalWorkouts + 1,
          totalVolumeKg: Number((ctx.user.totalVolumeKg + totalVolumeKg).toFixed(1)),
          peakAverageRating: avgRating,
          peakAverageRank: avgRankInfo.label,
          updatedAt: now,
        })
        .where(eq(users.id, ctx.user.id));

      await ctx.db.insert(rankHistory).values({
        id: generateId('rh'),
        userId: ctx.user.id,
        exerciseId: null,
        rating: avgRating,
        rankTier: avgRankInfo.tier,
        rankDivision: avgRankInfo.division,
        recordedAt: now,
      });

      // Advance workout/set quests
      const allQuests = await ctx.db.select().from(quests);
      for (const q of allQuests) {
        if (q.metricKey !== 'workouts' && q.metricKey !== 'sets') continue;
        const delta = q.metricKey === 'workouts' ? 1 : totalCompletedSets;
        const [uq] = await ctx.db
          .select()
          .from(userQuests)
          .where(and(eq(userQuests.userId, ctx.user.id), eq(userQuests.questId, q.id)))
          .limit(1);
        if (uq) {
          await ctx.db
            .update(userQuests)
            .set({ progress: uq.progress + delta, updatedAt: now })
            .where(eq(userQuests.id, uq.id));
        } else {
          await ctx.db.insert(userQuests).values({
            id: generateId('uq'),
            userId: ctx.user.id,
            questId: q.id,
            progress: delta,
            updatedAt: now,
          });
        }
      }

      // Advance matching strength goals
      const userGoals = await ctx.db
        .select()
        .from(goals)
        .where(eq(goals.userId, ctx.user.id));
      for (const g of userGoals) {
        if (g.completedAt) continue;
        if (g.goalType === 'strength' && g.exerciseId) {
          const matching = preparedLogs.find((pl) => pl.input.exerciseId === g.exerciseId);
          if (matching && matching.bestE1rmKg > g.currentValue) {
            await ctx.db
              .update(goals)
              .set({
                currentValue: matching.bestE1rmKg,
                completedAt: matching.bestE1rmKg >= g.targetValue ? now : null,
              })
              .where(eq(goals.id, g.id));
          }
        } else if (g.goalType === 'consistency') {
          const nextVal = g.currentValue + 1;
          await ctx.db
            .update(goals)
            .set({
              currentValue: nextVal,
              completedAt: nextVal >= g.targetValue ? now : null,
            })
            .where(eq(goals.id, g.id));
        }
      }

      // Sync completed workout into TOP1% Training Ledger & auto-detect competitive benchmark observations
      const ledgerSeq = await nextLedgerSequence(ctx.db, ctx.user.id);
      const top1Event = buildTop1WorkoutEventFromPost({
        postId,
        sequence: ledgerSeq,
        title: input.title,
        notes: input.notes,
        timeZone: ctx.user.timeZone || 'UTC',
        startedAt: input.startedAt ?? now,
        completedAt: now,
        exercises: input.exercises.map((exIn) => {
          const meta = exMap.get(exIn.exerciseId);
          return {
            exerciseId: exIn.exerciseId,
            exerciseName: meta?.name ?? 'Exercise',
            equipment: meta?.equipment ?? '',
            notes: exIn.notes,
            sets: exIn.sets,
          };
        }),
      });

      await ctx.db.insert(trainingLedgerEvents).values({
        id: generateId('tle'),
        userId: ctx.user.id,
        entityId: top1Event.id,
        sequence: ledgerSeq,
        revision: 1,
        kind: 'workout',
        source: 'personal',
        deleted: false,
        dataJson: JSON.stringify(top1Event.data),
        recordedAt: now,
      });

      const syncedBenchmarks: Array<{ metricId: string; value: number; unit: string }> = [];
      for (const exIn of input.exercises) {
        const meta = exMap.get(exIn.exerciseId);
        if (!meta) continue;
        const detected = detectTop1BenchmarkFromSets({
          exerciseName: meta.name,
          bodyweightKg: bwKg,
          sets: exIn.sets,
        });
        if (detected) {
          const obsSeq = await nextObservationSequence(ctx.db, ctx.user.id);
          await ctx.db.insert(metricObservations).values({
            id: generateId('obs'),
            userId: ctx.user.id,
            metricId: detected.metricId,
            value: detected.value,
            unit: detected.unit,
            measuredAt: now,
            recordedAt: now,
            sequence: obsSeq,
            method: detected.derivation ? 'epley_estimate' : 'manual',
            derivationJson: detected.derivation ? JSON.stringify(detected.derivation) : null,
            bodyWeightKg: bwKg,
            ageAtMeasurement: ctx.user.age,
            cleared: false,
            source: 'workout_sync',
          });
          syncedBenchmarks.push({
            metricId: detected.metricId,
            value: detected.value,
            unit: detected.unit,
          });
        }
      }

      const [freshUser] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);
      const top1Standing = freshUser
        ? await syncUserTop1Standings(ctx.db, freshUser)
        : null;

      return {
        postId,
        totalVolumeKg: Number(totalVolumeKg.toFixed(1)),
        totalSets: totalCompletedSets,
        xpEarned,
        creditsEarned,
        prCount,
        rankUps,
        newStreak: nextStreak,
        newOverallRating: avgRating,
        newOverallRank: top1Standing?.badge.topLabel ?? avgRankInfo.label,
        top1Impact: top1Standing
          ? {
              overallPercent: top1Standing.overall.overall?.percent ?? null,
              tierLabel: top1Standing.badge.topLabel,
              tierName: top1Standing.badge.tierName,
              scientificModelScore: Number(top1Standing.scientific.modelScore.toFixed(1)),
              syncedBenchmarks,
            }
          : null,
      };
    }),

  feed: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(['all', 'friends', 'mine']).default('all'),
          limit: z.number().int().min(1).max(50).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const scope = input?.scope ?? 'all';
      const limit = input?.limit ?? 20;

      const blockedRows = await ctx.db
        .select()
        .from(blockedUsers)
        .where(eq(blockedUsers.blockerId, ctx.user.id));
      const blockedSet = new Set(blockedRows.map((b) => b.blockedId));

      const friendRows = await ctx.db
        .select()
        .from(friendships)
        .where(eq(friendships.userId, ctx.user.id));
      const friendIds = new Set([ctx.user.id, ...friendRows.map((f) => f.friendId)]);

      const posts = await ctx.db
        .select()
        .from(workoutPosts)
        .orderBy(desc(workoutPosts.completedAt))
        .limit(limit * 2);

      const filtered = posts
        .filter((p) => {
          if (blockedSet.has(p.userId)) return false;
          if (scope === 'mine') return p.userId === ctx.user.id;
          if (scope === 'friends') return friendIds.has(p.userId) && (p.visibility !== 'private' || p.userId === ctx.user.id);
          return p.visibility === 'public' || p.userId === ctx.user.id || (p.visibility === 'friends' && friendIds.has(p.userId));
        })
        .slice(0, limit);

      if (filtered.length === 0) return [];

      const userIds = Array.from(new Set(filtered.map((p) => p.userId)));
      const authorRows = await ctx.db.select().from(users).where(inArray(users.id, userIds));
      const authorMap = new Map(authorRows.map((u) => [u.id, u]));

      const allExs = await ctx.db.select().from(exercises);
      const exMap = new Map(allExs.map((e) => [e.id, e]));

      const results = [];
      for (const p of filtered) {
        const author = authorMap.get(p.userId);
        const logs = await ctx.db
          .select()
          .from(workoutExerciseLogs)
          .where(eq(workoutExerciseLogs.postId, p.id));

        const reactions = await ctx.db
          .select()
          .from(postReactions)
          .where(eq(postReactions.postId, p.id));

        const comments = await ctx.db
          .select()
          .from(postComments)
          .where(eq(postComments.postId, p.id));

        const reactionCounts: Record<string, number> = {};
        let myReaction: string | null = null;
        for (const r of reactions) {
          reactionCounts[r.reactionKey] = (reactionCounts[r.reactionKey] ?? 0) + 1;
          if (r.userId === ctx.user.id) myReaction = r.reactionKey;
        }

        const exercisesSummary = [];
        for (const l of logs.sort((a, b) => a.sortOrder - b.sortOrder)) {
          const sets = await ctx.db
            .select()
            .from(workoutSets)
            .where(eq(workoutSets.exerciseLogId, l.id));
          exercisesSummary.push({
            id: l.id,
            exerciseId: l.exerciseId,
            exerciseName: exMap.get(l.exerciseId)?.name ?? 'Exercise',
            bestE1rmKg: l.bestE1rmKg,
            bestRating: l.bestRating,
            bestRankTier: l.bestRankTier,
            bestRankDivision: l.bestRankDivision,
            sets: sets.sort((a, b) => a.setIndex - b.setIndex),
          });
        }

        results.push({
          ...p,
          muscleHeatmap: JSON.parse(p.muscleHeatmapJson || '{}') as Record<string, number>,
          author: author
            ? {
                id: author.id,
                username: author.username,
                displayName: author.displayName,
                avatarConfig: JSON.parse(author.avatarConfigJson || '{}'),
                peakAverageRank: author.peakAverageRank,
                peakAverageRating: author.peakAverageRating,
                equippedTitleId: author.equippedTitleId,
                equippedBorderId: author.equippedBorderId,
              }
            : null,
          exercises: exercisesSummary,
          reactionCounts,
          totalReactions: reactions.length,
          myReaction,
          commentCount: comments.length,
        });
      }

      return results;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [p] = await ctx.db
        .select()
        .from(workoutPosts)
        .where(eq(workoutPosts.id, input.id))
        .limit(1);
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workout post not found' });

      const [author] = await ctx.db.select().from(users).where(eq(users.id, p.userId)).limit(1);
      const logs = await ctx.db
        .select()
        .from(workoutExerciseLogs)
        .where(eq(workoutExerciseLogs.postId, p.id));
      const allExs = await ctx.db.select().from(exercises);
      const exMap = new Map(allExs.map((e) => [e.id, e]));

      const exercisesDetail = [];
      for (const l of logs.sort((a, b) => a.sortOrder - b.sortOrder)) {
        const sets = await ctx.db
          .select()
          .from(workoutSets)
          .where(eq(workoutSets.exerciseLogId, l.id));
        exercisesDetail.push({
          ...l,
          exerciseName: exMap.get(l.exerciseId)?.name ?? 'Exercise',
          sets: sets.sort((a, b) => a.setIndex - b.setIndex),
        });
      }

      return {
        ...p,
        muscleHeatmap: JSON.parse(p.muscleHeatmapJson || '{}') as Record<string, number>,
        author: author
          ? {
              id: author.id,
              username: author.username,
              displayName: author.displayName,
              avatarConfig: JSON.parse(author.avatarConfigJson || '{}'),
              peakAverageRank: author.peakAverageRank,
            }
          : null,
        exercises: exercisesDetail,
      };
    }),

  editPost: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().trim().min(1).max(80).optional(),
        caption: z.string().max(120).optional(),
        visibility: z.enum(['public', 'friends', 'private']).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(workoutPosts)
        .where(and(eq(workoutPosts.id, input.id), eq(workoutPosts.userId, ctx.user.id)))
        .limit(1);
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' });

      await ctx.db
        .update(workoutPosts)
        .set({
          title: input.title ?? existing.title,
          caption: input.caption ?? existing.caption,
          visibility: input.visibility ?? existing.visibility,
        })
        .where(eq(workoutPosts.id, input.id));
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(workoutPosts)
        .where(and(eq(workoutPosts.id, input.id), eq(workoutPosts.userId, ctx.user.id)));
      return { ok: true };
    }),
});
