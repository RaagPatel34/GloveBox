'use client';
import { useState, type FormEvent } from 'react';
import type { StationSource } from '@/lib/station-sources';

export function StationSearch() {
  const [query, setQuery] = useState('');
  const [sources, setSources] = useState<StationSource[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setSources([]); setMessage('');
    try {
      const response = await fetch('/api/station-sources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSources(data.sources); setMessage(data.sources.length ? `Sources searched ${new Date(data.searchedAt).toLocaleString()}. Search time is not the price's update time.` : 'No usable sources found. Try the station’s exact name and city.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <details className="spaced"><summary>Find station-price sources</summary>
    <p className="helper">Search sends the station and city you enter to Tavily. Results are web excerpts, not verified pump prices. Open a source and check the exact station, fuel grade, cash/member conditions and price update date before entering a number below. No AI-generated answer is requested.</p>
    <form className="location-search" onSubmit={search}><label>Station and city<input required minLength={3} maxLength={160} value={query} onChange={e => setQuery(e.target.value)} placeholder="Station name, Buena Park, CA"/></label><button className="secondary" disabled={busy}>{busy ? 'Searching…' : 'Find price sources'}</button></form>
    {message && <p role="status" className="helper">{message}</p>}
    {sources.map(source => <article className="notice" key={source.url}><a className="source-link" href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><p>{source.excerpt}</p><span className="tiny">Unverified search excerpt</span></article>)}
  </details>;
}
