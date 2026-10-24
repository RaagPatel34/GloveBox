import { safeUrl } from './maintenance';
export type StationSource = { title: string; url: string; excerpt: string };
export function stationSources(value: unknown): StationSource[] {
  if (!value || typeof value !== 'object' || !('results' in value) || !Array.isArray(value.results)) throw new Error('Unexpected search response.');
  return value.results.slice(0, 5).flatMap((r: unknown) => {
    if (!r || typeof r !== 'object') return [];
    const row = r as Record<string, unknown>;
    if (!safeUrl(row.url) || typeof row.title !== 'string' || typeof row.content !== 'string') return [];
    return [{ title: row.title.slice(0, 180), url: row.url, excerpt: row.content.slice(0, 500) }];
  });
}
