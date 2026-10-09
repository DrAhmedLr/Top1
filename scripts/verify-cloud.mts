// Run only with an explicitly authorized account. The private fixture lives
// outside this repository. All logged observations are synthetic and removed.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createServerClient} from '@supabase/ssr';
import {buildPublicSummary,parsePublicSummary,type ProfileState} from '../lib/profile';
const fixture=JSON.parse(await readFile(process.env.TOP1_TEST_FIXTURE!,'utf8'));
const site=process.env.TOP1_TEST_BASE_URL||'http://localhost:3011';
const jar=new Map<string,string>();
const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>Array.from(jar,([name,value])=>({name,value})),setAll:items=>{for(const item of items)jar.set(item.name,item.value);}}});
const headers=()=>({cookie:Array.from(jar,([name,value])=>`${name}=${value}`).join('; '),origin:site,'content-type':'application/json','x-profile-user':fixture.id});
const call=(path:string,options:RequestInit={})=>fetch(site+path,options);
let original:ProfileState|undefined,current:ProfileState|undefined,changed=false;
async function load(){const response=await call('/api/profile',{headers:headers()});assert.equal(response.status,200);return (await response.json()).profile as ProfileState;}
async function save(profile:ProfileState){const response=await call('/api/profile',{method:'POST',headers:headers(),body:JSON.stringify({...profile,revision:current?.revision??profile.revision??0})});const body=await response.json();assert.equal(response.status,200,body.error);return current=body.profile as ProfileState;}
try{
 const {data,error}=await client.auth.signInWithPassword({email:fixture.email,password:fixture.password});assert.equal(error,null,'Authorized account could not sign in');assert.equal(data.user?.id,fixture.id);
 original=current=await load();assert.equal(Object.keys(original.values).length,0,'Do not overwrite an account containing personal measurements.');assert.equal(original.isPublic,false);
 const values={pushups:25,sit_to_stand:26,total_sleep:480,sauna_minutes:60};
 const measurementDetails=Object.fromEntries(Object.keys(values).map(id=>[id,{method:'manual' as const,source:'launch_test'}]));
 const profile:ProfileState={demographics:{age:32,sex:'female',weight:60,height:165},values,measurementDetails,username:fixture.username,isPublic:false,revision:original.revision};
 current=await save(profile);changed=true;const firstRevision=current.revision;
 const loaded=await load();assert.deepEqual(loaded,current);assert.deepEqual(loaded.values,values);
 let response=await call('/api/profile',{method:'POST',headers:{...headers(),'x-profile-user':'00000000-0000-0000-0000-000000000000'},body:JSON.stringify(current)});assert.equal(response.status,409);
 response=await call('/api/profile',{method:'POST',headers:{...headers(),origin:'https://wrong-origin.invalid'},body:JSON.stringify(current)});assert.equal(response.status,403);
 response=await call('/api/profile',{method:'POST',headers:headers(),body:JSON.stringify({...current,values:{rhr:500}})});assert.equal(response.status,400);
 response=await call('/share/'+fixture.username);assert.equal(response.status,404);
 response=await call('/api/og?username='+fixture.username);assert.equal(response.status,404);
 current=await save({...current,isPublic:true});
 response=await call('/api/profile',{method:'POST',headers:headers(),body:JSON.stringify({...current,revision:firstRevision})});assert.equal(response.status,409);assert.equal((await response.json()).conflict,true);
 response=await call('/share/'+fixture.username);assert.equal(response.status,200);const html=await response.text();assert.ok(html.includes('og:image')&&html.includes(fixture.username)&&html.includes('Self-reported measurements'));assert.ok(html.includes('BodyMarkers')&&html.includes('Recovery'));
 response=await call('/api/og?username='+fixture.username+'&percentile=99.99');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
 const summary=buildPublicSummary(current);const {data:row,error:summaryError}=await client.from('profiles').select('public_summary').eq('id',fixture.id).single();assert.equal(summaryError,null);assert.deepEqual(parsePublicSummary(row!.public_summary),summary);assert.match(row!.public_summary.signature,/^[a-f0-9]{64}$/);
 current=await save({...current,isPublic:false});
 response=await call('/share/'+fixture.username);assert.equal(response.status,404);response=await call('/api/og?username='+fixture.username);assert.equal(response.status,404);
 console.log('PASS: email/password sign-in, authenticated save/load, metadata, account scope, origin checks, validation, revision conflict, signed public page/card, and privacy revocation.');
}finally{
 if(changed&&original){
  // Restore through the revision-aware API before deleting only tagged fixtures.
  current=await load();await save(original);
  const {error}=await client.from('metric_logs').delete().eq('user_id',fixture.id).eq('source','launch_test');assert.equal(error,null,'Synthetic log cleanup failed');
 }
 const {error}=await client.auth.signOut({scope:'local'});client.auth.stopAutoRefresh();assert.equal(error,null);
 const denied=await call('/api/profile',{headers:headers()});assert.equal(denied.status,401);
 console.log('PASS: synthetic observations cleaned up, profile restored private, and signed-out API denied.');
}
