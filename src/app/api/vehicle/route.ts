const BASE = 'https://www.fueleconomy.gov/ws/rest/vehicle/';
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const kind = query.get('kind');
  let path: string;
  if (kind === 'detail') {
    const id = query.get('id') || '';
    if (!/^\d{1,7}$/.test(id)) return Response.json({ error: 'Invalid vehicle ID.' }, { status:400 });
    path = id;
  } else if (kind === 'options') {
    const year = query.get('year') || '', make = query.get('make') || '', model = query.get('model') || '';
    if (!/^\d{4}$/.test(year) || !make.trim() || make.length > 80 || !model.trim() || model.length > 100) return Response.json({ error: 'Enter year, make and model first.' }, { status:400 });
    path = `menu/options?${new URLSearchParams({year,make,model})}`;
  } else return Response.json({ error: 'Unknown lookup.' }, { status:400 });
  try {
    const response = await fetch(BASE + path, { headers:{Accept:'application/json'}, signal:AbortSignal.timeout(8000), next:{revalidate:86400} });
    if (!response.ok) throw new Error('Unavailable');
    const data = await response.json();
    if (kind === 'options') {
      const options = !data?.menuItem ? [] : Array.isArray(data.menuItem) ? data.menuItem : [data.menuItem];
      if (!options.length) {
        const params = new URLSearchParams({ year:query.get('year')!,make:query.get('make')! });
        const menuResponse = await fetch(`${BASE}menu/model?${params}`, { headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000),next:{revalidate:86400} });
        const menu = menuResponse.ok ? await menuResponse.json() : null;
        const models = !menu?.menuItem ? [] : Array.isArray(menu.menuItem) ? menu.menuItem : [menu.menuItem];
        return Response.json({ options:[], models:models.map((m:{text:string})=>m.text) });
      }
      return Response.json({ options: options.map((item: { text:string; value:string }) => ({label:item.text, id:String(item.value)})) });
    }
    const mpg = Number(data.comb08);
    if (!data || !Number.isFinite(mpg) || mpg <= 0 || mpg > 150 || data.fuelType1 === 'Electricity' || /plug-in hybrid/i.test(String(data.atvType || data.atvtype || ''))) return Response.json({ error:'This calculator supports liquid-fuel vehicles; electric and plug-in hybrid estimates are not supported.' },{status:422});
    return Response.json({ mpg, year:Number(data.year), make:String(data.make), model:String(data.model), id:String(data.id), source:`https://www.fueleconomy.gov/feg/noframes/${data.id}.shtml` });
  } catch { return Response.json({ error:'EPA lookup is unavailable. You can enter your fuel economy manually and continue.' }, { status:502 }); }
}
