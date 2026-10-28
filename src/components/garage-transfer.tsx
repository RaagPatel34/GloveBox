'use client';
import { useState } from 'react';
import { useVisitorId } from './visitor/useVisitorId';
import { isGarage, type Garage } from '@/lib/maintenance';

export function GarageTransfer({ garage }: { garage: Garage }) {
  const visitor = useVisitorId();
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function copy() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/garage-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(garage) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(data.message); setReview(false);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function download() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/garage-transfer'); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!isGarage(data.garage)) throw new Error('The saved archive could not be read.');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data.garage, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'glovebox-transferred-archive.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Original transferred archive downloaded. Later cloud edits are not included. Use Backup & restore to review it before replacing local records.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <details><summary>Copy to the cloud garage</summary>
    <p className="helper">Send your car, location label, reminders, service notes and proposal history to GloveBox’s database. Your local copy stays here. This is a one-time copy, not ongoing sync. An existing cloud car will never be replaced.</p>
    <p className="helper">The cloud dashboard uses the copied car and reminders. Full service and proposal history are kept as a downloadable archive; old suggestions are not reactivated. Cloud access belongs to this browser’s anonymous identity. Keep a separate backup before clearing browser data.</p>
    {!review ? <button className="secondary" disabled={!visitor || busy} onClick={() => setReview(true)}>Review copy</button> : <div className="notice">
      <p>Copy {garage.vehicle.year} {garage.vehicle.make} {garage.vehicle.model}, {garage.items.length} reminders and {garage.services?.length ?? 0} service records?</p>
      <button className="primary" disabled={busy} onClick={copy}>{busy ? 'Copying…' : 'Copy these records to GloveBox cloud'}</button>
      <button className="text-button" disabled={busy} onClick={() => setReview(false)}>Cancel</button>
    </div>}
    <button className="text-button" disabled={!visitor || busy} onClick={download}>Download original transferred archive</button>
    <a className="source-link" href="/garage">Open cloud garage</a>
    {message && <p role="status">{message}</p>}
  </details>;
}
