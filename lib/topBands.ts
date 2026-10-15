/** Product display bands, not a population model or a claim of statistical precision. */
export const TOP_BAND_EDGES=[1,2.5,5,7.5,10,15,20,25,30,35,45,55,65] as const;
export type TopBand={kind:'best'|'range'|'lower'|'upper';from:number;to:number};
/** Enclose the entire published percentile interval. Never invent finer quantiles.
 * Extreme open tails retain an open label: a P90 threshold supports Top 10% or
 * better, not a fabricated Top 1% assignment. */
export function topBandForThresholds(value:number,thresholds:readonly {percentile:number;value:number}[]):TopBand|null{
 if(!Number.isFinite(value)||thresholds.length<2)return null;
 const points=[...thresholds].sort((a,b)=>a.percentile-b.percentile);
 if(points.some((p,i)=>!Number.isFinite(p.value)||!Number.isFinite(p.percentile)||p.percentile<=0||p.percentile>=100||(i>0&&(p.percentile<=points[i-1].percentile||p.value<=points[i-1].value))))return null;
 const next=points.findIndex(p=>p.value>value),at=points.findIndex(p=>p.value===value);
 // Rounded values at a threshold belong to either adjacent interval.
 const low=at>=0?(points[at-1]?.percentile??0):next===-1?points.at(-1)!.percentile:points[next-1]?.percentile??0;
 const high=at>=0?(points[at+1]?.percentile??100):next===-1?100:points[next].percentile;
 const topLow=100-high,topHigh=100-low;
 if(topHigh<=1)return {kind:'best',from:0,to:1};
 if(topLow>=65)return {kind:'lower',from:65,to:100};
 if(topLow===0)return {kind:'upper',from:0,to:TOP_BAND_EDGES.find(edge=>edge>=topHigh)??100};
 const from=[...TOP_BAND_EDGES].reverse().find(edge=>edge<=topLow)??0;
 const to=TOP_BAND_EDGES.find(edge=>edge>=topHigh)??100;
 return {kind:'range',from,to};
}
