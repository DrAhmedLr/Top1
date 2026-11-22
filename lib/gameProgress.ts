/** Device-local engagement rewards. Never enters benchmark or clinical scoring. */
export type GameLog={version:1;days:Record<string,{check?:boolean;test?:boolean}>};
export const emptyGame=():GameLog=>({version:1,days:{}});
export const gameKey=(owner:string)=>`top1-game-v1:${owner}`;
export function localDay(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function parseGame(raw:string|null):GameLog{try{const p=JSON.parse(raw??'null');if(p?.version!==1||!p.days)return emptyGame();const days:GameLog['days']={};for(const [day,value]of Object.entries(p.days)){if(/^\d{4}-\d{2}-\d{2}$/.test(day)&&value&&typeof value==='object'){const v=value as {check?:boolean;test?:boolean};days[day]={check:v.check===true,test:v.test===true};}}return {version:1,days};}catch{return emptyGame();}}
export function reward(log:GameLog,kind:'check'|'test',day=localDay()){if(log.days[day]?.[kind])return {log,xp:0};return {log:{version:1 as const,days:{...log.days,[day]:{...log.days[day],[kind]:true}}},xp:kind==='test'?20:10};}
export function gameSummary(log:GameLog){const days=Object.values(log.days);const xp=days.reduce((n,d)=>n+(d.check?10:0)+(d.test?20:0),0);return {xp,level:1+Math.floor(xp/100),progress:xp%100,activeDays:days.filter(d=>d.check||d.test).length,testDays:days.filter(d=>d.test).length};}
export function saveReward(owner:string,kind:'check'|'test'){try{const result=reward(parseGame(localStorage.getItem(gameKey(owner))),kind);localStorage.setItem(gameKey(owner),JSON.stringify(result.log));window.dispatchEvent(new Event('top1-game-updated'));return result.xp;}catch{return null;}}
export function mergeGame(a:GameLog,b:GameLog):GameLog{const days={...a.days};for(const [day,value]of Object.entries(b.days)){days[day]={check:!!(days[day]?.check||value.check),test:!!(days[day]?.test||value.test)};}return {version:1,days};}
