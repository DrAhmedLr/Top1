import { TRPCError } from '@trpc/server';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  blockedUsers,
  friendRequests,
  friendships,
  notifications,
  users,
} from '../db/schema.js';
import { generateId } from '../lib/auth.js';
import { protectedProcedure, router } from '../trpc.js';

function publicUserCard(u: typeof users.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    avatarConfig: JSON.parse(u.avatarConfigJson || '{}'),
    peakAverageRank: u.peakAverageRank,
    peakAverageRating: u.peakAverageRating,
    streaks: u.streaks,
    totalWorkouts: u.totalWorkouts,
    experiencePoints: u.experiencePoints,
    lastWorkoutAt: u.lastWorkoutAt,
    equippedTitleId: u.equippedTitleId,
    equippedBorderId: u.equippedBorderId,
    equippedBannerId: u.equippedBannerId,
  };
}

export const friendsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const fRows = await ctx.db
      .select()
      .from(friendships)
      .where(eq(friendships.userId, ctx.user.id));
    const friendSet = new Set(fRows.map((f) => f.friendId));
    const allU = await ctx.db.select().from(users);

    return allU
      .filter((u) => friendSet.has(u.id))
      .map((u) => ({
        ...publicUserCard(u),
        isSlacking:
          !u.lastWorkoutAt ||
          Date.now() - new Date(u.lastWorkoutAt).getTime() > 72 * 3600 * 1000,
      }));
  }),

  listRequests: protectedProcedure.query(async ({ ctx }) => {
    const reqs = await ctx.db
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.status, 'pending'),
          or(
            eq(friendRequests.receiverId, ctx.user.id),
            eq(friendRequests.senderId, ctx.user.id)
          )
        )
      );
    const allU = await ctx.db.select().from(users);
    const uMap = new Map(allU.map((u) => [u.id, u]));

    return {
      incoming: reqs
        .filter((r) => r.receiverId === ctx.user.id)
        .map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          user: uMap.get(r.senderId) ? publicUserCard(uMap.get(r.senderId)!) : null,
        })),
      outgoing: reqs
        .filter((r) => r.senderId === ctx.user.id)
        .map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          user: uMap.get(r.receiverId) ? publicUserCard(uMap.get(r.receiverId)!) : null,
        })),
    };
  }),

  searchUsers: protectedProcedure
    .input(z.object({ query: z.string().default('') }))
    .query(async ({ ctx, input }) => {
      const fRows = await ctx.db
        .select()
        .from(friendships)
        .where(eq(friendships.userId, ctx.user.id));
      const friendSet = new Set(fRows.map((f) => f.friendId));
      const blocked = await ctx.db
        .select()
        .from(blockedUsers)
        .where(eq(blockedUsers.blockerId, ctx.user.id));
      const blockedSet = new Set(blocked.map((b) => b.blockedId));

      const allU = await ctx.db.select().from(users);
      const q = input.query.trim().toLowerCase();

      return allU
        .filter((u) => {
          if (u.id === ctx.user.id || blockedSet.has(u.id)) return false;
          if (!q) return true;
          return (
            u.username.toLowerCase().includes(q) ||
            u.displayName.toLowerCase().includes(q)
          );
        })
        .slice(0, 25)
        .map((u) => ({
          ...publicUserCard(u),
          isFriend: friendSet.has(u.id),
        }));
    }),

  sendRequest: protectedProcedure
    .input(z.object({ targetUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetUserId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot add yourself' });
      }
      const now = new Date().toISOString();
      const id = generateId('frq');
      await ctx.db.insert(friendRequests).values({
        id,
        senderId: ctx.user.id,
        receiverId: input.targetUserId,
        status: 'pending',
        createdAt: now,
      });
      await ctx.db.insert(notifications).values({
        id: generateId('ntf'),
        userId: input.targetUserId,
        actorId: ctx.user.id,
        type: 'friend_request',
        title: 'New Friend Request',
        body: `${ctx.user.displayName} (@${ctx.user.username}) wants to connect.`,
        createdAt: now,
      });
      return { id };
    }),

  acceptRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [req] = await ctx.db
        .select()
        .from(friendRequests)
        .where(
          and(
            eq(friendRequests.id, input.requestId),
            eq(friendRequests.receiverId, ctx.user.id)
          )
        )
        .limit(1);
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });

      const now = new Date().toISOString();
      await ctx.db
        .update(friendRequests)
        .set({ status: 'accepted' })
        .where(eq(friendRequests.id, req.id));

      await ctx.db.insert(friendships).values([
        { id: generateId('fr'), userId: ctx.user.id, friendId: req.senderId, createdAt: now },
        { id: generateId('fr'), userId: req.senderId, friendId: ctx.user.id, createdAt: now },
      ]);
      return { ok: true };
    }),

  removeFriend: protectedProcedure
    .input(z.object({ friendId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(friendships)
        .where(
          or(
            and(eq(friendships.userId, ctx.user.id), eq(friendships.friendId, input.friendId)),
            and(eq(friendships.userId, input.friendId), eq(friendships.friendId, ctx.user.id))
          )
        );
      return { ok: true };
    }),

  nudgeSlacking: protectedProcedure
    .input(z.object({ friendId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(notifications).values({
        id: generateId('ntf'),
        userId: input.friendId,
        actorId: ctx.user.id,
        type: 'slacking',
        title: `${ctx.user.displayName} nudged you!`,
        body: 'Time to hit the gym and protect your streak.',
        createdAt: new Date().toISOString(),
      });
      return { ok: true };
    }),

  getPublicProfile: protectedProcedure
    .input(z.object({ userIdOrUsername: z.string() }))
    .query(async ({ ctx, input }) => {
      const [u] = await ctx.db
        .select()
        .from(users)
        .where(
          or(
            eq(users.id, input.userIdOrUsername),
            eq(users.username, input.userIdOrUsername.toLowerCase())
          )
        )
        .limit(1);
      if (!u) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });

      const [isFr] = await ctx.db
        .select()
        .from(friendships)
        .where(and(eq(friendships.userId, ctx.user.id), eq(friendships.friendId, u.id)))
        .limit(1);

      return {
        ...publicUserCard(u),
        equippedMedalIds: JSON.parse(u.equippedMedalIdsJson || '["","",""]') as string[],
        isSelf: u.id === ctx.user.id,
        isFriend: Boolean(isFr),
      };
    }),
});
