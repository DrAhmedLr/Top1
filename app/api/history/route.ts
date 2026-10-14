import {currentAccount} from '@/lib/accountSession';
import {NextResponse,type NextRequest} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {metrics} from '@/lib/registry';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('metric'),before=req.nextUrl.searchParams.get('before');
 if(!metrics.some(m=>m.id===id)||before&&(!/^\d+$/.test(before)||!Number.isSafeInteger(Number(before))||Number(before)<1))return reply({error:'Invalid history query.'},400);
 const c=await getSupabaseServer();if(!c)return reply({error:'History unavailable.'},503);const user=await currentAccount(c);if(!user||user.is_anonymous)return reply({error:'Sign in to view history.'},401);
 let query=c.from('metric_logs').select('id,sequence,metric_value,is_deleted,measured_at,recorded_at,method,exercise_mode,protocol_context,observation_window,calculation_inputs,reference_context').eq('user_id',user.id).eq('metric_id',id).order('sequence',{ascending:false}).limit(50);if(before)query=query.lt('sequence',Number(before));
 const {data,error}=await query;if(error)return reply({error:'Unable to load measurement history.'},500);
 const entries=(data??[]).map(r=>({id:r.id,sequence:Number(r.sequence),metricId:id,value:r.is_deleted?null:Number(r.metric_value),cleared:r.is_deleted,recordedAt:r.recorded_at,measuredAt:r.measured_at??undefined,method:r.method??undefined,exerciseMode:r.exercise_mode??undefined,protocol:r.protocol_context??undefined,window:r.observation_window??undefined,derivation:r.calculation_inputs??undefined,referenceContext:r.reference_context??undefined}));
 const {data:comparison,error:comparisonError}=await c.rpc('read_history_comparison',{p_metric:id});if(comparisonError)return reply({error:'Unable to load the comparison window.'},500);
 return reply({entries,comparison:comparison??[],next:entries.length===50?entries[entries.length-1].sequence:null});
}
