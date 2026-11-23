'use server';

import type {CustomerDirectory, CustomerJourney} from '@/lib/customerJourneyTypes';
import {getOperator} from './access';

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
type Result<T> = {data:T;error?:never}|{data?:never;error:string};

export async function searchCustomers(days:number, search:string, after:string|null):Promise<Result<CustomerDirectory>> {
  if (![7,30,90].includes(days) || typeof search!=='string' || search.length>120 || (after!==null && (typeof after!=='string' || !uuid.test(after)))) {
    return {error:'Invalid search. Check the search field and try again.'};
  }
  const access = await getOperator();
  if (access.state!=='ready') return {error:'Access changed. Reload the admin panel to sign in again.'};
  const {data,error} = await access.client.rpc('admin_customer_directory', {p_days:days,p_search:search.trim(),p_after:after});
  return error || !data ? {error:'Could not load customers. Try the search again.'} : {data:data as CustomerDirectory};
}

export async function readTimeline(customer:string,days:number,before:number|null):Promise<Result<CustomerJourney>> {
  if (typeof customer!=='string' || !uuid.test(customer) || ![7,30,90].includes(days) || (before!==null && (!Number.isSafeInteger(before) || before<=0))) {
    return {error:'Invalid timeline request. Reload the page.'};
  }
  const access = await getOperator();
  if (access.state!=='ready') return {error:'Access changed. Reload the admin panel to sign in again.'};
  const {data,error} = await access.client.rpc('admin_customer_journey', {p_customer:customer,p_days:days,p_before:before});
  return error || !data ? {error:'Could not load this timeline page. Reload to verify access.'} : {data:data as CustomerJourney};
}
