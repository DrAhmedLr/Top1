import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { notificationSettings, notifications } from '../db/schema.js';
import { protectedProcedure, router } from '../trpc.js';

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, ctx.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(40);
    const unreadCount = rows.filter((r) => !r.readAt).length;
    return { notifications: rows, unreadCount };
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(notifications)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));
    return { ok: true };
  }),

  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, ctx.user.id))
      .limit(1);
    if (!row) {
      return {
        reminder: true,
        progress: true,
        feed: true,
        comments: true,
        reactions: true,
        friends: true,
        slacking: true,
        presetDownload: true,
        rankChallenge: true,
        announcement: true,
        reminderWeekdays: [1, 3, 5],
        reminderTime: '18:00',
      };
    }
    return {
      reminder: row.reminder,
      progress: row.progress,
      feed: row.feed,
      comments: row.comments,
      reactions: row.reactions,
      friends: row.friends,
      slacking: row.slacking,
      presetDownload: row.presetDownload,
      rankChallenge: row.rankChallenge,
      announcement: row.announcement,
      reminderWeekdays: JSON.parse(row.reminderWeekdaysJson || '[1,3,5]') as number[],
      reminderTime: row.reminderTime,
    };
  }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        reminder: z.boolean().optional(),
        progress: z.boolean().optional(),
        feed: z.boolean().optional(),
        comments: z.boolean().optional(),
        reactions: z.boolean().optional(),
        friends: z.boolean().optional(),
        slacking: z.boolean().optional(),
        presetDownload: z.boolean().optional(),
        rankChallenge: z.boolean().optional(),
        announcement: z.boolean().optional(),
        reminderWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
        reminderTime: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const updates: Partial<typeof notificationSettings.$inferInsert> = {
        updatedAt: now,
      };
      if (input.reminder !== undefined) updates.reminder = input.reminder;
      if (input.progress !== undefined) updates.progress = input.progress;
      if (input.feed !== undefined) updates.feed = input.feed;
      if (input.comments !== undefined) updates.comments = input.comments;
      if (input.reactions !== undefined) updates.reactions = input.reactions;
      if (input.friends !== undefined) updates.friends = input.friends;
      if (input.slacking !== undefined) updates.slacking = input.slacking;
      if (input.presetDownload !== undefined) updates.presetDownload = input.presetDownload;
      if (input.rankChallenge !== undefined) updates.rankChallenge = input.rankChallenge;
      if (input.announcement !== undefined) updates.announcement = input.announcement;
      if (input.reminderWeekdays !== undefined) {
        updates.reminderWeekdaysJson = JSON.stringify(input.reminderWeekdays);
      }
      if (input.reminderTime !== undefined) updates.reminderTime = input.reminderTime;

      await ctx.db
        .update(notificationSettings)
        .set(updates)
        .where(eq(notificationSettings.userId, ctx.user.id));
      return { ok: true };
    }),
});
