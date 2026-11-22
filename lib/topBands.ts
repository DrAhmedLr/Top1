/** Product display bands, not a population model or a claim of statistical precision. */
export const TOP_BAND_EDGES=[1,2.5,5,7.5,10,15,20,25,30,35,45,55,65] as const;
export type TopBand={kind:'range'|'lower'|'upper';from:number;to:number};
/** Enclose the entire published percentile interval. Never invent finer quantiles.
 * Extreme open tails retain an open label: a P90 threshold supports Top 10% or
 * better, not a fabricated Top 1% assignment. */
export function topBandForThresholds(value:number,thresholds:readonly {percentile:number;value:number}[],direction:1|-1=1):TopBand|null{
 if(!Number.isFinite(value)||thresholds.length<2)return null;
 const points=thresholds.map(point=>({percentile:point.percentile,value:direction*point.value}));
 if(points.some((p,i)=>!Number.isFinite(p.value)||!Number.isFinite(p.percentile)||p.percentile<=0||p.percentile>=100||(i>0&&(p.percentile<=points[i-1].percentile||p.value<=points[i-1].value))))return null;
 const next=points.findIndex(p=>p.value>direction*value),at=points.findIndex(p=>p.value===direction*value);
 // Rounded values at a threshold belong to either adjacent interval.
 const low=at>=0?(points[at-1]?.percentile??0):next===-1?points.at(-1)!.percentile:points[next-1]?.percentile??0;
 const high=at>=0?(points[at+1]?.percentile??100):next===-1?100:points[next].percentile;
 // Round only floating point subtraction noise, independently of game tier edges.
 const from=Number((100-high).toPrecision(12)),to=Number((100-low).toPrecision(12));
 if(from===0&&to<100)return {kind:'upper',from,to};
 if(to===100&&from>0)return {kind:'lower',from,to};
 return {kind:'range',from,to};
}
