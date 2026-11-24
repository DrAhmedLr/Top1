'use client';

import {useEffect, useMemo, useState} from 'react';
import {ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, ChevronRight, History, NotebookPen, Plus, Route} from 'lucide-react';
import {gameTierLabel} from './GameTierResult';
import HomeChallengePreview from './HomeChallengePreview';
import HomeComparison from './HomeComparison';
import {quickLogTests, referenceChart} from '@/lib/homePresentation';
import {referenceRank} from '@/lib/rankExplorer';
import {calendarWeek, type RegionalCalendar} from '@/lib/regionalCalendar';
import {captureEvent} from '@/lib/analytics';
import {overallPerformance} from '@/lib/overallPerformance';
import {currentAdaptivePlans, goalValue, sessionResult, type GoalUnit} from '@/lib/adaptiveProgram';
import {datedProgram} from '@/lib/datedProgram';
import {valid} from '@/lib/engine';
import {entryRaw, entryUnit, isLift} from '@/lib/focusedEntry';
import {observationDate,type Observation} from '@/lib/history';
import {usePerformanceInsights} from '@/lib/hooks/usePerformanceInsights';
import {useRetests} from '@/lib/hooks/useRetests';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import type {PersonalWorkspace} from '@/lib/personalWorkspace';
import {buildAthleteDossier} from '@/lib/athleteDossier';
import {selectNextSessionDecision} from '@/lib/coachDecision';
import {replayGoalAttempts} from '@/lib/goalAttempts';
import {portfolioMaintenanceSummary} from '@/lib/maintenancePlan';
import {activeMetrics, type Demographics, type Metric, type Values} from '@/lib/registry';
import {dayInZone} from '@/lib/routineHistory';
import {latestTraining, type TrainingEvent, type Workout} from '@/lib/training';
import CoachDecisionCard from './CoachDecisionCard';
import MaintenanceCard from './MaintenanceCard';
import {MetricIcon} from './MetricIcon';
import {useTranslations} from './providers/LocaleProvider';
import '@/app/training-home.css';

type Props = {
  initialCalendar?: RegionalCalendar | null;
  values: Values;
  profile?: Demographics;
  details: MeasurementMetadata;
  workspace?: PersonalWorkspace;
  workspaceEditable?: boolean;
  onSaveWorkspace?: (next: PersonalWorkspace) => Promise<boolean>;
  trainingEvents?: TrainingEvent[];
  observations?: Observation[];
  owner?:string;
  revision?:number;
  shortcut?: {action: 'log' | 'program' | 'rank' | 'history'; metric?: string};
  onRank: (metric?: string) => void;
  onLog: (metric?: string, goalUnit?: GoalUnit) => void;
  onProgram: (metric?:string) => void;
  onHistory: (metric?: string) => void;
};

function recordedMetrics(values: Values, details: MeasurementMetadata, entries: Observation[]) {
  const newest = new Map<string, Observation>();
  for (const entry of entries) {
    const previous = newest.get(entry.metricId);
    if (!previous || Date.parse(entry.recordedAt) > Date.parse(previous.recordedAt) ||
      (entry.recordedAt === previous.recordedAt && (entry.sequence ?? 0) > (previous.sequence ?? 0))) {
      newest.set(entry.metricId, entry);
    }
  }
  return activeMetrics.flatMap(metric => {
    const value = values[metric.id];
    if (!valid(metric, value)) return [];
    const entry = newest.get(metric.id);
    const recordedAt = entry && !entry.cleared && entry.value === value ? entry.recordedAt : undefined;
    const measuredAt = details[metric.id]?.measuredAt;
    const stamp = recordedAt ?? measuredAt;
    const date = stamp && Number.isFinite(Date.parse(stamp)) ? stamp : undefined;
    return [{metric, value, date}];
  }).sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
}

export default function TrainingHome({initialCalendar, values, details, profile, workspace, workspaceEditable=false, onSaveWorkspace, trainingEvents, observations = [], owner='guest', revision=0, shortcut, onRank, onLog, onProgram, onHistory}: Props) {
  const {locale, t} = useTranslations();
  const l = (en: string, fr: string, ar: string) => locale === 'fr' ? fr : locale === 'ar' ? ar : en;
  const numbers = new Intl.NumberFormat(locale, {maximumFractionDigits: 3});
  const plans = useMemo(() => trainingEvents ? currentAdaptivePlans(trainingEvents) : [], [trainingEvents]);
  const [homeMetric,setHomeMetric] = useState<string>();
  const plan = plans.find(item=>item.config.metric===homeMetric) ?? plans[0] ?? null;
  const [nativeCalendar, setNativeCalendar] = useState<RegionalCalendar | null>(null);
  useEffect(() => {
    if (initialCalendar !== undefined || process.env.NEXT_PUBLIC_NATIVE_APP !== '1') return;
    const controller = new AbortController();
    void fetch('/api/regional-calendar', {signal:controller.signal, cache:'no-store'})
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && typeof data?.region === 'string' && /^[A-Z]{2}$/.test(data.region)
            && Number.isInteger(data.firstDay) && data.firstDay >= 1 && data.firstDay <= 7) setNativeCalendar(data);
      }).catch(() => {});
    return () => controller.abort();
  }, [initialCalendar]);
  const calendar = initialCalendar ?? nativeCalendar;
  const dateLocale = calendar ? locale + '-' + calendar.region : locale;
  const zone = plan?.event.data.timeZone || workspace?.context.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dateFormat = new Intl.DateTimeFormat(dateLocale, {calendar: 'gregory', day: 'numeric', month: 'short', timeZone: zone});
  const [day, setDay] = useState('');
  useEffect(() => {
    const update = () => setDay(dayInZone(zone));
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, [zone]);
  const guidedCalendar = useMemo(() => plan?.config.guidedVersion === 1 ? datedProgram(plan) : null,[plan]);
  const guidedSessions = useMemo(() => guidedCalendar?.weeks.flatMap(week => week.sessions),[guidedCalendar]);
  const loggedToday = plan?.sessions.some(event => sessionResult(event.data as Workout)?.day === day);
  const guidedNext = day && guidedSessions?.find(session => session.date > day || session.date === day && (!loggedToday || session.kind === 'retest'));
  const homeDossier = useMemo(() => plan && day ? buildAthleteDossier({
    owner, profile, values, details, observations, workspace, trainingEvents, timeZone: zone,
  }) : null, [plan, day, owner, profile, values, details, observations, workspace, trainingEvents, zone]);
  const homeDecision = useMemo(() => plan && homeDossier && guidedNext ? selectNextSessionDecision(homeDossier, {
    plan, targetDay: guidedNext.date, calendar: guidedCalendar ?? undefined, allPlans: plans,
  }) : null, [plan, homeDossier, guidedNext, guidedCalendar, plans]);
  const maintenanceSummary = useMemo(() => {
    if (!homeDossier || !plans.length || !day || !trainingEvents?.length) return null;
    const attempts = replayGoalAttempts(trainingEvents, observations, Date.now());
    return portfolioMaintenanceSummary({plans, attempts, dossier: homeDossier, today: day});
  }, [homeDossier, plans, day, trainingEvents, observations]);
  const activeMaintenance = maintenanceSummary?.maintenancePlans.find(m => m.planId === plan?.event.id) ??
    (maintenanceSummary?.allGoalsMaintained ? maintenanceSummary.maintenancePlans[0] : undefined);

  const rows = recordedMetrics(values, details, observations);
  const goal = plan?.config ?? workspace?.goal;
  const metric = activeMetrics.find(item => item.id === goal?.metric);
  const deadline = plan?.config.deadline ?? workspace?.goal?.date;
  const hasGoal = !!goal && !!metric;
  const latestResult = rows[0];
  const targetInKg = plan?.config.goalUnit === 'kg';
  const unit = (key: string) => key === 'min:sec' ? l('min:s', 'min:s', 'د:ث') : key === 'kg' ? l('kg', 'kg', 'كغ') : t(key);
  const targetUnit = metric ? unit(targetInKg ? 'kg' : entryUnit(metric)) : '';
  const insights = usePerformanceInsights({owner, revision, values, details, profile, plan, guestEntries:observations, today:day, enabled:!!trainingEvents});
  const forecast = plan && insights.data?.goal?.planId === plan.event.id ? insights.data.goal : null;
  const {latest}=useRetests(owner,plan ? undefined : goal?.metric,observations,revision);
  const retest=latest&&goal&&Date.parse(observationDate(latest))>=Date.parse(goal.createdAt)?latest:undefined;
  const goalReading=forecast?.current ?? (metric&&retest?goalValue(metric,targetInKg?'kg':'metric',retest.value??undefined,retest):goal?.baseline);
  const personal = forecast?.personal.kind === 'ready' ? forecast.personal : null;
  const adherence = forecast?.adherence;
  const calibration = guidedCalendar&&adherence?insights.calibration:undefined;
  const probability = guidedCalendar ? calibration?.probability??adherence?.probability : personal?.probability ?? forecast?.scenario?.p;
  const percentFormat = new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:0});
  const probabilityText = probability === undefined ? '' : probability > 0 && probability < .01 ? '< ' + percentFormat.format(.01)
    : probability < 1 && probability > .99 ? '> ' + percentFormat.format(.99) : percentFormat.format(probability);
  const reached = !!(metric && goal && goalReading !== undefined && (goalReading - goal.target) * metric.polarity >= 0);
  const pastDeadline = !!(day && deadline && deadline < day);
  const formatValue = (item: Metric, value: number) => {
    const raw = entryRaw(item, value);
    return item.id === 'run_5k' ? raw : numbers.format(Number(raw));
  };
  const workouts = latestTraining(trainingEvents ?? [])
    .filter(event => event.kind === 'workout' && !event.deleted)
    .map(event => event.data as Workout);
  const week = day ? calendarWeek(day, calendar?.firstDay) : [];
  const completed = workouts.filter(workout => workout.status === 'completed' && workout.endedAt)
    .map(workout => sessionResult(workout)?.day ?? dayInZone(zone, new Date(workout.endedAt!)));
  const days = week.map(date => date.toISOString().slice(0, 10));
  const weekCount = completed.filter(date => days.includes(date)).length;
  const guidedWeek = guidedSessions?.filter(session => session.kind === 'training' && days.includes(session.date));
  const plannedDays = guidedWeek?.length ?? plan?.config.days ?? workspace?.context.days;
  const minutes = guidedWeek ? undefined : plan?.config.minutes ?? workspace?.context.minutes;
  const hasWeek = !!trainingEvents && week.length > 0 && (!!plannedDays || workouts.length > 0);
  const shortDay = new Intl.DateTimeFormat(dateLocale, {calendar: 'gregory', weekday: 'short', timeZone: 'UTC'});
  const fullDay = new Intl.DateTimeFormat(dateLocale, {calendar: 'gregory', dateStyle: 'full', timeZone: 'UTC'});
  const calendarDate = new Intl.DateTimeFormat(dateLocale, {calendar: 'gregory', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
  const standing=useMemo(()=>insights.data?.performance ?? overallPerformance(values,details,profile),[insights.data,values,details,profile]);
  const [viewDemo,setViewDemo]=useState(false);
  const shortcuts = {
    log: {label:l('Record a result','Saisir un résultat','تسجيل نتيجة'),Icon:NotebookPen,run:onLog},
    program: {label:l('My program','Mon programme','برنامجي'),Icon:Route,run:onProgram},
    rank: {label:l('My ranking','Mon classement','ترتيبي'),Icon:ChartNoAxesCombined,run:onRank},
    history: {label:l('My history','Mon historique','سجلي'),Icon:History,run:onHistory}
  };
  const favorite=shortcut?shortcuts[shortcut.action]:undefined;
  const preferredMetric=shortcut?.action!=='program'?activeMetrics.find(item=>item.id===shortcut?.metric):undefined;
  const goalNumber=(n:number)=>metric?(targetInKg?numbers.format(n):formatValue(metric,n)):'';
  const progress=goal&&goal.baseline!==undefined&&goalReading!==undefined&&goal.target!==goal.baseline
    ?Math.max(0,Math.min(1,(goalReading-goal.baseline)/(goal.target-goal.baseline))):undefined;
  const areas=[l('Push','Poussée','الدفع'),l('Pull','Tirage','السحب'),l('Lower body','Bas du corps','الجزء السفلي'),l('Running','Course','الجري')];
  const currentPercent=standing.overall?.percent;
  const rank=currentPercent===undefined?'':gameTierLabel(String(currentPercent)+'%',locale);
  const dateLabel=day&&new Intl.DateTimeFormat(dateLocale,{calendar:'gregory',weekday:'long',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
  const heroHeading = metric ? t(metric.name) : latestResult ? t(latestResult.metric.name)
    : l('Log your first result','Ton premier résultat','سجّل نتيجتك الأولى');
  const heroContext = hasGoal ? l('Current goal','Objectif en cours','الهدف الحالي')
    : latestResult?.date ? l('Latest result','Dernier résultat','أحدث نتيجة')
    : latestResult ? l('Saved result','Résultat enregistré','نتيجة مسجّلة') : l('Your performance','Ta performance','أداؤك');
  const primaryText=hasGoal?(reached?l('View result','Voir le résultat','عرض النتيجة'):pastDeadline?l('Review goal','Revoir l’objectif','مراجعة الهدف'):plan?l('Open program','Ouvrir le programme','فتح البرنامج'):l('Build my program','Créer mon programme','إنشاء برنامجي')):rows[0]?.date?l('Repeat latest test','Refaire le dernier test','أعد آخر اختبار'):l('Log a result','Saisir un résultat','تسجيل نتيجة');
  function quickLog(id:string) {
    captureEvent('quick_log_opened',{metric_id:id});
    onLog(id, id === plan?.config.metric ? plan.config.goalUnit : undefined);
  }
  const chartMetric = metric ?? rows[0]?.metric;
  const chart = chartMetric ? referenceChart(referenceRank(chartMetric, values[chartMetric.id], profile, details[chartMetric.id])) : null;
  return <div className="training-home">
    <header className="th-day"><div>{dateLabel&&<time dateTime={day}>{dateLabel}</time>}<h1 id="performance-page-title" tabIndex={-1}>{l('Today','Aujourd’hui','اليوم')}</h1></div></header>
    <section className="th-hero" aria-labelledby="th-hero-title">
      <div className="th-hero-copy">
        <span className="th-context">{heroContext}</span>
        <h2 id="th-hero-title">{heroHeading}</h2>
        {hasGoal&&goal?<p className="th-goal-value"><bdi>{goalNumber(goal.target)} {targetUnit}</bdi>{deadline&&<> · <time dateTime={deadline}>{calendarDate.format(new Date(deadline+'T12:00:00Z'))}</time></>}</p>
          : latestResult ? <p className="th-goal-value"><bdi>{formatValue(latestResult.metric, latestResult.value)} {unit(entryUnit(latestResult.metric))}</bdi>{latestResult.date && <> · <time dateTime={latestResult.date}>{dateFormat.format(new Date(latestResult.date))}</time></>}</p>
          : <p>{l('Pick a test to find your level.','Choisis un test pour découvrir ton niveau.','اختر اختبارًا لتعرف مستواك.')}</p>}
        {progress!==undefined&&<progress max={1} value={progress} aria-label={l('Goal progress','Progression de l’objectif','التقدم نحو الهدف')}/>}
        {probability !== undefined && !reached && !pastDeadline && <div className="th-forecast-pair">
          <p className="th-forecast">
            <strong><bdi>{probabilityText}</bdi></strong>
            <span>{l('If you follow the plan','Si tu suis le programme','عند الالتزام بالخطة')} · {calibration ? l('adjusted using observed outcomes','ajustée selon les résultats observés','معدّل وفق النتائج المرصودة') : adherence ? adherence.kind==='personal' ? l('personal estimate','estimation personnelle','تقدير شخصي')
              : l('day-one simulation','simulation initiale','محاكاة اليوم الأول')
              : personal ? l('from your training history', 'selon ton entraînement', 'من سجل تدريبك')
              : l('under program assumptions', 'selon les hypothèses', 'وفق افتراضات البرنامج')}</span>
          </p>
          {forecast?.recentPace && <p className="th-pace-line">
            <strong>{l('At your recent pace','À ton rythme récent','حسب وتيرتك الأخيرة')}:</strong>{' '}
            {forecast.recentPace.kind === 'ready'
              ? <><bdi>{percentFormat.format(forecast.recentPace.probability)}</bdi>{forecast.recentPace.finishRange ? <> · <bdi>{calendarDate.format(new Date(forecast.recentPace.finishRange.early+'T12:00:00Z'))} – {calendarDate.format(new Date(forecast.recentPace.finishRange.late+'T12:00:00Z'))}</bdi></> : null}</>
              : <span>{l('unlocks after 3 comparable trained intervals & logged attendance.','se débloque après 3 intervalles entraînés comparables et séances consignées.','يتاح بعد 3 فترات تدريب مماثلة وتسجيل الحضور.')}</span>}
          </p>}
        </div>}
        {activeMaintenance && <MaintenanceCard compact plan={activeMaintenance} onRetest={onLog}/>}
        {plan && insights.failed && <p role="status">{l('Goal estimate unavailable.', 'Estimation indisponible.', 'تقدير الهدف غير متاح.')} <button type="button" className="th-text-action" onClick={insights.retry}>{t('Retry')}</button></p>}
        {guidedNext&&!reached&&!pastDeadline&&<div className="th-session">
          <span>{homeDecision?.action==='move'&&homeDecision.movedTo?l('Rescheduled session','Séance déplacée','حصة معاد جدولتها'):guidedNext.kind==='retest'?l('Next retest','Prochain test','الاختبار القادم'):l('Next session','Prochaine séance','الجلسة القادمة')} · <time dateTime={homeDecision?.recommended?.date??guidedNext.date}>{calendarDate.format(new Date((homeDecision?.recommended?.date??guidedNext.date)+'T12:00:00Z'))}</time></span>
          {homeDecision&&homeDecision.action!=='keep'&&homeDecision.action!=='retest'
            ? (homeDecision.recommended
              ? <strong>{l(...homeDecision.recommended.exercise)} · <bdi>{numbers.format(homeDecision.recommended.sets)} × {numbers.format(homeDecision.recommended.amount)}</bdi> {homeDecision.recommended.mode==='reps'?l('reps','rép.','تكرارات'):l('s','s','ث')}{homeDecision.recommended.loadKg>0&&<> · <bdi>{numbers.format(homeDecision.recommended.loadKg)}</bdi> {unit('kg')}</>} · <bdi>{numbers.format(homeDecision.recommended.totalMinutes)}</bdi> {l('min','min','د')}</strong>
              : <strong>{l('Rest today','Repos aujourd’hui','راحة اليوم')}</strong>)
            : <strong>{l(...guidedNext.exercise)}{guidedNext.kind==='training'&&<> · <bdi>{numbers.format(guidedNext.sets)} × {numbers.format(guidedNext.amount)}</bdi> {guidedNext.mode==='reps'?l('reps','rép.','تكرارات'):l('s','s','ث')}{guidedNext.loadKg>0&&<> · <bdi>{numbers.format(guidedNext.loadKg)}</bdi> {unit('kg')}</>} · <bdi>{numbers.format(homeDecision?.scheduled.slotMinutes??guidedNext.estimatedMinutes)}</bdi> {l('min','min','د')}</>}</strong>}
          {homeDecision&&homeDossier&&plan&&workspace&&onSaveWorkspace&&<CoachDecisionCard compact decision={homeDecision} dossier={homeDossier} plan={plan} calendar={guidedCalendar??undefined} allPlans={plans} workspace={workspace} editable={workspaceEditable} onSaveWorkspace={onSaveWorkspace}/>}
        </div>}
        {plan&&!guidedCalendar&&!reached&&!pastDeadline&&<p className="th-session"><span>{l('Next session','Prochaine séance','الجلسة القادمة')}</span><strong>{plan.config.exercise} · <bdi>{numbers.format(plan.prescription.sets)} × {numbers.format(plan.prescription.amount)}</bdi> {plan.prescription.mode==='reps'?l('reps','rép.','تكرارات'):l('s','s','ث')}{plan.prescription.loadKg>0&&<> · <bdi>{numbers.format(plan.prescription.loadKg)}</bdi> {unit('kg')}</>}</strong></p>}
        {plans.length>1&&<label className="th-goal-switch">{l('Goal in this program','Objectif de ce programme','هدف في هذا البرنامج')}
          <select value={plan?.config.metric} onChange={event=>setHomeMetric(event.target.value)}>
            {plans.map(item=><option key={item.event.id} value={item.config.metric}>{t(activeMetrics.find(m=>m.id===item.config.metric)?.name??item.config.metric)}</option>)}
          </select></label>}
        <div className="th-actions">
          <button type="button" className="th-primary" onClick={()=>hasGoal?(reached&&metric?onHistory(metric.id):onProgram(plan?.config.metric)):onLog(rows[0]?.date ? rows[0].metric.id : undefined)}>{!hasGoal&&<Plus size={17}/>} {primaryText}{hasGoal&&<ArrowRight className="th-direction" size={16}/>}</button>
          {plan && !reached && !pastDeadline && <button type="button" className="th-secondary" onClick={()=>onLog(plan.config.metric,plan.config.goalUnit)}>{l('Record goal test','Consigner le test cible','سجّل اختبار الهدف')} <Plus size={15}/></button>}
          {!hasGoal&&<button type="button" className="th-secondary" onClick={()=>onProgram()}>{l('Set a goal','Définir un objectif','حدّد هدفًا')} <ArrowRight className="th-direction" size={15}/></button>}
        </div>
      </div>
      {chart && chartMetric ? <HomeComparison chart={chart} metric={chartMetric}/> : <div className="th-coverage" aria-label={l('Performance areas covered','Domaines de performance renseignés','مجالات الأداء المسجلة')}>
        <svg viewBox="0 0 124 124" aria-hidden="true">
          {standing.areas.map((area,i)=><circle key={area.area} cx="62" cy="62" r="51" fill="none" stroke={area.points===null?'#345575':'#9dd5ff'} strokeWidth="8" strokeLinecap="round" strokeDasharray="71 250" transform={`rotate(${i*90-84} 62 62)`}/>)}
        </svg>
        <span><bdi>{numbers.format(standing.coverage)}<small> / {numbers.format(4)}</small></bdi><em>{l('areas','domaines','مجالات')}</em></span>
      </div>}
      <div className="th-areas">
        {rank&&<strong>{standing.coverage===4?l('Overall TOP1 score','Score TOP1 global','نتيجة TOP1 الإجمالية'):l('Provisional TOP1 score','Score TOP1 provisoire','نتيجة TOP1 الأولية')} · <bdi>{rank}</bdi></strong>}
        {standing.areas.map((area,i)=><span key={area.area} data-filled={area.points!==null}><i aria-hidden="true"/>{areas[i]}</span>)}</div>
    </section>

    <section className="th-quick" aria-labelledby="th-quick-title">
      <div className="th-panel-heading"><h2 id="th-quick-title">{l('Quick log','Saisie rapide','تسجيل سريع')}</h2><button type="button" className="th-text-action" onClick={()=>onLog()}>{l('All tests','Tous les tests','كل الاختبارات')}<ChevronRight size={15} className="th-direction"/></button></div>
      <div className="th-quick-grid">{quickLogTests.map(test=><button type="button" key={test.id} onClick={()=>quickLog(test.id)} className="th-quick-test" data-test={test.id}><span className="th-quick-icon"><MetricIcon id={test.id} size={22}/></span><span><strong>{t(test.name)}</strong><small>{isLift(test.id)?l('Load & reps','Charge et reps','الوزن والتكرارات'):unit(entryUnit(test))}</small></span><Plus size={16} aria-hidden="true"/></button>)}</div>
    </section>
    <div className="th-demo-wrap">
      <button className="th-demo-link" type="button" onClick={()=>setViewDemo(open=>!open)} aria-expanded={viewDemo} aria-controls="th-preview-content"><ChartNoAxesCombined size={19}/><span>{l('Explore the game scale','Explorer le barème du jeu','استكشف سلّم اللعبة')}</span><ChevronDown size={16}/></button>
      <div id="th-preview-content" hidden={!viewDemo}>{viewDemo&&<HomeChallengePreview onRecord={onLog}/>}</div>
    </div>
    {(favorite||rows.length>0||hasWeek)&&<div className={'th-feed'+(hasWeek?' th-feed-split':'')}>
      {favorite&&<button className="th-shortcut" type="button" onClick={()=>favorite.run(preferredMetric?.id)}><favorite.Icon size={17}/>
        <span>{l('My shortcut','Mon raccourci','اختصاري')}</span><strong>{favorite.label}{preferredMetric?' · '+t(preferredMetric.name):''}</strong><ArrowUpRight size={16} className="th-direction"/></button>}
      {rows.length>0&&<section className="th-panel" aria-labelledby="th-results">
        <div className="th-panel-heading"><h2 id="th-results">{l('My recent results','Mes résultats récents','نتائجي الأخيرة')}</h2><button type="button" onClick={()=>onHistory(rows[0].metric.id)} className="th-text-action">{l('History','Historique','السجل')}<ChevronRight size={15} className="th-direction"/></button></div>
        <ul className="th-list">{rows.slice(0,3).map(({metric:item,value,date})=><li key={item.id}>
          <button type="button" className="th-result" onClick={()=>onHistory(item.id)}>
            <span className="th-result-icon"><MetricIcon id={item.id} size={19}/></span><span className="th-result-label"><strong>{t(item.name)}</strong>{date&&<time dateTime={date}>{dateFormat.format(new Date(date))}</time>}</span>
            <span className="th-result-value"><bdi>{formatValue(item,value)}</bdi> <small>{unit(entryUnit(item))}</small></span>
          </button>
        </li>)}</ul>
      </section>}
      {hasWeek && <section className="th-panel th-week" aria-labelledby="th-week">
        <div className="th-panel-heading"><h2 id="th-week">{l('This week', 'Cette semaine', 'هذا الأسبوع')}</h2><CalendarDays size={18} aria-hidden="true"/></div>
        <p className="th-week-count"><strong>{numbers.format(weekCount)}</strong> {weekCount === 1 ? l('completed workout', 'séance terminée', 'جلسة مكتملة') : l('completed workouts', 'séances terminées', 'جلسات مكتملة')}</p>
        <ol className="th-week-days">{week.map((date, index) => {
          const count = completed.filter(d => d === days[index]).length;
          const current = days[index] === day;
          return <li key={days[index]} className={count ? 'th-trained' : undefined} aria-current={current ? 'date' : undefined}>
            <time dateTime={days[index]} aria-label={fullDay.format(date) + ', ' + numbers.format(count) + ' ' + l('completed workouts', 'séances terminées', 'جلسات مكتملة')}>
              <span aria-hidden="true">{shortDay.format(date)}</span><b aria-hidden="true">{count ? <Check size={16}/> : numbers.format(date.getUTCDate())}</b>
            </time>
          </li>;
        })}</ol>
        {(plannedDays || minutes) && <p className="th-rhythm">{[
          plannedDays ? l('Weekly target', 'Objectif hebdomadaire', 'الهدف الأسبوعي') + ' · ' + numbers.format(plannedDays) + ' ' + (plannedDays === 1 ? l('session', 'séance', 'جلسة') : l('sessions', 'séances', 'جلسات')) : '',
          minutes ? numbers.format(minutes) + ' ' + l('min/session', 'min/séance', 'د/جلسة') : ''
        ].filter(Boolean).join(' · ')}</p>}
      </section>}
    </div>}
  </div>;
}
