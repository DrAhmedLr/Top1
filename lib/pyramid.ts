import {TOP_BAND_EDGES} from './topBands';
export const PYRAMID_TIERS=[...TOP_BAND_EDGES.map(n=>`${n}%`),'65%+'];
export function pyramidTier(top:string|null){return top===null?-1:PYRAMID_TIERS.indexOf(top);}

// Cosmetic leagues group the existing bands; they never change scoring.
export const PYRAMID_LEAGUES=[
 {name:'GOATs',range:'1%',first:0,last:0,color:'#dc2626'},
 {name:'Elite',range:'2.5–5%',first:1,last:2,color:'#b45309'},
 {name:'Champions',range:'7.5–10%',first:3,last:4,color:'#4d7c0f'},
 {name:'Challengers',range:'15–25%',first:5,last:7,color:'#047857'},
 {name:'Climbers',range:'30–45%',first:8,last:10,color:'#0369a1'},
 {name:'Rising',range:'55–65%+',first:11,last:13,color:'#4f46e5'},
] as const;
export function pyramidLeague(top:string|null){const i=pyramidTier(top);return i<0?null:PYRAMID_LEAGUES.find(league=>i>=league.first&&i<=league.last)??null;}
export function nextPyramidTier(top:string|null){const i=pyramidTier(top);return i>0?PYRAMID_TIERS[i-1]:null;}
