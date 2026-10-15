import {parseMeasurementInput} from './measurementInput';
import { normalizeDemographics } from './profile';
import type { Demographics } from './registry';

export type ProfileDraft = { age: string; sex: string; weight: string; height: string };
export const blankProfileDraft = (): ProfileDraft => ({ age: '', sex: '', weight: '', height: '' });
export function profileToDraft(profile?: Demographics): ProfileDraft {
  return profile ? { age: String(profile.age), sex: profile.sex, weight: profile.weight===undefined?'':String(profile.weight), height: profile.height===undefined?'':String(profile.height) } : blankProfileDraft();
}
export function parseProfileDraft(draft: ProfileDraft): Demographics | undefined {
  if (!draft.age.trim()) return;
  try { return normalizeDemographics({ age: Number(parseMeasurementInput(draft.age)), sex: draft.sex||'unselected', ...(draft.weight.trim()?{weight:Number(parseMeasurementInput(draft.weight))}:{}),...(draft.height.trim()?{height:Number(parseMeasurementInput(draft.height))}:{}) }); }
  catch { return; }
}
