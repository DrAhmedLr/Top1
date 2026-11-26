import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { notifications, postComments, postReactions, users, workoutPosts } from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { protectedProcedure, router } from '../trpc.js';

export const postInteractionsRouter = router({
  upsertReaction: protectedProcedure
    .input(z.object({ postId: z.string(), reactionKey: z.string().min(1).max(24) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const [existing] = await ctx.db
        .select()
        .from(postReactions)
        .where(
          and(
            eq(postReactions.postId, input.postId),
            eq(postReactions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existing) {
        if (existing.reactionKey === input.reactionKey) {
          await ctx.db.delete(postReactions).where(eq(postReactions.id, existing.id));
          return { activeReaction: null };
        }
        await ctx.db
          .update(postReactions)
          .set({ reactionKey: input.reactionKey })
          .where(eq(postReactions.id, existing.id));
        return { activeReaction: input.reactionKey };
      }

      await ctx.db.insert(postReactions).values({
        id: generateId('rxn'),
        postId: input.postId,
        userId: ctx.user.id,
        reactionKey: input.reactionKey,
        createdAt: now,
      });

      const [post] = await ctx.db
        .select({ userId: workoutPosts.userId, title: workoutPosts.title })
        .from(workoutPosts)
        .where(eq(workoutPosts.id, input.postId))
        .limit(1);
      if (post && post.userId !== ctx.user.id) {
        await ctx.db.insert(notifications).values({
          id: generateId('ntf'),
          userId: post.userId,
          actorId: ctx.user.id,
          type: 'reaction',
          title: `${ctx.user.displayName} reacted ${input.reactionKey}`,
          body: `On "${post.title}"`,
          createdAt: now,
        });
      }

      return { activeReaction: input.reactionKey };
    }),

  listComments: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(postComments)
        .where(eq(postComments.postId, input.postId))
        .orderBy(asc(postComments.createdAt));

      const allUsers = await ctx.db.select().from(users);
      const uMap = new Map(allUsers.map((u) => [u.id, u]));

      return rows.map((c) => {
        const author = uMap.get(c.userId);
        return {
          ...c,
          authorName: author?.displayName ?? 'Lifter',
          authorUsername: author?.username ?? 'lifter',
          authorAvatar: author ? JSON.parse(author.avatarConfigJson || '{}') : {},
        };
      });
    }),

  commentPost: protectedProcedure
    .input(
      z.object({
        postId: z.string(),
        body: z.string().trim().min(1).max(300),
        parentCommentId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateId('cmt');
      const now = new Date().toISOString();
      await ctx.db.insert(postComments).values({
        id,
        postId: input.postId,
        userId: ctx.user.id,
        parentCommentId: input.parentCommentId ?? null,
        body: input.body,
        likesCount: 0,
        createdAt: now,
      });

      const [post] = await ctx.db
        .select({ userId: workoutPosts.userId, title: workoutPosts.title })
        .from(workoutPosts)
        .where(eq(workoutPosts.id, input.postId))
        .limit(1);
      if (post && post.userId !== ctx.user.id) {
        await ctx.db.insert(notifications).values({
          id: generateId('ntf'),
          userId: post.userId,
          actorId: ctx.user.id,
          type: 'comment',
          title: `${ctx.user.displayName} commented`,
          body: input.body.slice(0, 80),
          createdAt: now,
        });
      }

      return { id };
    }),

  likeComment: protectedProcedure
    .input(z.object({ commentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await ctx.db
        .select()
        .from(postComments)
        .where(eq(postComments.id, input.commentId))
        .limit(1);
      if (!c) return { likesCount: 0 };
      const next = c.likesCount + 1;
      await ctx.db
        .update(postComments)
        .set({ likesCount: next })
        .where(eq(postComments.id, c.id));
      return { likesCount: next };
    }),
});
