import { TRPCError } from '@trpc/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { medals, shopItems, userInventory, userMedals, users } from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { protectedProcedure, router } from '../trpc.js';

export const shopRouter = router({
  listCatalog: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db.select().from(shopItems);
    const inv = await ctx.db
      .select()
      .from(userInventory)
      .where(eq(userInventory.userId, ctx.user.id));
    const ownedSet = new Set(inv.map((i) => i.itemId));

    return {
      credits: ctx.user.credits,
      items: items.map((item) => ({
        ...item,
        owned: ownedSet.has(item.id),
      })),
    };
  }),

  purchase: protectedProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select()
        .from(shopItems)
        .where(eq(shopItems.id, input.itemId))
        .limit(1);
      if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Item not found' });

      const [existing] = await ctx.db
        .select()
        .from(userInventory)
        .where(
          and(eq(userInventory.userId, ctx.user.id), eq(userInventory.itemId, item.id))
        )
        .limit(1);
      if (existing) return { ok: true, remainingCredits: ctx.user.credits };

      const now = new Date().toISOString();
      // Atomic conditional debit prevents concurrent double-spend below zero
      const updatedRows = await ctx.db
        .update(users)
        .set({
          credits: sql`${users.credits} - ${item.costCredits}`,
          updatedAt: now,
        })
        .where(and(eq(users.id, ctx.user.id), gte(users.credits, item.costCredits)))
        .returning({ credits: users.credits });

      if (updatedRows.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not enough Credits' });
      }

      await ctx.db.insert(userInventory).values({
        id: generateId('inv'),
        userId: ctx.user.id,
        itemId: item.id,
        purchasedAt: now,
      });

      return { ok: true, remainingCredits: updatedRows[0].credits };
    }),

  equip: protectedProcedure
    .input(
      z.object({
        category: z.enum(['title', 'border', 'banner', 'medals']),
        value: z.union([z.string(), z.array(z.string())]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();

      if (input.category === 'medals') {
        if (!Array.isArray(input.value)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Medals must be an array' });
        }
        const requested = input.value.slice(0, 3);
        const nonEmpty = requested.filter((id) => id.trim().length > 0);
        if (nonEmpty.length > 0) {
          const allM = await ctx.db.select().from(medals);
          const umRows = await ctx.db
            .select()
            .from(userMedals)
            .where(eq(userMedals.userId, ctx.user.id));
          const umMap = new Map(umRows.map((u) => [u.medalId, u]));
          const unlockedSet = new Set<string>();
          for (const m of allM) {
            const um = umMap.get(m.id);
            let liveProgress = um?.progress ?? 0;
            if (m.metricKey === 'workouts') liveProgress = Math.max(liveProgress, ctx.user.totalWorkouts);
            if (m.metricKey === 'streak') liveProgress = Math.max(liveProgress, ctx.user.longestStreak);
            if (m.metricKey === 'rating') liveProgress = Math.max(liveProgress, ctx.user.peakAverageRating);
            if (liveProgress >= m.targetValue || Boolean(um?.unlockedAt)) {
              unlockedSet.add(m.id);
            }
          }
          for (const id of nonEmpty) {
            if (!unlockedSet.has(id)) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'Medal not unlocked yet' });
            }
          }
        }
        await ctx.db
          .update(users)
          .set({ equippedMedalIdsJson: JSON.stringify(requested), updatedAt: now })
          .where(eq(users.id, ctx.user.id));
        return { ok: true };
      }

      if (typeof input.value !== 'string') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid cosmetic value' });
      }

      // Empty string unequips cleanly; non-empty values must match an owned shop item in this category
      if (input.value !== '') {
        const owned = await ctx.db
          .select({
            itemId: shopItems.id,
            category: shopItems.category,
            previewValue: shopItems.previewValue,
          })
          .from(userInventory)
          .innerJoin(shopItems, eq(userInventory.itemId, shopItems.id))
          .where(and(eq(userInventory.userId, ctx.user.id), eq(shopItems.category, input.category)));

        const ownsValue = owned.some(
          (row) => row.itemId === input.value || row.previewValue === input.value
        );
        if (!ownsValue) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You must unlock or purchase this item before equipping it.',
          });
        }
      }

      if (input.category === 'title') {
        await ctx.db
          .update(users)
          .set({ equippedTitleId: input.value, updatedAt: now })
          .where(eq(users.id, ctx.user.id));
      } else if (input.category === 'border') {
        await ctx.db
          .update(users)
          .set({ equippedBorderId: input.value, updatedAt: now })
          .where(eq(users.id, ctx.user.id));
      } else if (input.category === 'banner') {
        await ctx.db
          .update(users)
          .set({ equippedBannerId: input.value, updatedAt: now })
          .where(eq(users.id, ctx.user.id));
      }
      return { ok: true };
    }),
});
