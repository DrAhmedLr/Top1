import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {beginJourneyExport} from './journeyExport';

test('account export freezes the last eligible event and detects withdrawn or replaced consent',async()=>{
  let consentId='first';
  const calls: number[]=[];
  const client={rpc:async(_rpc:string,{p_after,p_through}:{p_after:number;p_through:number|null})=>{
    if(p_through!==null)calls.push(p_through);
    return {data:{highWater:p_after?9:2,enabled:true,consentId,consentedAt:'2026-11-22',events:p_after?[{seq:2}]:[{seq:1}],nextAfter:p_after?null:1},error:null};
  }} as unknown as SupabaseClient;
  const data=await beginJourneyExport(client), exported=[];
  for await (const page of data.part.pages()) exported.push(...page);
  assert.deepEqual(exported,[{seq:1},{seq:2}]); assert.deepEqual(calls,[2]);
  consentId='replacement';
  await assert.rejects(data.verify(),/sharing changed/);
});
