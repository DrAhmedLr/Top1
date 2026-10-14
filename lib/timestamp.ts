/** Strict calendar timestamp shared by scoring, storage and freshness display. */
export function normalizeTimestamp(input:unknown):string{
 if(typeof input!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input)||!Number.isFinite(Date.parse(input)))throw new Error('Use an ISO timestamp with a timezone.');
 const year=Number(input.slice(0,4)),month=Number(input.slice(5,7)),day=Number(input.slice(8,10));
 const monthEnd=new Date(0);monthEnd.setUTCFullYear(year,month,0);
 if(year<1||month<1||month>12||day<1||day>monthEnd.getUTCDate()||Number(input.slice(11,13))>23||Number(input.slice(14,16))>59||Number(input.slice(17,19))>59)throw new Error('Invalid measurement date.');
 return new Date(input).toISOString();
}
