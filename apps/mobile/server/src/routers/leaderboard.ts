import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ratingToRank, topPercentToBadge, topPercentToRating, xpToLevel } from '@apexlift/shared';
import { exerciseRanks, friendships, users } from '../db/schema.js';
import { getBlockedUserIds, PUBLIC_USER_SELECT, safeJsonParse } from '../lib/accessControl.js';
import { protectedProcedure, router } from '../trpc.js';

export const leaderboardRouter = router({
  getBoard: protectedProcedure
    .input(
      z.object({
        category: z.enum(['ranks', 'streaks', 'levels', 'exercise']).default('ranks'),
        scope: z.enum(['global', 'friends']).default('global'),
        exerciseId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const blockedSet = await getBlockedUserIds(ctx.db, ctx.user.id);
      const allUsers = (await ctx.db.select(PUBLIC_USER_SELECT).from(users)).filter(
        (u) => !blockedSet.has(u.id)
      );
      let pool = allUsers;

      if (input.scope === 'friends') {
        const fRows = await ctx.db
          .select()
          .from(friendships)
          .where(eq(friendships.userId, ctx.user.id));
        const allowed = new Set([ctx.user.id, ...fRows.map((f) => f.friendId)]);
        pool = allUsers.filter((u) => allowed.has(u.id));
      }

      let exRankMap = new Map<string, number>();
      if (input.category === 'exercise' && input.exerciseId) {
        const eRows = await ctx.db
          .select()
          .from(exerciseRanks)
          .where(eq(exerciseRanks.exerciseId, input.exerciseId));
        exRankMap = new Map(eRows.map((r) => [r.userId, r.peakRating]));
      }

      const rows = pool
        .map((u) => {
          const top1Score =
            u.overallTopPercent != null
              ? topPercentToRating(u.overallTopPercent)
              : u.peakAverageRating;

          const score =
            input.category === 'streaks'
              ? u.streaks
              : input.category === 'levels'
                ? u.experiencePoints
                : input.category === 'exercise'
                  ? (exRankMap.get(u.id) ?? 0)
                  : top1Score;

          const topBadge = topPercentToBadge(u.overallTopPercent);
          const scoreLabel =
            input.category === 'streaks'
              ? `${u.streaks}d`
              : input.category === 'levels'
                ? `Lv ${xpToLevel(u.experiencePoints).level}`
                : input.category === 'ranks' && u.overallTopPercent != null
                  ? `Top ${u.overallTopPercent < 1 ? u.overallTopPercent.toFixed(2) : u.overallTopPercent.toFixed(1)}%`
                  : `${score} SR`;

          const rankInfo = ratingToRank(
            input.category === 'exercise' ? score : u.peakAverageRating
          );

          return {
            userId: u.id,
            username: u.username,
            displayName: u.displayName,
            avatarConfig: safeJsonParse<Record<string, unknown>>(u.avatarConfigJson, {}),
            score,
            scoreLabel,
            rankTier:
              input.category === 'ranks' && u.overallTopPercent != null
                ? topBadge.badgeTier
                : rankInfo.tier,
            rankDivision:
              input.category === 'ranks' && u.overallTopPercent != null
                ? topBadge.division
                : rankInfo.division,
            rankLabel:
              input.category === 'ranks' && u.overallTopPercent != null
                ? `${topBadge.tierName} • ${topBadge.topLabel}`
                : rankInfo.label,
            overallTopPercent: u.overallTopPercent ?? null,
            isSelf: u.id === ctx.user.id,
          };
        })
        .sort((a, b) => b.score - a.score)
        .map((r, idx) => ({ ...r, position: idx + 1 }));

      const selfRow = rows.find((r) => r.isSelf) ?? null;
      return { rows: rows.slice(0, 50), selfRow };
    }),
});
