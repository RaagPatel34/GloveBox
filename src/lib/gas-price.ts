// EIA weekly retail regular gasoline averages: regional estimates, never station quotes.
export type EiaArea={series:string;label:string};
export const EIA_AREAS={
 la:{series:'EMM_EPMR_PTE_Y05LA_DPG',label:'Los Angeles weekly regular gasoline average'},
 ca:{series:'EMM_EPMR_PTE_SCA_DPG',label:'California weekly regular gasoline average'},
} satisfies Record<string,EiaArea>;
export const eiaSource=(area:EiaArea)=>`https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=${area.series}&f=W`;
export type RegionalPrice={price:number;asOf:string;source:string;kind:'eia';label:string;stale:boolean};
export function parseRegionalPrice(body:unknown,now=new Date(),area:EiaArea=EIA_AREAS.ca):RegionalPrice{
 const rows=(body as {response?:{data?:{period?:string;value?:string|number;units?:string}[]}})?.response?.data;
 const row=rows?.[0];const price=Number(row?.value);const asOf=row?.period;
 if(!asOf||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||Date.parse(asOf)>now.getTime()+86400000||!Number.isFinite(price)||price<=0||price>30)throw new Error('No usable regional price.');
 return {price,asOf,source:eiaSource(area),kind:'eia',label:area.label,stale:now.getTime()-Date.parse(asOf)>14*86400000};
}
// The latest weekly price for one area from the EIA v2 API. Throws when there is no usable one.
export async function fetchRegionalPrice(apiKey:string,area:EiaArea=EIA_AREAS.ca,now=new Date()):Promise<RegionalPrice>{
 const url=new URL('https://api.eia.gov/v2/petroleum/pri/gnd/data/');url.search=new URLSearchParams({'api_key':apiKey,frequency:'weekly','data[0]':'value','facets[series][]':area.series,'sort[0][column]':'period','sort[0][direction]':'desc',length:'1'}).toString();
 const r=await fetch(url,{signal:AbortSignal.timeout(8000),next:{revalidate:21600}});if(!r.ok)throw new Error(`EIA responded ${r.status}`);
 return parseRegionalPrice(await r.json(),now,area);
}
