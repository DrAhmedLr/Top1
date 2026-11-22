'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {AnimatePresence,LayoutGroup,motion,useReducedMotion} from 'framer-motion';
import {ArrowRight,Check,ChevronRight,History,Info,ListStart,Search,X} from 'lucide-react';
import {performanceCategories,performanceOrder,measurementTrack,measurementTracks,type MeasurementTrack} from '@/lib/performanceCatalog';
import {focusedEntry,entryRaw,entryUnit,isLift} from '@/lib/focusedEntry';
import {valid} from '@/lib/engine';
import {referenceRank} from '@/lib/rankExplorer';
import {bandLabel} from '@/lib/metricStandings';
import {parseMeasurementInput} from '@/lib/measurementInput';
import {performanceProfileAtTest,withPerformanceProfile} from '@/lib/performanceContext';
import {COMPETITIVE_CHALLENGE_METRICS} from '@/lib/challengeProgress';
import {overallChangeForSave,type OverallSaveChange} from '@/lib/overallPerformance';
import OverallChangeResult from './OverallChangeResult';
import BoundedTestResult from './BoundedTestResult';
import styles from './PerformanceBoard.module.css';
import {normalizeDemographics} from '@/lib/profile';
import type {Demographics,Metric,Values} from '@/lib/registry';
import type {MeasurementDetails,MeasurementMetadata} from '@/lib/measurementMetadata';
import {useTranslations} from './providers/LocaleProvider';
import {MetricIcon} from './MetricIcon';
import BenchmarkEvidence from './BenchmarkEvidence';
import GameTierResult,{gameTierLabel,type CreateTierGoal} from './GameTierResult';

type Props={owner:string;initialMetric?:string;onHistory:(id?:string)=>void;onCreateGoal?:CreateTierGoal;values:Values;details:MeasurementMetadata;profile?:Demographics;loadUnit?:'kg'|'lb';disabled?:boolean;onEditingChange:(open:boolean)=>void;onSave:(id:string,value:number,details:MeasurementDetails,profile:Demographics)=>Promise<void>};
function searchKey(value:string,locale:string){
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase(locale).replace(/[\s_‐‑–-]+/g,'');
}

export default function PerformanceBoard(props:Props){
 const {locale,t}=useTranslations(),l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en;
 const [selected,setSelected]=useState<string|null>(props.initialMetric??null),[queue,setQueue]=useState<string[]>([]);
 const [track,setTrack]=useState<MeasurementTrack>('performance'),[query,setQuery]=useState('');
 const trigger=useRef<HTMLElement|null>(null),searchInput=useRef<HTMLInputElement>(null);
 const reduced=useReducedMotion(),search=searchKey(query,locale);
 const labels={performance:l('Performance','Performance','الأداء'),capped:l('Capped tests','Tests plafonnés','اختبارات محدودة'),journal:l('Health journal','Journal santé','سجل الصحة')};
 const categories=performanceCategories.map(group=>({...group,ids:group.ids.filter(id=>{
   const metric=performanceOrder.find(item=>item.id===id)!;
   return search?[t(metric.name),metric.name,metric.id].some(name=>searchKey(name,locale).includes(search)):measurementTrack(id)===track;
 })})).filter(group=>group.ids.length);
 const selectedMetric=performanceOrder.find(m=>m.id===selected);
 const step=selected?queue.indexOf(selected):-1;
 useEffect(()=>{props.onEditingChange(!!selected);return()=>props.onEditingChange(false);},[selected,props.onEditingChange]);
 function open(id:string){trigger.current=document.activeElement as HTMLElement;setQueue([]);setSelected(id);}
 function close(){setSelected(null);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));}
 function start(){
  const ids=performanceOrder.filter(m=>measurementTrack(m.id)===track&&!valid(m,props.values[m.id])).map(m=>m.id);
  if(!ids.length)return;
  trigger.current=document.activeElement as HTMLElement;setQueue(ids);setSelected(ids[0]);
 }
 function another(){
  if(step>=0&&step+1<queue.length){setSelected(queue[step+1]);return;}
  setSelected(null);setQueue([]);setQuery('');
  if(selected)setTrack(measurementTrack(selected));
  requestAnimationFrame(()=>searchInput.current?.focus({preventScroll:true}));
 }
 const available=performanceOrder.some(m=>measurementTrack(m.id)===track&&!valid(m,props.values[m.id]));
 return <LayoutGroup id={`performance-${props.owner}`}><section className={`performance-board ${styles.board}`} aria-label={l('Measurements','Mesures','القياسات')}>
  <label className={styles.search}><Search size={18} aria-hidden="true"/><input ref={searchInput} type="search" aria-label={l('Find a measurement','Chercher une mesure','ابحث عن قياس')} placeholder={l('Find a measurement','Chercher une mesure','ابحث عن قياس')} value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className={styles.filters} role="group" aria-label={l('Measurement types','Types de mesures','أنواع القياسات')}>{measurementTracks.map(id=><button key={id} type="button" aria-pressed={!search&&track===id} onClick={()=>{setTrack(id);setQuery('');}}>{labels[id]}</button>)}</div>
  {categories.length===0&&<p role="status">{l('No matching measurements.','Aucune mesure correspondante.','لا توجد قياسات مطابقة.')}</p>}
  {categories.map(group=><section className={styles.group} key={group.id} aria-labelledby={`category-${group.id}`}>
   <h2 id={`category-${group.id}`}>{group.name[locale==='fr'?1:locale==='ar'?2:0]}</h2>
   <div className={styles.rows}>{group.ids.map(id=>{
    const m=performanceOrder.find(item=>item.id===id)!,value=props.values[id],recorded=valid(m,value);
    const rank=recorded?referenceRank(m,value,props.profile,props.details[id]):null;
    const standingId=`metric-standing-${id}`, valueId=`metric-value-${id}`;
    const label=rank?.progress?gameTierLabel(rank.progress.modelTopPercent===undefined?rank.progress.tier:rank.progress.modelTopPercent+'%',locale):null;
    return <motion.button type="button" layoutId={`metric-${id}`} transition={reduced?{duration:0}:{duration:.15}} className={`metric-tile ${styles.testRow} ${recorded?'is-recorded':''}`} key={id} onClick={()=>open(id)} disabled={props.disabled} aria-label={`${recorded?l('Update','Modifier','تعديل'):l('Record','Enregistrer','تسجيل')} ${t(m.name)}`} aria-describedby={recorded?`${valueId} ${standingId}`:undefined}>
     <span className={styles.icon}><MetricIcon id={id} size={20}/></span>
     <span className={styles.name}><strong>{t(m.name)}</strong><small id={valueId}>{recorded&&<><bdi>{entryRaw(m,value)}</bdi>{' '}</>}{t(entryUnit(m))}</small></span>
     <span className={`tile-standing ${styles.standing}`} id={standingId}>{rank?.published?<><bdi>TOP {bandLabel(rank.published.band)}{rank.published.band.kind==='upper'&&' '+t('or better')}</bdi><small>{l('Published cohort','Cohorte publiée','عينة منشورة')}</small></>:label?<bdi>{label}</bdi>:null}</span>
     <ChevronRight className={styles.next} size={16} aria-hidden="true"/>
    </motion.button>;
   })}</div>
  </section>)}
  <div className={styles.actions}>{available&&!search&&<button type="button" onClick={start} disabled={props.disabled}><ListStart size={16}/>{l('Guided entry','Saisie guidée','التسجيل الموجّه')}</button>}
   <button type="button" onClick={()=>props.onHistory()}><History size={16}/>{l('My history','Mon historique','سجلي')}</button></div>
 </section>
 {typeof document!=='undefined'&&createPortal(<AnimatePresence mode="wait">{selectedMetric&&<FocusedEditor key={selectedMetric.id} metric={selectedMetric} value={props.values[selectedMetric.id]} details={props.details[selectedMetric.id]??{}} profile={props.profile} loadUnit={props.loadUnit??'kg'} guided={step>=0} step={step+1} total={queue.length} onClose={close} onCreateGoal={props.onCreateGoal} onHistory={()=>props.onHistory(selectedMetric.id)} onAnother={another} onSave={async(value,detail,profile)=>{
  const change=overallChangeForSave(selectedMetric.id,value,detail,props.values,props.details,props.profile,profile);
  await props.onSave(selectedMetric.id,value,detail,profile);
  return change;
 }}/>}</AnimatePresence>,document.body)}
 </LayoutGroup>;
}
function FocusedEditor({metric:m,value,details,profile,loadUnit,guided,step,total,onClose,onCreateGoal,onHistory,onAnother,onSave}:{metric:Metric;value?:number;details:MeasurementDetails;profile?:Demographics;loadUnit:'kg'|'lb';guided:boolean;step:number;total:number;onClose:()=>void;onCreateGoal?:CreateTierGoal;onHistory:()=>void;onAnother:()=>void;onSave:(v:number,d:MeasurementDetails,p:Demographics)=>Promise<OverallSaveChange|null>}){
 const {locale,t}=useTranslations(),l=(en:string,fr:string,ar:string)=>locale==='fr'?fr:locale==='ar'?ar:en,reduced=useReducedMotion();
 const [raw,setRaw]=useState(entryRaw(m,value)),[load,setLoad]=useState(details.derivation?String(Number((details.derivation.inputs[0]/(loadUnit==='lb'?0.45359237:1)).toFixed(2))):''),[reps,setReps]=useState(String(details.derivation?.inputs[1]??1)),[weight,setWeight]=useState(String(details.derivation?.bodyWeightKg??profile?.weight??'')),[age,setAge]=useState<string>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState<{value:number;progress:ReturnType<typeof referenceRank>['progress'];snapshot?:ReturnType<typeof performanceProfileAtTest>;change:OverallSaveChange|null}|null>(null);
 const isPushup=m.id==='pushups', ranked=COMPETITIVE_CHALLENGE_METRICS.has(m.id);
 let sameTest=false;
 if(valid(m,value)){
   try{sameTest=focusedEntry(m,{raw,load,reps,weight,loadUnit},{value,details}).details===details;}
   catch{/* Incomplete inputs describe a new attempt. */}
 }
 const [weightOverride,setWeightOverride]=useState<string>(),[sexOverride,setSexOverride]=useState<Demographics['sex']>();
 const prior=performanceProfileAtTest(profile,details);
 const testAge=age??String((sameTest?prior.age:profile?.age)??'');
 const testWeight=weightOverride??String((sameTest?prior.weight:profile?.weight)??'');
 const testSex=sexOverride??(sameTest?prior.sex:profile?.sex)??'unselected';
 const root=useRef<HTMLElement>(null),saveLock=useRef(false),alive=useRef(true),lift=isLift(m.id);
 useEffect(()=>{alive.current=true;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';root.current?.querySelector<HTMLInputElement>('[data-entry]')?.focus({preventScroll:true});return()=>{alive.current=false;document.body.style.overflow=overflow;};},[]);
 useEffect(()=>{function keys(e:KeyboardEvent){if(e.key==='Escape'&&!saveLock.current)onClose();if(e.key==='Tab'){const nodes=Array.from(root.current?.querySelectorAll<HTMLElement>('button,input,select,summary,a[href]')??[]).filter(n=>!n.hasAttribute('disabled')&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}document.addEventListener('keydown',keys);return()=>document.removeEventListener('keydown',keys);},[onClose]);
 useEffect(()=>{
   if(saved&&root.current){
     root.current.scrollTop=0;
     root.current.querySelector<HTMLElement>('.focus-success [role=status]')?.focus({preventScroll:true});
   }
 },[saved]);

 async function submit(e:FormEvent){
   e.preventDefault();
   if(saveLock.current)return;
   setError('');
   let person:Demographics;
   try {
     const ageText=ranked?testAge:age??'';
     const suppliedAge=ageText.trim()===''?undefined:Number(parseMeasurementInput(ageText));
     if(suppliedAge!==undefined&&(!Number.isInteger(suppliedAge)||suppliedAge<18||suppliedAge>120))throw Error('age');
     person=profile??normalizeDemographics({age:suppliedAge,sex:ranked?testSex:'unselected'});
   } catch {
     setError(l('Enter your age, 18–120.','Indique ton âge, entre 18 et 120 ans.','أدخل عمرك من 18 إلى 120 سنة.'));
     const field=root.current?.querySelector<HTMLInputElement>('.first-age input');
     const disclosure=field?.closest('details');
     if(disclosure)disclosure.open=true;
     field?.focus();
     return;
   }
   let entry:ReturnType<typeof focusedEntry>;
   try {
     entry=focusedEntry(m,{raw,load,reps,weight,loadUnit},{value,details});
     if(ranked){
       const bodyWeightKg=lift?entry.details.derivation?.bodyWeightKg:testWeight.trim()?Number(parseMeasurementInput(testWeight)):undefined;
       if(bodyWeightKg!==undefined&&(!Number.isFinite(bodyWeightKg)||bodyWeightKg<25||bodyWeightKg>350)){
         setError(l('Test weight must be 25–350 kg. You can leave it blank.','Le poids au test doit être compris entre 25 et 350 kg. Ce champ est facultatif.','وزن الاختبار من 25 إلى 350 كغ. يمكنك تركه فارغًا.'));
         return;
       }
       entry.details=withPerformanceProfile(m.id,entry.details,{age:testAge.trim()?Number(parseMeasurementInput(testAge)):undefined,sex:testSex,weight:bodyWeightKg});
       if(!profile&&bodyWeightKg!==undefined)person={...person,weight:bodyWeightKg};
     }
   } catch {
     setError(l('Check the number and unit.','Vérifie le nombre et l’unité.','تحقق من الرقم والوحدة.'));
     return;
   }
   saveLock.current=true;
   setBusy(true);
   try {
     const change=await onSave(entry.value,entry.details,person);
     if(alive.current)setSaved({value:entry.value,progress:referenceRank(m,entry.value,person,entry.details).progress,snapshot:ranked?performanceProfileAtTest(person,entry.details):undefined,change});
   } catch(e) {
     if(alive.current)setError(e instanceof Error?t(e.message):l('Could not save. Try again.','Enregistrement impossible. Réessaie.','تعذّر الحفظ. أعد المحاولة.'));
   } finally {
     saveLock.current=false;
     if(alive.current)setBusy(false);
   }
 }
 return <motion.div className="focus-scrim" dir={locale==='ar'?'rtl':'ltr'} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:.18}}><motion.section ref={root} layoutId={`metric-${m.id}`} transition={reduced?{duration:0}:{type:'spring',stiffness:360,damping:34}} className={`focus-panel ${styles.panel}`} role="dialog" aria-modal="true" aria-labelledby="focus-title">
 <div className="focus-toolbar"><span>{guided?<>{String(step).padStart(2,'0')} <span>/ {total}</span></>:<MetricIcon id={m.id} size={25}/>}</span><button type="button" className="focus-close" aria-label={l('Close','Fermer','إغلاق')} onClick={onClose} disabled={busy}><X size={22}/></button></div>
 {guided&&<div className="focus-progress" role="progressbar" aria-label={l('Measurement progress','Progression des mesures','تقدم القياسات')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={step-1}><motion.span animate={{width:`${(step-1)/total*100}%`}}/></div>}
 <h2 id="focus-title">{t(m.name)}</h2>
 {saved?<div className={`focus-success${saved.progress?' has-game-tier':''}`}>
 <motion.div className="focus-check" initial={reduced?false:{scale:.7}} animate={{scale:1}}><Check size={saved.progress?22:42}/></motion.div>
 <p role="status" tabIndex={-1}>{l('Recorded','Enregistré','تم التسجيل')} · <bdi>{m.id==='run_5k'?entryRaw(m,saved.value):new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(Number(entryRaw(m,saved.value)))}</bdi> {m.id==='run_5k'?l('min:sec','min:s','د:ث'):t(entryUnit(m))}</p>
 {saved.change&&saved.change.previous!==null&&<OverallChangeResult change={saved.change}/>}
 {saved.progress&&<GameTierResult metric={m} progress={saved.progress} snapshot={saved.snapshot} onCreateGoal={onCreateGoal?(id,target)=>{onClose();onCreateGoal(id,target);}:undefined}/>}
 {!saved.progress&&<BoundedTestResult metric={m} value={saved.value}/>}
 {saved.change&&saved.change.previous===null&&<OverallChangeResult change={saved.change}/>}
 <div className={styles.afterActions}><button className="focus-save" type="button" onClick={onAnother}>{guided&&step<total?l('Next test','Test suivant','الاختبار التالي'):l('Log another','Ajouter une mesure','سجّل قياسًا آخر')}<ArrowRight size={17}/></button><button type="button" onClick={onClose}>{l('Done','Terminé','تم')}</button></div></div>:<form onSubmit={submit}>
 <fieldset disabled={busy} className="focus-inputs">{lift?<><label className="hero-number">{l(m.id==='pullup_1rm'?'Added load':'Weight lifted',m.id==='pullup_1rm'?'Charge ajoutée':'Charge soulevée',m.id==='pullup_1rm'?'الوزن الإضافي':'الوزن المرفوع')}<span><input data-entry inputMode="decimal" type="text" maxLength={16} value={load} placeholder="0" onChange={e=>setLoad(e.target.value)} autoComplete="off"/><b>{loadUnit}</b></span></label><div className="focus-pair"><label>{l('Reps','Répétitions','التكرارات')}<input inputMode="numeric" value={reps} maxLength={2} onChange={e=>setReps(e.target.value)}/></label><label>{l('Body weight · kg','Poids du corps · kg','وزن الجسم · كغ')}<input inputMode="decimal" value={weight} maxLength={8} placeholder="—" onChange={e=>setWeight(e.target.value)}/></label></div></>:<label className="hero-number"><span className="sr-only">{t(m.name)}</span><span><input data-entry type="text" inputMode={m.id==='run_5k'?'text':'decimal'} maxLength={16} value={raw} placeholder={m.id==='run_5k'?'00:00':'0'} onChange={e=>setRaw(e.target.value)} autoComplete="off"/><b>{t(entryUnit(m))}</b></span></label>}
 {isPushup&&<p className="pushup-protocol">{l('One strict set to form failure.','Une série stricte, jusqu’à la perte de forme.','مجموعة ضغط واحدة حتى تعذّر إكمال تكرار صحيح.')}</p>}
 {!profile&&<label className="first-age">{l('Your age','Ton âge','عمرك')}<input name="testAge" inputMode="numeric" maxLength={3} value={ranked?testAge:age??''} placeholder="—" onChange={e=>setAge(e.target.value)}/></label>}
 {ranked&&<details className={styles.testProfile}><summary>{l('Test profile','Profil du test','بيانات الاختبار')}<span>{l('Edit','Modifier','تعديل')}</span></summary>
 {profile&&<label className="first-age">{l('Age at test','Âge au test','العمر عند الاختبار')}<input name="testAge" inputMode="numeric" maxLength={3} value={testAge} onChange={e=>setAge(e.target.value)}/></label>}
 <div className="focus-pair">
 {!lift&&<label>{l('Test weight · kg','Poids au test · kg','الوزن عند الاختبار · كغ')}<input name={isPushup?'pushupWeight':'testWeight'} inputMode="decimal" maxLength={8} value={testWeight} onChange={e=>setWeightOverride(e.target.value)} placeholder={l('Optional','Facultatif','اختياري')}/></label>}
 <label>{l('Reference sex','Sexe de référence','الجنس المرجعي')}<select name={isPushup?'pushupSex':'testSex'} value={testSex} onChange={e=>setSexOverride(e.target.value as Demographics['sex'])}>
 <option value="unselected">{l('Unspecified','Non précisé','غير محدد')}</option><option value="female">{l('Female','Féminin','أنثى')}</option><option value="male">{l('Male','Masculin','ذكر')}</option>
 </select></label></div></details>}
 </fieldset>{error&&<p className="focus-error" role="alert">{error}</p>}
 <button type="submit" className="focus-save" disabled={busy}>{busy?l('Saving…','Enregistrement…','جارٍ الحفظ…'):l('Save result','Enregistrer','حفظ النتيجة')}<Check size={18}/></button>
 {guided&&<button className="focus-skip" type="button" disabled={busy} onClick={onAnother}>{l('Skip','Passer','تخطّ')}<ChevronRight size={15}/></button>}
 <details className="focus-help"><summary><Info size={14}/>{l('How to measure','Comment mesurer','طريقة القياس')}</summary><p>{t(m.proofData.instructions)}</p><BenchmarkEvidence metric={m}/></details>
 </form>}
 {!guided&&(saved||valid(m,value))&&<button type="button" className="focus-tracker-link" disabled={busy} onClick={onHistory}><History size={16}/>{l('View history','Voir l’historique','عرض السجل')}</button>}
 </motion.section></motion.div>;
}
