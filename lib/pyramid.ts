import {TOP_BAND_EDGES} from './topBands';
export const PYRAMID_TIERS=[...TOP_BAND_EDGES.map(n=>`${n}%`),'65%+'];
export function pyramidTier(top:string|null){return top===null?-1:PYRAMID_TIERS.indexOf(top);}
