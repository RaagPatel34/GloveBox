import { safeUrl } from './maintenance';
import type { Place, PostFetch } from './maps';
import type { GasPrice, GasPriceQuery } from './types';

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
export async function fetchRegionalPrice(apiKey:string,area:EiaArea=EIA_AREAS.ca,now=new Date(),fetchImpl:PostFetch=fetch):Promise<RegionalPrice>{
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
// "Buena Park, CA" from "8101 Beach Blvd, Buena Park, CA 90620, USA" or "Buena Park, CA": the
// part before a two-letter state. Undefined when no part is a state, as in "My place".
export function areaOf(label:string):string|undefined{
 const parts=label.split(',').map(s=>s.trim());
 const i=parts.findIndex((part,k)=>k>0&&!!parts[k-1]&&/^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/.test(part));
 return i>0?`${parts[i-1]}, ${parts[i].slice(0,2)}`:undefined;
}
// The first price in the plausible range for regular gas, and where it starts and ends in the text.
function priceIn(text:string){
 for(const m of text.matchAll(/\$\s?(\d{1,2}\.\d{2,3})(?!\d)/g)){const p=Number(m[1]);if(p>=MIN_PRICE&&p<=MAX_PRICE)return {price:p,at:m.index,end:m.index+m[0].length};}
 return null;
}
type Dated={ms:number;asOf:string};
const instant=(ms:number):Dated|null=>Number.isFinite(ms)?{ms,asOf:new Date(ms).toISOString()}:null;
// A calendar day stays "YYYY-MM-DD", so no time zone moves it to the day before.
function calendarDay(y:number,month:number,d:number):Dated|null{
 const ms=Date.UTC(y,month,d),asOf=new Date(ms).toISOString().slice(0,10);
 return month>=0&&new Date(ms).getUTCDate()===d?{ms,asOf}:null;
}
// A calendar date at the start of `text`: "Oct 27, 2026", "10/27/2026" or "2026-10-27".
function dayIn(text:string):Dated|null{
 let m=/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(text);
 if(m)return calendarDay(Number(m[3]),MONTHS.indexOf(m[1].toLowerCase()),Number(m[2]));
 if((m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text)))return calendarDay(Number(m[3]),Number(m[1])-1,Number(m[2]));
 if((m=/^(\d{4})-(\d{2})-(\d{2})/.exec(text)))return calendarDay(Number(m[1]),Number(m[2])-1,Number(m[3]));
 return null;
}
type Phrase={at:number;end:number;dated:Dated};
// Every date phrase in the text and where it is: "(updated) 3 hours ago", or "as of / updated Oct 27, 2026".
function datesIn(text:string,now:Date):Phrase[]{
 const phrases:Phrase[]=[];
 const add=(m:RegExpMatchArray,dated:Dated|null)=>{if(dated)phrases.push({at:m.index!,end:m.index!+m[0].length,dated});};
 for(const m of text.matchAll(/\b(?:(?:as of|updated)\s*:?\s*)?(\d+|an?)\s*(minute|min|hour|hr|day)s?\s+ago\b/gi))
  add(m,instant(now.getTime()-(/^an?$/i.test(m[1])?1:Number(m[1]))*UNIT_MS[m[2][0].toLowerCase()]));
 for(const m of text.matchAll(/\b(?:as of|updated)\s*:?\s*(.{6,20})/gi))add(m,dayIn(m[1]));
 return phrases;
}
// When the text says the price was true: the date phrase nearest it, so a page's other dates
// don't date it.
function dateNear(text:string,price:{at:number;end:number},now:Date):Dated|null{
 const gap=(p:Phrase)=>p.at>=price.end?p.at-price.end:Math.max(0,price.at-p.end);
 return datesIn(text,now).sort((a,b)=>gap(a)-gap(b))[0]?.dated??null;
}
// The result is about the asked-for station: its name and its street number in the title or
// next to the price. A street name alone could be any station on that street.
function aboutStation(station:Place,title:string,near:string){
 const brand=station.name.toLowerCase(),number=/^\d+/.exec(street(station))?.[0];
 const names=(text:string)=>!!number&&text.toLowerCase().includes(brand)&&new RegExp(`\\b${number}\\b`).test(text);
 return names(title)||names(near);
}
// The result is about one station, not an area: a GasBuddy station page, or a street address in
// the title or next to the price.
const STATION_PAGE=/^https:\/\/(www\.)?gasbuddy\.com\/station\/\d+/;
const ADDRESS=/\b\d{2,6}\s+[a-z0-9.' ]{2,30}?\s(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|way|hwy|highway|pkwy|parkway|ln|lane|pl|place|ct|court)\b/i;
const aboutAStation=(title:string,near:string,url:string)=>STATION_PAGE.test(url)||ADDRESS.test(title)||ADDRESS.test(near);
// A dated, plausible price from Tavily's results: for a station, its own page wherever it ranks,
// else the first area figure; for an area, the first figure. Another station's price is never
// called the area's. Throws when no result has one.
export function parseTavilyPrice(body:unknown,at:GasPriceQuery,now=new Date()):GasPrice{
 const rows=(body as {results?:unknown[]})?.results;if(!Array.isArray(rows))throw new Error('Unexpected search response.');
 const station=at.station;
 let areaPrice:GasPrice|undefined;
 for(const r of rows){
  const row=(r??{}) as Record<string,unknown>;
  if(!safeUrl(row.url)||typeof row.content!=='string')continue;
  const found=priceIn(row.content);if(!found)continue;
  const near=row.content.slice(Math.max(0,found.at-NEAR_CHARS),found.at+NEAR_CHARS);
  const dated=dateNear(row.content,found,now)??(typeof row.published_date==='string'?instant(Date.parse(row.published_date)):null);
  if(!dated||dated.ms>now.getTime()+DAY||now.getTime()-dated.ms>MAX_AGE_DAYS*DAY)continue;
  const title=typeof row.title==='string'?row.title:'';
  const base={price:found.price,asOf:dated.asOf,source:row.url,stale:false};
  if(station&&aboutStation(station,title,near))return {...base,kind:'station',label:`${station.name}, ${street(station)}`};
  if(station&&aboutAStation(title,near,row.url))continue;
  const area=at.area??(station?areaOf(station.label):undefined);
  areaPrice??={...base,kind:'area',label:area?`Regular gasoline reported around ${area}`:title.slice(0,120)||'Regular gasoline reported nearby'};
  if(!station)return areaPrice;
 }
 if(areaPrice)return areaPrice;
 throw new Error('No dated price in the search results.');
}
// Forums and aggregators whose prices are often days or weeks old.
const TAVILY_EXCLUDED=['reddit.com','gaspricewatch.com','yelp.com','mapquest.com'];
// A dated price for one station or area from Tavily (parameters per docs.tavily.com). The
// cached copy is at most a day old, so a relative "3 hours ago" is off by a day at worst.
// No visitor id is sent. Throws on any refusal, 434 (live-fetch capacity full) included.
export async function fetchTavilyPrice(apiKey:string,at:GasPriceQuery,fetchImpl:PostFetch=fetch,now=new Date()):Promise<GasPrice>{
 const where=at.station?`${at.station.name} ${at.station.label}`:at.area;if(!where)throw new Error('Nothing to price.');
 const r=await fetchImpl('https://api.tavily.com/search',{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
  body:JSON.stringify({query:`${where} regular gas price per gallon`,topic:'general',search_depth:'basic',auto_parameters:false,max_results:5,include_answer:false,include_raw_content:false,
   include_published_date:true,time_range:'week',max_age_hours:24,country:'united states',include_domains:['gasbuddy.com'],include_domains_mode:'prefer',exclude_domains:TAVILY_EXCLUDED})});
 if(!r.ok)throw new Error(`Tavily responded ${r.status}`);
 return parseTavilyPrice(await r.json(),at,now);
}
