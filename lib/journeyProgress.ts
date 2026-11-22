import {gameKey,parseGame} from './gameProgress';
import type {MeasurementDetails} from './measurementMetadata';
import {protocolKey} from './protocols';

export const firstChallenge = 'sit_to_stand';
const storageKey = (owner:string) => `top1-journey-v1:${owner}`;
type Checkpoint = {collection:number;metric:string;due?:string;guided?:boolean};

export function readCheckpoint(owner:string):Checkpoint|undefined {
 try {
  const saved = JSON.parse(localStorage.getItem(storageKey(owner)) ?? 'null');
  if (saved && Number.isInteger(saved.collection) && saved.collection >= 0 && saved.collection < 3 && typeof saved.metric === 'string') return saved;
 } catch {}
}

export function writeCheckpoint(owner:string, checkpoint:Checkpoint){
 try { localStorage.setItem(storageKey(owner),JSON.stringify(checkpoint)); } catch {}
}

export function clearCheckpoint(owner:string){
 try { localStorage.removeItem(storageKey(owner)); } catch {}
}

export function migrateCheckpoint(owner:string){
 try{const guestGame=parseGame(localStorage.getItem(gameKey('guest'))),accountGame=parseGame(localStorage.getItem(gameKey(owner)));for(const [day,value]of Object.entries(guestGame.days)){const previous=accountGame.days[day];accountGame.days[day]={check:!!(previous?.check||value.check),test:!!(previous?.test||value.test)};}localStorage.setItem(gameKey(owner),JSON.stringify(accountGame));localStorage.removeItem(gameKey('guest'));window.dispatchEvent(new Event('top1-game-updated'));}catch{}

 const guest = readCheckpoint('guest');
 if(guest&&!readCheckpoint(owner))writeCheckpoint(owner,guest);
 clearCheckpoint('guest');
}

export function comparableAttempts(previous?:MeasurementDetails,next?:MeasurementDetails){
 return !!previous?.measuredAt && !!next?.measuredAt && Date.parse(previous.measuredAt)<Date.parse(next.measuredAt) && !!previous.method &&
  previous.method === next.method && previous.source === next.source &&
  previous.exerciseMode === next.exerciseMode && protocolKey(previous.protocol) === protocolKey(next.protocol);
}
