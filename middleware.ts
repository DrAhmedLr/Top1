import { nativeOrigin, nativeCorsHeaders } from './lib/nativeApi';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './lib/supabaseConfig';
import { contentSecurityPolicy } from './lib/securityHeaders';

const SPA_EXACT_ROUTES = new Set([
  '/home',
  '/workouts',
  '/ranks',
  '/nutrition',
  '/profile',
  '/themes',
  '/exercises',
  '/schedule',
  '/generator',
  '/recap',
  '/friends',
  '/leaderboard',
  '/shop',
  '/notifications',
]);

const SPA_PREFIX_ROUTES = [
  '/exercise/',
  '/preset/',
  '/rank/',
  '/progress/',
  '/post/',
  '/u/',
  '/settings/',
];

function isUnifiedAppShellPath(pathname: string, hasViewParam: boolean): boolean {
  if (pathname === '/' && !hasViewParam) return true;
  if (SPA_EXACT_ROUTES.has(pathname)) return true;
  return SPA_PREFIX_ROUTES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api/') && nativeOrigin(request.headers.get('origin'))) {
    const cors = nativeCorsHeaders(request.headers.get('origin'))!;
    if (request.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers: cors });
    const reqHeaders = new Headers(request.headers);
    reqHeaders.delete('x-nonce');
    const response = NextResponse.next({ request: { headers: reqHeaders } });
    Object.entries(cors).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

  const headers = new Headers(request.headers);
  headers.delete('x-nonce');

  // Serve the unified TOP1% gamified mobile-first experience at `/` and all SPA deep links
  // while preserving classic deep links (/?view=...) and reserved Next.js routes (/admin, /share, /classic, /api/*, /about, /privacy, /sign-in, /reset-password, /account, /auth).
  const isAppShell = isUnifiedAppShellPath(pathname, request.nextUrl.searchParams.has('view'));
  const nonce = crypto.randomUUID();
  headers.set('x-nonce', nonce);

  const policy = isAppShell
    ? null
    : contentSecurityPolicy(nonce, process.env.NODE_ENV === 'development');
  if (policy) headers.set('Content-Security-Policy', policy);

  const makeResponse = () => {
    if (isAppShell) {
      const url = request.nextUrl.clone();
      url.pathname = '/api/app-shell';
      return NextResponse.rewrite(url, { request: { headers } });
    }
    const r = NextResponse.next({ request: { headers } });
    if (policy) r.headers.set('Content-Security-Policy', policy);
    return r;
  };

  let response = makeResponse();
  const config = getSupabaseConfig();
  if (!config) return response;
  if (!request.cookies.getAll().some((cookie) => /^sb-.*-auth-token/.test(cookie.name))) {
    return response;
  }

  // An auth outage must not hold every page until Vercel's middleware deadline.
  // Authorization remains enforced by server handlers and database RLS.
  const controller = new AbortController();
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const supabase = createServerClient(config.url, config.key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }),
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items, sdkHeaders) {
        if (expired) return;
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        headers.set('cookie', request.headers.get('cookie') ?? '');
        response = makeResponse();
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(sdkHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  try {
    await Promise.race([
      supabase.auth.getClaims(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          controller.abort();
          reject(new Error('Middleware auth deadline exceeded'));
        }, 3000);
      }),
    ]);
  } catch {
    // Keep existing cookies on transient failures so the browser can retry.
    response = makeResponse();
    console.warn('Middleware auth unavailable; continuing without session refresh');
  } finally {
    if (timer) clearTimeout(timer);
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_expo|assets|media|favicon.ico|robots.txt|sitemap.xml).*)'],
};
