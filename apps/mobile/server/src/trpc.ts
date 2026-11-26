import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from './db/index.js';
import { sessions, users } from './db/schema.js';
import { verifyAccessToken } from './lib/auth.js';

export interface TRPCContext {
  db: AppDatabase;
  authorizationHeader?: string;
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const header = ctx.authorizationHeader ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid token' });
  }

  const verified = verifyAccessToken(token);
  if (!verified.ok) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: verified.reason === 'expired' ? 'Token has expired' : 'Invalid token',
    });
  }

  const [session] = await ctx.db
    .select()
    .from(sessions)
    .where(eq(sessions.id, verified.payload.sid))
    .limit(1);

  if (!session || session.revokedAt) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Session not found' });
  }

  if (session.userId !== verified.payload.sub || new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid session' });
  }

  const [user] = await ctx.db
    .select()
    .from(users)
    .where(eq(users.id, verified.payload.sub))
    .limit(1);

  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not found' });
  }

  return next({
    ctx: {
      ...ctx,
      user,
      session,
    },
  });
});
