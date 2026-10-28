'use client';
import {useState, type FormEvent} from 'react';
import {evaluateNudge} from '@/lib/nudge';
import {itemStatus,estimateOdometer} from '@/lib/intervals';
import type {Garage} from '@/lib/maintenance';
import type {WeatherForecast,AirQuality} from '@/lib/weather';
import { ExternalIcon } from '@/components/shell/icons';
type Location={label:string;lat:number;lng:number};
type Conditions={weather:WeatherForecast|null;air:AirQuality|null;complete:boolean;checkedAt:string};
export function ConditionsPanel({garage}:{garage:Garage}) {
 const [query,setQuery]=useState(garage.vehicle.isDemo?'Buena Park, CA':'');
 const [locations,setLocations]=useState<Location[]>([]);
 const [place,setPlace]=useState<Location|null>(null);
 const [data,setData]=useState<Conditions|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function search(e:FormEvent){e.preventDefault();setBusy(true);setError('');setLocations([]);try{const r=await fetch('/api/locations?'+new URLSearchParams({name:query}));const d=await r.json();if(!r.ok)throw new Error(d.error);setLocations(d.locations);if(!d.locations.length)setError('No matching US city found. Try a ZIP code.');}catch(e){setError(e instanceof Error?e.message:'Search unavailable.');}finally{setBusy(false);}}
 async function check(location:Location){setBusy(true);setError('');setData(null);setPlace(location);try{const r=await fetch('/api/conditions?'+new URLSearchParams({lat:String(location.lat),lng:String(location.lng)}));const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);setLocations([]);}catch(e){setError(e instanceof Error?e.message:'Conditions unavailable.');}finally{setBusy(false);}}
 const now=new Date();const wash=garage.items.find(i=>i.kind==='wash');
 const nudge=data&&place?evaluateNudge({weather:data.weather??undefined,air:data.air??undefined,place:place.label,washStatus:wash?itemStatus(wash,now,estimateOdometer(garage.vehicle,garage.readingAt?new Date(garage.readingAt):now,now,garage.plannedTripMiles??0)):undefined}):null;
 return <section className="tool-panel conditions-panel" aria-label="Weather and air quality"><div className="section-heading"><h2>Ahead on the forecast</h2><span className="pill">LIVE DATA · NO AI</span></div><p className="helper">Check rain and air quality before washing. Search sends your city or ZIP code to Open-Meteo; no precise address is needed.</p><form onSubmit={search} className="location-search"><label>City or ZIP code<input required minLength={2} maxLength={120} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buena Park, CA"/></label><button className="secondary" disabled={busy}>{busy?'Checking…':'Find city'}</button></form>{locations.length>0&&<ul className="location-results">{locations.map(l=><li key={`${l.lat},${l.lng}`}><button disabled={busy} className="text-button" onClick={()=>check(l)}>Check {l.label}</button></li>)}</ul>}{error&&<p role="alert" className="error">{error}</p>}{data&&place&&<div className="notice" aria-live="polite"><h3>{nudge?.text??'No weather-related upkeep suggestion right now.'}</h3><p>{nudge?.reason??'Keep following your existing maintenance schedule.'}</p><p className="helper">{place.label} · Checked {new Date(data.checkedAt).toLocaleString()}{!data.complete?' · Some conditions are unavailable.':''}</p>{data.air&&<p className="helper">Air reading: {data.air.asOf.replace('T',' ')} local time · PM2.5 {data.air.pm25Now} µg/m³{data.air.usAqi!==null?` · US AQI ${data.air.usAqi}`:''}</p>}<p className="helper">Forecast guidance does not change a reminder or mark a service complete. High particulate levels do not by themselves confirm smoke or ash at your car.</p><a className="source-link" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo · Air quality by CAMS / Open-Meteo <ExternalIcon /></a><button className="text-button" disabled={busy} onClick={()=>check(place)}>Refresh conditions</button></div>}</section>;
}
