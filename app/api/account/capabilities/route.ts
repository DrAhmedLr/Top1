import {currentAccount} from '@/lib/accountSession';
import {NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
export const dynamic='force-dynamic';
export async function GET(){const c=await getSupabaseServer();const user=c?await currentAccount(c):null;return NextResponse.json(user&&!user.is_anonymous?{accountDeletionConfigured:!!process.env.SUPABASE_SERVICE_ROLE_KEY}:{error:'Sign in.'},{status:user&&!user.is_anonymous?200:401,headers:{'Cache-Control':'private, no-store'}});}
