import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './lib/supabaseConfig';
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items, headers) {
        items.forEach(({name,value}) => request.cookies.set(name,value));
        response = NextResponse.next({ request });
        items.forEach(({name,value,options}) => response.cookies.set(name,value,options));
        Object.entries(headers).forEach(([name,value]) => response.headers.set(name,value));
      },
    },
  });
  await supabase.auth.getClaims();
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config = { matcher: ['/', '/api/profile', '/auth/:path*', '/sign-in', '/reset-password', '/account/:path*', '/share/:path*'] };
