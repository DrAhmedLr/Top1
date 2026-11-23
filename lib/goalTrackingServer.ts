import type {AdaptivePlan} from './adaptiveProgram';
import type {SupabaseClient} from '@supabase/supabase-js';
import {calibratedGoalProbability,type CalibrationEvidence} from './goalCalibration';
import {postIssueAdherence,replayGoalAttempts,type GoalAttempt} from './goalAttempts';
import {daysBetween} from './guidedSchedule';
import {InsightsChanged,readAccountInsightSnapshot} from './performanceInsightsServer';
import type {GoalCalibration,GoalTracking,IssuedGoalForecast} from './goalTrackingTypes';

type Snapshot=Awaited<ReturnType<typeof readAccountInsightSnapshot>>;

function forecastAtIssue(snapshot:Snapshot,plan:AdaptivePlan,attempt:GoalAttempt|undefined) {
  if(plan.config.guidedVersion!==1 || !attempt || attempt.status!=='active' || attempt.deadlineMissCandidate || !attempt.baselineMeasuredAt)return null;
  const {goal,today}=snapshot.goalFor(plan);
  if(!goal?.adherence)return null;
  const horizonDays=daysBetween(today,attempt.deadline);
  if (horizonDays<1 || goal.adherence.sessions<1) return null;
  return {planId:attempt.planId,revision:attempt.revision,metric:attempt.metric,goalUnit:attempt.goalUnit,
    target:attempt.target,deadline:attempt.deadline,timeZone:attempt.timeZone,horizonDays,
    relativeGap:Math.abs(attempt.target-goal.current)/Math.max(1,Math.abs(goal.current)),
    recentProbability:goal.recentPace?.kind==='ready'?goal.recentPace.probability:null,
    version:plan.config.groupId?'guided-group-adherence-v1':'guided-adherence-v1',kind:goal.adherence.kind,probability:goal.adherence.probability};
}

type Forecast=NonNullable<ReturnType<typeof forecastAtIssue>>;
async function readCalibrations(client:SupabaseClient,owner:string,key:string,forecasts:Forecast[],plans:AdaptivePlan[]) {
  const results=new Map<string,GoalCalibration>();
  if(!forecasts.length)return results;
  let evidence:Record<string,CalibrationEvidence|null>;
  if(forecasts.length===1){
    const f=forecasts[0];
    const {data,error}=await client.rpc('forecast_learning_evidence',{p_owner:owner,p_capability:key,
      p_metric:f.metric,p_goal_unit:f.goalUnit,p_version:f.version,p_kind:f.kind,
      p_horizon_days:f.horizonDays,p_relative_gap:f.relativeGap,p_probability:f.probability});
    if(error)throw Error('Forecast comparison unavailable');
    evidence={[f.planId]:data};
  }else{
    const {data,error}=await client.rpc('forecast_learning_evidence_batch',{p_owner:owner,p_capability:key,p_criteria:forecasts});
    if(error||!data)throw Error('Forecast comparisons unavailable');
    evidence=data;
  }
  const revisions=new Map(plans.map(plan=>[plan.event.id,plan.event.revision]));
  for(const f of forecasts){
    const adjustment=calibratedGoalProbability(f.probability,evidence[f.planId]??null);
    if(adjustment)results.set(f.planId,{...adjustment,planId:f.planId,revision:revisions.get(f.planId)!});
  }
  return results;
}

export async function currentGoalCalibration(client:SupabaseClient,owner:string,snapshot:Snapshot) {
  const key=process.env.TOP1_GOAL_TRACKING_KEY,plan=snapshot.training.plan;
  if (!key || plan?.config.guidedVersion!==1) return null;
  const attempts=replayGoalAttempts(snapshot.training.events,snapshot.entries,snapshot.asOf);
  const forecast=forecastAtIssue(snapshot,plan,attempts.find(a=>a.planId===plan.event.id));
  if(!forecast)return null;
  return (await readCalibrations(client,owner,key,[forecast],[plan])).get(plan.event.id)??null;
}

type StoredReceipt={planId:string;revision:number;version:string;kind:IssuedGoalForecast['kind'];issuedAt:string};
type Exposure=Pick<StoredReceipt,'kind'|'version'|'issuedAt'> & {due:number;completed:number};

function outcome(attempt:GoalAttempt,afterIssue:Exposure[]) {
  const candidate=attempt.deadlineMissCandidate;
  const {completed,due,planned}=candidate ?? attempt.adherence;
  return {planId:attempt.planId,revision:attempt.revision,status:candidate?'missed':attempt.status,
    measuredAt:candidate?.measuredAt ?? attempt.terminalMeasuredAt,resolvedAt:candidate?.resolvedAt ?? attempt.resolvedAt,
    baselineRecordedAt:attempt.baselineRecordedAt,completed,due,planned,afterIssue};
}

export async function setGoalSharing(client:SupabaseClient,owner:string,enabled:boolean) {
  if (enabled && !process.env.TOP1_GOAL_TRACKING_KEY) throw Error('Forecast sharing is not configured');
  const {data,error}=await client.rpc('forecast_learning_preference',{p_owner:owner,p_enabled:enabled});
  if (error || typeof data!=='boolean') throw Error('Unable to save forecast sharing');
  return data;
}

async function reconcile(client:SupabaseClient,owner:string):Promise<GoalTracking> {
  const snapshot=await readAccountInsightSnapshot(client,owner,true);
  const attempts=replayGoalAttempts(snapshot.training.events,snapshot.entries,snapshot.asOf);
  const key=process.env.TOP1_GOAL_TRACKING_KEY;
  if (!key) {
    // Local installs can track a person's real deadlines and workouts without
    // credentials for writing prospective receipts or publishing contributions.
    return {owner,sharing:false,sharingAvailable:false,calibration:null,
      attempts:attempts.map(({deadlineMissCandidate,...attempt})=>attempt)};
  }
  const {plans,plan}=snapshot.training;
  // Replays are newest first. Edited goals issue against their current opening revision.
  const latest=new Map<string,GoalAttempt>();
  for(const attempt of attempts)if(!latest.has(attempt.planId))latest.set(attempt.planId,attempt);
  const forecasts=plans.map(p=>forecastAtIssue(snapshot,p,latest.get(p.event.id))).filter((f):f is Forecast=>f!==null);
  const terminal=attempts.some(a=>a.programKind==='guided' && (a.deadlineMissCandidate || a.status==='reached' || a.status==='missed'));
  const [calibrations,receipts]=await Promise.all([
    readCalibrations(client,owner,key,forecasts,plans).catch(()=>new Map<string,GoalCalibration>()),
    terminal ? client.rpc('own_forecast_learning_export') : Promise.resolve({data:{forecasts:[]},error:null}),
  ]);
  if (receipts.error || !Array.isArray(receipts.data?.forecasts)) throw Error('Forecast history unavailable');
  const stored:StoredReceipt[]=receipts.data.forecasts;
  const exposure=postIssueAdherence(snapshot.training.events,attempts,stored,snapshot.asOf);
  const byAttempt=new Map<string,Exposure[]>();
  for (const {planId,revision,kind,issuedAt,version:issuedVersion} of stored) {
    const id=`${planId}/${revision}`;
    const counts=exposure.get(`${id}/${issuedAt}`);
    if (!counts) continue;
    const list=byAttempt.get(id) ?? [];
    list.push({kind,version:issuedVersion,issuedAt,...counts});
    byAttempt.set(id,list);
  }
  const toIssue=forecasts.map(({recentProbability,...f})=>({...f,issuedProbability:calibrations.get(f.planId)?.probability??f.probability}));
  const paceIssues=forecasts.flatMap(({recentProbability,...f})=>recentProbability===null?[]:[{...f,
    version:f.version==='guided-group-adherence-v1'?'guided-group-recent-pace-v1':'guided-recent-pace-v1',
    kind:'personal' as const,probability:recentProbability,issuedProbability:recentProbability}]);
  const replay={p_owner:owner,p_capability:key,
    p_profile_revision:snapshot.profileRevision,p_training_epoch:snapshot.training.epoch,p_training_counter:snapshot.training.counter,
    p_outcomes:attempts.filter(a=>a.programKind==='guided').map(a=>outcome(a,byAttempt.get(`${a.planId}/${a.revision}`) ?? []))};
  // The database accepts one receipt per goal in each call. Each forecast family
  // uses the same snapshot and full outcome replay. Reconciliation is retry-safe.
  async function record(issues:typeof toIssue) {
    const {data,error}=await client.rpc('forecast_learning_sync',{...replay,p_forecast:issues.length>1?issues:issues[0]??null});
    if(error?.code==='PT409'||error?.code==='40001') throw new InsightsChanged();
    if(error||typeof data?.enabled!=='boolean') throw Error('Unable to record goal evidence');
    return data;
  }
  const data=await record(toIssue);
  if(paceIssues.length) await record(paceIssues);
  const issued=new Map<string,IssuedGoalForecast>();
  for (const row of data.firstForecasts ?? []) {
    issued.set(`${row.planId}/${row.revision}`,{probability:row.probability,kind:row.kind,issuedAt:row.issuedAt});
  }
  return {owner,sharing:data.enabled,sharingAvailable:true,calibration:plan?calibrations.get(plan.event.id)??null:null,calibrations:[...calibrations.values()],attempts:attempts.map(({deadlineMissCandidate,...attempt})=>
    ({...attempt,firstForecast:issued.get(`${attempt.planId}/${attempt.revision}`)}))};
}

export async function accountGoalTracking(client:SupabaseClient,owner:string) {
  try { return await reconcile(client,owner); }
  catch (error) {
    if (error instanceof InsightsChanged) return reconcile(client,owner);
    throw error;
  }
}

/** The source-of-truth write is already committed. A later reconciliation can
 * recover a failed capture but cannot backdate a forecast. SQL excludes stale labels. */
export async function reconcileAfterGoalWrite(client:SupabaseClient,owner:string) {
  if (!process.env.TOP1_GOAL_TRACKING_KEY) return;
  try { await reconcile(client,owner); }
  catch {
    // Retry using fresh revisions after a competing save or transient network failure.
    try { await reconcile(client,owner); }
    catch { console.warn('TOP1 could not reconcile goal evidence after a saved change.'); }
  }
}
