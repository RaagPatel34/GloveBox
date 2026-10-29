export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('name')?.trim();
  if (!name || name.length < 2 || name.length > 120) return Response.json({error:'Enter a city or ZIP code.'},{status:400});
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({name,count:'5',language:'en',countryCode:'US'}).toString();
    const res = await fetch(url,{signal:AbortSignal.timeout(6000),next:{revalidate:86400}});
    if (!res.ok) throw new Error();
    const data = await res.json();
    const locations = (data.results ?? []).filter((r: {latitude:number;longitude:number;name:string})=>Number.isFinite(r.latitude)&&Number.isFinite(r.longitude)&&typeof r.name==='string').map((r:{name:string;admin1?:string;latitude:number;longitude:number})=>({label:[r.name,r.admin1].filter(Boolean).join(', '),lat:r.latitude,lng:r.longitude}));
    return Response.json({locations});
  } catch {return Response.json({error:'City search is unavailable. Try again later.'},{status:502});}
}
