'use client';
import { useRef, useState, type FormEvent } from 'react';
import { createGarage, logService, setSchedule, updateOdometer, setMileagePlan, HONDA_SOURCE, TIRE_SOURCE } from '@/lib/garage';
import { isGarage, LABELS, type Garage } from '@/lib/maintenance';
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,10);
const field = (data: FormData, name: string) => String(data.get(name) || '').trim();

export function CarSetup({ existing, onSave, onCancel }: { existing:boolean; onSave:(garage:Garage)=>void; onCancel:()=>void }) {
  const [values, setValues] = useState({year:'',make:'',model:'',mpg:'',odometer:'',location:'',weeklyMiles:'0'});
  const [options, setOptions] = useState<{id:string;label:string}[]>([]);
  const [modelMatches,setModelMatches] = useState<string[]>([]);
  const [epaId, setEpaId] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  function change(name:keyof typeof values,value:string) { setValues({...values,[name]:value}); if (['year','make','model','mpg'].includes(name)) setEpaId(''); if (['year','make','model'].includes(name)) { setOptions([]);setModelMatches([]); } setNotice(''); }
  async function lookup(id?:string, modelName?:string) {
    setBusy(true);setError('');setNotice('');
    try {
      const query = id ? new URLSearchParams({kind:'detail',id}) : new URLSearchParams({kind:'options',year:values.year,make:values.make,model:modelName || values.model});
      const response = await fetch(`/api/vehicle?${query}`, {signal:AbortSignal.timeout(10000)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (id) { setValues({...values,year:String(result.year),make:result.make,model:result.model,mpg:String(result.mpg)});setEpaId(result.id);setNotice('EPA combined MPG loaded. You can override it with your measured MPG.'); }
      else {setOptions(result.options);setModelMatches(result.models || []);if (!result.options.length) setNotice('Choose the EPA model name below, or enter MPG manually.');}
    } catch(err) {setError(err instanceof Error && err.name !== 'TimeoutError' ? err.message : 'EPA lookup timed out. Enter MPG manually to continue.');}
    finally {setBusy(false);}
  }
  function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setError('');
    try { onSave(createGarage({ year:Number(values.year),make:values.make,model:values.model,mpg:Number(values.mpg),odometer:Number(values.odometer),location:values.location,weeklyMiles:Number(values.weeklyMiles),epaId:epaId || undefined })); }
    catch(err) {setError((err as Error).message);}
  }
  return <section className="tool-panel setup-panel" aria-labelledby="setup-title"><div className="section-heading"><h2 id="setup-title">Make room for your car</h2><button className="text-button" onClick={onCancel}>Cancel</button></div><p className="helper">Start with what you know. Service dates stay unknown until you record them. Liquid-fuel cars only; EV charging is not supported yet.</p><form onSubmit={submit}>
    <div className="form-grid"><label>Year<input required type="number" min="1984" max={new Date().getFullYear()+1} value={values.year} onChange={e=>change('year',e.target.value)} disabled={busy}/></label><label>Make<input required maxLength={80} placeholder="Honda" value={values.make} onChange={e=>change('make',e.target.value)} disabled={busy}/></label><label>Model<input required maxLength={100} placeholder="Civic" value={values.model} onChange={e=>change('model',e.target.value)} disabled={busy}/></label></div>
    <button className="secondary" type="button" disabled={busy || !values.year || !values.make || !values.model} onClick={()=>lookup()}>{busy ? 'Looking up EPA data…' : 'Find EPA fuel economy'}</button>
    {modelMatches.length>0 && <label className="spaced">EPA model name<select value="" disabled={busy} onChange={e=>{if(e.target.value){setValues({...values,model:e.target.value});void lookup(undefined,e.target.value);}}}><option value="">Select the model listed by EPA</option>{modelMatches.map(name=><option key={name} value={name}>{name}</option>)}</select></label>}
    {options.length>0 && <label className="spaced">Choose your engine / transmission<select value={epaId} disabled={busy} onChange={e=>{if(e.target.value) void lookup(e.target.value);}}><option value="">Select the matching configuration</option>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>}
    <div className="form-grid spaced"><label>Fuel economy (MPG)<input required type="number" min="1" max="150" step="0.1" value={values.mpg} onChange={e=>change('mpg',e.target.value)} disabled={busy}/><span className="field-note">{epaId ? 'EPA combined estimate' : 'Your measured or manually entered estimate'}</span></label><label>Current odometer (mi)<input required type="number" inputMode="numeric" min="0" max="2000000" step="1" value={values.odometer} onChange={e=>change('odometer',e.target.value)} disabled={busy}/></label><label>Miles per week<input required type="number" inputMode="numeric" min="0" max="2000" value={values.weeklyMiles} onChange={e=>change('weeklyMiles',e.target.value)} disabled={busy}/><span className="field-note">Used only to estimate upcoming upkeep</span></label><label>City (optional)<input maxLength={100} placeholder="Buena Park, CA" value={values.location} onChange={e=>change('location',e.target.value)} disabled={busy}/></label></div>
    {existing && <label className="check-label"><input type="checkbox" required/> Replace this browser’s current garage. I’ve exported any history I want to keep.</label>}
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>Save my car ↗</button>
  </form></section>;
}

type OnSave = (garage:Garage, message?:string)=>void;

// Each tool reports its own result beside it; the change itself goes through onSave.
function useAttempt(onSave:OnSave) {
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  function attempt(work:()=>Garage, message:string) {
    setError('');setNotice('');
    try {onSave(work(),message);setNotice(message);} catch(err){setError((err as Error).message);}
  }
  const feedback = <>{error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="notice">{notice}</p>}</>;
  return { attempt, setError, feedback };
}

export function ServiceHistory({garage}:{garage:Garage}) {
  const entries = [...(garage.services ?? [])].sort((a,b)=>b.date.localeCompare(a.date)||b.odometer-a.odometer);
  return <section className="tool-panel history" aria-labelledby="history-title"><div className="section-heading"><h2 id="history-title">Service history</h2><span className="tiny">{entries.length} {entries.length===1?'entry':'entries'} · stored on this device</span></div>
    {!entries.length ? <p className="helper">No completed services recorded yet.</p> : <div className="history-table"><table><thead><tr><th scope="col">Date</th><th scope="col">Service</th><th scope="col">Odometer</th><th scope="col">Notes</th></tr></thead><tbody>{entries.map(entry=>{const item=garage.items.find(i=>i.id===entry.itemId);return <tr key={entry.id}><td className="num">{entry.date}</td><th scope="row">{item ? LABELS[item.kind] : 'Removed item'}</th><td className="num">{entry.odometer.toLocaleString()} mi</td><td>{entry.notes||'—'}</td></tr>;})}</tbody></table></div>}
  </section>;
}

export function RecordService({garage,onSave,initialItemId}:{garage:Garage;onSave:OnSave;initialItemId?:string}) {
  const {attempt,feedback} = useAttempt(onSave);
  const [itemId,setItemId] = useState(initialItemId ?? garage.items[0].id);
  function service(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();const data=new FormData(e.currentTarget);
    attempt(()=>logService(garage,{itemId,date:field(data,'date'),odometer:Number(field(data,'odometer')),notes:field(data,'notes')}),'Service recorded. Only your most recent service updates the next due date.');
  }
  return <section className="tool-panel" aria-labelledby="record-title"><h2 id="record-title">Record a service</h2><form onSubmit={service}><label>Maintenance item<select value={itemId} onChange={e=>setItemId(e.target.value)}>{garage.items.map(i=><option value={i.id} key={i.id}>{LABELS[i.kind]}</option>)}</select></label><div className="form-grid"><label>Service date<input name="date" required type="date" max={today()} defaultValue={today()}/></label><label>Odometer at service<input key={garage.vehicle.odometer} name="odometer" required type="number" inputMode="numeric" min="0" max={garage.vehicle.odometer} defaultValue={garage.vehicle.odometer}/></label></div><label>Notes (optional)<textarea name="notes" maxLength={500} rows={2} placeholder="What was done? Keep receipts separately."/></label><p className="helper">Logging an inspection does not mean a part was replaced. Unknown intervals stay unscheduled.</p><button className="primary">Save service</button></form>{feedback}</section>;
}

export function UpdateOdometer({garage,onSave}:{garage:Garage;onSave:OnSave}) {
  const {attempt,feedback} = useAttempt(onSave);
  return <section className="tool-panel" aria-labelledby="odometer-title"><h2 id="odometer-title">Mileage</h2><p className="helper">Last reading {garage.vehicle.odometer.toLocaleString()} mi · about {garage.vehicle.weeklyMiles.toLocaleString()} mi a week.</p><form onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);attempt(()=>updateOdometer(garage,Number(field(d,'miles'))),'Odometer updated. Trip estimates never change this reading.');}}><label>New reading (mi)<input key={garage.vehicle.odometer} required name="miles" type="number" inputMode="numeric" min={garage.vehicle.odometer} max="2000000" defaultValue={garage.vehicle.odometer}/></label><button className="primary">Update odometer</button></form>{feedback}</section>;
}

export function MileageForecast({garage,onSave}:{garage:Garage;onSave:OnSave}) {
  const {attempt,feedback} = useAttempt(onSave);
  return <section className="tool-panel" aria-labelledby="forecast-title"><h2 id="forecast-title">Mileage forecast</h2><form key={`${garage.vehicle.weeklyMiles}-${garage.plannedTripMiles ?? 0}`} onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);attempt(()=>setMileagePlan(garage,Number(field(d,'weekly')),Number(field(d,'planned'))),'Mileage forecast updated. Recorded odometer and service history are unchanged.');}}><div className="form-grid"><label>Miles per week<input name="weekly" required type="number" inputMode="numeric" min="0" max="2000" defaultValue={garage.vehicle.weeklyMiles}/></label><label>Planned trip miles<input name="planned" required type="number" inputMode="numeric" min="0" max="10000" defaultValue={garage.plannedTripMiles ?? 0}/></label></div><p className="helper">The dashboard adds estimated weekly driving since your last reading and these planned miles. They never count as a completed service or change the recorded odometer. Clear planned miles after the trip. For older backups without a reading date, weekly estimates start when you save this forecast.</p><button className="primary">Save forecast</button></form>{feedback}</section>;
}

export function IntervalEditor({garage,onSave}:{garage:Garage;onSave:OnSave}) {
  const {attempt,feedback} = useAttempt(onSave);
  const [scheduleId,setScheduleId] = useState(garage.items[0].id);
  const selected = garage.items.find(i=>i.id===scheduleId) ?? garage.items[0];
  function schedule(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();const data=new FormData(e.currentTarget);
    attempt(()=>setSchedule(garage,{itemId:selected.id,days:field(data,'days') ? Number(field(data,'days')) : undefined,miles:field(data,'miles') ? Number(field(data,'miles')) : undefined,url:field(data,'url')||undefined,note:field(data,'note')}),'Interval saved. Record the last completed service to calculate the next due date.');
  }
  return <section className="tool-panel" aria-labelledby="interval-title"><h2 id="interval-title">Intervals and sources</h2><label>Item to schedule<select value={selected.id} onChange={e=>setScheduleId(e.target.value)}>{garage.items.map(i=><option key={i.id} value={i.id}>{LABELS[i.kind]}</option>)}</select></label><form key={`${selected.id}-${selected.intervalDays}-${selected.intervalMiles}`} onSubmit={schedule}><div className="form-grid"><label>Every (days)<input name="days" type="number" inputMode="numeric" min="1" max="3650" defaultValue={selected.intervalDays}/></label><label>Every (miles)<input name="miles" type="number" inputMode="numeric" min="1" max="200000" defaultValue={selected.intervalMiles}/></label></div><label>Manual / source link (optional)<input name="url" type="url" placeholder="https://…" defaultValue={selected.intervalSource.url}/></label><label>Source and conditions<textarea name="note" required maxLength={600} rows={3} defaultValue={selected.intervalSource.note} placeholder="Owner’s manual, page 200; normal driving. Or: my personal wash preference."/></label><p className="helper">If both intervals are set, the first threshold reached wins. Entered sources are labeled as your records, not independently verified.</p><button className="primary">Save interval</button></form>{feedback}</section>;
}

export function BackupRestore({garage,onSave}:{garage:Garage;onSave:OnSave}) {
  const {setError,feedback} = useAttempt(onSave);
  const [restore,setRestore] = useState<Garage|null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  function exportData() {
    const blob=new Blob([JSON.stringify(garage,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`glovebox-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importData(file?:File) {
    setError('');setRestore(null);if(!file)return;
    try {if(file.size>500000)throw new Error('Backup must be smaller than 500 KB.');const data:unknown=JSON.parse(await file.text());if(!isGarage(data))throw new Error('This file is not a valid GloveBox backup.');setRestore(data);}catch(err){setError((err as Error).message);}finally{if(importRef.current)importRef.current.value='';}
  }
  return <section className="tool-panel" aria-labelledby="backup-title"><h2 id="backup-title">Backup and restore</h2><p className="helper">Backups include your car and service notes. Keep them somewhere you trust. Restoring replaces the garage in this browser.</p><div className="actions"><button className="secondary" onClick={exportData}>Export backup</button><label className="file-label">Choose backup<input ref={importRef} type="file" accept="application/json,.json" onChange={e=>void importData(e.target.files?.[0])}/></label></div>{restore && <div className="notice"><p>Restore {restore.vehicle.year} {restore.vehicle.make} {restore.vehicle.model} and {restore.services?.length||0} service records?</p><button className="primary" onClick={()=>{onSave(restore,'Backup restored.');setRestore(null);}}>Replace with backup</button><button className="text-button" onClick={()=>setRestore(null)}>Cancel</button></div>}{feedback}</section>;
}

export function SourceLibrary({garage}:{garage:Garage}) {
  return <details className="source-library"><summary>Where the guidance comes from</summary><p><a href={TIRE_SOURCE} target="_blank" rel="noreferrer">NHTSA: tire care ↗</a> recommends monthly pressure checks. We use a 30-day reminder after you log a check; use the pressure on your vehicle’s placard.</p>{garage.vehicle.year===2019 && garage.vehicle.make.toLowerCase()==='honda' && garage.vehicle.model.toLowerCase().includes('civic') && <p><a href={HONDA_SOURCE} target="_blank" rel="noreferrer">2019 Honda Civic Sedan: Maintenance Minder ↗</a> explains condition-dependent maintenance. This reference applies to the sedan; confirm your body style and manual. GloveBox does not turn it into a universal oil or filter interval.</p>}<p>Most items start without an assumed schedule. Add the interval and page or conditions from your own manual. Sample dates are illustrative; AI reminders are suggestions. Neither is a manufacturer-prescribed replacement date.</p></details>;
}
