import { lookupMfrSchedule } from '@/lib/mfr-schedule';
import { boundedJson, sameOrigin } from '@/lib/request-json';

// Never cached: whether this works depends on the key, and an old "not connected" must not outlast it.
const answer = (body: object, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return answer({ error: 'Search from this website only.', intervals: [] }, 403);
  const apiKey = process.env.TAVILY_API_KEY;
  if (process.env.ENABLE_TAVILY !== 'true' || !apiKey)
    return answer({ error: 'Manufacturer-schedule search is not connected yet. Add intervals from your owner’s manual.', intervals: [] }, 503);
  let car: { year: number; make: string; model: string };
  try {
    const body = await boundedJson(request, 1000) as { year?: unknown; make?: unknown; model?: unknown };
    if (!body || !Number.isInteger(body.year) || (body.year as number) < 1984 || (body.year as number) > new Date().getFullYear() + 1) throw new Error();
    if (typeof body.make !== 'string' || !body.make.trim() || body.make.length > 80) throw new Error();
    if (typeof body.model !== 'string' || !body.model.trim() || body.model.length > 100) throw new Error();
    car = { year: body.year as number, make: body.make.trim(), model: body.model.trim() };
  } catch { return answer({ error: 'Send the car’s year, make and model.', intervals: [] }, 400); }
  const { status, intervals } = await lookupMfrSchedule(car, { apiKey });
  const found = status === 'ok' || status === 'empty';
  return answer({ status, intervals }, found ? 200 : 503);
}
