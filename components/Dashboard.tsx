'use client';

import {recordedCoverage} from '@/lib/coverage';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, ChevronRight, CircleHelp, Download, LayoutDashboard, Lock, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, UserRound, X } from 'lucide-react';
import { useAuth } from './providers/AuthProvider';
import Progress from './Progress';
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

const Program = dynamic(() => import('./Program'), { loading: () => <div className="card loading-panel" role="status">Loading your program…</div> });
const defaults: Demographics = { age: 32, sex: 'male', weight: 78, height: 180 };
type View = 'overview' | 'measurements' | 'progress' | 'scenarios' | 'profile' | 'methodology';
const navigation = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'measurements', label: 'My metrics', icon: SlidersHorizontal },
  { id: 'scenarios', label: 'My program', icon: Sparkles },
] as const;
const pageTitles: Record<View, [string, string, string]> = {
  overview: ['YOUR PERFORMANCE, SIMPLIFIED', 'Your performance dashboard.', 'Understand your measurements and decide what to explore next.'],
  progress:['','Progress',''],
  measurements: ['YOUR MEASUREMENT LIBRARY', 'My metrics.', 'Every field is optional. Add real measurements at your own pace.'],
  scenarios: ['ROOM TO EXPLORE', 'My program.', 'Explore how hypothetical changes affect your experimental index.'],
  profile: ['YOUR SPACE, YOUR CHOICE', 'My profile & passport.', 'Manage your details, save your progress and choose what to share.'],
  methodology: ['THE THINKING BEHIND TOP1', 'Understand what your index means.', 'Clear methods, transparent assumptions and evidence you can explore.'],
};
const viewLabels: Record<View,string> = { overview:'Dashboard', measurements:'My metrics', scenarios:'My program', progress:'Progress', profile:'My profile', methodology:'Methodology' };

const tierOrder = { tier1_everyday: 0, tier2_standard: 1, tier3_precision: 2 };
const measurementPillars = [pillars[1], pillars[2], pillars[0]];
const fmt = (n: number, d = 1) => n.toFixed(d).replace(/\.0$/, '');
function currentView(): View {
  const value = new URLSearchParams(window.location.search).get('view');
  return value && Object.keys(pageTitles).includes(value) ? value as View : 'overview';
}

export default function Dashboard() {
  const auth = useAuth();
  const [view, setView] = useState<View>('overview');
  const [values, setValues] = useState<Values>({}), [demographics, setDemographics] = useState<Demographics>(defaults);
  const [details, setDetails] = useState<MeasurementMetadata>({}), [profileSetup, setProfileSetup] = useState(false), [loaded, setLoaded] = useState(false);
  const [username, setUsername] = useState(''), [isPublic, setIsPublic] = useState(false), [profileAccount, setProfileAccount] = useState<string | null>(null);
  const loadedUser = useRef<string | undefined>(undefined), localReadFailed = useRef(false);
  const [localSaveError, setLocalSaveError] = useState(false);
  const [pillar, setPillar] = useState<PillarId | 'all'>('all');
  const [profileValid,setProfileValid]=useState(true);
  const [contextErrors,setContextErrors]=useState<Record<string,string>>({});
  useEffect(()=>{setContextErrors({});setEditingId(null);setProfileValid(true);},[auth.user?.id]);
  const [historyMetric,setHistoryMetric]=useState('pushups');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordFilter, setRecordFilter] = useState<'all' | 'recorded' | 'missing'>('all');
  const [panel, setPanel] = useState<'onboarding' | 'reset' | 'import' | null>(null), [proof, setProof] = useState<Metric | null>(null), [calculator, setCalculator] = useState<Metric | null>(null), [toast, setToast] = useState('');
  const needsSetup = !profileSetup;
  const autoSetupOwner = useRef<string | null>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const panelTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setView(currentView());
    function handleBack() { setView(currentView()); }
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
      setDemographics(auth.cloud.demographics); setUsername(auth.cloud.username); setIsPublic(auth.cloud.isPublic); setProfileSetup((auth.cloud.revision ?? 0) > 0 || Object.keys(auth.cloud.values).length > 0);
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
  useEffect(() => { document.title = `${viewLabels[view]} · TOP1`; }, [view]);




  const cloudProfile = useMemo<ProfileState>(() => ({ values, demographics, username, isPublic, measurementDetails: details, revision: auth.cloud?.revision ?? 0 }), [values, demographics, username, isPublic, details, auth.cloud?.revision]);
  const errors = activeMetrics.filter(m => {if(contextErrors[m.id]||values[m.id]!==undefined&&!valid(m,values[m.id]))return true;try{normalizeMeasurementMetadata({[m.id]:details[m.id]??{}});return false;}catch{return true;}});
  const cloudSave = useCloudSave(cloudProfile, loaded && !needsSetup && profileAccount === auth.user?.id && errors.length === 0 && profileValid, !!editingId);
  useEffect(()=>{if(cloudSave.saved)setIsPublic(cloudSave.saved.isPublic);},[cloudSave.saved]);
  useEffect(() => {
    if(!cloudSave.draftReady||cloudSave.draft||cloudSave.reviewing)return;
    if (!loaded || !auth.ready || auth.loading || profileSetup || localReadFailed.current) return;
    if (auth.user && (!auth.cloud || loadedUser.current !== auth.user.id || (auth.cloud.revision ?? 0) > 0 || Object.keys(auth.cloud.values).length > 0)) return;
    const owner = auth.user?.id ?? 'guest';
    if (autoSetupOwner.current === owner) return;
    autoSetupOwner.current = owner;
    panelTrigger.current = document.activeElement as HTMLElement;
    setPanel('onboarding');captureEvent('onboarding_started');
  }, [loaded, auth.ready, auth.loading, auth.user, auth.cloud, profileSetup,cloudSave.draftReady,cloudSave.draft,cloudSave.reviewing]);
  const result = useMemo(() => evaluate(values, demographics, details), [values, demographics, details]);
  const editable = loaded && auth.ready && !auth.loading && (!auth.user || profileAccount === auth.user.id);
  const guestHistory=useGuestHistory(values,details,auth.user?.id??'guest',loaded&&auth.ready&&!auth.loading&&errors.length===0,!!editingId);
  const filtered = activeMetrics.filter(m => (pillar === 'all' || m.pillar === pillar) && (editingId === m.id || recordFilter === 'all' || (recordFilter === 'recorded' ? valid(m, values[m.id]) : !valid(m, values[m.id])))).sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

  useEffect(() => {
    if (!errors.length && !localSaveError && !cloudSave.unsaved && cloudSave.status !== 'saving' && cloudSave.status !== 'error') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [errors.length, localSaveError, cloudSave.status, cloudSave.unsaved]);
  function go(next: View) {
    setView(next);
    const url = new URL(window.location.href); if (next === 'overview') url.searchParams.delete('view'); else url.searchParams.set('view', next);
    window.history.pushState(null, '', url); window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => pageHeading.current?.focus());
  }
  function openMeasurements(next?: PillarId) { setEditingId(null); setPillar(next ?? 'all'); setRecordFilter('all'); go('measurements'); }
  function start() { panelTrigger.current = document.activeElement as HTMLElement; if (editable){setPanel('onboarding');captureEvent('onboarding_started');} else setToast('Wait for your profile to finish loading before making changes.'); }
  function showEvidence(metric: Metric) { panelTrigger.current = document.activeElement as HTMLElement; setProof(metric); }
  function showCalculator(metric: Metric) { panelTrigger.current = document.activeElement as HTMLElement; setCalculator(metric); }
  function changeValue(id: string, raw: string) {
    if (!editable || needsSetup) return;
    setValues(current => ({ ...current, [id]: raw.trim() ? Number(raw) : undefined }));
  }
  function changeDetails(id: string, next: MeasurementDetails) { if (editable && !needsSetup) setDetails(current => ({ ...current, [id]: next })); }
  async function changeVisibility(next: boolean) {
    if (errors.length) throw new Error('Correct invalid measurements before changing visibility.');
    if (needsSetup || !auth.cloud || !editable) throw new Error('Load your personal profile before sharing.');
    cloudSave.cancelPending(); await cloudSave.save({ ...cloudProfile, isPublic: next },{visibilityIntent:true}); setIsPublic(next); setToast(next ? 'Your summary is now public.' : 'Your profile is now private.');
  }
  function applyProfile(profile:ProfileState){setValues(profile.values);setDetails(profile.measurementDetails??{});setDemographics(profile.demographics);setUsername(profile.username);setIsPublic(profile.isPublic);setProfileSetup((profile.revision??0)>0||Object.keys(profile.values).length>0);setContextErrors({});setEditingId(null);setProfileValid(true);}
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
    if (!result.ready) return;
    const bars = pillars.map((p, i) => { const z = result.domains[p.id]; return `<text x="40" y="${230 + i * 60}" font-size="16" fill="#e5e7eb">${pillarNames[p.id]}</text><text x="440" y="${230 + i * 60}" text-anchor="end" font-size="16" fill="#e5e7eb">${z === undefined ? 'Tracking only' : fmt(50 + 15 * z) + ' /100'}</text>`; }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="540" viewBox="0 0 480 540"><rect width="480" height="540" rx="24" fill="#111827"/><g font-family="Arial"><text x="40" y="65" font-size="30" font-weight="bold" fill="#f3f4f6">TOP1</text><text x="40" y="100" font-size="13" fill="#9ca3af">PERSONAL SUMMARY · EXPERIMENTAL MODEL</text><text x="40" y="173" font-size="52" fill="#f3f4f6">${fmt(result.modelScore)} /100</text>${bars}<text x="40" y="425" font-size="13" fill="#9ca3af">${fmt(recordedCoverage(result.measured.length))}% coverage · ${result.measured.length}/${activeMetrics.length} measurements</text><text x="40" y="465" font-size="12" fill="#9ca3af">Not a health score, population rank or medical assessment.</text><text x="40" y="505" font-size="12" fill="#9ca3af">${new Date().toISOString().slice(0, 10)} · Generated on your device</text></g></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); const a = document.createElement('a'); a.href = url; a.download = 'TOP1-profile-summary.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setToast('Profile summary downloaded.');
  }
  return <div className={`app-shell view-${view}`}>
    <a tabIndex={panel || proof || calculator ? -1 : undefined} className="skip-link" href="#main-content">Skip to content</a>

    <aside inert={panel || proof || calculator ? true : undefined} className="sidebar" aria-label="Main navigation">
      <Link href="/" className="brand" onClick={e => { e.preventDefault(); go('overview'); }}><span className="protocol-mark"><i/><i/></span><span>TOP1</span></Link>

      <nav>{navigation.map(n => <a key={n.id} href={n.id === 'overview' ? '/' : `/?view=${n.id}`} className={(view === n.id || n.id==='measurements' && view==='progress') ? 'active' : ''} aria-current={(view === n.id || n.id==='measurements' && view==='progress') ? 'page' : undefined} onClick={e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go(n.id); }}><n.icon size={19}/><span>{n.label}</span>{(view === n.id || n.id==='measurements' && view==='progress') && <span className="active-dot"/>}</a>)}</nav>
      <div className="header-account">{auth.user ? <button className="account-chip" aria-label="My profile" onClick={() => go('profile')}><span>{username ? `@${username}` : 'My profile'}</span><span className="avatar"><UserRound size={17}/></span></button> : <div className="auth-entry-actions"><Link className="header-login" href={authEntryPath('sign-in')}>Log in</Link><Link className="header-join" href={authEntryPath('sign-up')}>Join TOP1 <ArrowRight size={15}/></Link></div>}</div>
    </aside>
    <div inert={panel || proof || calculator ? true : undefined} className="main-wrap"><header className="topbar"><div className="topbar-right">{auth.user ? <button className="mobile-profile-account icon-button" aria-label="My profile" onClick={() => go('profile')}><UserRound size={19}/></button> : <div className="auth-entry-actions"><Link className="header-login" href={authEntryPath('sign-in')}>Log in</Link><Link className="header-join" href={authEntryPath('sign-up')}>Join TOP1 <ArrowRight size={15}/></Link></div>}</div></header>
      <main id="main-content" className="workspace-main">
        {localSaveError && !auth.user && <div className="cloud-error" role="alert"><span>Your changes are only in memory. Device storage is unavailable. Keep this page open or sign in to save.</span><Link href="/sign-in">Sign in</Link></div>}
        {auth.error && <div className="cloud-error" role="alert"><span>{auth.error}</span><button onClick={auth.retry}>Retry</button></div>}
        {auth.guest && <div className="cloud-error"><span>A guest profile is available in this browser. Review it before importing into your account.</span><button onClick={()=>{panelTrigger.current=document.activeElement as HTMLElement;setPanel('import');}}>Review import</button><button onClick={auth.dismissGuest}>Keep separate</button></div>}
        {cloudSave.draft && <div className="cloud-error" role="status"><span>An unsaved draft is available{cloudSave.draft.revision!==auth.cloud?.revision?' from an older profile revision':''}. Review it before saving.</span><button disabled={cloudSave.status==='saving'} onClick={()=>{const p=cloudSave.restoreDraft();if(p){applyProfile(p);setProfileSetup(true);}}}>Review draft</button><button onClick={()=>downloadDraft(cloudSave.draft!)}>Download draft</button><button disabled={cloudSave.status==='saving'} onClick={keepSavedProfile}>Keep saved profile</button></div>}
        {cloudSave.reviewing && <div className="cloud-error" role="status"><span>Reviewing your retained draft. It has not overwritten the saved profile.</span><button disabled={errors.length>0||!profileValid||cloudSave.status==='saving'} onClick={()=>void cloudSave.save(cloudProfile).catch(()=>{})}>Save reviewed draft</button><button onClick={()=>downloadDraft(cloudProfile)}>Download draft</button><button disabled={cloudSave.status==='saving'} onClick={keepSavedProfile}>Discard draft</button></div>}
        {cloudSave.error && <div className="cloud-error" role="alert"><span>{cloudSave.error}</span><button disabled={!cloudSave.conflict&&(errors.length>0||!profileValid)} onClick={() => cloudSave.conflict ? auth.retry() : void cloudSave.save(cloudProfile).catch(() => {})}>{cloudSave.conflict ? 'Review latest profile' : 'Retry save'}</button><button onClick={()=>downloadDraft(cloudProfile)}>Download draft</button></div>}
        <div className={`page-heading ${view === 'overview' ? 'compact-page-heading' : ''}`}><h1 tabIndex={-1} ref={pageHeading}>{viewLabels[view]}</h1></div>
        {needsSetup && !panel && <div className="setup-invitation"><p>Your profile is empty.</p><button className="primary-button" disabled={!editable} onClick={start}>Set up my profile <ArrowRight size={15}/></button></div>}
        {view === 'overview' && <Overview result={result} values={values} needsSetup={needsSetup} onMeasurements={openMeasurements} onStart={start} onScenarios={() => go('scenarios')} onScience={() => go('methodology')} onCalculationReport={downloadCalculationReport}/>}
        {view === 'measurements' && <section className="card measurement-library"><div className="live-ranking" role="status" aria-live="polite"><div><strong>{result.measured.length} measurements recorded</strong><small>Changes appear immediately. Compare dated observations to follow progress.</small></div></div><button className="text-link" onClick={()=>go('progress')}>View progress history</button><div className="measurement-tabs" role="group" aria-label="Measurement category"><button className={pillar === 'all' ? 'active' : ''} aria-pressed={pillar === 'all'} onClick={() => setPillar('all')}>All measurements</button>{pillars.map(p => <button key={p.id} className={pillar === p.id ? 'active' : ''} aria-pressed={pillar === p.id} onClick={() => setPillar(p.id)}>{pillarNames[p.id]}</button>)}</div><div className="library-filters"><label>Status<select aria-label="Filter by recording status" value={recordFilter} onChange={e => setRecordFilter(e.target.value as typeof recordFilter)}><option value="all">All measurements</option><option value="recorded">Recorded</option><option value="missing">Not yet recorded</option></select></label></div>{errors.length > 0 && <div className="field-error" role="alert">{errors.length} values need attention. Changes are not saved until corrected. <button className="text-link" onClick={() => { setPillar('all'); setRecordFilter('all'); }}>Show all measurements</button></div>}{filtered.length ? measurementPillars.filter(p => filtered.some(m => m.pillar === p.id)).map(p => <div className="metric-group" key={p.id}><div className="metric-group-title"><span className={`category-dot ${p.id}`}/><h3>{pillarNames[p.id]}</h3><span>{filtered.filter(m => m.pillar === p.id).length} {filtered.filter(m => m.pillar === p.id).length === 1 ? 'measurement' : 'measurements'}</span></div><div className="metric-card-grid">{filtered.filter(m => m.pillar === p.id).map(m => <MetricEditor key={m.id} metric={m} value={values[m.id]} details={details[m.id]} demographics={demographics} onValue={changeValue} onDetails={changeDetails} onEvidence={showEvidence} onCalculate={showCalculator} onEditingChange={setEditingId} onContextError={(id,error)=>setContextErrors(e=>({...e,[id]:error}))} readOnly={needsSetup || !editable}/>)}</div></div>) : <div className="empty-state"><Search size={28}/><h3>No measurements with this status.</h3><p>Choose another category or reset the Status filter.</p><button className="secondary-button" onClick={() => { setPillar('all'); setRecordFilter('all'); }}>Reset filters</button></div>}{metrics.some(m => m.archived && values[m.id] !== undefined) && <div className="science-note"><p>Preserved legacy observations: {metrics.filter(m => m.archived && values[m.id] !== undefined).map(m => `${m.name}: ${values[m.id]} ${m.unit}`).join(' · ')}. These stay outside active scores and coverage.</p></div>}<div className="library-foot"><ShieldCheck size={15}/><p>Tracking-only entries stay outside the experimental model.</p><button className="text-link" onClick={() => go('methodology')}>How scoring works <ArrowUpRight size={14}/></button></div></section>}
        {view==='progress'&&<Progress metricId={historyMetric} onSelect={setHistoryMetric} guestEntries={guestHistory.entries} values={values} revision={cloudSave.saved?.revision??auth.cloud?.revision} disabled={!editable||needsSetup||errors.length>0} onMeasurements={()=>openMeasurements()} onRecord={id=>{setDetails(d=>({...d,[id]:{...d[id],measuredAt:new Date().toISOString()}}));setToast('New dated observation added.');}}/>}
        {guestHistory.error&&<p className="field-error" role="alert">{guestHistory.error}</p>}
        {view === 'scenarios' && <Program key={auth.user?.id ?? 'local'} values={values} demographics={demographics} details={details} onMeasurements={needsSetup ? start : () => openMeasurements()} onScience={() => go('methodology')}/>}
        {view === 'profile' && <div className="profile-grid"><div><section className="card profile-card"><div className="card-heading"><div><h2>About you</h2></div><UserRound size={21}/></div>{profileSetup ? <fieldset disabled={!editable}><ProfileEdit profile={demographics} onChange={setDemographics} onValidityChange={setProfileValid}/></fieldset> : <p className="drawer-description">Add your basics to get started.</p>}{needsSetup && <button className="primary-button" disabled={!editable} onClick={start}>Create my profile <ArrowRight size={16}/></button>}</section><section className="card account-card"><div className="card-heading"><div><h2>Account & sharing</h2></div><Lock size={21}/></div><CloudProfileControls username={username} onUsernameChange={next => { if (editable) setUsername(next); }} isPublic={isPublic} shareUsername={(cloudSave.saved??auth.cloud)?.isPublic ? (cloudSave.saved??auth.cloud)?.username : undefined} onVisibilityChange={changeVisibility} canShare={!needsSetup && !!auth.cloud && editable && errors.length === 0} onNotice={setToast}/></section></div><div><section className="card summary-card"><div className="card-heading"><div><h2>Your performance passport</h2></div><Download size={20}/></div><div className="summary-score">{result.ready ? fmt(result.modelScore) : '—'}<span>/100</span></div><p>Experimental model index · {needsSetup ? 'awaiting measurements' : 'your measurements'}</p><TriadChart domains={result.domains} small/><button className="secondary-button" disabled={!result.ready} onClick={downloadSummary}><Download size={16}/> Download passport</button><small>{result.ready ? 'SVG image · generated on this device' : 'Record 3 eligible measurements across 2 pillars to export.'}</small></section>{!auth.user && !needsSetup && <section className="card reset-card"><h3>Start over on this device</h3><p>Replace your local profile with a new one. Export your summary first if you want to keep it.</p><button className="text-link" disabled={!editable} onClick={() => { panelTrigger.current = document.activeElement as HTMLElement; setPanel('reset'); }}>Reset local profile <ArrowRight size={14}/></button></section>}</div></div>}
        {view === 'methodology' && <Methodology onEvidence={showEvidence}/>}
        <footer className="page-footer"><span><Activity size={15}/><strong>TOP1.</strong></span><div><button onClick={() => go('profile')}>My profile</button><span>·</span><button onClick={() => go('methodology')}>Methodology</button><span>·</span><Link href="/privacy">Privacy</Link><span>·</span><span>Experimental model</span></div></footer>
      </main>
    </div>
    {toast && <div className="toast" role="status"><CircleHelp size={17}/><span>{toast}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16}/></button></div>}
    {panel==='import' && auth.guest && <Modal returnFocus={panelTrigger.current} title="Review guest import" onClose={()=>setPanel(null)}><p>{Object.keys(auth.guest.values).length} observations from this browser profile. Existing account measurements and basics take priority.</p><p>Import only if this is your data. Guest measurements are removed from this browser only after a successful, verified import.</p><button className="primary-button" disabled={auth.importing} onClick={()=>void auth.importGuest().then(p=>{if(p){setValues(p.values);setDetails(p.measurementDetails??{});setDemographics(p.demographics);setUsername(p.username);setProfileSetup((p.revision??0)>0);}setPanel(null);}).catch(()=>{})}>{auth.importing?'Importing…':'Import into my account'}</button>{auth.error&&<p role="alert">{auth.error}</p>}</Modal>}
    {panel === 'onboarding' && <Modal returnFocus={panelTrigger.current} title={needsSetup ? 'Welcome to TOP1' : 'Your starting point'} closeOnBackdrop={false} wide onClose={() => setPanel(null)}><Onboarding initialProfile={needsSetup ? undefined : demographics} initialValues={needsSetup ? {} : values} initialDetails={needsSetup ? {} : details} onFinish={finishSetup}/></Modal>}
    {panel === 'reset' && <Modal returnFocus={panelTrigger.current} title="Reset this local profile?" onClose={() => setPanel(null)}><p className="modal-description">This replaces the personal measurements stored on this device. Download your summary before continuing if you want a copy.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setPanel(null)}>Keep my profile</button><button className="primary-button" onClick={() => { if (editable && !auth.user) { localReadFailed.current = false; try { ['top1-profile-v2','top1_profile_v2','top1-profile-v1'].forEach(key => localStorage.removeItem(key)); } catch { setLocalSaveError(true); } setValues({}); setDetails({}); setDemographics(defaults); setUsername(''); setIsPublic(false); setProfileSetup(false); autoSetupOwner.current = null; setPanel('onboarding'); } }}>Reset & start again</button></div></Modal>}
    {proof && <Modal returnFocus={panelTrigger.current} title={proof.name} onClose={() => setProof(null)}><span className="eyebrow">{pillarNames[proof.pillar]}</span><p className="modal-description">{proof.proofData.rationale}</p><div className="proof-block"><h3>How to measure</h3><p>{proof.proofData.instructions}</p></div><div className="proof-block"><h3>Evidence & reference</h3><p>{proof.proofData.study}</p><p>{proof.proofData.sampleSize}</p>{proof.proofData.url && <a className="text-link" href={proof.proofData.url} target="_blank" rel="noreferrer">Read the source <ArrowUpRight size={15}/></a>}</div><div className="proof-block"><h3>How TOP1 uses it</h3><p>{!profileSetup ? 'Complete your profile to see the reference for your own age and biological sex. Most references remain provisional product assumptions.' : scoringEligibility(proof,demographics,details).status!=='eligible' ? scoringEligibility(proof,demographics,details).reason : `Experimental reference for ${reference(proof, demographics, details).cohortLabel??getAgeBracket(demographics.age)} · ${demographics.sex}. Mean ${fmt(reference(proof, demographics, details).mean, 2)}, standard deviation ${fmt(reference(proof, demographics, details).sd, 2)}. ${reference(proof, demographics, details).provenance === 'published' ? 'FRIEND 2015 direct treadmill CPET reference; explicit treadmill modality and a recorded test age of 20–79 are required.' : 'These reference parameters are provisional product assumptions.'}`}</p></div><div className="science-note"><CircleHelp size={18}/><p>Study associations do not establish a universal target or population rank.</p></div></Modal>}
    {calculator && <Modal returnFocus={panelTrigger.current} title={calculator.id === 'vo2_max' ? 'Cooper run estimate' : calculator.id === 'body_fat' ? 'Skinfold estimate' : 'One-rep max estimate'} onClose={() => setCalculator(null)}>{needsSetup ? <><p className="modal-description">Create a personal profile before saving a calculated measurement.</p><button className="primary-button" disabled={!editable} onClick={() => { setCalculator(null); start(); }}>Create my profile <ArrowRight size={16}/></button></> : <MetricCalculator metric={calculator} demographics={demographics} onWeight={weight=>setDemographics(d=>({...d,weight}))} onUse={(value, context) => { if (!editable) return; setValues(v => ({ ...v, [calculator.id]: value })); setDetails(d => ({ ...d, [calculator.id]: context })); setCalculator(null); setToast(`${calculator.name} estimate saved.`); }}/>}</Modal>}
  </div>;
}
