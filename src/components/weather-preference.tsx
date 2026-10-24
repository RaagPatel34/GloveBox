'use client';
import { useState } from 'react';

export function WeatherPreference({ initialEnabled, available, checkedAt, outcome }: {
  initialEnabled: boolean; available: boolean; checkedAt?: string; outcome?: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function change() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/weather-preference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !enabled }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEnabled(data.enabled); setMessage(data.enabled ? 'Background checks allowed.' : 'Background checks stopped.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="tool-panel mx-auto max-w-5xl"><h2>Daily weather guidance</h2>
    <p className="helper">Allow GloveBox to send your saved cloud car’s location to Open-Meteo for forecast and air-quality checks, even when this page is closed. Results appear here; no email or push messages are sent. Checks never change service records.</p>
    <p>{available ? 'Daily checks are available on the production website.' : 'The automatic schedule is not active on this preview. You can save your preference now.'}</p>
    <button className="secondary" disabled={busy} onClick={change}>{busy ? 'Saving…' : enabled ? 'Stop background weather checks' : 'Allow background weather checks'}</button>
    {checkedAt && <p className="helper">Last check: {new Date(checkedAt).toLocaleString()} · {outcome}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
