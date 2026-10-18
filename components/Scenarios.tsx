'use client';
import {useMemo,useState,type ReactNode} from 'react';
import {useTranslations} from './providers/LocaleProvider';
import PotentialHero from './PotentialHero';
import {benchmarkGame} from '@/lib/benchmarkGame';
import {gameScenario,gameRoutes,type GameRoute} from '@/lib/gameScenarios';
import {TOP_BAND_EDGES} from '@/lib/topBands';
import type {Values,Demographics} from '@/lib/registry';
import type {MeasurementMetadata} from '@/lib/measurementMetadata';
import type {ScenarioSelection} from '@/lib/scenarioPlan';
export default function Scenarios({values,demographics,onMeasurements,onChoose,initialGoal,renderPreview}:{values:Values;demographics:Demographics;details:MeasurementMetadata;initialGoal?:ScenarioSelection|null;onMeasurements:()=>void;onChoose?:(goal:ScenarioSelection)=>void;renderPreview?:(goal:ScenarioSelection)=>ReactNode}){
 const {t}=useTranslations(),current=benchmarkGame(values,demographics).total;
 const nextTier=current?([...TOP_BAND_EDGES].reverse().find(n=>current==='65%+'||n<Number.parseFloat(current))??1):1;
 const [chosenTier,setTier]=useState<number|null>(null),[chosenRoute,setRoute]=useState<GameRoute|null>(null);
 const route=chosenRoute??(gameRoutes.includes(initialGoal?.route as GameRoute)?initialGoal!.route as GameRoute:'easier'),wanted=chosenTier??initialGoal?.targetTop;
 const target=wanted!==undefined&&wanted!==null&&TOP_BAND_EDGES.some(n=>n===wanted)&&(!current||current==='65%+'||wanted<=Number.parseFloat(current))?wanted:nextTier;
 const scenarios=useMemo(()=>current?gameRoutes.map(r=>gameScenario(values,demographics,target,r)):[],[values,demographics,target,current]);
 const selected=scenarios.find(s=>s.route===route),canGenerate=!!selected?.eligibleCount&&!!selected?.goal.targets.length;
 const actionLabel=!current?'Discover my tier':!canGenerate?'Record a measurement':selected?.goal.maintenance?'Generate a maintenance week':'Generate my weekly program';
 function generate(){if(!current||!canGenerate){onMeasurements();return;}if(selected&&onChoose)onChoose({...selected.goal,route:selected.route,targetTop:target,projectedTop:selected.top??undefined});}
 return <div className="potential-flow">
  <PotentialHero values={values} demographics={demographics} targetTop={target} targets={selected?.goal.targets} onTargetChange={setTier} onAction={generate} actionLabel={actionLabel} actionDisabled={!!current&&canGenerate&&!onChoose} route={route} routeOptions={canGenerate?scenarios:undefined} onRouteChange={setRoute} projectedTop={selected?.top} reached={selected?.reached} programPreview={canGenerate&&selected&&renderPreview?renderPreview(selected.goal):undefined}/>
  <details className="scenario-disclaimer"><summary>{t('How these scenarios work')}</summary><p>{t('Published references and game assumptions are different. No route optimizes lab results or thermal exposure. Weekly suggestions remain editable.')}</p><p>{t('Changes are capped at 50% of the starting value, or five small steps for very low starting values. These are hypothetical measurements, not this week’s workload.')}</p><p>{t('Easier means fewer changed tests in this model, not a guarantee of easy or fast biological improvement. Actual training time depends on you.')}</p></details>
 </div>;
}
