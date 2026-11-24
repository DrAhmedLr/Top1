'use client';
import {usePersonalWorkspace} from '@/lib/hooks/usePersonalWorkspace';
import PerformanceBoard from './PerformanceBoard';
import TrainingHome from './TrainingHome';
import type {RegionalCalendar} from '@/lib/regionalCalendar';
import HomePreferences from './HomePreferences';
import {homeShortcutKey,useHomeShortcut} from '@/lib/homeShortcut';
import {useRecentMeasurements} from '@/lib/hooks/useRecentMeasurements';
import {useAdaptiveTraining} from '@/lib/adaptiveProgramClient';
const AdaptiveProgram=dynamic(()=>import('./AdaptiveProgram'));
const RankExplorer=dynamic(()=>import('./RankExplorer'));
import TrainingPreferences from './TrainingPreferences';
import TrainingProfileDossier from './TrainingProfileDossier';
import {buildAthleteDossier} from '@/lib/athleteDossier';
import {buildProgram} from '@/lib/adaptiveProgram';
import {createGuidedConfig} from '@/lib/datedProgram';
const FirstVisitAssessment=dynamic(()=>import('./FirstVisitAssessment'));
const WelcomeGateway=dynamic(()=>import('./WelcomeGateway'));
import type {AssessmentCommitPayload} from './FirstVisitAssessment';
import {COMPETITIVE_CHALLENGE_METRICS} from '@/lib/competitiveMetrics';
import {performanceProfileAtTest} from '@/lib/performanceContext';
import {overallChangeForSave} from '@/lib/overallPerformance';
import {challengeProgress} from '@/lib/challengeProgress';
import {FIELD_BENCHMARK_METRICS} from '@/lib/fieldBenchmarks';
import BenchmarkReference from './BenchmarkReference';
import {useTranslations} from '@/components/providers/LocaleProvider';

import {run10kBenchmarks,formatRunTime} from '@/lib/run10kReference';
import {SUPPORT_HREF} from '@/lib/site';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, CircleHelp, Lock, UserRound, X } from 'lucide-react';
import { useAuth } from './providers/AuthProvider';
import {minimalPublicFields,type PublicFields} from '@/lib/sharing';
const RepeatObservation=dynamic(()=>import('./RepeatObservation'));

const AccountDataControls=dynamic(()=>import('./AccountDataControls'));
import BrowserDataControls from './BrowserDataControls';
import {useGuestHistory} from '@/lib/hooks/useGuestHistory';
import { useCloudSave } from '@/lib/hooks/useCloudSave';
import { captureEvent,recordView } from '@/lib/analytics';
import { normalizeValues, type ProfileState } from '@/lib/profile';
import {GuestProfileConflictError,GuestProfileReadError,readGuestProfile,writeGuestProfile} from '@/lib/guestProfileStorage';
import { reference, scoringEligibility, valid } from '@/lib/engine';
import { activeMetrics, metrics, pillarNames, type Demographics, type Metric, type Values } from '@/lib/registry';
import { getAgeBracket } from '@/lib/demographics';
import { type MeasurementDetails, type MeasurementMetadata,normalizeMeasurementMetadata } from '@/lib/measurementMetadata';
const ProfileEdit=dynamic(()=>import('./ProfileEdit'));
const CloudProfileControls=dynamic(()=>import('./CloudProfileControls'));
import GameProgressSync from './GameProgressSync';
import ConnectionStatus from './ConnectionStatus';
import PerformanceShell from './PerformanceShell';
import ProfileMenu from './ProfileMenu';
const ProfileLadder=dynamic(()=>import('./ProfileLadder'));
import {ladderKey} from '@/lib/profileLadder';
import UsageAnalyticsSettings from './UsageAnalyticsSettings';
import {appView, viewHref, viewTitles, type AppView as View} from '@/lib/appViews';
import {clearCheckpoint,migrateCheckpoint} from '@/lib/journeyProgress';
import MetricEditor from './MetricEditor';
import Modal from './Modal';
import {GuestImportPrompt,GuestImportReview} from './GuestProfileImport';
const Onboarding=dynamic(()=>import('./Onboarding'));
const Methodology=dynamic(()=>import('./Methodology'));
const MetricCalculator=dynamic(()=>import('./MetricCalculator'));
import {baselineStorageKey} from '@/lib/balancedBaseline';
import {trainingKey} from '@/lib/trainingStorage';
import {useBodyweight,weightBrowserKeys} from '@/lib/hooks/useBodyweight';
import {importedBaselineChoices} from '@/lib/baselineStorage';

function HistoryLoading(){const {t}=useTranslations();return <p role="status">{t('Loading history…')}</p>;}
const Progress=dynamic(()=>import('./Progress'),{loading:HistoryLoading});
const defaults: Demographics = { age: 32, sex: 'male', weight: 78, height: 180 };
const fmt = (n: number, d = 1) => n.toFixed(d).replace(/\.0$/, '');
const validHistoryMetric = (id: string | null) => (id==='bodyweight'||metrics.some(metric=>metric.id===id)) ? id! : 'pushups';

export default function Dashboard({initialView='overview',initialMetric=null,initialCalendar}:{initialView?:View;initialMetric?:string|null;initialCalendar?:RegionalCalendar|null}) {
 const {t:tr,locale}=useTranslations();
 const local=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;

  const auth = useAuth();
  const personalWorkspace=usePersonalWorkspace(auth.user?.id??'guest');
  const routeSearch=useSearchParams().toString();
  const linkQuery=new URLSearchParams(routeSearch);
  const programMetric=appView(linkQuery)==='potential'?linkQuery.get('metric')??undefined:undefined;
  const aimForNextTier=!!programMetric&&linkQuery.get('aim')==='next';
  const [view, setView] = useState<View>(initialView);
  const [values, setValues] = useState<Values>({}), [demographics, setDemographics] = useState<Demographics>(defaults);
  const [details, setDetails] = useState<MeasurementMetadata>({}), [profileSetup, setProfileSetup] = useState(false), [loaded, setLoaded] = useState(false);
  const [privacyBusy,setPrivacyBusy]=useState(false);
  const [publicFields,setPublicFields]=useState<PublicFields>(minimalPublicFields);
  const [username, setUsername] = useState(''), [isPublic, setIsPublic] = useState(false), [profileAccount, setProfileAccount] = useState<string | null>(null);
  const loadedUser = useRef<string | undefined>(undefined);
  const expectedGuestProfile=useRef<ProfileState|null>(null);
  const [guestConflict,setGuestConflict]=useState(false);
  const [guestProfileUnreadable,setGuestProfileUnreadable]=useState(false);
  const [localSaveError, setLocalSaveError] = useState(false);
  const [focusOpen,setFocusOpen]=useState(false);
  const [repeatGoalUnit,setRepeatGoalUnit]=useState<'metric'|'kg'>();
  const [repeatMetric,setRepeatMetric]=useState<string|null>(null);
  const [entryFromTracker,setEntryFromTracker]=useState<string>();
  const repeatSaving=useRef(false);
  const [profileValid,setProfileValid]=useState(true);
  const [contextErrors,setContextErrors]=useState<Record<string,string>>({});
  useEffect(()=>{setContextErrors({});setEditingId(null);setProfileValid(true);},[auth.user?.id]);
  const [historyMetric,setHistoryMetric]=useState(()=>validHistoryMetric(initialMetric));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'onboarding' | 'reset' | 'import' | 'leave' | null>(null), [proof, setProof] = useState<Metric | null>(null), [calculator, setCalculator] = useState<Metric | null>(null), [toast, setToast] = useState('');
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [introCompleted, setIntroCompleted] = useState(false);
  const [assessmentDismissed, setAssessmentDismissed] = useState(false);
  const [leaveDestination,setLeaveDestination]=useState<{view:View;metric?:string;aim?:boolean}>({view:'overview'});
  const [editorEpoch,setEditorEpoch]=useState(0),[leaveUnfinished,setLeaveUnfinished]=useState(false);
  const unfinishedRef=useRef(false),lastValidEditor=useRef<{owner:string;profile:ProfileState}|undefined>(undefined);
  const routeRef=useRef({view,historyMetric});routeRef.current={view,historyMetric};
  useEffect(()=>{setCalculator(null);setProof(null);setPanel(null);setRepeatMetric(null);setEntryFromTracker(undefined);lastValidEditor.current=undefined;setEditorEpoch(n=>n+1);},[auth.user?.id]);
  const needsSetup = !profileSetup;
  const panelTrigger = useRef<HTMLElement | null>(null);

  useEffect(()=>{
    const search=new URLSearchParams(routeSearch), wanted=appView(search);
    const metric=validHistoryMetric(search.get('metric'));
    const previous=routeRef.current;
    if(wanted===previous.view&&(!['progress','potential','ranking'].includes(wanted)||metric===previous.historyMetric))return;
    if(unfinishedRef.current&&wanted!==previous.view){
      setLeaveUnfinished(true);setLeaveDestination({view:wanted,metric,aim:search.get('aim')==='next'});
      window.history.pushState(null,'',viewHref(previous.view,previous.historyMetric));
      panelTrigger.current=document.activeElement as HTMLElement;setPanel('leave');return;
    }
    setPanel(null);setProof(null);setCalculator(null);setRepeatMetric(null);
    setView(wanted);setEntryFromTracker(undefined);setHistoryMetric(metric);focusPage();
  },[routeSearch]);

  function restoreGuestProfile(keepEditorOnFailure=false) {
    let profile:ProfileState|null=null;
    try {
      profile=readGuestProfile(key=>localStorage.getItem(key));
      expectedGuestProfile.current=profile;setGuestConflict(false);setGuestProfileUnreadable(false);
    } catch {
      setGuestProfileUnreadable(true);
      if(keepEditorOnFailure)return;
    }
    setValues(profile?.values??{});
    setDetails(profile?.measurementDetails??{});
    setDemographics(profile?.demographics??defaults);
    setProfileSetup(!!profile);
    return profile;
  }
  function storeGuestProfile(snapshot:Parameters<typeof writeGuestProfile>[1]) {
    try { expectedGuestProfile.current=writeGuestProfile(localStorage,snapshot,expectedGuestProfile.current); }
    catch(error) {
      if(error instanceof GuestProfileConflictError)setGuestConflict(true);
      if(error instanceof GuestProfileReadError){
        setGuestProfileUnreadable(true);
        setPanel(null);
        setEditorEpoch(epoch=>epoch+1);
      }
      throw error;
    }
  }
  useEffect(() => {
    restoreGuestProfile();
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (auth.user && auth.cloud && loadedUser.current !== auth.user.id) {
      loadedUser.current = auth.user.id; setProfileAccount(auth.user.id); setValues(auth.cloud.values); setDetails(auth.cloud.measurementDetails ?? {});
      setDemographics(auth.cloud.demographics);setPublicFields(auth.cloud.publicFields??minimalPublicFields); setUsername(auth.cloud.username); setIsPublic(auth.cloud.isPublic); setProfileSetup((auth.cloud.revision ?? 0) > 0 || Object.keys(auth.cloud.values).length > 0);
    } else if (auth.ready && !auth.user && loadedUser.current) {
      loadedUser.current = undefined; setProfileAccount(null); restoreGuestProfile(); setUsername(''); setIsPublic(false);
    }
  }, [auth.user, auth.cloud, auth.ready]);
  useEffect(() => {
    if (loaded && profileSetup && auth.ready && !auth.user && profileAccount === null && !guestConflict && !guestProfileUnreadable && !activeMetrics.some(m => values[m.id] !== undefined && !valid(m, values[m.id]))) {
      try { storeGuestProfile({values:normalizeValues(values),demographics,measurementDetails:details}); setLocalSaveError(false); }
      catch(error) { if(!(error instanceof GuestProfileReadError||error instanceof GuestProfileConflictError)){setLocalSaveError(true); setToast('Device storage is unavailable. Keep this page open to retain your profile.');} }
    }
  }, [values, demographics, profileSetup, details, loaded, auth.ready, auth.user, profileAccount,guestProfileUnreadable,guestConflict]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timer); } }, [toast]);
  useEffect(()=>{if(loaded)recordView(view==='performance'?'measurements':view==='potential'?'program':view);},[view,loaded]);
  useEffect(()=>{if(auth.ready&&auth.user){const url=new URL(window.location.href);if(url.searchParams.get('confirmed')==='1'){captureEvent('signup_confirmed');url.searchParams.delete('confirmed');window.history.replaceState(null,'',url);}}},[auth.ready,auth.user]);
  useEffect(() => { document.title = `${local(...viewTitles[view])} · TOP1`; }, [view,locale]);




  const cloudProfile = useMemo<ProfileState>(() => ({ publicFields, values, demographics, username, isPublic, measurementDetails: details, revision: auth.cloud?.revision ?? 0 }), [publicFields,values, demographics, username, isPublic, details, auth.cloud?.revision]);
  const errors = activeMetrics.filter(m => {if(contextErrors[m.id]||values[m.id]!==undefined&&!valid(m,values[m.id]))return true;try{normalizeMeasurementMetadata({[m.id]:details[m.id]??{}});return false;}catch{return true;}});
  unfinishedRef.current=errors.length>0||!profileValid;
  useEffect(()=>{const ownsProfile=loaded&&auth.ready&&(auth.user?profileAccount===auth.user.id&&!auth.loading&&!!auth.cloud:profileAccount===null);if(ownsProfile&&!needsSetup&&errors.length===0&&profileValid)lastValidEditor.current={owner:auth.user?.id??'guest',profile:cloudProfile};},[cloudProfile,needsSetup,errors.length,profileValid,auth.user,auth.ready,auth.loading,auth.cloud,profileAccount,loaded]);
  const ownsCurrentProfile=loaded&&auth.ready&&(auth.user?profileAccount===auth.user.id&&!auth.loading&&!!auth.cloud:profileAccount===null);
  const allowRemoteProfile=ownsCurrentProfile&&!panel&&!focusOpen&&!editingId&&!repeatMetric&&!calculator&&!privacyBusy&&errors.length===0&&profileValid;
  const cloudSave = useCloudSave(cloudProfile, loaded && !needsSetup && profileAccount === auth.user?.id && errors.length === 0 && profileValid, false,ownsCurrentProfile&&!needsSetup,allowRemoteProfile?applyProfile:undefined);
  useEffect(()=>{if(cloudSave.saved)setIsPublic(cloudSave.saved.isPublic);},[cloudSave.saved]);
  const canDisplayProfile=ownsCurrentProfile;
  const recoverGuest=canDisplayProfile&&!auth.user&&guestProfileUnreadable;
  const editable = canDisplayProfile&&!recoverGuest&&(!guestConflict||!!auth.user);
  const weights=useBodyweight(auth.user?.id??'guest',canDisplayProfile);
  const guestHistory=useGuestHistory(values,details,auth.user?.id??'guest',editable&&errors.length===0,!!editingId,demographics);

  useEffect(() => {
    if (!errors.length && !localSaveError && !cloudSave.unsaved && cloudSave.status !== 'saving' && cloudSave.status !== 'error') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [errors.length, localSaveError, cloudSave.status, cloudSave.unsaved]);
  function focusPage() {
    requestAnimationFrame(()=>document.getElementById('performance-page-title')?.focus({preventScroll:true}));
  }
  function go(next: View, force=false, metric?:string, aim=false) {
    if(!force&&next!==view&&unfinishedRef.current){
      setLeaveUnfinished(true);panelTrigger.current=document.activeElement as HTMLElement;setLeaveDestination({view:next,metric,aim});setPanel('leave');return;
    }
    if(next===view&&(!metric||metric===historyMetric)&&aim===aimForNextTier)return;
    setView(next);setEntryFromTracker(undefined);
    if(next==='progress'||next==='potential'||next==='ranking')setHistoryMetric(metric??'pushups');
    window.history.pushState(null,'',viewHref(next,metric,aim));
    window.scrollTo({top:0,behavior:'instant'});
    focusPage();
  }
  function selectHistoryMetric(id:string) {
    setHistoryMetric(id);
    window.history.replaceState(null,'',viewHref('progress',id));
  }
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
    let notice='Your profile is syncing to your account.';
    if(!auth.user){
      try {
        storeGuestProfile({demographics:profile,values:nextValues,measurementDetails:nextDetails});
        setLocalSaveError(false);
        notice='Your profile is saved on this device.';
      } catch(error) {
        if(error instanceof GuestProfileReadError||error instanceof GuestProfileConflictError)return;
        setLocalSaveError(true);
        notice='Device storage is unavailable. Keep this page open to retain your profile.';
      }
    }
    captureEvent('onboarding_completed');
    setDemographics(profile); setValues(nextValues); setDetails(nextDetails); setProfileSetup(true);
    setPanel(null); go('performance'); setToast(notice);
  }
  function downloadDraft(profile: ProfileState) {
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,profile},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='TOP1-unsaved-profile.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const blocked = !!(focusOpen || panel || proof || calculator || repeatMetric);
  const owner=auth.user?.id??'guest';
  const home=useHomeShortcut(owner);
  const training=useAdaptiveTraining(owner,canDisplayProfile&&!recoverGuest);
  const recent=useRecentMeasurements(auth.user?.id,(view==='overview'||view==='potential'||view==='profile')&&canDisplayProfile,cloudSave.saved?.revision??auth.cloud?.revision);
  const currentDossier=useMemo(()=>buildAthleteDossier({
    owner,
    profile:needsSetup?undefined:demographics,
    values,
    details,
    observations:auth.user?recent.entries:guestHistory.entries,
    workspace:personalWorkspace.data,
    trainingEvents:training.ledger.events,
    timeZone:personalWorkspace.data.context.timezone,
  }),[owner,needsSetup,demographics,values,details,auth.user,recent.entries,guestHistory.entries,personalWorkspace.data,training.ledger.events]);
  async function completeAssessment(payload:AssessmentCommitPayload) {
    if (!editable) return;
    const nextValues=normalizeValues(payload.values,true);
    if (auth.user) {
      cloudSave.cancelPending();
      await cloudSave.save({...cloudProfile,demographics:payload.profile,values:nextValues,measurementDetails:payload.details},{retainFailedEntry:true});
    } else {
      guestHistory.saveWithProfile(nextValues,payload.details,payload.profile,()=>storeGuestProfile({demographics:payload.profile,values:nextValues,measurementDetails:payload.details}));
      setLocalSaveError(false);
    }
    setDemographics(payload.profile);
    setValues(nextValues);
    setDetails(payload.details);
    setProfileSetup(true);
    await personalWorkspace.save(payload.workspace,personalWorkspace.revision,'all');
    if (payload.startGoal && training.ready && !training.busy) {
      try {
        const zone=payload.workspace.context.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone??'UTC';
        const startDay=new Date().toISOString().slice(0,10);
        const cfg=createGuidedConfig({
          metric:payload.startGoal.metric,baseline:payload.startGoal.baseline,target:payload.startGoal.target,
          startDay,deadline:payload.startGoal.deadline,timeZone:zone,goalUnit:payload.startGoal.unit,
          context:payload.workspace.context,bodyWeightKg:payload.startGoal.bodyWeightKg,locale,
        });
        await training.put({
          kind:'program',version:1,id:crypto.randomUUID(),requestId:crypto.randomUUID(),deleted:false,reason:'',
          expectedRevision:0,epoch:training.ledger.epoch,data:buildProgram(cfg,zone),
        });
      } catch {/* Keep saved profile and workspace even if optional starter plan needs adjustment. */}
    }
    captureEvent('onboarding_completed');
    setAssessmentOpen(false);
    setAssessmentDismissed(true);
    go('overview');
    setToast(local('Your personal training profile is ready.','Ton profil d’entraînement est prêt.','ملفك التدريبي الشخصي جاهز.'));
  }
  function openEntry(id?:string) {
    go('performance');
    if(id&&activeMetrics.some(metric=>metric.id===id))setEntryFromTracker(id);
  }
  function selectRankMetric(id:string) {
    setHistoryMetric(id);
    window.history.replaceState(null,'',viewHref('ranking',id));
  }
  function openNextTierGoal(id:string) {
    go('potential',false,id,true);
  }
  const finishTierGoal=useCallback((id:string)=>{
    window.history.replaceState(null,'',viewHref('potential',id));
    setHistoryMetric(id);
  },[]);
  const goalDetail=programMetric?details[programMetric]:undefined;
  const tierTarget=aimForNextTier&&programMetric&&canDisplayProfile&&!needsSetup&&!goalDetail?.invalidContext
    ?challengeProgress(programMetric,values[programMetric],performanceProfileAtTest(demographics,goalDetail))?.next?.value
    :undefined;
  const recordingDisabled=!editable||!cloudSave.draftReady||!!cloudSave.draft||cloudSave.reviewing||cloudSave.conflict||errors.length>0||!profileValid;
  const requestedRank=linkQuery.get('metric');
  const selectedRank=requestedRank&&activeMetrics.some(metric=>metric.id===requestedRank)?requestedRank:
    activeMetrics.filter(metric=>COMPETITIVE_CHALLENGE_METRICS.has(metric.id)&&valid(metric,values[metric.id]))
      .sort((a,b)=>(details[b.id]?.measuredAt??'').localeCompare(details[a.id]?.measuredAt??''))[0]?.id??'run_5k';
  const firstRecorded=activeMetrics.find(metric=>valid(metric,values[metric.id]))?.id??'pushups';
  const openHistory=(id=firstRecorded)=>go('progress',false,id);
  function recordFromTracker(id:string,goalUnit?:'metric'|'kg') {
    if(recordingDisabled)return;
    setRepeatGoalUnit(goalUnit);
    if(!goalUnit&&(needsSetup||values[id]===undefined)){
      go('performance');
      setEntryFromTracker(id);
      return;
    }
    panelTrigger.current=document.activeElement as HTMLElement;
    setRepeatMetric(id);
  }
  async function saveMetric(id:string,value:number,context:MeasurementDetails,profile:Demographics) {
    if(recordingDisabled)throw new Error('Review your saved profile before recording another result.');
    const nextValues=normalizeValues({...values,[id]:value},true);
    const nextDetails={...details,[id]:context};
    if(auth.user) {
      cloudSave.cancelPending();
      await cloudSave.save({...cloudProfile,demographics:profile,values:nextValues,measurementDetails:nextDetails},{retainFailedEntry:true});
    } else {
      const commit=()=>{
        if(loadedUser.current)throw new Error('Your session changed. Wait for the profile to load and try again.');
        guestHistory.saveWithProfile(nextValues,nextDetails,profile,()=>storeGuestProfile({demographics:profile,values:nextValues,measurementDetails:nextDetails}));
      };
      if(navigator.locks)await navigator.locks.request('top1-guest-measurement',commit);
      else commit();
      setLocalSaveError(false);
    }
    setDemographics(profile);setValues(nextValues);setDetails(nextDetails);setProfileSetup(true);
  }
  async function confirmGuestImport(){
    try{
      const profile=await auth.importGuest();
      if(profile){
        if(auth.user){
          migrateCheckpoint(auth.user.id);
          try{
            if(auth.guest)importedBaselineChoices(localStorage,auth.user.id,auth.guest,profile);
            window.dispatchEvent(new Event('top1-baseline-updated'));
          }catch{setToast('Results imported. Review your baseline selections in Performance.');}
        }
        setValues(profile.values);
        setDetails(profile.measurementDetails??{});
        setDemographics(profile.demographics);
        setUsername(profile.username);
        setProfileSetup((profile.revision??0)>0);
      }
      setPanel(null);
    }catch{ /* The migration hook keeps the explanation in the review dialog. */ }
  }
  const showAdditional=view==='labs';
  const isFreshFirstVisit =
    view==='overview' &&
    canDisplayProfile &&
    !recoverGuest &&
    needsSetup &&
    !assessmentDismissed &&
    !training.ledger.events.length &&
    Object.keys(values).length===0;

  if (isFreshFirstVisit && !introCompleted && !assessmentOpen) {
    return (
      <WelcomeGateway
        onStartAssessment={() => {
          setIntroCompleted(true);
          setAssessmentOpen(true);
        }}
        onExploreAsGuest={() => {
          setIntroCompleted(true);
          setAssessmentDismissed(true);
        }}
      />
    );
  }

  return <div className={`app-shell glass-site personal-app view-${view}`}>
    <PerformanceShell view={view} blocked={blocked} onNavigate={go}>
        {auth.user&&view==='settings'&&<div className="account-safety"><button className="text-link" disabled={privacyBusy} onClick={()=>void changeVisibility(false).catch(e=>setToast(e instanceof Error?e.message:'Privacy withdrawal failed. Retry.'))}>{tr(privacyBusy?'Withdrawing…':'Make my profile private')}</button></div>}

        {cloudSave.storageWarning&&<div className="cloud-error" role="status"><span>{tr(cloudSave.storageWarning)}</span><button className="text-link" onClick={()=>downloadDraft(cloudSave.draft??cloudProfile)}>{tr("Download draft")}</button></div>}
        {localSaveError && !auth.user && <div className="cloud-error" role="alert"><span>{tr("Your changes are only in memory. Device storage is unavailable. Keep this page open or sign in to save.")}</span><Link href="/sign-in">{tr("Sign in")}</Link></div>}
        {guestConflict&&!auth.user&&<div className="cloud-error" role="alert"><span>{tr('Your guest profile changed in another tab. Reload before saving.')}</span><button onClick={()=>window.location.reload()}>{tr('Reload')}</button></div>}
        {recoverGuest&&<div className="cloud-error" role="alert">
          <span>{local('Your guest profile could not be read. In Browser data, export a copy before deleting it to start again.','Ton profil invité est illisible. Dans les données du navigateur, exporte une copie avant de les supprimer pour recommencer.','تعذّرت قراءة ملف الضيف. يمكنك تصدير نسخة من بيانات المتصفح قبل حذفها للبدء من جديد.')}</span>
          <button onClick={()=>{
            const profile=restoreGuestProfile(true);
            if(profile!==undefined)guestHistory.resetBaseline(profile?.values,profile?.measurementDetails);
          }}>{tr('Retry')}</button>
          {view!=='settings'&&<button onClick={()=>go('settings')}>{tr('Browser data')}</button>}
        </div>}
        {auth.error && <div className="cloud-error" role="alert"><span>{tr(auth.error)}</span><button onClick={auth.retry}>{tr("Retry")}</button></div>}
        {auth.guest&&<GuestImportPrompt importing={auth.importing} onKeepSeparate={auth.dismissGuest} onReview={trigger=>{panelTrigger.current=trigger;setPanel('import');}}/>}
        {canDisplayProfile&&cloudSave.draft && <div className="cloud-error" role="status"><span>{tr("An unsaved draft is available")}{tr(cloudSave.draft.revision!==auth.cloud?.revision?' from an older profile revision':'')}{tr(". Review it before saving.")}</span><button disabled={cloudSave.status==='saving'||cloudSave.conflict} onClick={()=>{const p=cloudSave.restoreDraft();if(p){applyProfile(p);setProfileSetup(true);}}}>{tr("Review draft")}</button><button onClick={()=>downloadDraft(cloudSave.draft!)}>{tr("Download draft")}</button><button disabled={cloudSave.status==='saving'} onClick={keepSavedProfile}>{tr("Keep saved profile")}</button></div>}
        {canDisplayProfile&&cloudSave.reviewing && <div className="cloud-error" role="status"><span>{tr("Reviewing your retained draft. It has not overwritten the saved profile.")}</span><button disabled={errors.length>0||!profileValid||cloudSave.status==='saving'} onClick={()=>void cloudSave.save(cloudProfile).catch(()=>{})}>{tr("Save reviewed draft")}</button><button onClick={()=>downloadDraft(cloudProfile)}>{tr("Download draft")}</button><button disabled={cloudSave.status==='saving'} onClick={keepSavedProfile}>{tr("Discard draft")}</button></div>}
        {canDisplayProfile&&cloudSave.error && <div className="cloud-error" role="alert"><span>{tr(cloudSave.error)}</span>{(cloudSave.conflict||!cloudSave.draft&&!cloudSave.reviewing)&&<button disabled={!cloudSave.conflict&&(errors.length>0||!profileValid)} onClick={() => cloudSave.conflict ? auth.retry() : void cloudSave.save(cloudProfile).catch(() => {})}>{tr(cloudSave.conflict ? 'Review latest profile' : 'Retry save')}</button>}{!cloudSave.draft&&!cloudSave.reviewing&&<button onClick={()=>downloadDraft(cloudProfile)}>{tr("Download draft")}</button>}</div>}
        {view==='overview'&&<>
          {(assessmentOpen||(isFreshFirstVisit&&introCompleted))
            ?<FirstVisitAssessment key={`fva:${owner}`} owner={owner} existingDossier={needsSetup?null:currentDossier} existingWorkspace={personalWorkspace.data} existingValues={values} existingDetails={details} onComplete={completeAssessment} onSkipToHome={()=>{setAssessmentOpen(false);setAssessmentDismissed(true);}}/>
            :<TrainingHome initialCalendar={initialCalendar} key={owner} owner={owner} profile={canDisplayProfile&&!recoverGuest&&!needsSetup?demographics:undefined} revision={cloudSave.saved?.revision??auth.cloud?.revision??0}
            values={canDisplayProfile&&!recoverGuest?values:{}} details={canDisplayProfile&&!recoverGuest?details:{}}
            workspace={canDisplayProfile&&!recoverGuest?personalWorkspace.data:undefined}
            workspaceEditable={canDisplayProfile&&!recoverGuest&&personalWorkspace.editable}
            onSaveWorkspace={next=>personalWorkspace.save(next,personalWorkspace.revision,'context')}
            trainingEvents={canDisplayProfile&&!recoverGuest&&training.ready?training.ledger.events:undefined}
            observations={canDisplayProfile&&!recoverGuest?(auth.user?recent.entries:guestHistory.entries):[]}
            shortcut={canDisplayProfile&&!recoverGuest?home.shortcut:undefined}
            onRank={id=>{if(canDisplayProfile)home.update({last:'rank'});go('ranking',false,id??firstRecorded);}}
            onLog={(id,goalUnit)=>{if(canDisplayProfile)home.update({last:'log'});if(id&&!recordingDisabled)recordFromTracker(id,goalUnit);else openEntry(id);}}
            onProgram={metric=>{if(canDisplayProfile)home.update({last:'program'});go('potential',false,metric);}}
            onHistory={id=>{if(canDisplayProfile)home.update({last:'history'});openHistory(id);}}/>}
          {canDisplayProfile&&training.error&&<p className="training-notice" role="status">{local('Your training journal could not be refreshed.','Ton journal d’entraînement n’a pas pu être actualisé.','تعذّر تحديث سجل تدريبك.')} <button onClick={()=>void training.refresh()}>{tr('Retry')}</button></p>}
          {canDisplayProfile&&recent.error&&<p className="training-notice" role="status">{local('Recent entries could not be loaded.','Le journal récent est indisponible.','تعذّر تحميل السجلات الأخيرة.')} <button onClick={recent.retry}>{tr('Retry')}</button></p>}
        </>}
        {canDisplayProfile?<>
        <ConnectionStatus/><GameProgressSync key={`game:${auth.user?.id??'guest'}`} owner={auth.user?.id??'guest'}/>
        {view==='potential'&&!recoverGuest&&<AdaptiveProgram key={owner+':'+(programMetric??'')+':'+(tierTarget??'')} initialMetric={programMetric} initialTarget={tierTarget} profile={needsSetup?undefined:demographics} onTierHandled={finishTierGoal} training={training} measurementRevision={cloudSave.saved?.revision??auth.cloud?.revision??0} owner={owner} values={values} details={details} guestEntries={guestHistory.entries} workspace={personalWorkspace} recommendationEntries={auth.user?recent.entries:guestHistory.entries} onBrowse={()=>go('performance')} onRecord={recordFromTracker}/>}
        {view==='ranking'&&!recoverGuest&&<RankExplorer key={owner} owner={owner} guestEntries={guestHistory.entries} revision={cloudSave.saved?.revision??auth.cloud?.revision}
          values={values} details={details} profile={needsSetup?undefined:demographics} metricId={selectedRank}
          onSelect={selectRankMetric} onCreateGoal={openNextTierGoal} onGoal={id=>go('potential',false,id)} onHistory={openHistory} onRecord={recordFromTracker} disabled={recordingDisabled}/>}
        {(view==='performance'||showAdditional)&&<PerformanceBoard key={`board:${auth.user?.id??'guest'}:${editorEpoch}`} owner={auth.user?.id??'guest'} values={values} details={details} profile={needsSetup?undefined:demographics} loadUnit={personalWorkspace.data.context.loadUnit} initialMetric={entryFromTracker} onCreateGoal={openNextTierGoal} onHistory={openHistory} disabled={recordingDisabled} onEditingChange={setFocusOpen} onSave={saveMetric}/>}

        {guestHistory.error&&<p className="field-error" role="alert">{tr(guestHistory.error)}</p>}
        {view==='progress'&&!recoverGuest&&<Progress key={auth.user?.id??'guest'} metricId={historyMetric} onSelect={selectHistoryMetric} guestEntries={guestHistory.entries} values={values} revision={cloudSave.saved?.revision??auth.cloud?.revision} onRecord={recordFromTracker} disabled={recordingDisabled} weights={weights} profileWeight={needsSetup?undefined:demographics.weight} onSettings={()=>go('settings')}/>}
        {view === 'profile' && <><div className="profile-grid"><div><ProfileMenu key={`menu:${owner}`} owner={auth.user?.id} onSettings={()=>go('settings')} onRanking={()=>go('ranking',false,firstRecorded)} onHistory={()=>openHistory()}/><ProfileLadder key={`ladder:${owner}`} owner={owner} profile={cloudProfile}/><section className="card profile-card"><div className="card-heading"><div><h2>{tr("About you")}</h2>{(cloudSave.saved?.ageRecordedAt??auth.cloud?.ageRecordedAt)&&Date.now()-Date.parse((cloudSave.saved?.ageRecordedAt??auth.cloud?.ageRecordedAt)!)>365*86400000&&<p>{tr("Review your age: it was last recorded over a year ago.")}</p>}</div><UserRound size={21}/></div>{profileSetup ? <fieldset disabled={!editable}><ProfileEdit key={`${auth.user?.id??'guest'}:${editorEpoch}`} profile={demographics} onChange={setDemographics} onValidityChange={setProfileValid}/></fieldset> : <p className="drawer-description">{tr("Add your basics to get started.")}</p>}{needsSetup && <button className="primary-button" disabled={!editable} onClick={start}>{tr("Create my profile ")}<ArrowRight size={16}/></button>}</section></div><div><TrainingProfileDossier dossier={currentDossier} workspace={personalWorkspace.data} editable={personalWorkspace.editable} onSaveWorkspace={next=>personalWorkspace.save(next,personalWorkspace.revision,'context')} onOpenAssessment={()=>{setAssessmentOpen(true);go('overview');}}/><HomePreferences choice={home.choice} onChange={home.update} error={home.error}/><TrainingPreferences state={personalWorkspace}/><section className="performance-note"><h2>{local('Connections','Connexions','الاتصالات')}</h2><p>{local('Wearables · Coming soon','Objets connectés · Bientôt','الأجهزة القابلة للارتداء · قريبًا')}</p></section>{!auth.user && !needsSetup && <section className="card reset-card"><h3>{tr("Start over on this device")}</h3><p>{tr("Replace your local profile with a new one. Export your summary first if you want to keep it.")}</p><button className="text-link" disabled={!editable} onClick={() => { panelTrigger.current = document.activeElement as HTMLElement; setPanel('reset'); }}>{tr("Reset local profile ")}<ArrowRight size={14}/></button></section>}</div></div></>}
        {view === 'settings' && <><UsageAnalyticsSettings/>{!auth.user&&<BrowserDataControls onCleared={()=>{expectedGuestProfile.current=null;setGuestConflict(false);setGuestProfileUnreadable(false);setLocalSaveError(false);guestHistory.resetBaseline();lastValidEditor.current=undefined;setContextErrors({});setProfileValid(true);setValues({});setDetails({});setUsername('');setIsPublic(false);setDemographics(defaults);setProfileSetup(false);setEditorEpoch(n=>n+1);setPanel('onboarding');}}/>}<AccountDataControls revision={cloudSave.saved?.revision??auth.cloud?.revision??0} canChange={!weights.pending.length&&!weights.busy&&editable&&!cloudSave.unsaved&&cloudSave.status!=='saving'&&!cloudSave.draft&&!cloudSave.reviewing&&errors.length===0&&profileValid} onPurged={p=>{cloudSave.cancelPending();cloudSave.discardDraft();applyProfile(p);auth.retry();}}/><section className="card account-card"><div className="card-heading"><div><h2>{tr("Account & sharing")}</h2></div><Lock size={21}/></div><CloudProfileControls publicFields={publicFields} onPublicFields={setPublicFields} username={username} onUsernameChange={next => { if (editable) setUsername(next); }} isPublic={isPublic} shareUsername={(cloudSave.saved??auth.cloud)?.isPublic ? (cloudSave.saved??auth.cloud)?.username : undefined} onVisibilityChange={changeVisibility} canWithdraw={!!auth.user&&canDisplayProfile} canShare={!needsSetup && !!auth.cloud && editable && errors.length === 0&&profileValid&&!cloudSave.draft&&!cloudSave.reviewing&&!cloudSave.conflict} onNotice={setToast}/></section></>}
        {view === 'methodology' && <Methodology onEvidence={showEvidence}/>}
        {view!=='performance'&&<footer className="page-footer"><span><Activity size={15}/><strong>TOP1%</strong></span><div><Link href="/about">{tr("About TOP1")}</Link><span>·</span><button onClick={() => go('methodology')}>{tr("Methodology")}</button><span>·</span><Link href="/privacy">{tr("Privacy")}</Link><span>·</span><a href={SUPPORT_HREF}>{tr("Support")}</a></div></footer>}
        </>:view!=='overview'&&<p className="dashboard-startup" role="status">{tr(auth.error?'Your account could not be loaded. Retry above before making changes.':'Loading your profile…')}</p>}
    </PerformanceShell>
    {toast && <div className="toast" role="status"><CircleHelp size={17}/><span>{tr(toast)}</span><button className="icon-button" aria-label={tr("Dismiss notification")} onClick={() => setToast('')}><X size={16}/></button></div>}
    {repeatMetric&&canDisplayProfile&&<Modal safetyAction={privacyAction} title={tr("Record a new observation")} returnFocus={panelTrigger.current} onClose={()=>{if(!repeatSaving.current)setRepeatMetric(null);}}><RepeatObservation key={repeatMetric} metric={activeMetrics.find(m=>m.id===repeatMetric)!} value={values[repeatMetric]} details={details[repeatMetric]??{}} goalUnit={repeatGoalUnit} demographics={needsSetup?undefined:demographics} onDone={()=>setRepeatMetric(null)} onFinish={async(value,context,person)=>{
      repeatSaving.current=true;
      try {
        const change=overallChangeForSave(repeatMetric,value,context,values,details,needsSetup?undefined:demographics,person);
        await saveMetric(repeatMetric,value,context,person);
        if(!change){setRepeatMetric(null);setToast('Reviewed observation recorded.');}
        return change;
      }
      finally { repeatSaving.current=false; }
    }}/></Modal>}

    {panel==='leave'&&<Modal safetyAction={privacyAction} title={tr("Leave without saving?")} returnFocus={panelTrigger.current} onClose={()=>setPanel(null)}><p>{tr(leaveUnfinished?'Some inputs are unfinished or invalid. Discard those inputs before leaving this view, or keep editing.':'Your routine changes could not be stored. Leaving may lose them.')}</p><button className="secondary-button" onClick={()=>setPanel(null)}>{tr("Keep working")}</button><button className="primary-button" onClick={()=>{if(leaveUnfinished){const saved=lastValidEditor.current;if(saved?.owner===(auth.user?.id??'guest'))applyProfile(saved.profile);else if(auth.cloud)applyProfile(cloudSave.saved??auth.cloud);}setPanel(null);go(leaveDestination.view,true,leaveDestination.metric,leaveDestination.aim);}}>{tr(leaveUnfinished?'Discard unfinished inputs and leave':'Leave without saving')}</button></Modal>}
    {panel==='import'&&auth.guest&&<GuestImportReview count={Object.keys(auth.guest.values).length} importing={auth.importing} error={auth.error}
      safetyAction={privacyAction} returnFocus={panelTrigger.current} onCancel={()=>setPanel(null)} onImport={()=>void confirmGuestImport()}/>}
    {canDisplayProfile&&panel === 'onboarding' && <Modal safetyAction={privacyAction} returnFocus={panelTrigger.current} title={tr(needsSetup ? 'Welcome to TOP1' : 'Your starting point')} closeOnBackdrop={false} wide onClose={() => setPanel(null)}><Onboarding basicsOnly initialProfile={needsSetup ? undefined : demographics} initialValues={needsSetup ? {} : values} initialDetails={needsSetup ? {} : details} onFinish={finishSetup}/></Modal>}
    {canDisplayProfile&&panel === 'reset' && <Modal safetyAction={privacyAction} returnFocus={panelTrigger.current} title={tr("Reset this local profile?")} onClose={() => setPanel(null)}><p className="modal-description">{local("This removes this guest profile and its measurement history from this browser.", "Cette action efface ce profil invité et son historique de mesures dans ce navigateur.", "سيُحذف ملف الضيف هذا وسجل قياساته من هذا المتصفح.")}</p><div className="modal-actions"><button className="secondary-button" onClick={() => setPanel(null)}>{tr("Keep my profile")}</button><button className="primary-button" onClick={() => { if (editable && !auth.user) { try { ['top1-workspace-form-v1:guest:goal','top1-workspace-form-v1:guest:context','top1-workspace-v1:guest','top1-workspace-draft-v1:guest','top1-potential-v1:guest',homeShortcutKey('guest'),ladderKey('guest'),trainingKey('guest'),...weightBrowserKeys('guest'),baselineStorageKey('guest'),'top1-session-draft:guest','top1-adaptive-v1:guest','top1-game-v1:guest','top1-history-guest','top1-profile-v2','top1_profile_v2','top1-profile-v1'].forEach(key => localStorage.removeItem(key));window.dispatchEvent(new Event('top1-workspace-reset')); } catch { setLocalSaveError(true); return; } clearCheckpoint('guest'); expectedGuestProfile.current=null;setGuestConflict(false);guestHistory.resetBaseline(); setGuestProfileUnreadable(false); setLocalSaveError(false); setValues({}); setDetails({}); setDemographics(defaults); setUsername(''); setIsPublic(false); setProfileSetup(false); setPanel('onboarding'); } }}>{tr("Reset & start again")}</button></div></Modal>}
    {canDisplayProfile&&proof && <Modal safetyAction={privacyAction} returnFocus={panelTrigger.current} title={tr(proof.name)} onClose={() => setProof(null)}><span className="eyebrow">{tr(pillarNames[proof.pillar])}</span><p className="modal-description">{tr(proof.proofData.rationale)}</p><div className="proof-block"><h3>{tr("How to measure")}</h3><p>{tr(proof.proofData.instructions)}</p></div><div className="proof-block"><h3>{tr("Evidence & reference")}</h3><p>{tr(proof.proofData.study)}</p><p>{tr(proof.proofData.sampleSize)}</p>{proof.proofData.url && <a className="text-link" href={proof.proofData.url} target="_blank" rel="noreferrer">{tr("Read the source ")}<ArrowUpRight size={15}/></a>}</div><BenchmarkReference metric={proof} demographics={demographics}/>{proof.id!=='body_fat'&&<div className="proof-block"><h3>{tr(FIELD_BENCHMARK_METRICS.has(proof.id)?'Scientific score':'How TOP1 uses it')}</h3><p>{tr(FIELD_BENCHMARK_METRICS.has(proof.id)?'Benchmark percentages affect your dashboard rank. This measurement stays outside the separate scientific capacity score.':!profileSetup ? 'Complete your profile to see the reference for your own age and biological sex. Most references remain provisional product assumptions.' : scoringEligibility(proof,demographics,details).status!=='eligible' ? scoringEligibility(proof,demographics,details).reason : `Experimental reference for ${reference(proof, demographics, details).cohortLabel??getAgeBracket(demographics.age)} · ${demographics.sex}. Mean ${fmt(reference(proof, demographics, details).mean, 2)}, standard deviation ${fmt(reference(proof, demographics, details).sd, 2)}. ${reference(proof, demographics, details).provenance === 'published' ? 'FRIEND 2022 direct treadmill CPET reference; explicit treadmill modality and a recorded test age of 20–89 are required.' : 'These reference parameters are provisional product assumptions.'}`)}</p></div>}{proof.id==='run_10k'&&<div className="proof-block"><h3>{tr('10 km race-finisher benchmarks')}</h3><div className="running-reference-tiers">{run10kBenchmarks(demographics).tiers.map(tier=><div key={tier.percent}><strong>{tier.estimated?'≈ ':''}{tr('Top')} {tier.percent}%</strong><bdi>{formatRunTime(Math.floor(tier.minutes*60)/60)}</bdi><small>{tr(tier.estimated?'Interpolated estimate':'Published cutoff')}</small></div>)}</div></div>}<MetricEditor detailsOnly metric={proof} value={values[proof.id]} details={details[proof.id]} demographics={demographics} onValue={changeValue} onDetails={changeDetails} onEvidence={showEvidence} onCalculate={showCalculator} readOnly={needsSetup||!editable} onContextError={(id,error)=>setContextErrors(e=>({...e,[id]:error}))}/><div className="science-note"><CircleHelp size={18}/><p>{tr("Study associations do not establish a universal target or population rank.")}</p></div></Modal>}
    {canDisplayProfile&&calculator && <Modal safetyAction={privacyAction} returnFocus={panelTrigger.current} title={tr(calculator.id === 'vo2_max' ? 'Cooper run estimate' : calculator.id === 'body_fat' ? 'Skinfold estimate' : 'One-rep max estimate')} onClose={() => setCalculator(null)}>{needsSetup ? <><p className="modal-description">{tr("Create a personal profile before saving a calculated measurement.")}</p><button className="primary-button" disabled={!editable} onClick={() => { setCalculator(null); start(); }}>{tr("Create my profile ")}<ArrowRight size={16}/></button></> : <MetricCalculator metric={calculator} demographics={demographics} onUse={(value, context) => { if (!editable) return; setValues(v => ({ ...v, [calculator.id]: value })); setDetails(d => ({ ...d, [calculator.id]: context })); setCalculator(null); setToast(`${calculator.name} estimate added.`); }}/>}</Modal>}
  </div>;
}
