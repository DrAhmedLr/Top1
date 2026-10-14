import {NextResponse,type NextRequest} from 'next/server';
import {getSupabaseServer} from '@/lib/supabaseServer';
import {currentAccount} from '@/lib/accountSession';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
/** Withdrawal never reads, validates or signs the client's working profile. */
export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)return reply({error:'Invalid origin.'},403);
 const client=await getSupabaseServer();if(!client)return reply({error:'Account storage unavailable.'},503);
 const user=await currentAccount(client);if(!user)return reply({error:'Sign in to make your profile private.'},401);
 if(request.headers.get('x-profile-user')!==user.id)return reply({error:'Your account changed.'},409);
 const {data,error}=await client.rpc('withdraw_public_profile');
 return error?reply({error:'Unable to withdraw your profile. Please retry.'},500):reply({isPublic:false,revision:Number(data)});
}
