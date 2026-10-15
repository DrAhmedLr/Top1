import {cdf,type evaluate} from './engine';
import {TOP_BAND_EDGES} from './topBands';
/** Illustrative normal-model position, NOT an empirical population percentile.
 * This is a game display of existing provisional model units. Never feed it
 * into signed scientific summaries, clinical outputs, or published references. */
export function illustrativeTop(z:number|undefined):string|null{
 if(z===undefined||!Number.isFinite(z))return null;
 const top=100*(1-cdf(z));
 if(top>65)return '65%+';
 return `${TOP_BAND_EDGES.find(edge=>edge>=top)??65}%`;
}
export function gameStanding(result:ReturnType<typeof evaluate>){return {total:result.submitted.length?illustrativeTop(result.z):null,sections:{bodymarkers:illustrativeTop(result.domains.bodymarkers),strength:illustrativeTop(result.domains.strength),recovery:illustrativeTop(result.domains.recovery)},eligibleCount:result.submitted.length};}
