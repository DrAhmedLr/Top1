'use client';
import {useEffect, useMemo, useState} from 'react';
import {accountReadOptions} from '../accountSession';
import {savedGoalCalibration} from '../goalTrackingDisplay';
import type {GoalCalibration} from '../goalTrackingTypes';
import type {Observation} from '../history';
import {goalDate} from '../personalGoal';
import {performanceInsights, type InsightInputs, type PerformanceInsights} from '../performanceInsights';

type Inputs = Omit<InsightInputs,'entries'> & {owner:string; revision:number; guestEntries:Observation[]; enabled?:boolean};

export function usePerformanceInsights({owner, revision, values, details, profile, plan, guestEntries, today, enabled=true}:Inputs) {
  const [attempt,setAttempt] = useState(0);
  const [remote,setRemote] = useState<{key:string;data?:PerformanceInsights;calibration?:GoalCalibration;failed:boolean}>();
  const latestSession = plan?.sessions.reduce((sequence,event)=>Math.max(sequence,event.sequence),0);
  const key = JSON.stringify([owner, revision, plan?.event.id, plan?.event.sequence, latestSession, plan?.sessions.length, today, attempt]);
  const active = enabled && goalDate(today);
  useEffect(() => {
    if (!active || owner === 'guest') return;
    const controller = new AbortController();
    async function read() {
      const options = accountReadOptions(owner, controller.signal);
      const path=plan ? '/api/performance-insights?plan='+encodeURIComponent(plan.event.id) : '/api/performance-insights';
      let response = await fetch(path, options);
      if (response.status === 409) response = await fetch(path, options);
      if (!response.ok) throw Error('Insights unavailable');
      const result = await response.json();
      if (result.owner !== owner || !result.data?.performance || !result.data.version || plan && result.data.goal?.planId!==plan.event.id) throw Error('Invalid insights');
      if (!controller.signal.aborted) setRemote({key,data:result.data,calibration:result.calibration??undefined,failed:false});
    }
    void read().catch(() => {if (!controller.signal.aborted) setRemote({key,failed:true});});
    return () => controller.abort();
  }, [active,key,owner]);
  useEffect(()=>{
    if(!active||owner==='guest')return;
    const refresh=()=>setAttempt(n=>n+1);
    window.addEventListener('top1-goal-sharing-changed',refresh);
    return ()=>window.removeEventListener('top1-goal-sharing-changed',refresh);
  },[owner,active]);
  const local = useMemo(() => active && owner === 'guest' ? performanceInsights({values,details,profile,plan,entries:guestEntries,today}) : undefined,
    [active,owner,values,details,profile,plan,guestEntries,today]);
  const current = active && remote?.key === key ? remote : undefined;
  const calibration=savedGoalCalibration(current?.calibration,plan,current?.data?.goal?.adherence?.probability);
  return {data:owner === 'guest' ? local : current?.data,calibration, loading:active && owner !== 'guest' && !current, failed:!!current?.failed,
    retry:() => setAttempt(value => value + 1)};
}
