import { TRPCError } from '@trpc/server';
import { and, eq, or } from 'drizzle-orm';
import type { AppDatabase } from '../db/index.js';
import { blockedUsers, friendships, users } from '../db/schema.js';

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const PUBLIC_USER_SELECT = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  bio: users.bio,
  avatarConfigJson: users.avatarConfigJson,
  rankingSex: users.rankingSex,
  peakAverageRank: users.peakAverageRank,
  peakAverageRating: users.peakAverageRating,
  overallTopPercent: users.overallTopPercent,
  overallTierLabel: users.overallTierLabel,
  streaks: users.streaks,
  totalWorkouts: users.totalWorkouts,
  experiencePoints: users.experiencePoints,
  lastWorkoutAt: users.lastWorkoutAt,
  equippedTitleId: users.equippedTitleId,
  equippedBorderId: users.equippedBorderId,
  equippedBannerId: users.equippedBannerId,
  equippedMedalIdsJson: users.equippedMedalIdsJson,
};

export async function isBlockedBetween(
  db: AppDatabase,
  userA: string,
  userB: string
): Promise<boolean> {
  if (userA === userB) return false;
  const [row] = await db
    .select({ id: blockedUsers.id })
    .from(blockedUsers)
    .where(
      or(
        and(eq(blockedUsers.blockerId, userA), eq(blockedUsers.blockedId, userB)),
        and(eq(blockedUsers.blockerId, userB), eq(blockedUsers.blockedId, userA))
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function getBlockedUserIds(db: AppDatabase, userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ blockerId: blockedUsers.blockerId, blockedId: blockedUsers.blockedId })
    .from(blockedUsers)
    .where(or(eq(blockedUsers.blockerId, userId), eq(blockedUsers.blockedId, userId)));
  const set = new Set<string>();
  for (const r of rows) {
    if (r.blockerId !== userId) set.add(r.blockerId);
    if (r.blockedId !== userId) set.add(r.blockedId);
  }
  return set;
}

export async function areFriends(
  db: AppDatabase,
  userA: string,
  userB: string
): Promise<boolean> {
  if (userA === userB) return true;
  const [row] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userId, userA), eq(friendships.friendId, userB)))
    .limit(1);
  return Boolean(row);
}

export async function assertCanViewPost(
  db: AppDatabase,
  viewerId: string,
  post: { userId: string; visibility: string }
): Promise<void> {
  if (post.userId === viewerId) return;
  if (await isBlockedBetween(db, viewerId, post.userId)) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Workout post not found' });
  }
  if (post.visibility === 'public') return;
  if (post.visibility === 'friends' && (await areFriends(db, viewerId, post.userId))) {
    return;
  }
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Workout post not found' });
}
