import { cookies } from 'next/headers';
import { isVisitorId, VISITOR_COOKIE } from '@/lib/visitor';
import { boundedJson, sameOrigin } from '@/lib/request-json';
import { setWeatherPreference } from '@/lib/db/weather-check-store';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Use this website to change preferences.' }, { status: 403 });
  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitor)) return Response.json({ error: 'Open your cloud garage first.' }, { status: 401 });
  let enabled: boolean;
  try {
    const body = await boundedJson(request, 1000) as { enabled?: unknown };
    if (!body || typeof body.enabled !== 'boolean') throw new Error();
    enabled = body.enabled;
  } catch { return Response.json({ error: 'Choose whether to enable checks.' }, { status: 400 }); }
  try {
    if (!await setWeatherPreference(visitor, enabled)) return Response.json({ error: 'Save a cloud car with a resolved location first. A local location label alone cannot support background checks.' }, { status: 404 });
    return Response.json({ enabled });
  } catch { return Response.json({ error: 'Could not save this preference. Try again later.' }, { status: 503 }); }
}
