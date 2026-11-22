'use client';

import {useEffect, useMemo, useState} from 'react';
import {ArrowRight, ArrowUpRight, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, ChevronRight, History, NotebookPen, Plus, Route} from 'lucide-react';
import {gameTierLabel} from './GameTierResult';
import HomeChallengePreview from './HomeChallengePreview';
import {overallPerformance} from '@/lib/overallPerformance';
import {activePlan, goalValue, sessionResult} from '@/lib/adaptiveProgram';
import {valid} from '@/lib/engine';
import {entryRaw, entryUnit} from '@/lib/focusedEntry';
import {observationDate,type Observation} from '@/lib/history';
import {useRetests} from '@/lib/hooks/useRetests';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import type {PersonalWorkspace} from '@/lib/personalWorkspace';
import {activeMetrics, type Demographics, type Metric, type Values} from '@/lib/registry';
import {dayInZone} from '@/lib/routineHistory';
import {latestTraining, type TrainingEvent, type Workout} from '@/lib/training';
import {MetricIcon} from './MetricIcon';
import {useTranslations} from './providers/LocaleProvider';
import '@/app/training-home.css';

type Props = {
  values: Values;
  profile?: Demographics;
  details: MeasurementMetadata;
  workspace?: PersonalWorkspace;
  trainingEvents?: TrainingEvent[];
  observations?: Observation[];
  owner?:string;
  revision?:number;
  shortcut?: {action: 'log' | 'program' | 'rank' | 'history'; metric?: string};
  onRank: (metric?: string) => void;
  onLog: (metric?: string) => void;
  onProgram: () => void;
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

function calendarWeek(isoDay: string) {
  const date = new Date(isoDay + 'T12:00:00Z');
  const monday = date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000;
  return Array.from({length: 7}, (_, index) => new Date(monday + index * 86400000));
}

export default function TrainingHome({values, details, profile, workspace, trainingEvents, observations = [], owner='guest', revision=0, shortcut, onRank, onLog, onProgram, onHistory}: Props) {
  const {locale, t} = useTranslations();
  const l = (en: string, fr: string, ar: string) => locale === 'fr' ? fr : locale === 'ar' ? ar : en;
  const numbers = new Intl.NumberFormat(locale, {maximumFractionDigits: 3});
  const plan = trainingEvents ? activePlan(trainingEvents) : null;
  const zone = plan?.event.data.timeZone || workspace?.context.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dateFormat = new Intl.DateTimeFormat(locale, {day: 'numeric', month: 'short', timeZone: zone});
  const [day, setDay] = useState('');
  useEffect(() => {
    const update = () => setDay(dayInZone(zone));
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, [zone]);

  const rows = recordedMetrics(values, details, observations);
  const goal = plan?.config ?? workspace?.goal;
  const metric = activeMetrics.find(item => item.id === goal?.metric);
  const deadline = plan?.config.deadline ?? workspace?.goal?.date;
  const hasGoal = !!goal && !!metric;
  const first = !hasGoal && rows.length === 0;
  const targetInKg = plan?.config.goalUnit === 'kg';
  const unit = (key: string) => key === 'min:sec' ? l('min:s', 'min:s', 'د:ث') : key === 'kg' ? l('kg', 'kg', 'كغ') : t(key);
  const targetUnit = metric ? unit(targetInKg ? 'kg' : entryUnit(metric)) : '';
  const {latest}=useRetests(owner,goal?.metric,observations,revision);
  const retest=latest&&goal&&Date.parse(observationDate(latest))>=Date.parse(goal.createdAt)?latest:undefined;
  const goalReading=metric&&retest?goalValue(metric,targetInKg?'kg':'metric',retest.value??undefined,retest):goal?.baseline;
  const reached = !!(metric && goal && goalReading !== undefined && (goalReading - goal.target) * metric.polarity >= 0);
  const pastDeadline = !!(day && deadline && deadline < day);
  const formatValue = (item: Metric, value: number) => {
    const raw = entryRaw(item, value);
    return item.id === 'run_5k' ? raw : numbers.format(Number(raw));
  };
  const workouts = latestTraining(trainingEvents ?? [])
    .filter(event => event.kind === 'workout' && !event.deleted)
    .map(event => event.data as Workout);
  const week = day ? calendarWeek(day) : [];
  const completed = workouts.filter(workout => workout.status === 'completed' && workout.endedAt)
    .map(workout => sessionResult(workout)?.day ?? dayInZone(zone, new Date(workout.endedAt!)));
  const days = week.map(date => date.toISOString().slice(0, 10));
  const weekCount = completed.filter(date => days.includes(date)).length;
  const plannedDays = plan?.config.days ?? workspace?.context.days;
  const minutes = plan?.config.minutes ?? workspace?.context.minutes;
  const hasWeek = !!trainingEvents && week.length > 0 && (!!plannedDays || workouts.length > 0);
  const shortDay = new Intl.DateTimeFormat(locale, {weekday: 'short', timeZone: 'UTC'});
  const fullDay = new Intl.DateTimeFormat(locale, {dateStyle: 'full', timeZone: 'UTC'});
  const calendarDate = new Intl.DateTimeFormat(locale, {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
  const standing=useMemo(()=>overallPerformance(values,details,profile),[values,details,profile]);
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
  const dateLabel=day&&new Intl.DateTimeFormat(locale,{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
  const heroHeading=hasGoal&&metric?t(metric.name):first?l('Log your first result','Ton premier résultat','سجّل نتيجتك الأولى'):rank?rank:l('Log a performance test','Saisis un test de performance','سجّل اختبار أداء');
  const primaryText=hasGoal?(reached?l('View result','Voir le résultat','عرض النتيجة'):pastDeadline?l('Review goal','Revoir l’objectif','مراجعة الهدف'):plan?l('Open program','Ouvrir le programme','فتح البرنامج'):l('Build my program','Créer mon programme','إنشاء برنامجي')):l('Log a result','Saisir un résultat','تسجيل نتيجة');
  const quickTests=[
    {id:'run_5k',name:l('5 km run','Course 5 km','جري ٥ كم'),unit:l('Min / sec','Min / sec','دقيقة / ثانية')},
    {id:'grip_strength',name:l('Grip strength','Force de poigne','قوة القبضة'),unit:l('Kilograms','Kilogrammes','كيلوغرام')},
    {id:'squat_1rm',name:l('Squat','Squat','القرفصاء'),unit:l('Load & reps','Charge et reps','الوزن والتكرارات')},
  ];
  return <div className="training-home">
    <header className="th-day"><div>{dateLabel&&<time dateTime={day}>{dateLabel}</time>}<h1 id="performance-page-title" tabIndex={-1}>{l('Today','Aujourd’hui','اليوم')}</h1></div></header>
    <section className="th-hero" aria-labelledby="th-hero-title">
      <div className="th-hero-copy">
        <span className="th-context">{hasGoal?l('Current goal','Objectif en cours','الهدف الحالي'):first?l('Your performance','Ta performance','أداؤك'):standing.coverage===4?l('Overall game position','Position globale dans le jeu','ترتيبك الإجمالي في اللعبة'):l('Provisional game position','Position provisoire dans le jeu','ترتيبك المؤقت في اللعبة')}</span>
        <h2 id="th-hero-title">{heroHeading}</h2>
        {hasGoal&&goal?<p className="th-goal-value"><bdi>{goalNumber(goal.target)} {targetUnit}</bdi>{deadline&&<> · <time dateTime={deadline}>{calendarDate.format(new Date(deadline+'T12:00:00Z'))}</time></>}</p>
          :<p>{first?l('Pick a test to find your level.','Choisis un test pour découvrir ton niveau.','اختر اختبارًا لتعرف مستواك.'):standing.overall?l('Based on your recorded performance tests.','D’après tes tests de performance enregistrés.','بحسب اختبارات الأداء التي سجّلتها.'):l('Your other measurements are in your journal.','Tes autres mesures sont dans ton journal.','قياساتك الأخرى محفوظة في سجلك.')}</p>}
        {progress!==undefined&&<progress max={1} value={progress} aria-label={l('Goal progress','Progression de l’objectif','التقدم نحو الهدف')}/>}
        {plan&&!reached&&!pastDeadline&&<p className="th-session"><span>{l('Next session','Prochaine séance','الجلسة القادمة')}</span><strong>{plan.config.exercise} · <bdi>{numbers.format(plan.prescription.sets)} × {numbers.format(plan.prescription.amount)}</bdi> {plan.prescription.mode==='reps'?l('reps','rép.','تكرارات'):l('s','s','ث')}{plan.prescription.loadKg>0&&<> · <bdi>{numbers.format(plan.prescription.loadKg)}</bdi> {unit('kg')}</>}</strong></p>}
        <div className="th-actions">
          <button type="button" className="th-primary" onClick={()=>hasGoal?(reached&&metric?onHistory(metric.id):onProgram()):onLog()}>{!hasGoal&&<Plus size={17}/>} {primaryText}{hasGoal&&<ArrowRight className="th-direction" size={16}/>}</button>
          {standing.overall&&<button type="button" className="th-secondary" onClick={()=>onRank()}>{l('View ranking','Classement','عرض الترتيب')}<ArrowRight className="th-direction" size={15}/></button>}
        </div>
      </div>
      <div className="th-coverage" aria-label={l('Performance areas covered','Domaines de performance renseignés','مجالات الأداء المسجلة')}>
        <svg viewBox="0 0 124 124" aria-hidden="true">
          {standing.areas.map((area,i)=><circle key={area.area} cx="62" cy="62" r="51" fill="none" stroke={area.points===null?'#345575':'#9dd5ff'} strokeWidth="8" strokeLinecap="round" strokeDasharray="71 250" transform={`rotate(${i*90-84} 62 62)`}/>)}
        </svg>
        <span><bdi>{numbers.format(standing.coverage)}<small> / {numbers.format(4)}</small></bdi><em>{l('areas','domaines','مجالات')}</em></span>
      </div>
      <div className="th-areas">{standing.areas.map((area,i)=><span key={area.area} data-filled={area.points!==null}><i aria-hidden="true"/>{areas[i]}</span>)}</div>
    </section>

    <section className="th-quick" aria-labelledby="th-quick-title">
      <div className="th-panel-heading"><h2 id="th-quick-title">{l('Quick log','Saisie rapide','تسجيل سريع')}</h2><button type="button" className="th-text-action" onClick={()=>onLog()}>{l('All tests','Tous les tests','كل الاختبارات')}<ChevronRight size={15} className="th-direction"/></button></div>
      <div className="th-quick-grid">{quickTests.map(test=><button type="button" key={test.id} onClick={()=>onLog(test.id)} className="th-quick-test" data-test={test.id}><span className="th-quick-icon"><MetricIcon id={test.id} size={22}/></span><span><strong>{test.name}</strong><small>{test.unit}</small></span><Plus size={16} aria-hidden="true"/></button>)}</div>
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
