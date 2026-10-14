import {currentAccount} from '@/lib/accountSession';
import {NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
export const dynamic='force-dynamic';
export async function GET(){const c=await getSupabaseServer();const user=c?await currentAccount(c):null;if(!c||!user)return NextResponse.json({error:'Sign in.'},{status:401,headers:{'Cache-Control':'private, no-store'}});const edge=process.env.SUPABASE_SERVICE_ROLE_KEY?null:await c.functions.invoke('delete-own-account',{method:'GET'});return NextResponse.json({accountDeletionConfigured:!!process.env.SUPABASE_SERVICE_ROLE_KEY||!edge?.error&&edge?.data?.accountDeletionConfigured===true},{headers:{'Cache-Control':'private, no-store'}});}
