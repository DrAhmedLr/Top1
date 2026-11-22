import test from 'node:test';import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {confirmationPage,confirmEmail,confirmationNext} from './emailConfirmation';
import {emailConfirmationUrl,needsEmailConfirmation} from './emailAuth';
const origin='https://top1.fit';
const request=(type='email',next='/?view=profile',site=origin)=>new Request(origin+'/auth/confirm',{method:'POST',headers:{origin:site,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({type,next,token_hash:'example-test-hash'})});
const auth=(verifyOtp:unknown)=>({verifyOtp}) as Pick<SupabaseClient['auth'],'verifyOtp'>;
test('email GET is scanner safe and renders an explicit POST without exposing token to third-party resources',async()=>{
 const response=confirmationPage(new URL(origin+'/auth/confirm?token_hash=test%22%3E%3Cscript%3E&type=email'));
 assert.equal(response.status,200);const html=await response.text();assert.match(html,/method="post"/);assert.ok(!html.includes('<script>'));assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.match(response.headers.get('Cache-Control')!,/no-store/);
});
test('confirmation works on a second device without a PKCE verifier and preserves safe return path',async()=>{
 let received:unknown;const response=await confirmEmail(request(),auth(async(args:unknown)=>{received=args;return {error:null};}));assert.deepEqual(received,{type:'email',token_hash:'example-test-hash'});assert.equal(response.status,303);assert.equal(response.headers.get('Location'),origin+'/?view=profile&confirmed=1');
 assert.equal(new URL(emailConfirmationUrl(origin,'/?view=profile')).searchParams.get('next'),'/?view=profile');assert.ok(needsEmailConfirmation({code:'email_not_confirmed'}));
});
test('expired and failed confirmations offer signup/resend with safe destination; recovery stays recovery',async()=>{
 for(const verify of [async()=>({error:{code:'otp_expired'}}),async()=>{throw Error('outage');}]){const response=await confirmEmail(request('email','//evil.test'),auth(verify));const location=new URL(response.headers.get('Location')!);assert.equal(location.origin,origin);assert.equal(location.searchParams.get('mode'),'sign-up');assert.equal(location.searchParams.get('next'),'/');}
 const response=await confirmEmail(request('recovery'),auth(async()=>({error:null})));assert.equal(response.headers.get('Location'),origin+'/reset-password');
});
test('cross-origin and unsupported verification requests cannot consume a token',async()=>{
 let calls=0;const fake=auth(async()=>{calls++;return {error:null};});assert.equal((await confirmEmail(request('email','/','https://evil.test'),fake)).status,403);await confirmEmail(request('invite'),fake);assert.equal(calls,0);
 assert.equal(confirmationPage(new URL(origin+'/auth/confirm')).status,303);
});

test('template return URLs unwrap only the same-origin callback and Arabic confirmation is RTL',async()=>{
 assert.equal(confirmationNext('https://top1.fit/auth/callback?next=%2F%3Fview%3Dprofile',origin),'/?view=profile');
 assert.equal(confirmationNext('https://evil.test/auth/callback?next=/profile',origin),'/');
 const html=await confirmationPage(new URL(origin+'/auth/confirm?token_hash=test&type=email'),'ar').text();assert.match(html,/lang="ar" dir="rtl"/);
});
