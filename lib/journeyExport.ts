import type {SupabaseClient} from '@supabase/supabase-js';

type ExportPage = {
  enabled:boolean; consentId:string|null; consentedAt:string|null; highWater:number;
  events: {seq:number}[]; nextAfter:number|null;
};
const pageSize = 250;
export async function beginJourneyExport(client:SupabaseClient) {
  async function load(after:number, limit = pageSize, through:number|null = null) {
    const {data,error} = await client.rpc('own_customer_journey_export', {p_after:after, p_limit:limit, p_through:through});
    if (error?.code === 'PGRST202') return null;
    if (error || !data || !Array.isArray(data.events) || !Number.isSafeInteger(data.highWater)) throw Error('Unable to read customer journey export.');
    return data as ExportPage;
  }
  const first = await load(0);
  function sameConsent(page:ExportPage|null) {
    if (page?.consentId !== first?.consentId || page?.enabled !== first?.enabled) throw Error('Journey sharing changed during export.');
  }
  return {
    preference: first ? {enabled:first.enabled, consentedAt:first.consentedAt} : null,
    part: {name:'customerJourney', async *pages() {
      if (!first) return;
      let page: ExportPage|null = first;
      let after = 0;
      while (page) {
        sameConsent(page);
        const rows = page.events.filter(row => row.seq <= first.highWater);
        yield rows;
        if (page.nextAfter === null || page.nextAfter >= first.highWater) return;
        if (!Number.isSafeInteger(page.nextAfter) || page.nextAfter <= after) throw Error('Invalid journey export cursor.');
        after = page.nextAfter;
        page = await load(after, pageSize, first.highWater);
        if (!page) throw Error('Journey export interrupted.');
      }
    }},
    verify: async () => { sameConsent(await load(0, 1)); }
  };
}
