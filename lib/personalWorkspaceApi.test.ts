import test from 'node:test';import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {personalWorkspaceHandlers} from './personalWorkspaceApi';
import {emptyWorkspace} from './personalWorkspace';
import {accountReadOptions} from './accountSession';
function setup(options:{user?:{id:string;is_anonymous?:boolean}|null;active?:boolean;error?:string}={}){
 let rpcCalls=0,record:{data:ReturnType<typeof emptyWorkspace>;revision:number}|null=null;
 const client={auth:{getUser:async()=>({data:{user:options.user===undefined?{id:'owner'}:options.user},error:null})},from:()=>({select:()=>({eq:(_key:string,id:string)=>{assert.equal(id,'owner');return {maybeSingle:async()=>({data:record,error:null})};}})}),rpc:async(name:string,args?:{p_data:ReturnType<typeof emptyWorkspace>;p_revision:number})=>{
 if(name==='active_account_session')return {data:options.active!==false,error:null};rpcCalls++;if(options.error)return {error:{code:options.error}};
 if(args!.p_revision!==(record?.revision??0))return {error:{code:'PT409'}};record={data:args!.p_data,revision:(record?.revision??0)+1};return {data:record,error:null};}} as unknown as SupabaseClient;
 return {handlers:personalWorkspaceHandlers(async()=>client),get rpcCalls(){return rpcCalls;}};
}
const read=()=>new Request('https://top1.fit/api/personal-workspace');
const post=(data:unknown,revision:unknown,owner='owner',origin='https://top1.fit')=>new Request('https://top1.fit/api/personal-workspace',{method:'POST',headers:{origin,'X-Profile-User':owner},body:JSON.stringify({data,revision})});
test('workspace API reads, writes, returns private no-store responses and maps stale writes to 409',async()=>{
 const {handlers}=setup();const empty=await handlers.GET(read());assert.match(empty.headers.get('Cache-Control')!,/private, no-store/);assert.equal((await empty.json()).revision,0);
 const first=await handlers.POST(post({...emptyWorkspace(),context:{days:3}},0));assert.equal(first.status,200);assert.equal((await first.json()).revision,1);
 assert.equal((await handlers.POST(post(emptyWorkspace(),0))).status,409);const latest=await (await handlers.GET(read())).json();assert.equal(latest.data.context.days,3);
 assert.equal((await handlers.POST(post({...latest.data,context:{days:4}},latest.revision))).status,200);
});
test('a private read follows the account shown in the tab even if its session changes',async()=>{
 const {handlers}=setup();
 const url='https://top1.fit/api/personal-workspace';
 await handlers.POST(post({...emptyWorkspace(),context:{days:4}},0));
 const matching=await handlers.GET(new Request(url,accountReadOptions('owner')));
 assert.equal((await matching.json()).data.context.days,4);
 const different=await handlers.GET(new Request(url,accountReadOptions('previous-owner')));
 assert.equal(different.status,401);
 assert.deepEqual(Object.keys(await different.json()),['error']);
 const legacy=await handlers.GET(new Request(url));
 assert.equal((await legacy.json()).owner,'owner');
});
test('anonymous, revoked, signed-out, changed-owner and cross-origin writes never reach the save RPC',async()=>{
 for(const options of [{user:null},{user:{id:'owner',is_anonymous:true}},{active:false}]){const s=setup(options);assert.equal((await s.handlers.GET(read())).status,401);assert.equal((await s.handlers.POST(post(emptyWorkspace(),0))).status,401);assert.equal(s.rpcCalls,0);}
 const s=setup();assert.equal((await s.handlers.POST(post(emptyWorkspace(),0,'other'))).status,409);assert.equal((await s.handlers.POST(post(emptyWorkspace(),0,'owner','https://evil.test'))).status,403);assert.equal(s.rpcCalls,0);
});
test('invalid and oversized input is rejected and provider failures remain recoverable',async()=>{
 const s=setup();for(const revision of [-1,'0',null])assert.equal((await s.handlers.POST(post(emptyWorkspace(),revision))).status,400);
 assert.equal((await s.handlers.POST(post({...emptyWorkspace(),context:{days:8}},0))).status,400);assert.equal((await s.handlers.POST(post({padding:'a'.repeat(17000)},0))).status,413);assert.equal(s.rpcCalls,0);
 const broken=setup({error:'08006'});assert.equal((await broken.handlers.POST(post(emptyWorkspace(),0))).status,500);
 assert.equal((await personalWorkspaceHandlers(async()=>null).GET(read())).status,503);
});
test('native workspace requests retain account validation and stale-revision behavior',async()=>{
 const s=setup();const native=(revision:number,owner='owner')=>new Request('https://top1.fit/api/personal-workspace',{method:'POST',headers:{origin:'capacitor://localhost',Authorization:'Bearer fixture-token','X-Profile-User':owner},body:JSON.stringify({data:emptyWorkspace(),revision})});
 assert.equal((await s.handlers.POST(native(0))).status,200);assert.equal((await s.handlers.POST(native(0))).status,409);assert.equal((await s.handlers.POST(native(1,'other'))).status,409);
 const revoked=setup({active:false});assert.equal((await revoked.handlers.POST(native(0))).status,401);assert.equal(revoked.rpcCalls,0);
});
