import { NextResponse,type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { safeNextPath } from '@/lib/profile';
export async function GET(request:NextRequest){
 const hash=request.nextUrl.searchParams.get('token_hash'),type=request.nextUrl.searchParams.get('type');
 const client=await getSupabaseServer();
 if(hash&&client&&(type==='email'||type==='signup'||type==='recovery')){
  const {error}=await client.auth.verifyOtp({token_hash:hash,type});
  if(!error){const destination=type==='recovery'?'/reset-password':safeNextPath(request.nextUrl.searchParams.get('next'));const response=NextResponse.redirect(new URL(destination,request.url));response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');return response;}
 }
 return NextResponse.redirect(new URL('/sign-in?error=confirmation',request.url));
}
