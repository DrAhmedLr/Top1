import {currentAccount} from '@/lib/accountSession';
import {NextResponse,type NextRequest} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {historySummary} from '@/lib/history';
import {metrics} from '@/lib/registry';
export const dynamic='force-dynamic';
import {historyFields,toEntries} from '@/lib/metricLogRows';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){
 const id=req.nextUrl.searchParams.get('metric'),before=req.nextUrl.searchParams.get('before');
 const recent=req.nextUrl.searchParams.get('recent')==='1'&&!id&&!before;
 const metric=metrics.find(m=>m.id===id);
 if((!recent&&!metric)||(before&&(!/^\d+$/.test(before)||!Number.isSafeInteger(Number(before))||Number(before)<1)))return reply({error:'Invalid history query.'},400);
 const c=await getSupabaseServer();if(!c)return reply({error:'History unavailable.'},503);const user=await currentAccount(c,req);if(!user||user.is_anonymous)return reply({error:'Sign in to view history.'},401);
 let query=c.from('metric_logs').select(historyFields).eq('user_id',user.id).order('sequence',{ascending:false}).limit(recent?60:50);
 if(metric)query=query.eq('metric_id',metric.id);
 if(before)query=query.lt('sequence',Number(before));
 const {data,error}=await query;if(error)return reply({error:'Unable to load measurement history.'},500);
 const entries=toEntries(data??[]);
 if(recent)return reply({owner:user.id,entries});
 let summary:ReturnType<typeof historySummary>|undefined;
 if(!before&&req.nextUrl.searchParams.get('list')!=='1'){
  const complete=[...entries];
  let cursor=entries.length===50?entries.at(-1)?.sequence:undefined;
  while(cursor!==undefined){
   const {data:page,error:pageError}=await c.from('metric_logs').select(historyFields).eq('user_id',user.id).eq('metric_id',id).lt('sequence',cursor).order('sequence',{ascending:false}).limit(250);
   if(pageError)return reply({error:'Unable to load the complete history summary.'},500);
   const batch=toEntries(page??[]);complete.push(...batch);
   cursor=batch.length===250?batch.at(-1)?.sequence:undefined;
  }
  summary=historySummary(complete);
 }
 return reply({entries,comparison:summary?.comparison,best:summary?.best,latest:summary?.latest,previous:summary?.previous,next:entries.length===50?entries[entries.length-1].sequence:null});
}
