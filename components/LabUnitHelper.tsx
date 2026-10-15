'use client';
import {useTranslations} from '@/components/providers/LocaleProvider';
import {useState} from 'react';
export default function LabUnitHelper({metricId}:{metricId:string}){
 const {t:tr}=useTranslations();

 const [raw,setRaw]=useState('');if(metricId!=='hba1c'&&metricId!=='lpa')return null;
 if(metricId==='lpa')return <p className="observation-age">{tr("Keep the laboratory's reported units. Lipoprotein(a) has no universal mg/dL-to-nmol/L conversion; this field accepts nmol/L only.")}</p>;
 const n=Number(raw),result=raw.trim()&&Number.isFinite(n)&&n>=0?(n*.09148+2.152).toFixed(1):null;
 return <details className="measurement-details"><summary>{tr("HbA1c unit helper")}</summary><label>{tr("IFCC result (mmol/mol)")}<input type="text" inputMode="decimal" value={raw} onChange={e=>setRaw(e.target.value)}/></label><p>{tr(result?`${result}% NGSP · rounded to 0.1% · preview only`:'Enter a result to preview NGSP percent.')}</p><p>{tr("Formula: NGSP (%) = 0.09148 × IFCC + 2.152. Record the converted percent above if appropriate and retain your original lab report. This helper does not infer a diagnosis.")}</p><a href="https://ngsp.org/ifccngsp.asp" target="_blank" rel="noreferrer">{tr("NGSP conversion source")}</a></details>;
}
