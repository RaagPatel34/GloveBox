import { boundedJson, sameOrigin } from '@/lib/request-json';
import { stationSources } from '@/lib/station-sources';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Search from this website only.' }, { status: 403 });
  if (process.env.ENABLE_TAVILY !== 'true' || !process.env.TAVILY_API_KEY)
    return Response.json({ error: 'Station-source search is not connected yet. Enter prices from a dated source or pump receipt in the calculator.' }, { status: 503 });
  let query: string;
  try {
    const body = await boundedJson(request, 2000) as { query?: unknown };
    if (!body || typeof body.query !== 'string' || body.query.trim().length < 3 || body.query.length > 160) throw new Error();
    query = body.query.trim();
  } catch { return Response.json({ error: 'Enter a station and city using 3–160 characters.' }, { status: 400 }); }
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST', signal: AbortSignal.timeout(8000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query: `${query} regular gasoline price per gallon station last updated`, search_depth: 'basic', max_results: 5, include_answer: false, include_raw_content: false, auto_parameters: false }),
    });
    if (!response.ok) throw new Error();
    return Response.json({ sources: stationSources(await response.json()), searchedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Station sources are unavailable. Enter a verified price manually.' }, { status: 503 }); }
}
