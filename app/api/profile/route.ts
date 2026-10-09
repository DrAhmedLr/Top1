import { signSummary } from '@/lib/summarySignature';
import { normalizeMeasurementMetadata } from '@/lib/measurementMetadata';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { emptyProfile,normalizeDemographics,normalizeValues,normalizeUsername,buildPublicSummary } from '@/lib/profile';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
  const client=await getSupabaseServer();
  if(!client)return reply({error:'Cloud storage is not configured.'},503);
  const {data:{user}}=await client.auth.getUser();
  if(!user)return reply({error:'Sign in to access your profile.'},401);
  const {data,error}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error)return reply({error:'Unable to load profile.'},500);
  if(!data)return reply({profile:emptyProfile});
  const {data:measurements,error:logError}=await client.rpc('read_current_measurements');
  if(logError)return reply({error:'Unable to load measurements.'},500);
  return reply({profile:{demographics:{age:data.age,sex:data.sex,weight:Number(data.weight_kg),height:Number(data.height_cm)},values:normalizeValues(measurements.values),measurementDetails:normalizeMeasurementMetadata(measurements.details),username:data.username??'',isPublic:data.is_public,revision:Number(data.revision)}});
}
export async function POST(request:NextRequest){
  // Cookie-authenticated writes only accept same-origin browser requests.
  if(request.headers.get('origin')!==request.nextUrl.origin)return reply({error:'Invalid request origin.'},403);
  if(Number(request.headers.get('content-length')??0)>16384)return reply({error:'Profile payload too large.'},413);
  const client=await getSupabaseServer();
  if(!client)return reply({error:'Cloud storage is not configured.'},503);
  const {data:{user}}=await client.auth.getUser();
  if(!user)return reply({error:'Sign in to save your profile.'},401);
  if(request.headers.get('x-profile-user')!==user.id)return reply({error:'Your session changed. Reload before saving.'},409);
  try{
    const text=await request.text();if(text.length>16384)return reply({error:'Profile payload too large.'},413);
    const input=JSON.parse(text);
    const demographics=normalizeDemographics(input.demographics),values=normalizeValues(input.values,true),username=normalizeUsername(input.username);
    if(typeof input.isPublic!=='boolean')throw new Error('Choose private or public visibility.');
    if(input.isPublic&&!username)throw new Error('Choose a username before publishing.');
    const measurementDetails=normalizeMeasurementMetadata(input.measurementDetails);
    if(!Number.isSafeInteger(input.revision)||input.revision<0)throw new Error('Reload the profile before saving.');
    const profile={demographics,values,username,isPublic:input.isPublic,measurementDetails,revision:input.revision};
    const summary=await signSummary(buildPublicSummary(profile),user.id,demographics);
    const {data:revision,error}=await client.rpc('save_profile',{p_demographics:demographics,p_metrics:values,p_username:username||null,p_is_public:input.isPublic,p_summary:summary,p_details:measurementDetails,p_expected_revision:input.revision});
    if(error)return reply({error:error.code==='23505'?'That username is already taken.':['40001','PT409'].includes(error.code)?'This profile changed on another device. Reload before saving.':'Unable to save your profile. Please retry.',conflict:['40001','PT409'].includes(error.code)},['23505','40001','PT409'].includes(error.code)?409:500);
    return reply({profile:{...profile,revision:Number(revision)}});
  }catch(error){return reply({error:error instanceof Error?error.message:'Invalid profile.'},400);}
}
