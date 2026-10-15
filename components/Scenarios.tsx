'use client';
import {useMemo,useState} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowRight,Check} from 'lucide-react';
import {useTranslations} from './providers/LocaleProvider';
import {MetricIcon} from './MetricIcon';
import Pyramid from './Pyramid';
import {benchmarkGame} from '@/lib/benchmarkGame';
import {gameScenario,gameRoutes,type GameRoute} from '@/lib/gameScenarios';
import {TOP_BAND_EDGES} from '@/lib/topBands';
import type {Values,Demographics} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import type {ScenarioSelection} from '@/lib/scenarioPlan';
export default function Scenarios({values,demographics,onMeasurements,onChoose,initialGoal}:{values:Values;demographics:Demographics;details:MeasurementMetadata;initialGoal?:ScenarioSelection|null;onMeasurements:()=>void;onChoose?:(goal:ScenarioSelection)=>void}){
 const {t}=useTranslations(),reduced=useReducedMotion(),standing=benchmarkGame(values,demographics),current=standing.total;
 const nextTier=current?([...TOP_BAND_EDGES].reverse().find(n=>current==='65%+'||n<Number.parseFloat(current))??1):35;
 const [chosenTier,setTier]=useState<number|null>(null),[chosenRoute,setRoute]=useState<GameRoute|null>(null);
 const route=chosenRoute??(gameRoutes.includes(initialGoal?.route as GameRoute)?initialGoal!.route as GameRoute:'easier'),savedTier=chosenTier??initialGoal?.targetTop;
 const target=savedTier!==undefined&&savedTier!==null&&(current==='65%+'||current&&savedTier<Number.parseFloat(current))?savedTier:nextTier;
 const scenarios=useMemo(()=>gameRoutes.map(r=>gameScenario(values,demographics,target,r)),[values,demographics,target]),selected=scenarios.find(s=>s.route===route)!;
 return <div className="potential-flow"><div className="potential-steps"><span>{t('1 · Find your tier')}</span><span>{t('2 · Choose your climb')}</span><span>{t('3 · Build your week')}</span></div>
 <section className="card potential-tier"><div><span className="eyebrow">{t('YOUR STARTING POINT')}</span><h3>{current?`${t('Top')} ${current}`:t('Your first measurement starts here')}</h3><p>{t('Illustrative benchmark · product assumptions')}</p><p>{t('Choose a higher tier, then compare ways to get there. The pyramid has finer steps near the top.')}</p><strong className="target-tier">{t('Your target')} · {t('Top')} {target}%</strong><p>{t('Only recorded physical performance measurements can be changed in these routes. Other results stay fixed.')}</p></div><Pyramid top={current} selected={target} onChoose={setTier}/></section>
 {!selected.eligibleCount?<section className="card"><p>{t('Record a physical performance test to build an exercise route. Other measurements still contribute to your game standing.')}</p><button className="primary-button" onClick={onMeasurements}>{t('Record a measurement')}</button></section>:<>
 <div className="card-heading"><h3>{t('Choose your route')}</h3><small>{t('Different effort, no promised timeline')}</small></div><div className="route-grid">{scenarios.map(s=><button className={`card route-card ${route===s.route?'selected':''}`} key={s.route} aria-pressed={route===s.route} onClick={()=>setRoute(s.route)}><span className="eyebrow">{t(s.route==='easier'?'FOCUSED':s.route==='balanced'?'BALANCED':'HIGHER EFFORT')}</span><h3>{t(s.route==='easier'?'One thing at a time':s.route==='balanced'?'Share the effort':'A broader challenge')}</h3><p>{t(s.route==='easier'?'Change one recorded test with the strongest model impact.':s.route==='balanced'?'Spread changes across up to two tests.':'Explore changes across up to three tests.')}</p><strong>{t('Top')} {s.top??'—'}</strong><small>{s.changes} {t('measurements to improve')}</small><span>{t(s.reached?'Reaches your chosen tier in this model':'Closest available route within the change limits')}</span>{route===s.route&&<Check size={18}/>}</button>)}</div>
 <motion.section className="card route-details" key={`${route}-${target}`} initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}}><h3>{t('What would need to change')}</h3><div className="scenario-roadmap">{selected.goal.targets.map(g=><div key={g.id}><span className="metric-title"><MetricIcon id={g.id}/>{t(g.name)}</span><strong>{g.current} <ArrowRight size={14}/> {g.target} <small>{t(g.unit)}</small></strong></div>)}</div><p>{t('Changes are capped at 50% of the starting value, or five small steps for very low starting values. These are hypothetical measurements, not this week’s workload.')}</p><p>{t('Easier means fewer changed tests in this model, not a guarantee of easy or fast biological improvement. Actual training time depends on you.')}</p><button className="primary-button stitch-cta" disabled={!onChoose||!selected.goal.targets.length} onClick={()=>onChoose?.({...selected.goal,route:selected.route,targetTop:target,projectedTop:selected.top??undefined})}>{t('Generate my weekly program')}<ArrowRight size={16}/></button>{!selected.reached&&<p>{t('This route does not reach the selected tier. Choose a closer tier or use these intermediate goals.')}</p>}</motion.section></>}
 <p className="scenario-disclaimer">{t('Published references and game assumptions are different. No route optimizes lab results or thermal exposure. Weekly suggestions remain editable.')}</p></div>;
}
