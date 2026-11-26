import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { shopItems, userInventory, users } from '../db/schema.js';
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
          and(
            eq(userInventory.userId, ctx.user.id),
            eq(userInventory.itemId, item.id)
          )
        )
        .limit(1);
      if (existing) return { ok: true, remainingCredits: ctx.user.credits };

      if (ctx.user.credits < item.costCredits) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not enough Credits' });
      }

      const now = new Date().toISOString();
      const remainingCredits = ctx.user.credits - item.costCredits;
      await ctx.db
        .update(users)
        .set({ credits: remainingCredits, updatedAt: now })
        .where(eq(users.id, ctx.user.id));

      await ctx.db.insert(userInventory).values({
        id: generateId('inv'),
        userId: ctx.user.id,
        itemId: item.id,
        purchasedAt: now,
      });

      return { ok: true, remainingCredits };
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
      if (input.category === 'title' && typeof input.value === 'string') {
        await ctx.db
          .update(users)
          .set({ equippedTitleId: input.value, updatedAt: now })
          .where(eq(users.id, ctx.user.id));
      } else if (input.category === 'border' && typeof input.value === 'string') {
        await ctx.db
          .update(users)
          .set({ equippedBorderId: input.value, updatedAt: now })
          .where(eq(users.id, ctx.user.id));
      } else if (input.category === 'banner' && typeof input.value === 'string') {
        await ctx.db
          .update(users)
          .set({ equippedBannerId: input.value, updatedAt: now })
          .where(eq(users.id, ctx.user.id));
      } else if (input.category === 'medals' && Array.isArray(input.value)) {
        await ctx.db
          .update(users)
          .set({ equippedMedalIdsJson: JSON.stringify(input.value.slice(0, 3)), updatedAt: now })
          .where(eq(users.id, ctx.user.id));
      }
      return { ok: true };
    }),
});
