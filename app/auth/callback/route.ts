import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { safeNextPath } from '@/lib/profile';
export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get('code');
  const client=await getSupabaseServer();
  if(code&&client){
    const {error}=await client.auth.exchangeCodeForSession(code);
    if(!error){const response=NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get('next')),request.url));response.headers.set('Cache-Control','private, no-store');return response;}
  }
  return NextResponse.redirect(new URL('/sign-in?error=oauth',request.url));
}
