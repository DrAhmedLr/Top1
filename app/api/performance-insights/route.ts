import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/accountSession';
import {readAccountInsightSnapshot, InsightsChanged, InactiveGoal} from '@/lib/performanceInsightsServer';
import {currentGoalCalibration} from '@/lib/goalTrackingServer';
import {trainingId} from '@/lib/training';
import {getSupabaseServer} from '@/lib/supabaseServer';

export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});

export async function GET(request:Request) {
  const client = await getSupabaseServer();
  if (!client) return reply({error:'Account storage unavailable.'},503);
  const user = await currentAccount(client,request);
  if (!user) return reply({error:'Sign in to view your performance.'},401);
  const rawPlan=new URL(request.url).searchParams.get('plan');
  let plan:string|undefined;
  if(rawPlan!==null){
    try {plan=trainingId(rawPlan);} catch{return reply({error:'Invalid goal selection.'},400);}
  }
  try {
    const snapshot=await readAccountInsightSnapshot(client,user.id,false,plan);
    const calibration=await currentGoalCalibration(client,user.id,snapshot).catch(()=>null);
    return reply({owner:user.id,data:snapshot.insights,calibration});
  } catch (error) {
    if(error instanceof InactiveGoal)return reply({error:'This goal is no longer active.'},404);
    return error instanceof InsightsChanged ? reply({error:'Your data changed during calculation. Retry.'},409) :
      reply({error:'Unable to calculate performance insights.'},503);
  }
}
