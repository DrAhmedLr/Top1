import test from 'node:test';import assert from 'node:assert/strict';
import {validApiOrigin,nativeCorsHeaders,bearerToken} from './nativeApi';
import {nativeApiFetch} from './nativeTransport';
import {verifiedRevocationToken} from './accountSession';
import type {SupabaseClient} from '@supabase/supabase-js';
const req=(origin:string,token?:string)=>new Request('https://top1.fit/api/profile',{headers:{origin,...(token?{Authorization:token}:{})}});
test('native writes require bearer auth and exact local app origins; web writes stay same-origin',()=>{
 assert.equal(validApiOrigin(req('https://top1.fit')),true);
 for(const origin of ['capacitor://localhost','https://localhost']){assert.equal(validApiOrigin(req(origin)),false);assert.equal(validApiOrigin(req(origin,'Bearer example.token')),true);assert.equal(nativeCorsHeaders(origin)?.['Access-Control-Allow-Origin'],origin);}
 for(const origin of ['null','http://localhost','https://localhost.evil.test','https://evil.test']){assert.equal(validApiOrigin(req(origin,'Bearer example.token')),false);assert.equal(nativeCorsHeaders(origin),null);}
 assert.equal(bearerToken(new Headers({Authorization:'Basic secret'})),null);assert.equal(bearerToken(new Headers({Authorization:'Bearer bad token'})),null);
 assert.ok(!Object.keys(nativeCorsHeaders('capacitor://localhost')!).includes('Access-Control-Allow-Credentials'));
});
test('native transport sends tokens only to owned API requests, omits cookies and refuses redirects',async()=>{
 const received:{input:unknown;init?:RequestInit}[]=[];let tokenReads=0;
 const transport=nativeApiFetch((async(input,init)=>{received.push({input,init});return Response.json({ok:true});}) as typeof fetch,'https://top1.fit',async()=>{tokenReads++;return 'test-token';});
 await transport('/api/personal-workspace',{method:'POST',body:'{}'});assert.equal(received[0].input,'https://top1.fit/api/personal-workspace');assert.equal(new Headers(received[0].init?.headers).get('Authorization'),'Bearer test-token');assert.equal(received[0].init?.credentials,'omit');assert.equal(received[0].init?.redirect,'error');
 await transport('https://external.test/resource');assert.equal(tokenReads,1);assert.equal(received[1].init,undefined);
 await assert.rejects(transport('/api/../../external'),/Invalid API/);assert.throws(()=>nativeApiFetch(fetch,'http://top1.fit',async()=>null),/HTTPS/);
});
test('native signed-out requests never reuse a supplied stale token',async()=>{
 let headers:Headers|undefined;const transport=nativeApiFetch((async(_input,init)=>{headers=new Headers(init?.headers);return Response.json({});}) as typeof fetch,'https://top1.fit',async()=>null);
 await transport('/api/profile',{headers:{Authorization:'Bearer old'}});assert.equal(headers?.get('Authorization'),null);
});
test('account deletion verifies the exact bearer or web session token before revoking sessions',async()=>{
 let cookieReads=0;
 const verified:string[]=[];
 const client={auth:{
  getSession:async()=>{cookieReads++;return {data:{session:{access_token:'web-token'}}};},
  getUser:async(token:string)=>{
   verified.push(token);
   const id=token==='switched-token'?'other':'owner';
   return {data:{user:{id,is_anonymous:token==='guest-token'}},error:token==='expired-token'?new Error():null};
  }
 }} as unknown as SupabaseClient;
 const native=(token?:string)=>req('capacitor://localhost',token).headers;
 assert.equal(await verifiedRevocationToken(client,native('Bearer native-token'),'owner'),'native-token');
 for(const token of [undefined,'Basic invalid','Bearer switched-token','Bearer expired-token','Bearer guest-token']){
  await assert.rejects(verifiedRevocationToken(client,native(token),'owner'),/session changed/);
 }
 assert.equal(cookieReads,0);
 assert.equal(await verifiedRevocationToken(client,req('https://top1.fit').headers,'owner'),'web-token');
 assert.equal(cookieReads,1);
 assert.deepEqual(verified,['native-token','switched-token','expired-token','guest-token','web-token']);
});
