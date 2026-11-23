import {getPublicProfile} from '@/lib/publicProfile';
import {MODEL_VERSION} from '@/lib/model';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};

export async function GET(_request:Request,{params}:{params:Promise<{username:string}>}) {
 const {username}=await params;
 if(!/^[a-z0-9][a-z0-9_-]{2,29}$/.test(username))return new Response(null,{status:404,headers});
 try {
  const profile=await getPublicProfile(username);
  if(!profile)return new Response(null,{status:404,headers});
  const {summary}=profile;
  const score=summary.ready&&summary.modelVersion===MODEL_VERSION?Number(summary.modelScore.toFixed(1)):null;
  return Response.json({score},{headers});
 } catch {
  return new Response(null,{status:503,headers});
 }
}
