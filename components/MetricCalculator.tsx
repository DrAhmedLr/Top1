'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cooper, epley, skinfold, valid, weightedPullupRatio } from '@/lib/engine';
import type { Demographics, Metric } from '@/lib/registry';
import type { MeasurementDetails } from '@/lib/measurementMetadata';

export default function MetricCalculator({ metric, demographics, onUse,onWeight }: { metric: Metric; demographics: Demographics; onUse: (value: number, details: MeasurementDetails) => void;onWeight?:(weight:number)=>void }) {
  const [inputs, setInputs] = useState<number[]>(metric.id === 'vo2_max' ? [2400] : metric.id === 'body_fat' ? [10, 15, 12] : [60, 5]);
  const [bodyWeight,setBodyWeight]=useState(demographics.weight===undefined?'':String(demographics.weight));
  const needsWeight=!['vo2_max','body_fat'].includes(metric.id);
  const [error, setError] = useState('');
  const unsupported = metric.id === 'body_fat' && (demographics.sex === 'female' || demographics.age > 61);
  const labels = metric.id === 'vo2_max' ? ['Distance in 12 minutes (m)'] : metric.id === 'body_fat' ? ['Chest skinfold (mm)', 'Abdominal skinfold (mm)', 'Thigh skinfold (mm)'] : [metric.id === 'pullup_1rm' ? 'Added load (kg)' : 'Weight lifted (kg)', 'Repetitions (1–10)'];
  function calculate() {
    try {
      if (inputs.some(n => !Number.isFinite(n))) throw new Error('Enter a number in every field.');
      const weight=Number(bodyWeight);if(needsWeight&&(!bodyWeight.trim()||!Number.isFinite(weight)||weight<25||weight>350))throw new Error('Enter your actual body weight (25–350 kg) to calculate a body-weight ratio.');
      const value = metric.id === 'vo2_max' ? cooper(inputs[0]) : metric.id === 'body_fat' ? skinfold(inputs[0], inputs[1], inputs[2], demographics.age) : metric.id === 'pullup_1rm' ? weightedPullupRatio(inputs[0], inputs[1], weight) : epley(inputs[0], inputs[1]) / weight;
      if (!valid(metric, value)) throw new Error('The estimate is outside the supported range. Check your inputs.');
      if(needsWeight)onWeight?.(weight);
      onUse(Number(value.toFixed(2)), { method: metric.id === 'vo2_max' ? 'cooper_estimate' : metric.id === 'body_fat' ? 'skinfold_estimate' : inputs[1] === 1 ? 'direct_1rm' : 'epley_estimate', source: 'manual' });
    } catch (err) { setError(err instanceof Error ? err.message : 'Check your inputs.'); }
  }
  return <><p className="modal-description">{metric.id === 'vo2_max' ? 'A Cooper run gives an estimate of VO₂. It is saved for tracking and does not enter the index.' : metric.id === 'body_fat' ? 'The male Jackson–Pollock three-site equation estimates body fat. It is not interchangeable with DEXA.' : 'Estimate a one-rep maximum using Epley. The result is converted to a ratio of your recorded body weight.'}</p>{unsupported && <p className="field-error">This skinfold equation supports men aged 18–61. Use a different measurement method.</p>}<div className="calculator-fields">{needsWeight&&<label>Your body weight (kg)<input type="number" min="25" max="350" step="any" value={bodyWeight} placeholder="Required for this ratio" onChange={e=>setBodyWeight(e.target.value)}/></label>}{labels.map((label, i) => <label key={label}>{label}<input type="number" step="any" min={metric.id === 'pullup_1rm' && i === 0 ? 0 : 1} value={Number.isNaN(inputs[i]) ? '' : inputs[i]} onChange={e => setInputs(current => current.map((v, index) => index === i ? e.target.value ? Number(e.target.value) : NaN : v))}/></label>)}</div>{error && <p className="field-error" role="alert">{error}</p>}<div className="modal-actions"><button className="primary-button" disabled={unsupported} onClick={calculate}>Calculate & use estimate <ArrowRight size={16}/></button></div></>;
}
