import {nativeOrigin,nativeCorsHeaders} from './lib/nativeApi';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './lib/supabaseConfig';
import {contentSecurityPolicy} from './lib/securityHeaders';
export async function middleware(request: NextRequest) {
  if(request.nextUrl.pathname.startsWith('/api/')&&nativeOrigin(request.headers.get('origin'))){
    const cors=nativeCorsHeaders(request.headers.get('origin'))!;
    if(request.method==='OPTIONS')return new NextResponse(null,{status:204,headers:cors});
    const response=NextResponse.next();Object.entries(cors).forEach(([key,value])=>response.headers.set(key,value));return response;
  }
  const headers=new Headers(request.headers),nonce=crypto.randomUUID();
  const policy=contentSecurityPolicy(nonce,process.env.NODE_ENV==='development');
  headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',policy);
  const fresh=()=>{const r=NextResponse.next({request:{headers}});r.headers.set('Content-Security-Policy',policy);return r;};
  let response = fresh();
  const config = getSupabaseConfig();
  if (!config) return response;
  if (!request.cookies.getAll().some(cookie=>/^sb-.*-auth-token/.test(cookie.name))) return response;
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
        items.forEach(({name,value}) => request.cookies.set(name,value));
        headers.set('cookie',request.headers.get('cookie')??'');
        response = fresh();
        items.forEach(({name,value,options}) => response.cookies.set(name,value,options));
        Object.entries(sdkHeaders).forEach(([name,value]) => response.headers.set(name,value));
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
    response = fresh();
    console.warn('Middleware auth unavailable; continuing without session refresh');
  } finally {
    if (timer) clearTimeout(timer);
  }
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'] };
