import type { GasPriceQuery } from './agent/trip';
import { safeUrl } from './maintenance';
import type { Place } from './maps';
import type { GasPrice } from './types';

// A fetch, so tests can answer EIA and Tavily without a network.
export type Fetcher=(url:string,init:RequestInit)=>Promise<Response>;

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
export async function fetchRegionalPrice(apiKey:string,area:EiaArea=EIA_AREAS.ca,now=new Date(),fetchImpl:Fetcher=fetch):Promise<RegionalPrice>{
 const url=new URL('https://api.eia.gov/v2/petroleum/pri/gnd/data/');url.search=new URLSearchParams({'api_key':apiKey,frequency:'weekly','data[0]':'value','facets[series][]':area.series,'sort[0][column]':'period','sort[0][direction]':'desc',length:'1'}).toString();
 const r=await fetchImpl(url.toString(),{signal:AbortSignal.timeout(8000),next:{revalidate:21600}});if(!r.ok)throw new Error(`EIA responded ${r.status}`);
 return parseRegionalPrice(await r.json(),now,area);
}

// Tavily web search: a dated price for one station or one area. A price counts only with a
// date no older than a week, from the result's published date or its own text; never "now".
const DAY=86400000,MAX_AGE_DAYS=7,MIN_PRICE=2,MAX_PRICE=9.5;
// How far either side of a price the station's name and street must appear.
const NEAR_CHARS=120;
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const UNIT_MS:Record<string,number>={m:60000,h:3600000,d:DAY};
const street=(place:Place)=>place.label.split(',')[0].trim();
// "Buena Park, CA" from "8101 Beach Blvd, Buena Park, CA 90620, USA".
const cityOf=(place:Place)=>place.label.split(',').slice(1,3).map(s=>s.trim()).join(', ').replace(/\s+\d{5}(-\d{4})?$/,'');
// The first price in the plausible range for regular gas, and where it is in the text.
function priceIn(text:string){
 for(const m of text.matchAll(/\$\s?(\d{1,2}\.\d{2,3})(?!\d)/g)){const p=Number(m[1]);if(p>=MIN_PRICE&&p<=MAX_PRICE)return {price:p,at:m.index};}
 return null;
}
type Dated={ms:number;asOf:string};
const instant=(ms:number):Dated|null=>Number.isFinite(ms)?{ms,asOf:new Date(ms).toISOString()}:null;
// A calendar day stays "YYYY-MM-DD", so no time zone moves it to the day before.
function calendarDay(y:number,month:number,d:number):Dated|null{
 const ms=Date.UTC(y,month,d),asOf=new Date(ms).toISOString().slice(0,10);
 return month>=0&&new Date(ms).getUTCDate()===d?{ms,asOf}:null;
}
// When the text says the price is from: "3 hours ago", or "as of / updated Oct 27, 2026".
function dateIn(text:string,now:Date):Dated|null{
 const rel=/\b(\d+|an?)\s*(minute|min|hour|hr|day)s?\s+ago\b/i.exec(text);
 if(rel)return instant(now.getTime()-(/^an?$/i.test(rel[1])?1:Number(rel[1]))*UNIT_MS[rel[2][0].toLowerCase()]);
 const tail=/\b(?:as of|updated)\s*:?\s*(.{6,20})/i.exec(text)?.[1];if(!tail)return null;
 let m=/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(tail);
 if(m)return calendarDay(Number(m[3]),MONTHS.indexOf(m[1].toLowerCase()),Number(m[2]));
 if((m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(tail)))return calendarDay(Number(m[3]),Number(m[1])-1,Number(m[2]));
 if((m=/^(\d{4})-(\d{2})-(\d{2})/.exec(tail)))return calendarDay(Number(m[1]),Number(m[2])-1,Number(m[3]));
 return null;
}
// The result is about the asked-for station: its name with its street number or street name
// in the title or next to the price, or a GasBuddy station page titled with its name.
function aboutStation(station:Place,title:string,near:string,url:string){
 const line=street(station).toLowerCase(),brand=station.name.toLowerCase();
 const number=/^\d+/.exec(line)?.[0],road=line.replace(/^\d+\s*/,'');
 const names=(text:string)=>{const t=text.toLowerCase();return t.includes(brand)&&((!!number&&t.includes(number))||(!!road&&t.includes(road)));};
 return names(title)||names(near)||(title.toLowerCase().includes(brand)&&/^https:\/\/(www\.)?gasbuddy\.com\/station\/\d+/.test(url));
}
// The first dated, plausible price in Tavily's results. Throws when no result has one.
export function parseTavilyPrice(body:unknown,at:GasPriceQuery,now=new Date()):GasPrice{
 const rows=(body as {results?:unknown[]})?.results;if(!Array.isArray(rows))throw new Error('Unexpected search response.');
 for(const r of rows){
  const row=(r??{}) as Record<string,unknown>;
  if(!safeUrl(row.url)||typeof row.content!=='string')continue;
  const found=priceIn(row.content);if(!found)continue;
  const {price}=found,near=row.content.slice(Math.max(0,found.at-NEAR_CHARS),found.at+NEAR_CHARS);
  const dated=dateIn(row.content,now)??(typeof row.published_date==='string'?instant(Date.parse(row.published_date)):null);
  if(!dated||dated.ms>now.getTime()+DAY||now.getTime()-dated.ms>MAX_AGE_DAYS*DAY)continue;
  const title=typeof row.title==='string'?row.title:'',station=at.station;
  const base={price,asOf:dated.asOf,source:row.url,stale:false};
  if(station&&aboutStation(station,title,near,row.url))return {...base,kind:'station',label:`${station.name}, ${street(station)}`};
  const area=at.area??(station?cityOf(station):'');
  return {...base,kind:'area',label:area?`Regular gasoline reported around ${area}`:title.slice(0,120)||'Regular gasoline reported nearby'};
 }
 throw new Error('No dated price in the search results.');
}
// Forums and aggregators whose prices are often days or weeks old.
const TAVILY_EXCLUDED=['reddit.com','gaspricewatch.com','yelp.com','mapquest.com'];
// A dated price for one station or area from Tavily (parameters per docs.tavily.com). The
// cached copy is at most a day old, so a relative "3 hours ago" is off by a day at worst.
// No visitor id is sent. Throws on any refusal, 434 (live-fetch capacity full) included.
export async function fetchTavilyPrice(apiKey:string,at:GasPriceQuery,fetchImpl:Fetcher=fetch,now=new Date()):Promise<GasPrice>{
 const where=at.station?`${at.station.name} ${at.station.label}`:at.area;if(!where)throw new Error('Nothing to price.');
 const r=await fetchImpl('https://api.tavily.com/search',{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
  body:JSON.stringify({query:`${where} regular gas price per gallon`,topic:'general',search_depth:'basic',auto_parameters:false,max_results:5,include_answer:false,include_raw_content:false,
   include_published_date:true,time_range:'week',max_age_hours:24,country:'united states',include_domains:['gasbuddy.com'],include_domains_mode:'prefer',exclude_domains:TAVILY_EXCLUDED})});
 if(!r.ok)throw new Error(`Tavily responded ${r.status}`);
 return parseTavilyPrice(await r.json(),at,now);
}
