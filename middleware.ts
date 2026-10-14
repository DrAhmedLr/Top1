import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './lib/supabaseConfig';
import {contentSecurityPolicy} from './lib/securityHeaders';
export async function middleware(request: NextRequest) {
  const headers=new Headers(request.headers),nonce=crypto.randomUUID();
  const policy=contentSecurityPolicy(nonce,process.env.NODE_ENV==='development');
  headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',policy);
  const fresh=()=>{const r=NextResponse.next({request:{headers}});r.headers.set('Content-Security-Policy',policy);return r;};
  let response = fresh();
  const config = getSupabaseConfig();
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items, sdkHeaders) {
        items.forEach(({name,value}) => request.cookies.set(name,value));
        headers.set('cookie',request.headers.get('cookie')??'');
        response = fresh();
        items.forEach(({name,value,options}) => response.cookies.set(name,value,options));
        Object.entries(sdkHeaders).forEach(([name,value]) => response.headers.set(name,value));
      },
    },
  });
  await supabase.auth.getClaims();
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'] };
