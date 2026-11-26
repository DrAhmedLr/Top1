import type { AnyRouter } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createDatabase, type AppDatabase } from '@/apps/mobile/server/src/db/index';
import { seedDatabase } from '@/apps/mobile/server/src/db/seed';
import { appRouter } from '@/apps/mobile/server/src/routers/index';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

let dbReadyPromise: Promise<AppDatabase> | null = null;

function getDb(): Promise<AppDatabase> {
  if (!dbReadyPromise) {
    dbReadyPromise = (async () => {
      const configuredUrl =
        process.env.TOP1_MOBILE_DATABASE_URL ||
        process.env.TURSO_DATABASE_URL ||
        process.env.LIFTOFF_DATABASE_URL;
      const authToken =
        process.env.TOP1_MOBILE_DATABASE_AUTH_TOKEN ||
        process.env.TURSO_AUTH_TOKEN ||
        undefined;
      if (!configuredUrl && process.env.VERCEL === '1') {
        console.warn('[top1/trpc] TOP1_MOBILE_DATABASE_URL is not set on Vercel; falling back to ephemeral /tmp SQLite.');
      }
      const dbUrl =
        configuredUrl ||
        (process.env.VERCEL === '1' ? 'file:/tmp/top1-mobile.db' : 'file:./.next/top1-mobile.db');
      const { db } = await createDatabase(dbUrl, authToken);
      await seedDatabase(db);
      return db;
    })().catch((err) => {
      dbReadyPromise = null;
      throw err;
    });
  }
  return dbReadyPromise;
}

async function handle(request: Request) {
  const db = await getDb();
  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter as unknown as AnyRouter,
    createContext: () => ({
      db,
      authorizationHeader: request.headers.get('authorization') ?? undefined,
    }),
  });
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
