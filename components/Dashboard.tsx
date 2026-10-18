'use client';
import {MetricIcon,CategoryIcon} from './MetricIcon';
import {useTranslations} from '@/components/providers/LocaleProvider';

import LanguageToggle from './LanguageToggle';
import {SUPPORT_HREF} from '@/lib/site';
import {recordedCoverage} from '@/lib/coverage';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, ChevronRight, CircleHelp, Download, LayoutDashboard, Lock, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, X } from 'lucide-react';
import { useAuth } from './providers/AuthProvider';
import {minimalPublicFields,type PublicFields} from '@/lib/sharing';
import RepeatObservation from './RepeatObservation';

import {repeatDetails} from '@/lib/observationPresentation';
import AccountDataControls from './AccountDataControls';
import BrowserDataControls from './BrowserDataControls';
import {useGuestHistory} from '@/lib/hooks/useGuestHistory';
import { useCloudSave } from '@/lib/hooks/useCloudSave';
import {calculationReport} from '@/lib/calculationReport';
import { captureEvent,recordView } from '@/lib/analytics';
import { parseLocalProfile, normalizeValues, type ProfileState } from '@/lib/profile';
import { authEntryPath } from '@/lib/emailAuth';
import { evaluate, reference, scoringEligibility, valid } from '@/lib/engine';
import { activeMetrics, metrics, pillars, type Demographics, type Metric, type PillarId, type Values } from '@/lib/registry';
import { getAgeBracket } from '@/lib/demographics';
import { type MeasurementDetails, type MeasurementMetadata,normalizeMeasurementMetadata } from '@/lib/measurementMetadata';
import ProfileEdit from './ProfileEdit';
import CloudProfileControls from './CloudProfileControls';
import Overview, { pillarNames } from './Overview';
import MetricEditor from './MetricEditor';
import Modal from './Modal';
import Onboarding from './Onboarding';
import Methodology from './Methodology';
import MetricCalculator from './MetricCalculator';
import TriadChart from './TriadChart';
import {benchmarkGame} from '@/lib/benchmarkGame';

function HistoryLoading(){const {t}=useTranslations();return <p role="status">{t('Loading history…')}</p>;}
const Progress=dynamic(()=>import('./Progress'),{loading:HistoryLoading});
function GoalsLoading(){const {t}=useTranslations();return <div className="card loading-panel" role="status">{t('Loading your goals…')}</div>;}
const PotentialGoals = dynamic(() => import('./PotentialGoals'), { loading:GoalsLoading });
const defaults: Demographics = { age: 32, sex: 'male', weight: 78, height: 180 };
type View = 'overview' | 'measurements' | 'progress' | 'scenarios' | 'profile' | 'settings' | 'methodology';
const navigation = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scenarios', label: 'Your Potential', icon: Sparkles },
] as const;
const pageTitles: Record<View, [string, string, string]> = {
  overview: ['YOUR PERFORMANCE, SIMPLIFIED', 'Your performance dashboard.', 'Understand your measurements and decide what to explore next.'],
  progress:['','Measurement history',''],
  settings:['','Settings',''],
  measurements: ['YOUR MEASUREMENT LIBRARY', 'My metrics.', 'Every field is optional. Add real measurements at your own pace.'],
  scenarios: ['ROOM TO EXPLORE', 'My Potential.', 'Explore how hypothetical changes affect your experimental index.'],
  profile: ['YOUR SPACE, YOUR CHOICE', 'My profile & passport.', 'Manage your details, save your progress and choose what to share.'],
  methodology: ['THE THINKING BEHIND TOP1', 'Understand what your index means.', 'Clear methods, transparent assumptions and evidence you can explore.'],
};
const viewLabels: Record<View,string> = { overview:'Dashboard', measurements:'Dashboard', scenarios:'Your Potential', progress:'Your measurement history', profile:'My profile', settings:'Settings', methodology:'Methodology' };

const measurementRows = [
  ['bench_1rm', 'squat_1rm', 'deadlift_1rm'],
  ['pullup_1rm', 'grip_strength', 'pushups'],
  ['cmj', 'broad_jump', 'sprint_10m'],
  ['vo2_max', 'sit_to_stand', 'single_leg_balance'],
  ['body_fat', 'waist_height_ratio'],
  ['total_sleep', 'rhr', 'hrv'],
];
const fmt = (n: number, d = 1) => n.toFixed(d).replace(/\.0$/, '');
function currentView(): View {
  const raw = new URLSearchParams(window.location.search).get('view');
  const value=raw==='potential'?'scenarios':raw==='measurements'?'overview':raw;
  return value && Object.keys(pageTitles).includes(value) ? value as View : 'overview';
}

export default function Dashboard() {
 const {t:tr}=useTranslations();

  const auth = useAuth();
  const [view, setView] = useState<View>('overview');
  const [navigationHidden,setNavigationHidden]=useState(false);
  useEffect(()=>{
    setNavigationHidden(false);let last=window.scrollY,pivot=last,direction=0;
    const scroll=()=>{const y=Math.max(0,window.scrollY),next=Math.sign(y-last);
      if(next&&next!==direction){pivot=last;direction=next;}
      const headerEngaged=document.querySelector('.sidebar [aria-expanded="true"],.topbar [aria-expanded="true"],.sidebar :focus-visible,.topbar :focus-visible');
      if(y<90||headerEngaged)setNavigationHidden(false);else if(direction>0&&y-pivot>18)setNavigationHidden(true);else if(direction<0&&pivot-y>8)setNavigationHidden(false);last=y;
    };
    window.addEventListener('scroll',scroll,{passive:true});return()=>window.removeEventListener('scroll',scroll);
  },[view]);
  const [values, setValues] = useState<Values>({}), [demographics, setDemographics] = useState<Demographics>(defaults);
  const [details, setDetails] = useState<MeasurementMetadata>({}), [profileSetup, setProfileSetup] = useState(false), [loaded, setLoaded] = useState(false);
  const [privacyBusy,setPrivacyBusy]=useState(false);
  const [publicFields,setPublicFields]=useState<PublicFields>(minimalPublicFields);
  const [username, setUsername] = useState(''), [isPublic, setIsPublic] = useState(false), [profileAccount, setProfileAccount] = useState<string | null>(null);
  const loadedUser = useRef<string | undefined>(undefined), localReadFailed = useRef(false);
  const [localSaveError, setLocalSaveError] = useState(false);
  const [repeatMetric,setRepeatMetric]=useState<string|null>(null);
  const [profileValid,setProfileValid]=useState(true);
  const [contextErrors,setContextErrors]=useState<Record<string,string>>({});
  useEffect(()=>{setContextErrors({});setEditingId(null);setProfileValid(true);},[auth.user?.id]);
  const [historyMetric,setHistoryMetric]=useState('pushups');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'onboarding' | 'reset' | 'import' | 'leave' | null>(null), [proof, setProof] = useState<Metric | null>(null), [calculator, setCalculator] = useState<Metric | null>(null), [toast, setToast] = useState('');
  const [quickStarter,setQuickStarter]=useState<string|undefined>();
  const [programRisk,setProgramRisk]=useState(false),[leaveDestination,setLeaveDestination]=useState<View>('overview');
  const [editorEpoch,setEditorEpoch]=useState(0),[leaveUnfinished,setLeaveUnfinished]=useState(false);
  const unfinishedRef=useRef(false),lastValidEditor=useRef<{owner:string;profile:ProfileState}|undefined>(undefined);
  const programRiskRef=useRef(false),viewRef=useRef<View>('overview'),focusMetric=useRef<string|null>(null);programRiskRef.current=programRisk;viewRef.current=view;
  useEffect(()=>{setCalculator(null);setProof(null);setPanel(null);setProgramRisk(false);lastValidEditor.current=undefined;focusMetric.current=null;setEditorEpoch(n=>n+1);},[auth.user?.id]);
  const needsSetup = !profileSetup;
  const autoSetupOwner = useRef<string | null>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const panelTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setView(currentView());
    function handleBack() { const wanted=currentView();if(programRiskRef.current||unfinishedRef.current){setLeaveUnfinished(unfinishedRef.current);setLeaveDestination(wanted);const url=new URL(window.location.href);url.searchParams.set('view',viewRef.current);window.history.pushState(null,'',url);setPanel('leave');return;}setView(wanted); }
    window.addEventListener('popstate', handleBack);
    try {
      const saved = localStorage.getItem('top1-profile-v2') ?? localStorage.getItem('top1_profile_v2') ?? localStorage.getItem('top1-profile-v1');
      if (saved) { const profile = parseLocalProfile(saved); if (profile) { setValues(profile.values); setDetails(profile.measurementDetails ?? {}); setDemographics(profile.demographics); setProfileSetup(true); } }
    } catch { localReadFailed.current = true; setToast('Stored profile could not be loaded. Your saved data has been retained.'); }
    setLoaded(true);
    return () => window.removeEventListener('popstate', handleBack);
  }, []);
  useEffect(() => {
    if (auth.user && auth.cloud && loadedUser.current !== auth.user.id) {
      loadedUser.current = auth.user.id; setProfileAccount(auth.user.id); setValues(auth.cloud.values); setDetails(auth.cloud.measurementDetails ?? {});
      setDemographics(auth.cloud.demographics);setPublicFields(auth.cloud.publicFields??minimalPublicFields); setUsername(auth.cloud.username); setIsPublic(auth.cloud.isPublic); setProfileSetup((auth.cloud.revision ?? 0) > 0 || Object.keys(auth.cloud.values).length > 0);
    } else if (auth.ready && !auth.user && loadedUser.current) {
      loadedUser.current = undefined; setProfileAccount(null); setValues({}); setDetails({}); setDemographics(defaults); setProfileSetup(false); autoSetupOwner.current = null; setUsername(''); setIsPublic(false);
    }
  }, [auth.user, auth.cloud, auth.ready]);
  useEffect(() => {
    if (loaded && profileSetup && auth.ready && !auth.user && profileAccount === null && !localReadFailed.current && !activeMetrics.some(m => values[m.id] !== undefined && !valid(m, values[m.id]))) {
      try { localStorage.setItem('top1-profile-v2', JSON.stringify({ values: normalizeValues(values), demographics, setupComplete: true, measurementDetails: details })); setLocalSaveError(false); }
      catch { setLocalSaveError(true); setToast('Device storage is unavailable. Keep this page open to retain your profile.'); }
    }
  }, [values, demographics, profileSetup, details, loaded, auth.ready, auth.user, profileAccount]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); } }, [toast]);
  useEffect(()=>{if(loaded)recordView(view);},[view,loaded]);
  useEffect(()=>{if(auth.ready&&auth.user){const url=new URL(window.location.href);if(url.searchParams.get('confirmed')==='1'){captureEvent('signup_confirmed');url.searchParams.delete('confirmed');window.history.replaceState(null,'',url);}}},[auth.ready,auth.user]);
  useEffect(() => { document.title = `${tr(viewLabels[view])} · TOP1`; }, [view,tr]);




  const cloudProfile = useMemo<ProfileState>(() => ({ publicFields, values, demographics, username, isPublic, measurementDetails: details, revision: auth.cloud?.revision ?? 0 }), [publicFields,values, demographics, username, isPublic, details, auth.cloud?.revision]);
  const errors = activeMetrics.filter(m => {if(contextErrors[m.id]||values[m.id]!==undefined&&!valid(m,values[m.id]))return true;try{normalizeMeasurementMetadata({[m.id]:details[m.id]??{}});return false;}catch{return true;}});
  unfinishedRef.current=errors.length>0||!profileValid;
  useEffect(()=>{const ownsProfile=loaded&&auth.ready&&(auth.user?profileAccount===auth.user.id&&!auth.loading&&!!auth.cloud:profileAccount===null);if(ownsProfile&&!needsSetup&&errors.length===0&&profileValid)lastValidEditor.current={owner:auth.user?.id??'guest',profile:cloudProfile};},[cloudProfile,needsSetup,errors.length,profileValid,auth.user,auth.ready,auth.loading,auth.cloud,profileAccount,loaded]);
  const ownsCurrentProfile=loaded&&auth.ready&&(auth.user?profileAccount===auth.user.id&&!auth.loading&&!!auth.cloud:profileAccount===null);
  const cloudSave = useCloudSave(cloudProfile, loaded && !needsSetup && profileAccount === auth.user?.id && errors.length === 0 && profileValid, !!editingId,ownsCurrentProfile&&!needsSetup);
  useEffect(()=>{if(cloudSave.saved)setIsPublic(cloudSave.saved.isPublic);},[cloudSave.saved]);
  const result = useMemo(() => evaluate(values, demographics, details), [values, demographics, details]);
  const canDisplayProfile=ownsCurrentProfile;
  const editable = canDisplayProfile;
  const guestHistory=useGuestHistory(values,details,auth.user?.id??'guest',loaded&&auth.ready&&!auth.loading&&errors.length===0,!!editingId);

  useEffect(() => {
    if (!errors.length && !localSaveError && !cloudSave.unsaved && cloudSave.status !== 'saving' && cloudSave.status !== 'error') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [errors.length, localSaveError, cloudSave.status, cloudSave.unsaved]);
  function go(next: View,force=false) {
    if(next==='measurements')next='overview';
    if(!force&&next!==view&&(programRisk&&view==='scenarios'||unfinishedRef.current)){setLeaveUnfinished(unfinishedRef.current);panelTrigger.current=document.activeElement as HTMLElement;setLeaveDestination(next);setPanel('leave');return;}
    setView(next);
    const url = new URL(window.location.href); if (next === 'overview') url.searchParams.delete('view'); else url.searchParams.set('view', next==='scenarios'?'potential':next);
    window.history.pushState(null, '', url); window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => pageHeading.current?.focus());
  }
  function openMeasurements(next?: PillarId,metricId?:string) {setEditingId(null);go('overview');requestAnimationFrame(()=>{const target=metricId?document.querySelector<HTMLElement>(`[data-metric-id="${metricId}"]`):next?document.querySelector<HTMLElement>(`#measurements [data-pillar="${next}"]`):document.getElementById('measurements');target?.scrollIntoView({behavior:'smooth',block:'start'});if(metricId)target?.querySelector<HTMLInputElement>('input[inputmode]')?.focus({preventScroll:true});});}
  function start() { panelTrigger.current = document.activeElement as HTMLElement; if (editable){setPanel('onboarding');captureEvent('onboarding_started');} else setToast('Wait for your profile to finish loading before making changes.'); }
  function showEvidence(metric: Metric) { panelTrigger.current = document.activeElement as HTMLElement; setProof(metric); }
  function showCalculator(metric: Metric) { panelTrigger.current = document.activeElement as HTMLElement; setCalculator(metric); }
  function changeValue(id: string, raw: string) {
    if (!editable || needsSetup) return;
    setValues(current => ({ ...current, [id]: raw.trim() ? Number(raw) : undefined }));
    setDetails(current=>({...current,[id]:{...current[id],derivation:undefined}}));
  }
  function changeDetails(id: string, next: MeasurementDetails) { if (editable && !needsSetup) setDetails(current => ({ ...current, [id]: next })); }
  async function changeVisibility(next: boolean) {
    if(!next){setPrivacyBusy(true);try{await cloudSave.withdraw();setIsPublic(false);setToast('Your profile is private. Unsaved edits are retained.');}finally{setPrivacyBusy(false);}return;}
    if (errors.length) throw new Error('Correct invalid measurements before publishing.');
    if (needsSetup || !auth.cloud || !editable) throw new Error('Load your personal profile before sharing.');
    cloudSave.cancelPending(); await cloudSave.save({ ...cloudProfile, isPublic: next },{visibilityIntent:true}); setIsPublic(next); setToast(next ? 'Your summary is now public.' : 'Your profile is now private.');
  }
  const privacyAction=auth.user?<div className="modal-safety"><button className="text-link" disabled={privacyBusy} onClick={()=>void changeVisibility(false).catch(e=>setToast(e instanceof Error?e.message:'Privacy withdrawal failed. Retry.'))}>{tr(privacyBusy?'Withdrawing…':'Make my profile private')}</button></div>:undefined;
  function applyProfile(profile:ProfileState){setPublicFields(profile.publicFields??minimalPublicFields);setValues(profile.values);setDetails(profile.measurementDetails??{});setDemographics(profile.demographics);setUsername(profile.username);setIsPublic(profile.isPublic);setProfileSetup((profile.revision??0)>0||Object.keys(profile.values).length>0);setContextErrors({});setEditingId(null);setProfileValid(true);setEditorEpoch(n=>n+1);}
  function keepSavedProfile(){if(!auth.cloud||cloudSave.status==='saving')return;applyProfile(cloudSave.saved??auth.cloud);cloudSave.discardDraft();}
  function finishSetup(profile: Demographics, nextValues: Values, nextDetails: MeasurementMetadata) {
    if (!editable) { setToast('Your session changed. Wait for the profile to load and try again.'); return; }
    captureEvent('onboarding_completed');localReadFailed.current = false; setDemographics(profile); setValues(nextValues); setDetails(nextDetails); setProfileSetup(true); setPanel(null); go('overview'); setToast(auth.user ? 'Your profile is syncing to your account.' : 'Your profile is saved on this device.');
  }
  function downloadDraft(profile: ProfileState) {
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,profile},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='TOP1-unsaved-profile.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadCalculationReport(){
    if(needsSetup)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(calculationReport(cloudProfile),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='TOP1-calculation-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadSummary() {
    const game=benchmarkGame(values,demographics);if(!game.total)return;
    const bars = pillars.map((p, i) => { const top = game.sections[p.id]; return `<text x="40" y="${230 + i * 60}" font-size="16" fill="#e5e7eb">${pillarNames[p.id]}</text><text x="440" y="${230 + i * 60}" text-anchor="end" font-size="16" fill="#e5e7eb">${top ? 'Top '+top : 'No measurements'}</text>`; }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="540" viewBox="0 0 480 540"><rect width="480" height="540" rx="24" fill="#111827"/><g font-family="Arial"><text x="40" y="65" font-size="30" font-weight="bold" fill="#f3f4f6">TOP1</text><text x="40" y="100" font-size="13" fill="#9ca3af">PERSONAL SUMMARY · ILLUSTRATIVE GAME ESTIMATE</text><text x="40" y="173" font-size="52" fill="#f3f4f6">Top ${game.total}</text>${bars}<text x="40" y="425" font-size="13" fill="#9ca3af">${fmt(recordedCoverage(result.measured.length))}% coverage · ${result.measured.length}/${activeMetrics.length} measurements</text><text x="40" y="465" font-size="12" fill="#9ca3af">Not a health score, population rank or medical assessment.</text><text x="40" y="505" font-size="12" fill="#9ca3af">${new Date().toISOString().slice(0, 10)} · Generated on your device</text></g></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); const a = document.createElement('a'); a.href = url; a.download = 'TOP1-profile-summary.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setToast('Profile summary downloaded.');
  }
  return <div className={`app-shell view-${view}${navigationHidden?' navigation-hidden':''}`}>
    <a tabIndex={panel || proof || calculator || repeatMetric ? -1 : undefined} className="skip-link" href="#main-content">{tr("Skip to content")}</a>

    <aside inert={panel || proof || calculator || repeatMetric ? true : undefined} className="sidebar" aria-label={tr("Main navigation")} onFocusCapture={()=>setNavigationHidden(false)}>
      <Link href="/" className="brand" onClick={e => { e.preventDefault(); go('overview'); }}><span className="protocol-mark"><i/><i/></span><span>{tr("TOP1")}</span></Link>

      <nav>{navigation.map(n => <a key={n.id} href={n.id === 'overview' ? '/' : '/?view=potential'} className={(view === n.id || n.id==='overview' && view==='progress') ? 'active' : ''} aria-current={(view === n.id || n.id==='overview' && view==='progress') ? 'page' : undefined} onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go(n.id); }}><n.icon size={19}/><span>{tr(n.label)}</span>{(view === n.id || n.id==='overview' && view==='progress') && <span className="active-dot"/>}</a>)}</nav>
      <div className="header-account"><LanguageToggle/>{auth.user ? <button className="account-chip" aria-label={tr("My profile")} onClick={() => go('profile')}><span>{profileAccount===auth.user?.id&&username ? `@${username}` : tr('My profile')}</span><span className="avatar"><UserRound size={17}/></span></button> : <div className="auth-entry-actions"><Link className="header-login" href={authEntryPath('sign-in')}>{tr("Log in")}</Link></div>}</div>
    </aside>
    <div inert={panel || proof || calculator || repeatMetric ? true : undefined} className="main-wrap"><header className="topbar" onFocusCapture={()=>setNavigationHidden(false)}><div className="topbar-right"><LanguageToggle/>{auth.user ? <button className="mobile-profile-account icon-button" aria-label={tr("My profile")} onClick={() => go('profile')}><UserRound size={19}/></button> : <div className="auth-entry-actions"><Link className="header-login" href={authEntryPath('sign-in')}>{tr("Log in")}</Link></div>}</div></header>
      <main id="main-content" className="workspace-main">
        {auth.user&&view!=='scenarios'&&view!=='overview'&&<div className="account-safety"><button className="text-link" disabled={privacyBusy} onClick={()=>void changeVisibility(false).catch(e=>setToast(e instanceof Error?e.message:'Privacy withdrawal failed. Retry.'))}>{tr(privacyBusy?'Withdrawing…':'Make my profile private')}</button></div>}
        {canDisplayProfile&&!needsSetup&&view!=='scenarios'&&(view!=='overview'||auth.user&&(errors.length>0||!profileValid||!!editingId||cloudSave.status==='saving'||cloudSave.unsaved||cloudSave.status==='error'))&&<div className="save-status" role="status">{auth.user&&<span>{tr(errors.length||!profileValid?'Inputs need attention':editingId?'Editing · leave this field to save':cloudSave.status==='saving'?'Saving…':cloudSave.unsaved?'Unsaved changes':cloudSave.status==='error'?'Save needs attention':'Saved to your account')}</span>}{auth.user&&cloudSave.unsaved&&<button className="text-link" disabled={errors.length>0||!profileValid||cloudSave.status==='saving'} onClick={()=>void cloudSave.save(cloudProfile).catch(()=>{})}>{tr("Save now")}</button>}</div>}
        {cloudSave.storageWarning&&<div className="cloud-error" role="status"><span>{tr(cloudSave.storageWarning)}</span><button className="text-link" onClick={()=>downloadDraft(cloudProfile)}>{tr("Download draft")}</button></div>}
        {localSaveError && !auth.user && <div className="cloud-error" role="alert"><span>{tr("Your changes are only in memory. Device storage is unavailable. Keep this page open or sign in to save.")}</span><Link href="/sign-in">{tr("Sign in")}</Link></div>}
        {auth.error && <div className="cloud-error" role="alert"><span>{tr(auth.error)}</span><button onClick={auth.retry}>{tr("Retry")}</button></div>}
        {auth.guest && <div className="cloud-error"><span>{tr("A guest profile is available in this browser. Review it before importing into your account.")}</span><button onClick={()=>{panelTrigger.current=document.activeElement as HTMLElement;setPanel('import');}}>{tr("Review import")}</button><button onClick={auth.dismissGuest}>{tr("Keep separate")}</button></div>}
        {canDisplayProfile&&cloudSave.draft && <div className="cloud-error" role="status"><span>{tr("An unsaved draft is available")}{tr(cloudSave.draft.revision!==auth.cloud?.revision?' from an older profile revision':'')}{tr(". Review it before saving.")}</span><button disabled={cloudSave.status==='saving'} onClick={()=>{const p=cloudSave.restoreDraft();if(p){applyProfile(p);setProfileSetup(true);}}}>{tr("Review draft")}</button><button onClick={()=>downloadDraft(cloudSave.draft!)}>{tr("Download draft")}</button><button disabled={cloudSave.status==='saving'} onClick={keepSavedProfile}>{tr("Keep saved profile")}</button></div>}
        {canDisplayProfile&&cloudSave.reviewing && <div className="cloud-error" role="status"><span>{tr("Reviewing your retained draft. It has not overwritten the saved profile.")}</span><button disabled={errors.length>0||!profileValid||cloudSave.status==='saving'} onClick={()=>void cloudSave.save(cloudProfile).catch(()=>{})}>{tr("Save reviewed draft")}</button><button onClick={()=>downloadDraft(cloudProfile)}>{tr("Download draft")}</button><button disabled={cloudSave.status==='saving'} onClick={keepSavedProfile}>{tr("Discard draft")}</button></div>}
        {canDisplayProfile&&cloudSave.error && <div className="cloud-error" role="alert"><span>{tr(cloudSave.error)}</span><button disabled={!cloudSave.conflict&&(errors.length>0||!profileValid)} onClick={() => cloudSave.conflict ? auth.retry() : void cloudSave.save(cloudProfile).catch(() => {})}>{tr(cloudSave.conflict ? 'Review latest profile' : 'Retry save')}</button><button onClick={()=>downloadDraft(cloudProfile)}>{tr("Download draft")}</button></div>}
        {view==='scenarios'?<h1 className="sr-only" tabIndex={-1} ref={pageHeading}>{tr(viewLabels[view])}</h1>:<div className={`page-heading ${view === 'overview' ? 'compact-page-heading' : ''}`}><h1 tabIndex={-1} ref={pageHeading}>{tr(viewLabels[view])}</h1></div>}
        {canDisplayProfile?<>

        {view === 'overview' && <Overview key={auth.user?.id??'guest'} guestEntries={guestHistory.entries} revision={cloudSave.saved?.revision??auth.cloud?.revision} demographics={demographics} values={values} details={details} result={result} needsSetup={needsSetup} onMeasurements={openMeasurements} onStart={id=>{setQuickStarter(id);start();}} onScience={() => go('methodology')} onCalculationReport={downloadCalculationReport} onPotential={()=>go('scenarios')}/>}
        {view === 'overview' && <section id="measurements" className="measurement-library simplified-library" aria-label={tr('Measurements')}>
          <div className="measurement-toolbar"><button className="text-link" onClick={()=>go('progress')}>{tr('View history')} <ArrowUpRight size={14}/></button></div>
          {errors.length > 0 && <div className="field-error" role="alert">{errors.length} {tr('values need attention. Changes are not saved until corrected. ')}</div>}
          {measurementRows.map(row=><div className="metric-card-grid measurement-line" key={row[0]}>{row.map(id=>activeMetrics.find(m=>m.id===id)).filter((m):m is Metric=>!!m).map(m=><MetricEditor dashboardCard onProfile={()=>go('profile')} key={`${auth.user?.id??'guest'}:${m.id}:${editorEpoch}`} metric={m} value={values[m.id]} details={details[m.id]} demographics={demographics} onValue={changeValue} onDetails={changeDetails} onEvidence={showEvidence} onCalculate={showCalculator} onEditingChange={setEditingId} onContextError={(id,error)=>setContextErrors(e=>({...e,[id]:error}))} readOnly={needsSetup || !editable}/>)}</div>)}
        </section>}

        {guestHistory.error&&<p className="field-error" role="alert">{tr(guestHistory.error)}</p>}
        {view === 'scenarios' && <PotentialGoals key={auth.user?.id??'guest'} owner={auth.user?.id??'guest'} values={values} demographics={demographics} onRecordMetric={id=>{if(needsSetup){setQuickStarter(id);start();}else openMeasurements(undefined,id);}}/>}
        {view==='progress'&&<div id="measurement-history"><Progress key={auth.user?.id??'guest'} metricId={historyMetric} onSelect={setHistoryMetric} guestEntries={guestHistory.entries} values={values} revision={cloudSave.saved?.revision??auth.cloud?.revision} disabled={!editable||needsSetup||errors.length>0} onMeasurements={()=>openMeasurements()} onRecord={id=>{panelTrigger.current=document.activeElement as HTMLElement;setRepeatMetric(id);}}/></div>}
        {view === 'profile' && <><div className="profile-grid"><div><section className="card profile-card"><div className="card-heading"><div><h2>{tr("About you")}</h2>{(cloudSave.saved?.ageRecordedAt??auth.cloud?.ageRecordedAt)&&Date.now()-Date.parse((cloudSave.saved?.ageRecordedAt??auth.cloud?.ageRecordedAt)!)>365*86400000&&<p>{tr("Review your age: it was last recorded over a year ago.")}</p>}</div><UserRound size={21}/></div>{profileSetup ? <fieldset disabled={!editable}><ProfileEdit key={`${auth.user?.id??'guest'}:${editorEpoch}`} profile={demographics} onChange={setDemographics} onValidityChange={setProfileValid}/></fieldset> : <p className="drawer-description">{tr("Add your basics to get started.")}</p>}{needsSetup && <button className="primary-button" disabled={!editable} onClick={start}>{tr("Create my profile ")}<ArrowRight size={16}/></button>}</section></div><div><section className="card summary-card"><div className="card-heading"><div><h2>{tr("Your performance passport")}</h2></div><Download size={20}/></div><div className="summary-score">{tr('Top')} {benchmarkGame(values,demographics).total??'—'}</div><p>{tr("Illustrative benchmark · ")}{tr(needsSetup ? 'awaiting measurements' : 'your measurements')}</p><TriadChart domains={result.domains} tops={benchmarkGame(values,demographics).sections} small/><button className="secondary-button" disabled={!benchmarkGame(values,demographics).total} onClick={downloadSummary}><Download size={16}/> {tr("Download passport")}</button><small>{tr(benchmarkGame(values,demographics).total ? 'SVG image · generated on this device' : 'Record a measurement to export.')}</small></section>{!auth.user && !needsSetup && <section className="card reset-card"><h3>{tr("Start over on this device")}</h3><p>{tr("Replace your local profile with a new one. Export your summary first if you want to keep it.")}</p><button className="text-link" disabled={!editable} onClick={() => { panelTrigger.current = document.activeElement as HTMLElement; setPanel('reset'); }}>{tr("Reset local profile ")}<ArrowRight size={14}/></button></section>}</div></div></>}
        {view === 'settings' && <>{!auth.user&&<BrowserDataControls onCleared={()=>{guestHistory.resetBaseline();lastValidEditor.current=undefined;setContextErrors({});setProfileValid(true);setValues({});setDetails({});setUsername('');setIsPublic(false);setDemographics(defaults);setProfileSetup(false);setEditorEpoch(n=>n+1);autoSetupOwner.current=null;setPanel('onboarding');}}/>}<AccountDataControls revision={cloudSave.saved?.revision??auth.cloud?.revision??0} canChange={editable&&!cloudSave.unsaved&&cloudSave.status!=='saving'&&!cloudSave.draft&&!cloudSave.reviewing&&errors.length===0&&profileValid} onPurged={p=>{cloudSave.cancelPending();cloudSave.discardDraft();applyProfile(p);auth.retry();}}/><section className="card account-card"><div className="card-heading"><div><h2>{tr("Account & sharing")}</h2></div><Lock size={21}/></div><CloudProfileControls publicFields={publicFields} onPublicFields={setPublicFields} username={username} onUsernameChange={next => { if (editable) setUsername(next); }} isPublic={isPublic} shareUsername={(cloudSave.saved??auth.cloud)?.isPublic ? (cloudSave.saved??auth.cloud)?.username : undefined} onVisibilityChange={changeVisibility} canWithdraw={!!auth.user&&canDisplayProfile} canShare={!needsSetup && !!auth.cloud && editable && errors.length === 0&&profileValid&&!cloudSave.draft&&!cloudSave.reviewing&&!cloudSave.conflict} onNotice={setToast}/></section></>}
        {view === 'methodology' && <Methodology onEvidence={showEvidence}/>}
        <footer className="page-footer"><span><Activity size={15}/><strong>{tr("TOP1.")}</strong></span><div><Link href="/about">{tr("About TOP1")}</Link><span>·</span><button onClick={() => go('profile')}>{tr("My profile")}</button><span>·</span><button onClick={() => go('settings')}>{tr("Settings")}</button><span>·</span><button onClick={() => go('methodology')}>{tr("Methodology")}</button><span>·</span><Link href="/privacy">{tr("Privacy")}</Link><span>·</span><a href={SUPPORT_HREF}>{tr("Support")}</a></div></footer>
        </>:<section className="card loading-panel" role="status">{tr(auth.error?'Your account could not be loaded. Retry above before making changes.':'Loading your profile…')}</section>}
      </main>
    </div>
    {toast && <div className="toast" role="status"><CircleHelp size={17}/><span>{tr(toast)}</span><button className="icon-button" aria-label={tr("Dismiss notification")} onClick={() => setToast('')}><X size={16}/></button></div>}
    {repeatMetric&&<Modal safetyAction={privacyAction} title={tr("Record a new observation")} returnFocus={panelTrigger.current} onClose={()=>setRepeatMetric(null)}><RepeatObservation metric={activeMetrics.find(m=>m.id===repeatMetric)!} value={values[repeatMetric]!} details={details[repeatMetric]??{}} demographics={demographics} onFinish={(value,context)=>{const id=repeatMetric;setValues(v=>({...v,[id]:value}));setDetails(d=>({...d,[id]:context}));setRepeatMetric(null);setToast('Reviewed observation recorded.');}}/></Modal>}
    {panel==='leave'&&<Modal safetyAction={privacyAction} title={tr("Leave without saving?")} returnFocus={panelTrigger.current} onClose={()=>setPanel(null)}><p>{tr(leaveUnfinished?'Some inputs are unfinished or invalid. Discard those inputs before leaving this view, or keep editing.':'Your routine changes could not be stored. Leaving may lose them.')}</p><button className="secondary-button" onClick={()=>setPanel(null)}>{tr("Keep working")}</button><button className="primary-button" onClick={()=>{if(leaveUnfinished){const saved=lastValidEditor.current;if(saved?.owner===(auth.user?.id??'guest'))applyProfile(saved.profile);else if(auth.cloud)applyProfile(cloudSave.saved??auth.cloud);}setPanel(null);setProgramRisk(false);go(leaveDestination,true);}}>{tr(leaveUnfinished?'Discard unfinished inputs and leave':'Leave without saving')}</button></Modal>}
    {panel==='import' && auth.guest && <Modal safetyAction={privacyAction} returnFocus={panelTrigger.current} title={tr("Review guest import")} onClose={()=>setPanel(null)}><p>{Object.keys(auth.guest.values).length} {tr("observations from this browser profile. Existing account measurements and basics take priority.")}</p><p>{tr("Import only if this is your data. Guest measurements are removed from this browser only after a successful, verified import.")}</p><button className="primary-button" disabled={auth.importing} onClick={()=>void auth.importGuest().then(p=>{if(p){setValues(p.values);setDetails(p.measurementDetails??{});setDemographics(p.demographics);setUsername(p.username);setProfileSetup((p.revision??0)>0);}setPanel(null);}).catch(()=>{})}>{tr(auth.importing?'Importing…':'Import into my account')}</button>{auth.error&&<p role="alert">{tr(auth.error)}</p>}</Modal>}
    {canDisplayProfile&&panel === 'onboarding' && <Modal safetyAction={privacyAction} returnFocus={panelTrigger.current} title={tr(needsSetup ? 'Welcome to TOP1' : 'Your starting point')} closeOnBackdrop={false} wide onClose={() => setPanel(null)}><Onboarding initialStarter={quickStarter} initialProfile={needsSetup ? undefined : demographics} initialValues={needsSetup ? {} : values} initialDetails={needsSetup ? {} : details} onFinish={finishSetup}/></Modal>}
    {canDisplayProfile&&panel === 'reset' && <Modal safetyAction={privacyAction} returnFocus={panelTrigger.current} title={tr("Reset this local profile?")} onClose={() => setPanel(null)}><p className="modal-description">{tr("This replaces the personal measurements stored on this device. Download your summary before continuing if you want a copy.")}</p><div className="modal-actions"><button className="secondary-button" onClick={() => setPanel(null)}>{tr("Keep my profile")}</button><button className="primary-button" onClick={() => { if (editable && !auth.user) { guestHistory.resetBaseline(); localReadFailed.current = false; try { ['top1-profile-v2','top1_profile_v2','top1-profile-v1'].forEach(key => localStorage.removeItem(key)); } catch { setLocalSaveError(true); } setValues({}); setDetails({}); setDemographics(defaults); setUsername(''); setIsPublic(false); setProfileSetup(false); autoSetupOwner.current = null; setPanel('onboarding'); } }}>{tr("Reset & start again")}</button></div></Modal>}
    {canDisplayProfile&&proof && <Modal safetyAction={privacyAction} returnFocus={panelTrigger.current} title={tr(proof.name)} onClose={() => setProof(null)}><span className="eyebrow">{tr(pillarNames[proof.pillar])}</span><p className="modal-description">{tr(proof.proofData.rationale)}</p><div className="proof-block"><h3>{tr("How to measure")}</h3><p>{tr(proof.proofData.instructions)}</p></div><div className="proof-block"><h3>{tr("Evidence & reference")}</h3><p>{tr(proof.proofData.study)}</p><p>{tr(proof.proofData.sampleSize)}</p>{proof.proofData.url && <a className="text-link" href={proof.proofData.url} target="_blank" rel="noreferrer">{tr("Read the source ")}<ArrowUpRight size={15}/></a>}</div><div className="proof-block"><h3>{tr("How TOP1 uses it")}</h3><p>{tr(!profileSetup ? 'Complete your profile to see the reference for your own age and biological sex. Most references remain provisional product assumptions.' : scoringEligibility(proof,demographics,details).status!=='eligible' ? scoringEligibility(proof,demographics,details).reason : `Experimental reference for ${reference(proof, demographics, details).cohortLabel??getAgeBracket(demographics.age)} · ${demographics.sex}. Mean ${fmt(reference(proof, demographics, details).mean, 2)}, standard deviation ${fmt(reference(proof, demographics, details).sd, 2)}. ${reference(proof, demographics, details).provenance === 'published' ? 'FRIEND 2022 direct treadmill CPET reference; explicit treadmill modality and a recorded test age of 20–89 are required.' : 'These reference parameters are provisional product assumptions.'}`)}</p></div><div className="science-note"><CircleHelp size={18}/><p>{tr("Study associations do not establish a universal target or population rank.")}</p></div></Modal>}
    {canDisplayProfile&&calculator && <Modal safetyAction={privacyAction} returnFocus={panelTrigger.current} title={tr(calculator.id === 'vo2_max' ? 'Cooper run estimate' : calculator.id === 'body_fat' ? 'Skinfold estimate' : 'One-rep max estimate')} onClose={() => setCalculator(null)}>{needsSetup ? <><p className="modal-description">{tr("Create a personal profile before saving a calculated measurement.")}</p><button className="primary-button" disabled={!editable} onClick={() => { setCalculator(null); start(); }}>{tr("Create my profile ")}<ArrowRight size={16}/></button></> : <MetricCalculator metric={calculator} demographics={demographics} onUse={(value, context) => { if (!editable) return; setValues(v => ({ ...v, [calculator.id]: value })); setDetails(d => ({ ...d, [calculator.id]: context })); setCalculator(null); setToast(`${calculator.name} estimate added.`); }}/>}</Modal>}
  </div>;
}
