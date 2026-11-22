import {journeyBaseline} from './journeyDraft';
import {baselineArea} from './journeyResult';
import {baselineChallenge,baselineStorageKey,BASELINE_VERSION,readBaselineSelection,type BaselineSelection} from './balancedBaseline';
import type {Demographics,Values} from './registry';
import type {MeasurementMetadata} from './measurementMetadata';

export function saveBaselineChoice(storage:Pick<Storage,'getItem'|'setItem'>,owner:string,id:string,values:Values,details:MeasurementMetadata,sex:Demographics['sex']):BaselineSelection|null{
 const area=baselineArea(id);
 if(!area||!baselineChallenge(id,values,details,sex))return null;
 const choices={...readBaselineSelection(storage.getItem(baselineStorageKey(owner))),[area]:{test:id,sex}};
 storage.setItem(baselineStorageKey(owner),JSON.stringify({version:BASELINE_VERSION,choices}));
 return choices;
}

/** Call only after the user-reviewed guest import has succeeded.
 * Keep account choices and copy only a result that actually survived the merge. */
export function importedBaselineChoices(storage:Pick<Storage,'getItem'|'setItem'>,owner:string,guest:{values:Values;measurementDetails?:MeasurementMetadata},merged:{values:Values;measurementDetails?:MeasurementMetadata}){
 const account=readBaselineSelection(storage.getItem(baselineStorageKey(owner)));
 const incoming=readBaselineSelection(storage.getItem(baselineStorageKey('guest')));
 let changed=false;
 for(const area of Object.keys(incoming) as (keyof BaselineSelection)[]){
  const choice=incoming[area]!;
  if(account[area]||merged.values[choice.test]!==guest.values[choice.test])continue;
  const before=guest.measurementDetails?.[choice.test]??{},after=merged.measurementDetails?.[choice.test]??{};
  if(journeyBaseline(undefined,{}, {[choice.test]:before})!==journeyBaseline(undefined,{}, {[choice.test]:after})||!baselineChallenge(choice.test,merged.values,merged.measurementDetails??{},choice.sex))continue;
  account[area]=choice;changed=true;
 }
 if(changed)storage.setItem(baselineStorageKey(owner),JSON.stringify({version:BASELINE_VERSION,choices:account}));
 return account;
}

export function clearBaselineChoice(storage:Pick<Storage,'getItem'|'setItem'>,owner:string,id:string){
 const choices=readBaselineSelection(storage.getItem(baselineStorageKey(owner)));
 const area=baselineArea(id);
 if(area&&choices[area]?.test===id){delete choices[area];storage.setItem(baselineStorageKey(owner),JSON.stringify({version:BASELINE_VERSION,choices}));}
 return choices;
}
