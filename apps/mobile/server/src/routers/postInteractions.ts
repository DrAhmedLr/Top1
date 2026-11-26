import { TRPCError } from '@trpc/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  commentLikes,
  notifications,
  postComments,
  postReactions,
  users,
  workoutPosts,
} from '../db/schema.js';
import { assertCanViewPost, PUBLIC_USER_SELECT, safeJsonParse } from '../lib/accessControl.js';
import { generateId } from '../lib/auth.js';
import { protectedProcedure, router } from '../trpc.js';

export const postInteractionsRouter = router({
  upsertReaction: protectedProcedure
    .input(z.object({ postId: z.string(), reactionKey: z.string().min(1).max(24) }))
    .mutation(async ({ ctx, input }) => {
      const [post] = await ctx.db
        .select({
          id: workoutPosts.id,
          userId: workoutPosts.userId,
          title: workoutPosts.title,
          visibility: workoutPosts.visibility,
        })
        .from(workoutPosts)
        .where(eq(workoutPosts.id, input.postId))
        .limit(1);
      if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workout post not found' });
      await assertCanViewPost(ctx.db, ctx.user.id, post);

      const now = new Date().toISOString();
      const [existing] = await ctx.db
        .select()
        .from(postReactions)
        .where(
          and(eq(postReactions.postId, input.postId), eq(postReactions.userId, ctx.user.id))
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

      if (post.userId !== ctx.user.id) {
        await ctx.db.insert(notifications).values({
          id: generateId('ntf'),
          userId: post.userId,
          actorId: ctx.user.id,
          type: 'reaction',
          title: `${ctx.user.displayName} reacted ${input.reactionKey}`,
          body: `On "${post.title}"`,
          payloadJson: JSON.stringify({ postId: post.id }),
          createdAt: now,
        });
      }

      return { activeReaction: input.reactionKey };
    }),

  listComments: protectedProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [post] = await ctx.db
        .select({ id: workoutPosts.id, userId: workoutPosts.userId, visibility: workoutPosts.visibility })
        .from(workoutPosts)
        .where(eq(workoutPosts.id, input.postId))
        .limit(1);
      if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workout post not found' });
      await assertCanViewPost(ctx.db, ctx.user.id, post);

      const rows = await ctx.db
        .select()
        .from(postComments)
        .where(eq(postComments.postId, input.postId))
        .orderBy(asc(postComments.createdAt));

      const authorIds = Array.from(new Set(rows.map((r) => r.userId)));
      const authorRows = authorIds.length
        ? await ctx.db.select(PUBLIC_USER_SELECT).from(users).where(inArray(users.id, authorIds))
        : [];
      const uMap = new Map(authorRows.map((u) => [u.id, u]));

      return rows.map((c) => {
        const author = uMap.get(c.userId);
        return {
          ...c,
          authorName: author?.displayName ?? 'Athlete',
          authorUsername: author?.username ?? 'athlete',
          authorAvatar: author ? safeJsonParse<Record<string, unknown>>(author.avatarConfigJson, {}) : {},
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
      const [post] = await ctx.db
        .select({
          id: workoutPosts.id,
          userId: workoutPosts.userId,
          title: workoutPosts.title,
          visibility: workoutPosts.visibility,
        })
        .from(workoutPosts)
        .where(eq(workoutPosts.id, input.postId))
        .limit(1);
      if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workout post not found' });
      await assertCanViewPost(ctx.db, ctx.user.id, post);

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

      if (post.userId !== ctx.user.id) {
        await ctx.db.insert(notifications).values({
          id: generateId('ntf'),
          userId: post.userId,
          actorId: ctx.user.id,
          type: 'comment',
          title: `${ctx.user.displayName} commented`,
          body: input.body.slice(0, 80),
          payloadJson: JSON.stringify({ postId: post.id }),
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
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment not found' });

      const [post] = await ctx.db
        .select({ userId: workoutPosts.userId, visibility: workoutPosts.visibility })
        .from(workoutPosts)
        .where(eq(workoutPosts.id, c.postId))
        .limit(1);
      if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workout post not found' });
      await assertCanViewPost(ctx.db, ctx.user.id, post);

      const [existingLike] = await ctx.db
        .select()
        .from(commentLikes)
        .where(
          and(eq(commentLikes.commentId, c.id), eq(commentLikes.userId, ctx.user.id))
        )
        .limit(1);

      let next: number;
      if (existingLike) {
        await ctx.db.delete(commentLikes).where(eq(commentLikes.id, existingLike.id));
        next = Math.max(0, c.likesCount - 1);
      } else {
        await ctx.db.insert(commentLikes).values({
          id: generateId('clk'),
          commentId: c.id,
          userId: ctx.user.id,
          createdAt: new Date().toISOString(),
        });
        next = c.likesCount + 1;
      }

      await ctx.db
        .update(postComments)
        .set({ likesCount: next })
        .where(eq(postComments.id, c.id));
      return { likesCount: next, liked: !existingLike };
    }),
});
