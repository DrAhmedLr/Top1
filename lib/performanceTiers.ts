import {TOP_BAND_EDGES,type TopBand} from './topBands';
import {PERFORMANCE_RANK_FLOOR} from './performanceRules';

const numericDisplay={useGrouping:false,maximumSignificantDigits:3} as const;
const tierDisplay=new Intl.NumberFormat('en-US',numericDisplay);

/** Keep the normal numeric notation in every supported locale, including for
 * game tiers. The input is already in percentage units. */
export function formatGamePercent(percent:number,locale:string) {
  return new Intl.NumberFormat(locale,numericDisplay).format(percent);
}

// Repeat the same four milestones in each lower decade. Normalizing a few
// insignificant floating-point digits keeps exact anchors in their own tier.
const rareSteps=[1,2.5,5,7.5,10] as const;
function rareBounds(percent:number) {
  const rounded=Number(percent.toPrecision(13));
  const unit=10**Math.floor(Math.log10(rounded));
  const withinDecade=Number((rounded/unit).toPrecision(13));
  const index=rareSteps.findIndex(step=>step>=withinDecade);
  return {from:(rareSteps[index-1]??.75)*unit,to:rareSteps[index]*unit};
}

export function performanceTier(percent:number):string {
  if(!Number.isFinite(percent)||percent<=0||percent>100)throw new RangeError('Game percentage must be above zero and at most 100.');
  const rounded=Number(percent.toPrecision(13));
  if(rounded>65)return '65%+';
  const edge=rounded<1?rareBounds(rounded).to:TOP_BAND_EDGES.find(candidate=>candidate>=rounded)!;
  return tierDisplay.format(edge)+'%';
}

export function performanceTierBand(tier:string):TopBand|null {
  if(tier==='65%+')return {kind:'lower',from:65,to:100};
  if(!/^\d+(?:\.\d+)?%$/.test(tier))return null;
  const edge=Number(tier.slice(0,-1));
  if(!Number.isFinite(edge)||edge<=0||edge>65||performanceTier(edge)!==tier)return null;
  if(edge===PERFORMANCE_RANK_FLOOR)return {kind:'upper',from:0,to:edge};
  if(edge<=1)return {kind:'range',from:Number(rareBounds(edge).from.toPrecision(13)),to:edge};
  const index=TOP_BAND_EDGES.findIndex(candidate=>candidate===edge);
  return {kind:'range',from:TOP_BAND_EDGES[index-1],to:edge};
}
