import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmationPage,confirmEmail,confirmationNext} from './emailConfirmation';
import {emailConfirmationUrl,needsEmailConfirmation} from './emailAuth';

const origin='https://top1.fit';
const hash='example-test-hash';
const password='abcde123';
const user={id:'fixture'};
const verified={data:{session:{user},user},error:null};
type ConfirmationAuth=NonNullable<Parameters<typeof confirmEmail>[1]>;

function request(type='email',next='/?view=profile',fields:Record<string,string>={},site=origin){
 return new Request(origin+'/auth/confirm',{method:'POST',headers:{origin:site,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({type,next,token_hash:hash,...fields})});
}
const auth=(methods:Record<string,unknown>)=>methods as unknown as ConfirmationAuth;

test('email links render an explicit POST without consuming the hash or loading scripts',async()=>{
 const response=confirmationPage(new URL(origin+'/auth/confirm?token_hash=test%22%3E%3Cscript%3E&type=email'));
 assert.equal(response.status,200);
 const html=await response.text();
 assert.match(html,/method="post"/);assert.doesNotMatch(html,/<script>|type="password"/);
 assert.equal(response.headers.get('Referrer-Policy'),'strict-origin');
 assert.match(response.headers.get('Cache-Control')!,/no-store/);
});

test('signup confirmation works on a second device and preserves its return path',async()=>{
 let received:unknown;
 const response=await confirmEmail(request(),auth({verifyOtp:async(args:unknown)=>{received=args;return verified;}}));
 assert.deepEqual(received,{type:'email',token_hash:hash});
 assert.equal(response.status,303);assert.equal(response.headers.get('Location'),origin+'/?view=profile&confirmed=1');
 assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
 assert.equal(new URL(emailConfirmationUrl(origin,'/?view=profile')).searchParams.get('next'),'/?view=profile');
 assert.ok(needsEmailConfirmation({code:'email_not_confirmed'}));
});

test('failed confirmations return to the correct form without echoing the hash',async()=>{
 for(const type of ['email','recovery']){
  for(const verifyOtp of [async()=>({error:{code:'otp_expired'}}),async()=>{throw Error('outage');},async()=>({data:{session:null,user:null},error:null})]){
   const response=await confirmEmail(request(type,'//invalid.test',{password,confirmation:password}),auth({verifyOtp}));
   const location=new URL(response.headers.get('Location')!);
   assert.equal(location.origin,origin);assert.equal(location.searchParams.get('mode'),type==='recovery'?'forgot-password':'sign-up');
   assert.equal(location.searchParams.get('next'),'/');assert.ok(!location.href.includes(hash));
  }
 }
});

test('recovery verifies its own token, changes the password, and signs out globally',async()=>{
 const steps:string[]=[];
 const response=await confirmEmail(request('recovery','/',{password,confirmation:password}),auth({
  verifyOtp:async(args:unknown)=>{steps.push('verify');assert.deepEqual(args,{type:'recovery',token_hash:hash});return verified;},
  updateUser:async(args:unknown)=>{steps.push('update');assert.deepEqual(args,{password});return {data:{user},error:null};},
  signOut:async(args:unknown)=>{steps.push('sign-out');assert.deepEqual(args,{scope:'global'});return {error:null};}
 }));
 assert.deepEqual(steps,['verify','update','sign-out']);
 assert.equal(response.status,303);assert.equal(response.headers.get('Location'),origin+'/sign-in?passwordUpdated=1');
});

test('an old confirmation tab or invalid password preserves the recovery link and never echoes the password',async()=>{
 let calls=0;const fake=auth({verifyOtp:async()=>{calls++;return verified;}});
 assert.equal((await confirmEmail(request('recovery'),fake)).status,200);
 for(const [value,confirmation] of [['seven77','seven77'],[password,'mismatch']]){
  const response=await confirmEmail(request('recovery','/',{password:value,confirmation}),fake,'fr');
  const html=await response.text();
  assert.equal(response.status,422);assert.match(html,/role="alert"/);assert.match(html,/minlength="8" maxlength="128"/);
  assert.match(html,/Utilisez au moins 8 caractères/);assert.ok(html.includes(hash));assert.ok(!html.includes(value));
 }
 assert.equal(calls,0);
});

test('recovery handles provider password refusal and sign-out failure without reporting an incorrect update status',async()=>{
 for(const code of ['same_password','weak_password']){
  let scope='';
  const response=await confirmEmail(request('recovery','/',{password,confirmation:password}),auth({
   verifyOtp:async()=>verified,updateUser:async()=>({data:{user:null},error:{code}}),
   signOut:async(args:{scope:string})=>{scope=args.scope;return {error:null};}
  }));
  assert.equal(scope,'local');assert.equal(response.status,422);assert.match(await response.text(),/mode=forgot-password/);
 }
 const response=await confirmEmail(request('recovery','/',{password,confirmation:password}),auth({
  verifyOtp:async()=>verified,updateUser:async()=>({data:{user},error:null}),signOut:async()=>({error:{}})
 }));
 assert.equal(response.status,200);assert.match(await response.text(),/Your password was updated/);
});

test('other origins and unsupported verification types cannot consume a token',async()=>{
 let calls=0;const fake=auth({verifyOtp:async()=>{calls++;return verified;}});
 assert.equal((await confirmEmail(request('email','/',{},'https://invalid.test'),fake)).status,403);
 assert.equal((await confirmEmail(request('email','/',{},'null'),fake)).status,403);
 await confirmEmail(request('invite'),fake);assert.equal(calls,0);
 assert.equal(confirmationPage(new URL(origin+'/auth/confirm')).status,303);
});

test('template return URLs unwrap the same-origin callback and all recovery forms display the minimum',async()=>{
 assert.equal(confirmationNext('https://top1.fit/auth/callback?next=%2F%3Fview%3Dprofile',origin),'/?view=profile');
 assert.equal(confirmationNext('https://invalid.test/auth/callback?next=/profile',origin),'/');
 for(const [locale,copy] of [['en','Use at least 8 characters.'],['fr','Utilisez au moins 8 caractères.'],['ar','استخدم 8 حرفًا على الأقل.']]){
  const html=await confirmationPage(new URL(origin+'/auth/confirm?token_hash=test&type=recovery'),locale).text();
  assert.ok(html.includes(copy));assert.match(html,/minlength="8" maxlength="128"/);assert.ok(html.includes('lang="'+locale+'"'));
  if(locale==='ar')assert.match(html,/dir="rtl"/);
 }
});
