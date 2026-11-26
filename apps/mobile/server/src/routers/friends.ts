import { TRPCError } from '@trpc/server';
import { and, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  friendRequests,
  friendships,
  notifications,
  users,
} from '../db/schema.js';
import {
  areFriends,
  getBlockedUserIds,
  isBlockedBetween,
  PUBLIC_USER_SELECT,
  safeJsonParse,
} from '../lib/accessControl.js';
import { generateId } from '../lib/auth.js';
import { protectedProcedure, router } from '../trpc.js';

interface PublicUserRow {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarConfigJson: string;
  rankingSex: string;
  peakAverageRank: string;
  peakAverageRating: number;
  streaks: number;
  totalWorkouts: number;
  experiencePoints: number;
  lastWorkoutAt: string | null;
  equippedTitleId: string;
  equippedBorderId: string;
  equippedBannerId: string;
}

function publicUserCard(u: PublicUserRow) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    rankingSex: (u.rankingSex === 'Female' ? 'Female' : 'Male') as 'Male' | 'Female',
    avatarConfig: safeJsonParse<Record<string, unknown>>(u.avatarConfigJson, {}),
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
    if (fRows.length === 0) return [];

    const blockedSet = await getBlockedUserIds(ctx.db, ctx.user.id);
    const friendIds = fRows.map((f) => f.friendId).filter((id) => !blockedSet.has(id));
    if (friendIds.length === 0) return [];

    const friendUsers = await ctx.db
      .select(PUBLIC_USER_SELECT)
      .from(users)
      .where(inArray(users.id, friendIds));

    return friendUsers.map((u) => ({
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
    if (reqs.length === 0) return { incoming: [], outgoing: [] };

    const blockedSet = await getBlockedUserIds(ctx.db, ctx.user.id);
    const visibleReqs = reqs.filter(
      (r) => !blockedSet.has(r.senderId) && !blockedSet.has(r.receiverId)
    );
    const userIds = Array.from(
      new Set(visibleReqs.flatMap((r) => [r.senderId, r.receiverId]))
    );
    const userRows = userIds.length
      ? await ctx.db.select(PUBLIC_USER_SELECT).from(users).where(inArray(users.id, userIds))
      : [];
    const uMap = new Map(userRows.map((u) => [u.id, u]));

    return {
      incoming: visibleReqs
        .filter((r) => r.receiverId === ctx.user.id)
        .map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          user: uMap.get(r.senderId) ? publicUserCard(uMap.get(r.senderId)!) : null,
        })),
      outgoing: visibleReqs
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
        .select({ friendId: friendships.friendId })
        .from(friendships)
        .where(eq(friendships.userId, ctx.user.id));
      const friendSet = new Set(fRows.map((f) => f.friendId));
      const blockedSet = await getBlockedUserIds(ctx.db, ctx.user.id);

      const pendingOut = await ctx.db
        .select({ receiverId: friendRequests.receiverId })
        .from(friendRequests)
        .where(
          and(
            eq(friendRequests.senderId, ctx.user.id),
            eq(friendRequests.status, 'pending')
          )
        );
      const pendingSet = new Set(pendingOut.map((r) => r.receiverId));

      const allU = await ctx.db.select(PUBLIC_USER_SELECT).from(users);
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
          requestSent: pendingSet.has(u.id),
        }));
    }),

  sendRequest: protectedProcedure
    .input(z.object({ targetUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetUserId === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot add yourself' });
      }
      if (await isBlockedBetween(ctx.db, ctx.user.id, input.targetUserId)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot send request to this user' });
      }
      if (await areFriends(ctx.db, ctx.user.id, input.targetUserId)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Already friends' });
      }
      const [existingPending] = await ctx.db
        .select({ id: friendRequests.id })
        .from(friendRequests)
        .where(
          and(
            eq(friendRequests.status, 'pending'),
            or(
              and(
                eq(friendRequests.senderId, ctx.user.id),
                eq(friendRequests.receiverId, input.targetUserId)
              ),
              and(
                eq(friendRequests.senderId, input.targetUserId),
                eq(friendRequests.receiverId, ctx.user.id)
              )
            )
          )
        )
        .limit(1);
      if (existingPending) return { id: existingPending.id };

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
        payloadJson: JSON.stringify({ userId: ctx.user.id }),
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
            eq(friendRequests.receiverId, ctx.user.id),
            eq(friendRequests.status, 'pending')
          )
        )
        .limit(1);
      if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });

      const now = new Date().toISOString();
      await ctx.db
        .update(friendRequests)
        .set({ status: 'accepted' })
        .where(eq(friendRequests.id, req.id));

      if (!(await areFriends(ctx.db, ctx.user.id, req.senderId))) {
        await ctx.db.insert(friendships).values([
          { id: generateId('fr'), userId: ctx.user.id, friendId: req.senderId, createdAt: now },
          { id: generateId('fr'), userId: req.senderId, friendId: ctx.user.id, createdAt: now },
        ]);
      }
      return { ok: true };
    }),

  declineRequest: protectedProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(friendRequests)
        .set({ status: 'declined' })
        .where(
          and(
            eq(friendRequests.id, input.requestId),
            or(
              eq(friendRequests.receiverId, ctx.user.id),
              eq(friendRequests.senderId, ctx.user.id)
            ),
            eq(friendRequests.status, 'pending')
          )
        );
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
      if (
        input.friendId === ctx.user.id ||
        !(await areFriends(ctx.db, ctx.user.id, input.friendId)) ||
        (await isBlockedBetween(ctx.db, ctx.user.id, input.friendId))
      ) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only nudge accepted friends.' });
      }
      await ctx.db.insert(notifications).values({
        id: generateId('ntf'),
        userId: input.friendId,
        actorId: ctx.user.id,
        type: 'slacking',
        title: `${ctx.user.displayName} nudged you!`,
        body: 'Time to hit the gym and protect your streak.',
        payloadJson: JSON.stringify({ userId: ctx.user.id }),
        createdAt: new Date().toISOString(),
      });
      return { ok: true };
    }),

  getPublicProfile: protectedProcedure
    .input(z.object({ userIdOrUsername: z.string() }))
    .query(async ({ ctx, input }) => {
      const [u] = await ctx.db
        .select(PUBLIC_USER_SELECT)
        .from(users)
        .where(
          or(
            eq(users.id, input.userIdOrUsername),
            eq(users.username, input.userIdOrUsername.toLowerCase())
          )
        )
        .limit(1);
      if (!u || (u.id !== ctx.user.id && (await isBlockedBetween(ctx.db, ctx.user.id, u.id)))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const [isFr] = await ctx.db
        .select({ id: friendships.id })
        .from(friendships)
        .where(and(eq(friendships.userId, ctx.user.id), eq(friendships.friendId, u.id)))
        .limit(1);

      return {
        ...publicUserCard(u),
        equippedMedalIds: safeJsonParse<string[]>(u.equippedMedalIdsJson, ['', '', '']),
        isSelf: u.id === ctx.user.id,
        isFriend: Boolean(isFr),
      };
    }),
});
