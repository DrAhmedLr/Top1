import {currentAccount} from '@/lib/accountSession';
import {NextResponse} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {pagedExport} from '@/lib/pagedExport';
export const dynamic='force-dynamic';
export async function GET(){
 const client=await getSupabaseServer();if(!client)return NextResponse.json({error:'Account storage unavailable.'},{status:503});
 const user=await currentAccount(client);if(!user)return NextResponse.json({error:'Sign in to export your account.'},{status:401});
 const [profile,program]=await Promise.all([client.from('profiles').select('*').eq('id',user.id).maybeSingle(),client.from('programs').select('*').eq('user_id',user.id).maybeSingle()]);
 if(profile.error||program.error)return NextResponse.json({error:'Unable to start the export.'},{status:500});
 const tables=[['observations','metric_logs','sequence'],['assessmentHistory','profile_revisions','revision'],['importReceipts','profile_imports','import_id'],['routineSchedules','program_schedule_history','effective_date'],['routineCompletions','program_completion_history','sequence']] as const;
 const parts=tables.map(([name,table,order])=>({name,pages:async function*(){for(let offset=0;;offset+=250){const {data,error}=await client.from(table).select('*').eq('user_id',user.id).order(order).range(offset,offset+249);if(error)throw new Error('Export interrupted. Sign in again and retry.');yield data??[];if(!data||data.length<250)break;}}}));
 const stream=pagedExport({schemaVersion:3,exportedAt:new Date().toISOString(),account:{id:user.id,email:user.email,createdAt:user.created_at},profile:profile.data,program:program.data},parts,async()=>{
  const [p,r,active]=await Promise.all([client.from('profiles').select('revision').eq('id',user.id).maybeSingle(),client.from('programs').select('revision').eq('user_id',user.id).maybeSingle(),currentAccount(client)]);
  if(p.error||r.error||!active||active.id!==user.id||p.data?.revision!==profile.data?.revision||r.data?.revision!==program.data?.revision)throw new Error('Your data changed during export. Retry while no edits are being made.');
 });
 return new Response(stream,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="TOP1-account-export.json"'}});
}
