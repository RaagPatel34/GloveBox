'use client';
import { useState, type FormEvent } from 'react';
import { calculateTrip, type TripInput } from '@/lib/trip';
import { DrivingPlanner } from '@/components/driving-planner';
import { safeUrl } from '@/lib/maintenance';
import { ExternalIcon } from '@/components/shell/icons';
const money = (v:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v);
export function TripPlanner({mpg}:{mpg:number}) {
  const [values,setValues] = useState({miles:'',mpg:String(mpg),gallons:'',usualPrice:'',alternatePrice:'',extraMiles:'',extraMinutes:'0',hourlyValue:'0'});
  const [example,setExample] = useState(false);
  const [result,setResult] = useState<ReturnType<typeof calculateTrip>|null>(null);
  const [error,setError] = useState('');
  const [source,setSource]=useState('');const [asOf,setAsOf]=useState('');
  function change(key:keyof TripInput,value:string) {setValues({...values,[key]:value});if (key === 'usualPrice' || key === 'alternatePrice') setExample(false);setResult(null);}
  function loadExample() {setValues({miles:'42',mpg:'32',gallons:'12',usualPrice:'4.89',alternatePrice:'4.59',extraMiles:'8',extraMinutes:'15',hourlyValue:'0'});setExample(true);setResult(null);setError('');setSource('');setAsOf('');}
  function submit(e:FormEvent) {
    e.preventDefault();setError('');setResult(null);
    try {
      if(source && !safeUrl(source))throw new Error('Price source must be an HTTPS URL.');
      if(!example && (!asOf || !Number.isFinite(Date.parse(asOf)) || Date.parse(asOf)>Date.now()))throw new Error('Enter when you observed the prices, using a time in the past.');
      setResult(calculateTrip(Object.fromEntries(Object.entries(values).map(([key,value])=>[key,Number(value)])) as TripInput));
    }catch(err){setError((err as Error).message);}
  }
  return <><DrivingPlanner mpg={mpg} onDistance={miles=>{setValues(v=>({...v,miles:String(miles)}));setResult(null);}}/><section className="tool-panel trip-panel" id="trip"><div className="section-heading"><div><h2>Is cheaper gas worth the detour?</h2></div><button className="text-button" onClick={loadExample}>Use example</button></div><p className="helper">Compare the savings at the pump with the extra fuel and time it takes to get there. All math runs locally. No AI credits needed.</p>
    <form onSubmit={submit}><div className="form-grid trip-inputs">{([
      ['miles','Original trip (mi)',0,10000],['mpg','Fuel economy (MPG)',1,150],['gallons','Gallons to buy',0.1,100],['usualPrice','Usual station ($/gal)',0.01,30],['alternatePrice','Alternate station ($/gal)',0.01,30],['extraMiles','Extra detour miles',0,1000],['extraMinutes','Extra detour minutes',0,1440],['hourlyValue','Value of your time ($/hr)',0,1000],
    ] as const).map(([key,label,min,max])=><label key={key}>{label}<input required type="number" min={min} max={max} step="any" value={values[key]} onChange={e=>change(key,e.target.value)}/></label>)}</div>
    <div className="form-grid"><label>Prices observed at<input type="datetime-local" required={!example} value={asOf} onChange={e=>{setAsOf(e.target.value);setResult(null);}} disabled={example}/></label><label>Price source link (optional)<input type="url" placeholder="https://…" value={source} onChange={e=>{setSource(e.target.value);setResult(null);}} disabled={example}/></label></div><p className="helper">{example?'Example prices only—not live station quotes. Editing either price switches to your own price inputs.':'Prices and distances are entered by you, not independently verified. Use the same fuel grade at both stations.'} Time value can stay at $0 to compare fuel alone.</p><button className="primary">Compare the detour</button></form>
    {error&&<p className="error" role="alert">{error}</p>}{result&&<div className="trip-result" role="status"><span className="pill">{example?'ILLUSTRATIVE EXAMPLE':'YOUR ENTERED PRICES'}</span><h3>{Math.abs(result.netAfterTime)<0.005?'It’s a break-even detour.':result.worthIt?`Keep ${money(result.netAfterTime)} after the detour.`:`The detour costs ${money(Math.abs(result.netAfterTime))} more.`}</h3><div className="calculation-grid"><div><span>Savings at the pump</span><strong>{money(result.purchaseSavings)}</strong></div><div><span>Extra fuel cost</span><strong>− {money(result.detourFuelCost)}</strong></div><div><span>Extra time value</span><strong>− {money(result.timeCost)}</strong></div><div><span>Net savings</span><strong>{money(result.netAfterTime)}</strong></div></div><p>Original trip fuel: {money(result.baselineFuelCost)} · Distance with detour: {result.totalMiles.toFixed(1)} mi</p><p>Break-even allowance: {result.breakEvenExtraMiles.toFixed(1)} extra miles at these prices and time cost.</p><p className="helper">Savings = price difference × gallons purchased − extra miles ÷ MPG × usual price − extra minutes ÷ 60 × hourly value. Estimates exclude tolls, wear, queues, and traffic changes. Buying fuel is separate from the cost of fuel consumed on the trip.</p>{!example&&<p className="helper">Observed: {new Date(asOf).toLocaleString()}{source&&<> · <a href={source} target="_blank" rel="noreferrer">Your price source <ExternalIcon /></a></>}</p>}</div>}
  </section></>;
}
