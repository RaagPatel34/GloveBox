import { timingSafeEqual } from 'node:crypto';
import { runDailyWeather } from '@/lib/daily-weather';

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || process.env.ENABLE_DAILY_WEATHER !== 'true' || !process.env.DATABASE_URL)
    return Response.json({ error: 'Daily weather checks are not enabled.' }, { status: 503 });
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  try {
    return Response.json(await runDailyWeather(), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Daily check unavailable.' }, { status: 503 });
  }
}
