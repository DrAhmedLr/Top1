import {currentAccount} from '@/lib/accountSession';
import {NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {jsonExportStream} from '@/lib/exportStream';
export const dynamic='force-dynamic';
export async function GET(){
 const client=await getSupabaseServer();if(!client)return NextResponse.json({error:'Account storage unavailable.'},{status:503});
 const user=await currentAccount(client);if(!user||user.is_anonymous)return NextResponse.json({error:'Sign in to export your account.'},{status:401});
 const {data,error}=await client.rpc('export_own_data');if(error)return NextResponse.json({error:'Unable to export. Sign in again and retry.'},{status:error.code==='42501'?401:500});
 const stream=jsonExportStream({...data,account:{id:user.id,email:user.email,createdAt:user.created_at}});
 return new Response(stream,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="TOP1-account-export.json"'}});
}
