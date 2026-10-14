import {currentAccount} from '@/lib/accountSession';
import {NextResponse,type NextRequest} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {normalizePlan} from '@/lib/program';
import {dayInZone} from '@/lib/routineHistory';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const c=await getSupabaseServer();if(!c)return reply({error:'Account storage unavailable.'},503);const user=await currentAccount(c);if(!user||user.is_anonymous)return reply({error:'Sign in to view your program.'},401);const {data,error}=await c.rpc('read_program_recorded');return error?reply({error:'Unable to load your program.'},500):reply(data);}
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return reply({error:'Invalid origin.'},403);
 const c=await getSupabaseServer();if(!c)return reply({error:'Account storage unavailable.'},503);const user=await currentAccount(c);if(!user||user.is_anonymous)return reply({error:'Sign in to save your program.'},401);
 if(req.headers.get('x-profile-user')!==user.id)return reply({error:'Your account changed.'},409);
 try{const text=await req.text();if(text.length>65536)return reply({error:'Plan too large.'},413);const body=JSON.parse(text),plan=normalizePlan(body.plan);if(!Number.isSafeInteger(body.revision)||body.revision<0)throw new Error('Reload your program before saving.');
 if(typeof body.timeZone!=='string'||body.timeZone.length>80)throw new Error('Choose a valid calendar time zone.');const today=dayInZone(body.timeZone);
 if(body.completion&&(!body.completion.taskId||typeof body.completion.taskId!=='string'||typeof body.completion.completed!=='boolean'))throw new Error('Invalid check-in.');
 const {data,error}=await c.rpc('save_program_recorded',{p_plan:plan,p_expected_revision:body.revision,p_day:today,p_timezone:body.timeZone,p_completion:body.completion??null});if(error)return reply({error:error.code==='PT409'?'Your program changed elsewhere. Your draft is retained; reload to review it.':'Unable to save your program.'},error.code==='PT409'?409:500);return reply(data);
 }catch(e){return reply({error:e instanceof Error?e.message:'Invalid plan.'},400);}
}
