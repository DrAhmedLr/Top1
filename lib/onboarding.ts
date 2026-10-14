import { normalizeDemographics } from './profile';
import type { Demographics } from './registry';

export type ProfileDraft = { age: string; sex: string; weight: string; height: string };
export const blankProfileDraft = (): ProfileDraft => ({ age: '', sex: '', weight: '', height: '' });
export function profileToDraft(profile?: Demographics): ProfileDraft {
  return profile ? { age: String(profile.age), sex: profile.sex, weight: profile.weight===undefined?'':String(profile.weight), height: profile.height===undefined?'':String(profile.height) } : blankProfileDraft();
}
export function parseProfileDraft(draft: ProfileDraft): Demographics | undefined {
  if (!draft.age.trim() || !draft.sex) return;
  try { return normalizeDemographics({ age: Number(draft.age), sex: draft.sex, ...(draft.weight.trim()?{weight:Number(draft.weight.replace(',', '.'))}:{}),...(draft.height.trim()?{height:Number(draft.height.replace(',', '.'))}:{}) }); }
  catch { return; }
}
