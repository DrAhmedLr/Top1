import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrateLocalProfile,type MigrationStorage} from './authMigration';
import {parseLocalProfile,normalizeDemographics,normalizeValues,normalizeUsername,buildPublicSummary,parsePublicSummary,safeNextPath} from './profile';
import {radarPoints} from './radar';
const raw=JSON.stringify({demographics:{age:32,sex:'female',weight:60,height:165},values:{rhr:55,vo2_max:42,body_fat:19},demo:false});
function storage(entries:Record<string,string>):MigrationStorage & {data:Map<string,string>}{const data=new Map(Object.entries(entries));return {data,getItem:key=>data.get(key)??null,removeItem:key=>{data.delete(key);}};}
test('actual V2 key and shape migrate in one RPC before cleanup',async()=>{
 const local=storage({'top1-profile-v2':raw,'top1-profile-v1':raw});let calls=0;
 await migrateLocalProfile({rpc:async(name,args)=>{calls++;assert.equal(name,'migrate_local_profile');if(calls===1)assert.ok(local.data.has('top1-profile-v2'));assert.deepEqual(args.p_metrics,{rhr:55,vo2_max:42,body_fat:19});return {error:null};}},local,async()=> 'stable-import-id');
 assert.equal(calls,2);assert.equal(local.data.size,0);
});
test('failed transaction retains all local measurements and permits retry',async()=>{
 const local=storage({'top1-profile-v2':raw});
 await assert.rejects(migrateLocalProfile({rpc:async()=>({error:{message:'offline'}})},local,async()=> 'same-id'),/still saved/);
 assert.equal(local.data.get('top1-profile-v2'),raw);
 assert.equal(await migrateLocalProfile({rpc:async()=>({error:null})},local,async()=> 'same-id'),true);
});
test('underscore key and requested measurements/weightKg shape are supported',()=>{
 const profile=parseLocalProfile(JSON.stringify({demographics:{age:28,sex:'male',weightKg:78,heightCm:180},measurements:{rhr:50,lpa:NaN}}));
 assert.deepEqual(profile?.demographics,{age:28,sex:'male',weight:78,height:180});assert.deepEqual(profile?.values,{rhr:50});
});
test('demo profiles and no local data do not import',async()=>{
 const client={rpc:async()=>{throw new Error('should not import');}};
 assert.equal(await migrateLocalProfile(client,storage({}),async()=> ''),false);
 assert.equal(await migrateLocalProfile(client,storage({'top1-profile-v2':JSON.stringify({...JSON.parse(raw),demo:true})}),async()=> ''),false);
});
test('corrupt storage survives migration failure',async()=>{
 const local=storage({'top1-profile-v2':'not json'});
 await assert.rejects(migrateLocalProfile({rpc:async()=>({error:null})},local,async()=> 'id'));
 assert.equal(local.data.get('top1-profile-v2'),'not json');
});
test('demographic and strict metric validation rejects bad values',()=>{
 for(const age of [17,121,24.5,NaN])assert.throws(()=>normalizeDemographics({...JSON.parse(raw).demographics,age}));
 assert.throws(()=>normalizeDemographics({...JSON.parse(raw).demographics,weight:Infinity}));
 assert.throws(()=>normalizeValues({rhr:500},true));assert.throws(()=>normalizeValues({unknown:50},true));
 assert.deepEqual(normalizeValues({rhr:50,hrv:NaN,apob:null}),{rhr:50});
});
test('public usernames normalize and reject URL or markup injection',()=>{
 assert.equal(normalizeUsername('  Alex-32  '),'alex-32');
 for(const username of ['ab','<script>','a/b','a b','a'.repeat(31)])assert.throws(()=>normalizeUsername(username));
});
test('OAuth callback redirect stays on the same site',()=>{
 assert.equal(safeNextPath('/share/alex'),'/share/alex');
 for(const next of ['https://evil.test','//evil.test','/\\evil.test','/\r\nevil.test',null])assert.equal(safeNextPath(next),'/');
});
test('public score summaries contain aggregates without raw metrics',()=>{
 const profile=parseLocalProfile(raw)!;profile.values={sit_to_stand:25,total_sleep:480,pushups:25};const summary=buildPublicSummary(profile);
 assert.equal(summary.measured,3);assert.equal(summary.ready,true);
 assert.ok(!('values' in summary)&&!('submitted' in summary));assert.deepEqual(parsePublicSummary(summary),summary);
 assert.equal(parsePublicSummary({...summary,modelScore:1000}),null);assert.equal(parsePublicSummary({...summary,domains:{strength:NaN}}),null);
 assert.notEqual(radarPoints(summary.domains),radarPoints({}));assert.equal(radarPoints({}).split(' ').length,3);
});

test('migration never clears another stored snapshot or a concurrently edited one',async()=>{
 const personal=raw;const demo=JSON.stringify({...JSON.parse(raw),demo:true});
 const local=storage({'top1-profile-v2':demo,'top1_profile_v2':personal});
 assert.equal(await migrateLocalProfile({rpc:async()=>({error:null})},local,async()=> 'id'),true);
 assert.equal(local.data.get('top1-profile-v2'),demo);assert.equal(local.data.has('top1_profile_v2'),false);
 const changed=storage({'top1-profile-v2':personal});
 await assert.rejects(migrateLocalProfile({rpc:async()=>{changed.data.set('top1-profile-v2',personal+' ');return {error:null};}},changed,async()=> 'id'),/newer snapshot was retained/);
 assert.equal(changed.data.get('top1-profile-v2'),personal+' ');
});
