'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { addProposals, demoGarage, isGarage, LABELS, resolveProposal, sampleCommand, STORAGE_KEY, type CommandResult, type Garage } from '@/lib/maintenance';
import { CarSetup, GarageTools, SourceLibrary } from '@/components/garage-tools';
import { TripPlanner } from '@/components/trip-planner';
import { estimateOdometer, itemStatus } from '@/lib/intervals';
import type { DueTarget } from '@/lib/types';

const SECTIONS = [{ id: 'overview', label: 'Overview' }, { id: 'records', label: 'Records' }, { id: 'trips', label: 'Trips & gas' }, { id: 'guidance', label: 'Guidance' }] as const;
type Section = typeof SECTIONS[number]['id'];
const EXAMPLE = 'I drove 300 miles on dirt roads';
const STATUS = { overdue: 'Overdue', due_soon: 'Due soon', ok: 'On track', unknown: 'History needed' };
function due(target: DueTarget) {
  const date = target.dueAt ? new Date(target.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
  const miles = target.dueOdometer !== undefined ? `${target.dueOdometer.toLocaleString()} mi` : null;
  return [date, miles].filter(Boolean).join(' or ') || 'Not scheduled';
}
function Car() {
  return <svg viewBox="0 0 500 200" fill="none" aria-hidden="true"><path d="M58 129 70 100l67-12 53-46h119l62 48 65 18 14 30-8 21H59l-9-15Z" fill="#d9e4df" stroke="#233f35" strokeWidth="3"/><path d="m153 89 45-37h49v37Zm106-37h43l45 37h-88Z" fill="#345b4d"/><path d="M63 118h47m287-2 35 8M248 94v50m-58-43h22m57 0h22" stroke="#233f35" strokeWidth="3"/><circle cx="131" cy="151" r="30" fill="#192f28"/><circle cx="131" cy="151" r="16" fill="#aabdb3"/><circle cx="371" cy="151" r="30" fill="#192f28"/><circle cx="371" cy="151" r="16" fill="#aabdb3"/><path d="M49 184h405" stroke="#88a393" strokeWidth="2"/></svg>;
}
export default function Home() {
  const [section, setSection] = useState<Section>('overview');
  useEffect(() => {
    function syncSection() {
      const id = window.location.hash.slice(1);
      setSection(SECTIONS.find(s => s.id === id)?.id ?? 'overview');
    }
    const timer = window.setTimeout(syncSection, 0);
    window.addEventListener('hashchange', syncSection);
    return () => { window.clearTimeout(timer); window.removeEventListener('hashchange', syncSection); };
  }, []);
  const [garage, setGarage] = useState<Garage | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [command, setCommand] = useState('');
  const [mode, setMode] = useState<'sample' | 'live'>('sample');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal }).then(r=>r.json()).then(data=>setLiveAvailable(Boolean(data.liveAI))).catch(()=>{});
    const clock = window.setInterval(() => setNow(new Date()), 60000);
    const timer = window.setTimeout(() => {
      setNow(new Date());
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isGarage(parsed)) setGarage(parsed);
          else setStorageError('Saved data could not be restored. Load a fresh demo to continue.');
        }
      } catch { setStorageError('Browser storage is unavailable or unreadable. You can still try the demo in this tab.'); }
      setReady(true);
    }, 0);
    return () => { window.clearTimeout(timer); window.clearInterval(clock); controller.abort(); };
  }, []);
  function save(next: Garage, notice?: string) {
    if (!isGarage(next)) { setStorageError('That change could not be validated. Your saved garage is unchanged.'); return; }
    if (notice) setMessage(notice);
    setNow(new Date());
    setGarage(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStorageError(''); }
    catch { setStorageError('Your changes work in this tab, but could not be saved for your next visit.'); }
  }
  function loadDemo() {
    setConfirmDemo(false); setSetupOpen(false); const current = new Date(); setNow(current); save(demoGarage(current)); setMessage('Demo car loaded. Try the dirt-road example below.'); setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!garage || busy || !command.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      let data: CommandResult;
      if (mode === 'sample') data = sampleCommand(command, garage);
      else {
        const response = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, mode, garage: { ...garage, proposals: [], services: [] } }), signal: AbortSignal.timeout(30000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'The request failed. Please try again.');
        data = result as CommandResult;
      }
      const next = addProposals(garage, data.proposals);
      if (!isGarage(next)) throw new Error('The response was invalid. Your schedule is unchanged.');
      save(next); setNow(new Date()); setMessage(data.message);
    } catch (err) { setError(err instanceof Error && err.name !== 'TimeoutError' ? err.message : 'The request timed out. Your schedule is unchanged. Try again.'); }
    finally { setBusy(false); }
  }
  function resolve(id: string, action: 'applied' | 'dismissed') {
    if (!garage) return;
    try { save(resolveProposal(garage, id, action)); setNow(new Date()); setMessage(action === 'applied' ? 'Reminder updated. No service has been marked complete.' : 'Suggestion dismissed. Your schedule is unchanged.'); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update this suggestion.'); }
  }
  const pending = garage?.proposals.filter(p => p.state === 'pending') || [];
  const completed = garage?.proposals.filter(p => p.state !== 'pending').slice(-3).reverse() || [];
  const estimatedOdometer = garage && now ? estimateOdometer(garage.vehicle, garage.readingAt ? new Date(garage.readingAt) : now, now, garage.plannedTripMiles ?? 0) : 0;
  const attention = garage && now ? garage.items.filter(i => ['overdue', 'due_soon'].includes(itemStatus(i, now, estimatedOdometer))).length : 0;
  const isDemo = garage?.vehicle.isDemo ?? garage?.vehicle.id === 'demo-civic';
  return <div className="app-shell">
    <header className="topbar"><Link className="brand" href="/" aria-label="GloveBox home"><span className="brand-mark">g.</span> glovebox</Link><span className="top-note">A little care. A longer road.</span><Link className="preview-tag" href="/garage">Cloud garage ↗</Link></header>
    <main>
      <nav className="garage-nav" aria-label="Garage sections">{SECTIONS.map(item => <a key={item.id} href={`#${item.id}`} aria-current={section === item.id ? 'page' : undefined} onClick={()=>setSection(item.id)}>{item.label}</a>)}</nav>
      <div className="dashboard-heading"><div><p className="eyebrow">YOUR GARAGE</p><h1>{section === 'overview' ? 'Your car, at a glance.' : section === 'records' ? 'Care, on the record.' : section === 'trips' ? 'Make the miles count.' : 'Know your guidance.'}</h1><p className="helper">{section === 'overview' ? 'Mileage, upcoming upkeep, and a little help for the road ahead.' : section === 'records' ? 'Service history, mileage forecasts, intervals, and backups.' : section === 'trips' ? 'Plan your stops and compare the real cost of a gas detour.' : 'See where your maintenance reminders come from.'}</p></div><div className="toolbar"><button className="text-button" disabled={busy || !ready} onClick={()=>setSetupOpen(true)}>Add my car ↗</button><button className="text-button" disabled={busy || !ready} onClick={()=>garage ? setConfirmDemo(true) : loadDemo()}>{garage ? 'Reset demo car ↻' : 'Load demo car ↗'}</button></div></div>
      {confirmDemo && <div className="notice"><p>Loading the demo replaces the current car, history, and suggestions in this browser. Export a backup in Records if you want to keep them.</p><button className="primary" onClick={loadDemo}>Replace with demo</button><button className="text-button" onClick={()=>setConfirmDemo(false)}>Cancel</button></div>}
      {setupOpen && <fieldset className="unframed" disabled={busy}><CarSetup existing={Boolean(garage)} onCancel={()=>setSetupOpen(false)} onSave={next=>{save(next,'Your car is ready. Add your service history in Records.');setSetupOpen(false);setError('');}}/></fieldset>}
      {!ready ? <div className="empty-state">Opening your garage…</div> : !garage ? <section className="empty-state"><div className="empty-car"><Car/></div><h2>Meet your next co-pilot.</h2><p>Try a sample Civic with a few things on its to-do list.<br/>No account or API key needed for sample mode.</p><button className="primary" onClick={loadDemo}>Load demo car <span>↗</span></button></section> : <>
        <div hidden={section !== 'overview'} id="overview-content">
        <section className="vehicle-card"><div className="vehicle-info"><span className="pill light">{isDemo ? 'DEMO VEHICLE' : 'YOUR VEHICLE'}</span><h2>{garage.vehicle.year} {garage.vehicle.make}<br/><strong>{garage.vehicle.model}</strong></h2><p>● {garage.vehicle.home.label}</p></div><div className="car-art"><Car/></div><div className="vehicle-stats"><div><span className="small-label">RECORDED ODOMETER</span><p>{garage.vehicle.odometer.toLocaleString()} <small>mi</small></p></div><div><span className="small-label">NEEDS YOUR ATTENTION</span><p>{attention.toString().padStart(2, '0')} <small>items</small></p><span className="tiny">{garage.items.filter(i=>now && itemStatus(i,now,estimatedOdometer) === 'unknown').length} items need history or intervals</span></div><span className="tiny">{isDemo ? 'Illustrative vehicle and service history' : `${garage.vehicle.epaMpg} MPG · ${garage.vehicle.mpgSource?.kind === 'epa' ? 'EPA estimate' : 'Your estimate'}`}{garage.vehicle.mpgSource?.url && <> · <a href={garage.vehicle.mpgSource.url} target="_blank" rel="noreferrer">Source ↗</a></>}</span></div></section>
        <section className="workspace"><div className="maintenance"><div className="section-heading"><h2>A little upkeep</h2><span className="tiny">Based on {estimatedOdometer.toLocaleString()} projected mi, including {garage.plannedTripMiles ?? 0} planned mi</span></div><div className="health-grid">{[...garage.items].sort((a,b) => { const rank = {overdue:0,due_soon:1,unknown:2,ok:3}; return now ? rank[itemStatus(a,now,estimatedOdometer)] - rank[itemStatus(b,now,estimatedOdometer)] : 0; }).map(item => { const status = now ? itemStatus(item, now, estimatedOdometer) : 'unknown'; return <article className={`health-card ${status}`} key={item.id}><div className="card-top"><span className="item-symbol" aria-hidden="true">{item.kind === 'wash' ? '✳' : item.kind === 'oil' ? '◒' : item.kind.includes('filter') ? '▤' : '◎'}</span><span className={`status ${status}`}><i/>{STATUS[status]}</span></div><h3>{LABELS[item.kind]}</h3><p>{due(item)}</p><span className="tiny">{status === 'unknown' ? 'Add history and an interval to schedule this' : item.reminderOrigin === 'sample' ? 'Sample suggestion' : item.reminderOrigin === 'ai' ? 'AI suggestion · review before relying on it' : item.intervalSource.kind === 'baseline' ? 'Illustrative baseline' : item.intervalSource.kind === 'nhtsa' ? 'NHTSA monthly check' : 'Your entered schedule'}</span>{item.intervalSource.url && <a className="source-link" href={item.intervalSource.url} target="_blank" rel="noreferrer">View interval source ↗</a>}{item.intervalSource.note && <details className="source-note"><summary>Source notes</summary><p>{item.intervalSource.note}</p></details>}</article>; })}</div></div>
        <aside className="copilot"><div className="copilot-heading"><span className="spark" aria-hidden="true">✳</span><h2>A heads-up, not a headache.</h2></div><p>Tell GloveBox about your drive. Review a suggestion before it changes your schedule.</p><form onSubmit={submit}><label htmlFor="command">What’s happened lately?</label><textarea id="command" placeholder="A dusty weekend away? Tell me about it…" value={command} onChange={e => setCommand(e.target.value)} maxLength={1000} disabled={busy} rows={4}/><button type="button" className="example-button" onClick={() => setCommand(EXAMPLE)} disabled={busy}>Try: “300 miles on dirt roads” ↗</button><div className="mode-row"><label htmlFor="mode">Response mode</label><select id="mode" value={mode} disabled={busy} onChange={e => setMode(e.target.value as 'sample' | 'live')}><option value="sample">Sample · no AI call</option><option value="live" disabled={!liveAvailable}>{liveAvailable ? 'Live · Nemotron' : 'Live AI · paused'}</option></select></div><button className="primary full" disabled={busy || !command.trim()} type="submit">{busy ? 'Reviewing your drive…' : 'Review my drive'}<span aria-hidden="true">↗</span></button></form>{error && <p className="error" role="alert">{error}</p>}<p className="mode-note">{mode === 'sample' ? 'Sample mode uses a fixed dirt-road example. No live AI, weather, or manufacturer lookup.' : 'Live mode sends your command and car’s schedule to Nemotron through Nebius.'}</p></aside>
        </section>
        <div className="feedback" aria-live="polite">{busy && <p>Checking your drive. Your schedule stays unchanged until you approve.</p>}{message && <p className="notice">{message}</p>}</div>
        <section className="suggestions"><div className="section-heading"><h2>Your call <span className="count">{pending.length.toString().padStart(2, '0')}</span></h2><span className="tiny">Suggestions wait for your approval</span></div>{pending.length === 0 ? <div className="quiet-state">Nothing waiting on you. Tell us about a drive to get started.</div> : <div className="proposal-grid">{pending.map(p => { const item = garage.items.find(i => i.id === p.itemId)!; return <article className="proposal" key={p.id}><span className="pill">{p.model === 'sample' ? 'SAMPLE · NOT AI-GENERATED' : 'NEMOTRON · LIVE'}</span><h3>{LABELS[item.kind]}</h3><div className="date-change"><span>{due(p.from)}</span><b aria-hidden="true">→</b><strong>{due(p.to)}</strong></div><p>{p.reason}</p><div className="actions"><button className="primary" disabled={busy} onClick={() => resolve(p.id, 'applied')}>Apply reminder ↗</button><button className="secondary" disabled={busy} onClick={() => resolve(p.id, 'dismissed')}>Dismiss</button></div></article>; })}</div>}</section>
        {completed.length > 0 && <section className="activity"><h2>Recent decisions</h2>{completed.map(p => <div key={p.id}><span>{LABELS[garage.items.find(i => i.id === p.itemId)!.kind]}</span><span>{p.state === 'applied' ? '✓ Applied' : 'Dismissed'}{p.model === 'sample' ? ' · Sample' : ' · Live AI'}</span></div>)}</section>}
        </div>
        <section hidden={section !== 'records'} aria-label="Records"><fieldset className="unframed" disabled={busy}><GarageTools key={garage.vehicle.id} garage={garage} onSave={save}/></fieldset></section>
        <section hidden={section !== 'trips'} aria-label="Trips and gas"><TripPlanner key={`${garage.vehicle.id}-${garage.vehicle.epaMpg}`} mpg={garage.vehicle.mpgOverride || garage.vehicle.epaMpg}/></section>
        <section hidden={section !== 'guidance'} aria-label="Guidance"><SourceLibrary garage={garage}/><div className="tool-panel"><h2>About this garage</h2><p className="helper">Your records are saved in this browser. Export a backup from Records to keep a copy. Live AI is currently {liveAvailable ? 'available' : 'paused'}; sample suggestions are labeled and always wait for your approval.</p><h3>Cloud garage</h3><p className="helper">The cloud garage is separate from your local records and requires a database connection. Opening it does not upload or replace your saved car.</p><Link className="primary link-button" href="/garage">Open cloud garage ↗</Link></div></section>
      </>}
      {storageError && <p className="error" role="alert">{storageError}</p>}
    </main><footer><span className="brand footer-brand">glovebox.</span><span>Made for the miles ahead.</span><span>Saved in this browser · Preview 0.2</span></footer>
  </div>;
}
