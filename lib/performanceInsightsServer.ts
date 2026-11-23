import type {SupabaseClient} from '@supabase/supabase-js';
import {currentAdaptivePlans, dayInZone, type AdaptivePlan} from './adaptiveProgram';
import {historyFields, toEntries} from './metricLogRows';
import type {Observation} from './history';
import {normalizeMeasurementMetadata} from './measurementMetadata';
import {performanceInsights} from './performanceInsights';
import {goalAttemptMetrics} from './goalAttempts';
import {normalizeDemographics, normalizeValues} from './profile';
import type {TrainingEvent} from './training';

export class InsightsChanged extends Error {}
export class InactiveGoal extends Error {}

async function readPlan(client:SupabaseClient) {
  let cursor = 0;
  let epoch:number|undefined, counter:number|undefined;
  const events:TrainingEvent[] = [];
  while (true) {
    const {data, error} = await client.rpc('read_training_page', {p_after:cursor});
    if (error || !Array.isArray(data?.events)) throw Error('Training unavailable');
    if (epoch !== undefined && (epoch !== data.epoch || counter !== data.counter)) throw new InsightsChanged();
    epoch = Number(data.epoch);
    counter = Number(data.counter);
    events.push(...data.events as TrainingEvent[]);
    if (data.next === null) break;
    if (!Number.isSafeInteger(data.next) || data.next <= cursor) throw Error('Invalid training cursor');
    cursor = data.next;
  }
  return {events,plans:currentAdaptivePlans(events), epoch:epoch ?? 0, counter:counter ?? 0};
}

async function readGoalHistory(client:SupabaseClient, owner:string, metric:string) {
  const rows:Observation[] = [];
  let cursor:number|undefined;
  while (true) {
    let query = client.from('metric_logs').select(historyFields).eq('user_id',owner).eq('metric_id',metric)
      .order('sequence',{ascending:false}).limit(250);
    if (cursor !== undefined) query = query.lt('sequence', cursor);
    const {data, error} = await query;
    if (error) throw Error('History unavailable');
    const batch = toEntries(data ?? []);
    rows.push(...batch);
    if (batch.length < 250 || batch.some(entry => entry.cleared)) return rows;
    const next = batch.at(-1)?.sequence;
    if (next === undefined || !Number.isSafeInteger(next) || cursor !== undefined && next >= cursor) throw Error('Invalid history cursor');
    cursor = next;
  }
}

export async function readAccountInsightSnapshot(client:SupabaseClient, owner:string, includePastGoals=false,selectedPlanId?:string) {
  const profileQuery = () => client.from('profiles').select('age,sex,weight_kg,revision').eq('id',owner).maybeSingle();
  const [profileRow, ledger] = await Promise.all([profileQuery(), readPlan(client)]);
  if (profileRow.error) throw Error('Profile unavailable');
  const plan=selectedPlanId ? ledger.plans.find(p=>p.event.id===selectedPlanId) : ledger.plans[0];
  if(selectedPlanId&&!plan)throw new InactiveGoal();
  const training={...ledger,plan:plan??null};
  const metrics=new Set(includePastGoals ? goalAttemptMetrics(training.events) : []);
  if (plan) metrics.add(plan.config.metric);
  const [measurements, histories] = await Promise.all([
    client.rpc('read_current_measurements'),
    Promise.all([...metrics].map(metric=>readGoalHistory(client,owner,metric))),
  ]);
  if (measurements.error) throw Error('Measurements unavailable');
  const [profileCheck, trainingCheck] = await Promise.all([profileQuery(),
    client.from('training_state').select('epoch,counter').eq('user_id',owner).maybeSingle()]);
  if (profileCheck.error || trainingCheck.error) throw Error('Snapshot unavailable');
  if (profileCheck.data?.revision !== profileRow.data?.revision ||
      Number(trainingCheck.data?.epoch ?? 0) !== training.epoch ||
      Number(trainingCheck.data?.counter ?? 0) !== training.counter) throw new InsightsChanged();
  const row = profileRow.data;
  const now = new Date();
  const values = normalizeValues(row ? measurements.data?.values ?? {} : {});
  const hasProfile = row && (Number(row.revision)>0 || Object.keys(values).length>0);
  const entries=histories.flat();
  const byMetric=new Map([...metrics].map((metric,i)=>[metric,histories[i]]));
  const facts={values,details:normalizeMeasurementMetadata(measurements.data?.details,{legacy:true}),
    profile:hasProfile ? normalizeDemographics({age:row.age,sex:row.sex,weight:row.weight_kg==null?undefined:Number(row.weight_kg)}) : undefined,
    now:now.getTime()};
  const dayFor=(item:AdaptivePlan|null)=>dayInZone(now,item?.event.data.timeZone??'UTC');
  const today=dayFor(training.plan);
  const insights=performanceInsights({...facts,entries:plan?byMetric.get(plan.config.metric)??[]:[],plan,today});
  const perGoal=new Map<string,{goal:typeof insights.goal;today:string}>();
  if(plan)perGoal.set(plan.event.id,{goal:insights.goal,today});
  function goalFor(item:AdaptivePlan){
    const cached=perGoal.get(item.event.id);
    if(cached)return cached;
    const localDay=dayFor(item);
    const {goal}=performanceInsights({...facts,entries:byMetric.get(item.config.metric)??[],plan:item,today:localDay},insights.performance);
    const result={goal,today:localDay};perGoal.set(item.event.id,result);return result;
  }
  return {training,entries,insights,goalFor,profileRevision:Number(row?.revision ?? 0),asOf:now.getTime(),today};
}

export const accountPerformanceInsights = async (client:SupabaseClient,owner:string,selectedPlanId?:string) =>
  (await readAccountInsightSnapshot(client,owner,false,selectedPlanId)).insights;
