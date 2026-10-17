import {activeMetrics,type Values,type Demographics} from './registry';
import {comparableDelta,type Observation} from './history';
import {metricGameEstimate,benchmarkGame} from './benchmarkGame';
export function journeyChanges(entries:Observation[],values:Values,d:Demographics){
 return activeMetrics.flatMap(m=>{const history=entries.filter(e=>e.metricId===m.id),delta=comparableDelta(history);if(!delta||delta.latest.value!==values[m.id])return [];
 const before=metricGameEstimate(m.id,delta.previous.value!,d),after=metricGameEstimate(m.id,delta.latest.value!,d);if(!before||!after)return [];
 const older=history.filter(e=>!e.cleared&&e.id!==delta.latest.id&&e.measuredAt&&Date.parse(e.measuredAt)<Date.parse(delta.latest.measuredAt!)).flatMap(e=>{const pair=comparableDelta([e,delta.latest]);return pair?[metricGameEstimate(m.id,e.value!,d)?.z??Infinity]:[];});
 return [{id:m.id,name:m.name,unit:m.id==='total_sleep'?'h/night':m.unit,previous:delta.previous.value!/(m.id==='total_sleep'?60:1),current:delta.latest.value!/(m.id==='total_sleep'?60:1),previousTop:before.top,top:after.top,improved:after.z>before.z,personalBest:after.z>before.z&&older.length>0&&older.every(z=>after.z>z),date:delta.latest.measuredAt!}];});
}
export function rankChangeReason(before:Values,after:Values,d:Demographics){
 const keys=(v:Values)=>benchmarkGame(v,d).rows.map(r=>r.id).sort().join(',');return keys(before)!==keys(after)?'Measurements added or removed':'Recorded results changed';
}
export function rankCardSvg(title:string,top:string,league:string,disclaimer:string,rows:{name:string;top:string}[]){
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
 return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="760" viewBox="0 0 720 760"><defs><linearGradient id="g"><stop stop-color="#f87171"/><stop offset=".5" stop-color="#34d399"/><stop offset="1" stop-color="#60a5fa"/></linearGradient></defs><rect width="720" height="760" rx="32" fill="#101a2c"/><g font-family="Arial" text-anchor="middle"><text x="360" y="75" fill="#fff" font-size="30">TOP1.FIT</text><text x="360" y="135" fill="#94a3b8" font-size="20">${escape(title)}</text><text x="360" y="240" fill="#fff" font-size="84">${escape(top)}</text><text x="360" y="295" fill="#6ee7b7" font-size="28">${escape(league)}</text><path d="M360 330L440 440H280Z" fill="url(#g)" opacity=".8"/>${rows.map((r,i)=>`<text x="360" y="${490+i*46}" fill="#e2e8f0" font-size="22">${escape(r.name)} · ${escape(r.top)}</text>`).join('')}<text x="360" y="690" fill="#94a3b8" font-size="18">${escape(disclaimer)}</text><text x="360" y="728" fill="#64748b" font-size="16">top1.fit</text></g></svg>`;
}
