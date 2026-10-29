// Deterministic route requests and strict provider-response validation. No model calls.
export type DrivingRoute = {stops:string[];miles:number;minutes:number;mapsUrl:string;checkedAt:string};
export function validateStops(value:unknown):string[]{
 if(!Array.isArray(value)||value.length<2||value.length>8||value.some(s=>typeof s!=='string'||!s.trim()||s.length>200)) throw new Error('Enter 2–8 stops, with each address under 200 characters.');
 return value.map(s=>s.trim());
}
export function mapsDirections(stops:string[]){return 'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',origin:stops[0],destination:stops.at(-1)!,travelmode:'driving',...(stops.length>2?{waypoints:stops.slice(1,-1).join('|')}:{})});}
export function routeRequest(stops:string[],optimize:boolean){return {origin:{address:stops[0]},destination:{address:stops.at(-1)},intermediates:stops.slice(1,-1).map(address=>({address})),travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',optimizeWaypointOrder:optimize&&stops.length>3,units:'IMPERIAL'};}
export function parseDrivingRoute(body:unknown,stops:string[],optimize:boolean,now=new Date()):DrivingRoute {
 const data=body as {routes?:{distanceMeters?:number;duration?:string;optimizedIntermediateWaypointIndex?:number[]}[]};const route=data?.routes?.[0];
 if(!route||typeof route.distanceMeters!=='number'||!Number.isFinite(route.distanceMeters)||route.distanceMeters<=0||route.distanceMeters>16_093_440||typeof route.duration!=='string'||!/^\d+(\.\d+)?s$/.test(route.duration))throw new Error('No usable driving route returned. Check the addresses.');
 const intermediate=stops.slice(1,-1);let order=intermediate;
 if(optimize&&stops.length>3){const indices=route.optimizedIntermediateWaypointIndex;if(!Array.isArray(indices)||indices.length!==intermediate.length||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=intermediate.length))throw new Error('The route provider returned an invalid stop order.');order=indices.map(i=>intermediate[i]);}
 const sorted=[stops[0],...order,stops.at(-1)!];
 return {stops:sorted,miles:route.distanceMeters/1609.344,minutes:parseFloat(route.duration)/60,mapsUrl:mapsDirections(sorted),checkedAt:now.toISOString()};
}
