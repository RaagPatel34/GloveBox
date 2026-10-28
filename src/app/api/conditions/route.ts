import { getWeather, getAirQuality } from '@/lib/weather';
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const lat = Number(p.get('lat')), lng = Number(p.get('lng'));
  if (!p.has('lat') || !p.has('lng') || !Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) return Response.json({error:'Choose a valid location.'},{status:400});
  const cachedFetch = (url:string) => fetch(url,{signal:AbortSignal.timeout(6000),next:{revalidate:1800}});
  const [weather,air] = await Promise.allSettled([getWeather({lat,lng},cachedFetch),getAirQuality({lat,lng},cachedFetch)]);
  if (weather.status==='rejected' && air.status==='rejected') return Response.json({error:'Weather and air quality are unavailable. Your maintenance records are unchanged.'},{status:502});
  return Response.json({weather:weather.status==='fulfilled'?weather.value:null,air:air.status==='fulfilled'?air.value:null,complete:weather.status==='fulfilled'&&air.status==='fulfilled',checkedAt:new Date().toISOString()});
}
