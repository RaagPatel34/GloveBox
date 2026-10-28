import { afterEach, expect, it, vi } from 'vitest';
import { stationSources } from './station-sources';
import { POST } from '@/app/api/station-sources/route';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('keeps evidence text without inferring a price or accepting unsafe links', () => {
  expect(stationSources({ results: [{ title: 'Station', url: 'https://example.com/station', content: 'Regular $4.50; reported last week' }, { title: 'Unsafe', url: 'javascript:alert(1)', content: 'cheap' }] })).toEqual([{ title: 'Station', url: 'https://example.com/station', excerpt: 'Regular $4.50; reported last week' }]);
});
it('makes no provider call when disabled even if a key exists', async () => {
  vi.stubEnv('ENABLE_TAVILY', 'false'); vi.stubEnv('TAVILY_API_KEY', 'fake');
  const network = vi.fn(); vi.stubGlobal('fetch', network);
  expect((await POST(new Request('https://example.com/api/station-sources', { method: 'POST' }))).status).toBe(503);
  expect(network).not.toHaveBeenCalled();
});
