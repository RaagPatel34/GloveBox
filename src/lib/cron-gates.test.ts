import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/cron/weather/route';
import { runDailyWeather } from './daily-weather';
vi.mock('./daily-weather', () => ({ runDailyWeather: vi.fn(async () => ({ checked: 0, complete: 0, failed: 0 })) }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it('never runs a disabled job', async () => {
  vi.stubEnv('ENABLE_DAILY_WEATHER', 'false');
  expect((await GET(new Request('https://example.com/api/cron/weather'))).status).toBe(503);
  expect(runDailyWeather).not.toHaveBeenCalled();
});
it('requires the exact scheduler secret before touching the database', async () => {
  vi.stubEnv('ENABLE_DAILY_WEATHER', 'true'); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('DATABASE_URL', 'test-only');
  for (const auth of ['', 'Bearer incorrect', 'Bearer test-secrex']) {
    expect((await GET(new Request('https://example.com/api/cron/weather', { headers: { authorization: auth } }))).status).toBe(401);
  }
  expect(runDailyWeather).not.toHaveBeenCalled();
  expect((await GET(new Request('https://example.com/api/cron/weather', { headers: { authorization: 'Bearer test-secret' } }))).status).toBe(200);
  expect(runDailyWeather).toHaveBeenCalledTimes(1);
});
