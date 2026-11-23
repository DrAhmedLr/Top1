import assert from 'node:assert/strict';
import type {PGlite} from '@electric-sql/pglite';
import {createClient} from '@supabase/supabase-js';
import {activePlan,addDays,buildProgram,makeWorkout} from '../lib/adaptiveProgram';
import {createGuidedConfig,previewDatedProgram} from '../lib/datedProgram';
import {historyFields} from '../lib/metricLogRows';
import {accountPerformanceInsights} from '../lib/performanceInsightsServer';
import {accountGoalTracking,setGoalSharing} from '../lib/goalTrackingServer';
import type {TrainingEvent,TrainingMutation} from '../lib/training';

// Exercise the account reader with the project's migrations, row policies, RPCs
// and a real supabase-js query builder. Only the HTTP transport is local.
export async function testAccountInsights(db:PGlite){
 const alice=crypto.randomUUID(),bob=crypto.randomUUID(),secondSession=crypto.randomUUID();
 const today=new Date().toISOString().slice(0,10),startDay=addDays(today,-20);
 const config=createGuidedConfig({metric:'pushups',baseline:10,target:16,startDay,deadline:addDays(startDay,32),
   timeZone:'UTC',now:new Date(startDay+'T09:00:00Z')});
 const log:TrainingEvent[]=[];
 const rpc=async<T,>(sql:string,params:unknown[]=[])=> (await db.query<{value:T}>(sql,params)).rows[0].value;
 const transport:typeof fetch=async(input,options)=>{
  const url=new URL(String(input)),filter=(name:string)=>url.searchParams.get(name)?.replace(/^eq\./,'');
  let data:unknown;
  switch(url.pathname.split('/').at(-1)){
   case 'own_forecast_learning_export':data=await rpc('select public.own_forecast_learning_export() as value');break;
   case 'forecast_learning_evidence_batch':{
    const a=JSON.parse(String(options?.body));
    data=await rpc('select public.forecast_learning_evidence_batch($1,$2,$3) as value',[a.p_owner,a.p_capability,JSON.stringify(a.p_criteria)]);break;
   }
   case 'forecast_learning_evidence':{
    const a=JSON.parse(String(options?.body));
    data=await rpc('select public.forecast_learning_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9) as value',
      [a.p_owner,a.p_capability,a.p_metric,a.p_goal_unit,a.p_version,a.p_kind,a.p_horizon_days,a.p_relative_gap,a.p_probability]);break;
   }
   case 'forecast_learning_preference':{
    const a=JSON.parse(String(options?.body));
    data=await rpc('select public.forecast_learning_preference($1,$2) as value',[a.p_owner,a.p_enabled]);break;
   }
   case 'forecast_learning_sync':{
    const a=JSON.parse(String(options?.body));
    data=await rpc('select public.forecast_learning_sync($1,$2,$3,$4,$5,$6,$7) as value',
      [a.p_owner,a.p_capability,a.p_profile_revision,a.p_training_epoch,a.p_training_counter,JSON.stringify(a.p_forecast),JSON.stringify(a.p_outcomes)]);break;
   }
   case 'profiles':data=(await db.query('select age,sex,weight_kg,revision from public.profiles where id=$1',[filter('id')])).rows;break;
   case 'training_state':data=(await db.query('select epoch,counter from public.training_state where user_id=$1',[filter('user_id')])).rows;break;
   case 'read_training_page':data=await rpc('select public.read_training_page($1) as value',[JSON.parse(String(options?.body)).p_after]);break;
   case 'read_current_measurements':data=await rpc('select public.read_current_measurements() as value');break;
   case 'metric_logs':{
    assert.equal(url.searchParams.get('select'),historyFields);
    const before=url.searchParams.get('sequence')?.replace(/^lt\./,'')??null;
    data=(await db.query('select '+historyFields+' from public.metric_logs where user_id=$1 and metric_id=$2 and ($3::bigint is null or sequence<$3) order by sequence desc limit 250',[filter('user_id'),filter('metric_id'),before])).rows;
    break;
   }
   default:throw Error('Unexpected account reader request');
  }
  return Response.json(data);
 };
 const client=createClient('https://fixture.invalid','local-public-key',{global:{fetch:transport},auth:{persistSession:false,autoRefreshToken:false}});
 const signIn=async(owner:string,session:string)=>{
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:owner,session_id:session,role:'authenticated'})]);
  assert.equal(await rpc('select public.active_account_session() as value'),true);
 };
 const save=(value:number,day:string,revision:number)=>rpc<number>(
  "select public.save_profile($1,$2,null,false,'{}',$3,$4) as value",[
   {age:32,sex:'male',weight:75},{pushups:value},
   {pushups:{measuredAt:day+'T08:00:00Z',method:'manual',protocol:{id:'strict_pushups_v1'}}},revision]);
 const write=async(kind:TrainingMutation['kind'],data:TrainingMutation['data'])=>{
  const event=await rpc<TrainingEvent>('select public.write_training($1) as value',[{version:1,kind,data,
    id:crypto.randomUUID(),requestId:crypto.randomUUID(),expectedRevision:0,epoch:0,deleted:false,reason:''}]);
  log.push(event);return event;
 };

 const previousKey=process.env.TOP1_GOAL_TRACKING_KEY;
 const fixtureKey=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
 process.env.TOP1_GOAL_TRACKING_KEY=fixtureKey;
 await db.exec('begin');
 try{
  await db.query("insert into private.forecast_writer values(true,sha256(convert_to($1,'UTF8')))",[fixtureKey]);
  await db.query('insert into auth.users(id) values($1),($2)',[alice,bob]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[secondSession,alice]);
  await db.exec('set local role authenticated');
  await signIn(alice,alice);
  let revision=await save(10,startDay,0);
  await write('program',buildProgram(config,'UTC'));
  const initial=await accountPerformanceInsights(client,alice);
  assert.equal(initial.goal?.current,10);
  assert.equal(initial.goal?.adherence?.kind,'illustrative');
  assert.equal(initial.goal?.adherence?.intervals,0);
  await signIn(alice,secondSession);
  assert.deepEqual(await accountPerformanceInsights(client,alice),initial);
  let tests=0;
  for(const week of previewDatedProgram(config,'UTC').weeks){
   for(const session of week.sessions){
    if(session.date>=today)continue;
    if(session.kind==='retest'){
     revision=await save(11+tests,session.date,revision);tests++;
    }else{
     const at=new Date(session.date+'T13:00:00Z');
     await write('workout',makeWorkout(activePlan(log)!,session.date,{...session,minutes:session.estimatedMinutes},at));
    }
   }
  }
  await signIn(alice,alice);
  const final=await accountPerformanceInsights(client,alice);
  assert.equal(tests,3);assert.equal(final.goal?.current,13);
  assert.equal(final.goal?.adherence?.kind,'personal');assert.equal(final.goal?.adherence?.intervals,3);
  assert.equal(final.goal?.recentPace?.kind,'ready');
  await accountGoalTracking(client,alice);
  await accountGoalTracking(client,alice);
  const aliceIssues=await rpc<{forecasts:{version:string;probability:number}[]}>('select public.own_forecast_learning_export() as value');
  const paceIssue=aliceIssues.forecasts.filter(f=>f.version==='guided-recent-pace-v1');
  assert.equal(paceIssue.length,1);
  if(final.goal?.recentPace?.kind==='ready')assert.equal(paceIssue[0].probability,final.goal.recentPace.probability);
  await db.exec('savepoint stale_device');
  await assert.rejects(save(3,startDay,0),{code:'PT409'});
  await db.exec('rollback to savepoint stale_device');
  await signIn(bob,bob);
  const empty=await accountPerformanceInsights(client,bob);
  assert.equal(empty.goal,null);assert.equal(empty.performance.coverage,0);
  assert.ok(await save(68,startDay,0)>0);
  const other=await accountPerformanceInsights(client,bob);
  assert.equal(other.goal,null);assert.equal(other.performance.coverage,1);
  assert.notDeepEqual(other.performance,final.performance);
  // The ordinary server reader, Supabase client and private receipt store must
  // agree on the active attempt and its first forecast across subsequent visits.
  await setGoalSharing(client,bob,true);
  const tracked=createGuidedConfig({metric:'pushups',baseline:68,target:70,startDay:today,deadline:addDays(today,28),timeZone:'UTC'});
  await write('program',buildProgram(tracked,'UTC'));
  const beforeTest=await accountGoalTracking(client,bob);
  assert.equal(beforeTest.sharing,true);
  assert.equal(beforeTest.calibration,null);
  const first=beforeTest.attempts[0];
  assert.equal(first.status,'active');
  assert.ok(first.firstForecast && Number.isFinite(first.firstForecast.probability));
  assert.equal((await accountGoalTracking(client,bob)).attempts[0].firstForecast?.issuedAt,first.firstForecast.issuedAt);
  const measuredAt=new Date().toISOString();
  const revisionBob=await rpc<number>('select revision as value from public.profiles where id=$1',[bob]);
  await rpc("select public.save_profile($1,$2,null,false,'{}',$3,$4) as value",[{age:32,sex:'male',weight:75},{pushups:71},
    {pushups:{measuredAt,method:'manual',protocol:{id:'strict_pushups_v1'}}},revisionBob]);
  const afterTest=await accountGoalTracking(client,bob);
  assert.equal(afterTest.attempts[0].status,'reached');
  assert.deepEqual(afterTest.attempts[0].firstForecast,first.firstForecast);
  const exported=await rpc<{forecasts:{outcome:{status:string}|null}[]}>('select public.own_forecast_learning_export() as value');
  assert.equal(exported.forecasts[0]?.outcome?.status,'reached');
  // Two measured baselines in one explicit group must seal two prospective
  // receipts in the same write. A later retest resolves only its own metric.
  // Training fixture writes share one database transaction and transaction-start
  // time. The grouped baseline tests must predate that instant.
  const groupId=crypto.randomUUID(),baseTime=new Date(Date.now()-3600_000).toISOString();
  const freshRevision=await rpc<number>('select revision as value from public.profiles where id=$1',[bob]);
  const saveGroup=(pushups:number,pullups:number,revision:number,pushDate:string,pullDate:string)=>rpc<number>(
    "select public.save_profile($1,$2,null,false,'{}',$3,$4) as value",[{age:32,sex:'male',weight:75},{pushups,pullups},
    {pushups:{method:'manual',measuredAt:pushDate,protocol:{id:'strict_pushups_v1'}},
     pullups:{method:'manual',measuredAt:pullDate,protocol:{id:'strict_pullups_v1'}}},revision]);
  const groupRevision=await saveGroup(71,4,freshRevision,baseTime,baseTime);
  const makeGroupGoal=(metric:string,baseline:number,target:number)=>buildProgram({...createGuidedConfig({
   metric,baseline,target,startDay:today,deadline:addDays(today,28),timeZone:'UTC'}),groupId},'UTC');
  const groupMutations=[makeGroupGoal('pushups',71,74),makeGroupGoal('pullups',4,8)].map(data=>({
    kind:'program',version:1,id:crypto.randomUUID(),requestId:crypto.randomUUID(),expectedRevision:0,epoch:0,reason:'',deleted:false,data}));
  const beforeGroup=await rpc<number>('select counter as value from public.training_state where user_id=$1',[bob]);
  const [pushGoal,pullGoal]=await rpc<TrainingEvent[]>('select public.write_training_batch($1,$2) as value',[JSON.stringify(groupMutations),beforeGroup]);
  const groupCounter=await rpc<number>('select counter as value from public.training_state where user_id=$1',[bob]);
  const issue=(planId:string,metric:string)=>({planId,revision:1,metric,goalUnit:'metric',target:74,deadline:addDays(today,28),
    timeZone:'UTC',version:'invalid-second-member-test',kind:'illustrative',probability:.5,horizonDays:28,relativeGap:.1});
  await db.exec('savepoint incomplete_forecast_group');
  await assert.rejects(rpc('select public.forecast_learning_sync($1,$2,$3,0,$4,$5,$6) as value',
    [bob,fixtureKey,groupRevision,groupCounter,JSON.stringify([issue(pushGoal.id,'pushups'),issue(crypto.randomUUID(),'pullups')]),'[]']),{code:'PT409'});
  await db.exec('rollback to savepoint incomplete_forecast_group');
  const beforeCapture=await rpc<{forecasts:{planId:string}[]}>('select public.own_forecast_learning_export() as value');
  assert.ok(!beforeCapture.forecasts.some(f=>f.planId===pushGoal.id));
  const groupSnapshot=await accountGoalTracking(client,bob);
  const grouped=groupSnapshot.attempts.filter(a=>a.groupId===groupId);
  assert.equal(grouped.length,2);
  assert.deepEqual(grouped.map(a=>[a.metric,a.status,!!a.baselineMeasuredAt,a.firstForecast?.kind]).sort(),
    [['pullups','active',true,'illustrative'],['pushups','active',true,'illustrative']]);
  const selected=await accountPerformanceInsights(client,bob,pullGoal.id);
  assert.equal(selected.goal?.planId,pullGoal.id);
  assert.equal(selected.goal?.metric,'pullups');
  await assert.rejects(accountPerformanceInsights(client,bob,crypto.randomUUID()));
  const groupedReceipts=await rpc<{forecasts:{planId:string;version:string}[]}>('select public.own_forecast_learning_export() as value');
  assert.equal(groupedReceipts.forecasts.filter(f=>f.version==='guided-group-adherence-v1').length,2);
  await saveGroup(74,4,groupRevision,new Date().toISOString(),baseTime);
  const separate=await accountGoalTracking(client,bob);
  assert.equal(separate.attempts.find(a=>a.planId===pushGoal.id)?.status,'reached');
  assert.equal(separate.attempts.find(a=>a.planId===pullGoal.id)?.status,'active');
  const contributions=await rpc<{forecasts:{planId:string;sharedProgress?:{status:string}}[]}>('select public.own_forecast_learning_export() as value');
  assert.equal(contributions.forecasts.find(f=>f.planId===pushGoal.id)?.sharedProgress?.status,'reached');
  assert.equal(contributions.forecasts.find(f=>f.planId===pullGoal.id)?.sharedProgress?.status,'active');
  assert.equal(await setGoalSharing(client,bob,false),false);
  const bobsSavedInsights=await accountPerformanceInsights(client,bob);
  await signIn(alice,secondSession);
  assert.deepEqual(await accountPerformanceInsights(client,alice),final);
  // The Auth service deletes its own auth.users row without application table
  // privileges. Running this as the database owner hides cascade-trigger failures.
  await db.exec('reset role; create role supabase_auth_admin; grant usage on schema auth to supabase_auth_admin; grant select,delete on auth.users to supabase_auth_admin');
  const sample=await rpc<string>('select id as value from public.metric_logs where user_id=$1 limit 1',[alice]);
  const prior=await rpc<number>('select revision as value from public.profiles where id=$1',[alice]);
  await db.exec('savepoint ordinary_delete');
  await db.query('delete from public.metric_logs where id=$1',[sample]);
  assert.ok(await rpc<number>('select revision as value from public.profiles where id=$1',[alice])>prior);
  await db.exec('rollback to savepoint ordinary_delete');
  // Exercise the invoker identity recorded by hosted Postgres when its FK
  // cascade reaches the metric-log trigger. These test-only grants roll back.
  await db.exec(`savepoint auth_trigger;
    grant delete,select(id) on public.metric_logs to supabase_auth_admin;
    create policy fixture_delete on public.metric_logs for delete to supabase_auth_admin using(user_id=auth.uid());
    create policy fixture_read on public.metric_logs for select to supabase_auth_admin using(user_id=auth.uid());
    set local role supabase_auth_admin`);
  assert.equal(await rpc("select has_table_privilege(current_user,'public.profiles','update') as value"),false);
  assert.equal((await db.query('delete from public.metric_logs where id=$1 returning id',[sample])).rows.length,1);
  await db.exec('rollback to savepoint auth_trigger; set local role supabase_auth_admin');
  await db.query('delete from auth.users where id=$1',[alice]);
  await db.exec('reset role');
  for(const [table,column] of [['auth.users','id'],['auth.sessions','user_id'],['public.profiles','id'],['public.metric_logs','user_id'],['public.training_events','user_id']]){
   assert.equal(await rpc('select count(*)::integer as value from '+table+' where '+column+'=$1',[alice]),0);
  }
  await db.exec('set local role authenticated');
  await signIn(bob,bob);
  assert.deepEqual(await accountPerformanceInsights(client,bob),bobsSavedInsights);
 }finally{
  if (previousKey===undefined) delete process.env.TOP1_GOAL_TRACKING_KEY; else process.env.TOP1_GOAL_TRACKING_KEY=previousKey;
  await db.exec('rollback');
 }
}
