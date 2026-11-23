import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { safeNextPath } from '@/lib/profile';
import {getTranslations} from '@/lib/localeServer';
import {confirmationFailure,confirmationPage} from '@/lib/emailConfirmation';
export async function GET(request:NextRequest){
  if(request.nextUrl.searchParams.has('token_hash'))return confirmationPage(request.nextUrl,(await getTranslations()).locale);
  const code=request.nextUrl.searchParams.get('code');
  const next=safeNextPath(request.nextUrl.searchParams.get('next'));
  const client=await getSupabaseServer();
  if(code&&client){
    const session=await client.auth.exchangeCodeForSession(code).catch(()=>null);
    if(session?.data.session&&!session.error){
      const response=NextResponse.redirect(new URL(next,request.url));
      response.headers.set('Cache-Control','private, no-store');
      response.headers.set('Referrer-Policy','no-referrer');
      return response;
    }
  }
 return confirmationFailure(request.nextUrl,next,next==='/reset-password');
}
