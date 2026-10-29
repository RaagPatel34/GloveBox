// Deterministic route requests and strict provider-response validation. No model calls.
export type DrivingRoute = {stops:string[];miles:number;minutes:number;mapsUrl:string;checkedAt:string};
export function validateStops(value:unknown):string[]{
 if(!Array.isArray(value)||value.length<2||value.length>8||value.some(s=>typeof s!=='string'||!s.trim()||s.length>200)) throw new Error('Enter 2–8 stops, with each address under 200 characters.');
 return value.map(s=>s.trim());
}
export function mapsDirections(stops:string[]){return 'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',origin:stops[0],destination:stops.at(-1)!,travelmode:'driving',...(stops.length>2?{waypoints:stops.slice(1,-1).join('|')}:{})});}
export function routeRequest(stops:string[],optimize:boolean){return {origin:{address:stops[0]},destination:{address:stops.at(-1)},intermediates:stops.slice(1,-1).map(address=>({address})),travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',optimizeWaypointOrder:optimize&&stops.length>3,units:'IMPERIAL'};}
// The provider's route for any kind of stop: intermediates in driving order, miles and minutes.
export type RouteResult<T>={order:T[];miles:number;minutes:number};
export function parseRoute<T>(body:unknown,intermediates:T[],optimize:boolean):RouteResult<T>{
 const data=body as {routes?:{distanceMeters?:number;duration?:string;optimizedIntermediateWaypointIndex?:number[]}[]};const route=data?.routes?.[0];
 if(!route||typeof route.distanceMeters!=='number'||!Number.isFinite(route.distanceMeters)||route.distanceMeters<=0||route.distanceMeters>16_093_440||typeof route.duration!=='string'||!/^\d+(\.\d+)?s$/.test(route.duration))throw new Error('No usable driving route returned. Check the addresses.');
 let order=intermediates;
 if(optimize){const indices=route.optimizedIntermediateWaypointIndex;if(!Array.isArray(indices)||indices.length!==intermediates.length||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=intermediates.length))throw new Error('The route provider returned an invalid stop order.');order=indices.map(i=>intermediates[i]);}
 return {order,miles:route.distanceMeters/1609.344,minutes:parseFloat(route.duration)/60};
}
export function parseDrivingRoute(body:unknown,stops:string[],optimize:boolean,now=new Date()):DrivingRoute {
 const {order,miles,minutes}=parseRoute(body,stops.slice(1,-1),optimize&&stops.length>3);
 const sorted=[stops[0],...order,stops.at(-1)!];
 return {stops:sorted,miles,minutes,mapsUrl:mapsDirections(sorted),checkedAt:now.toISOString()};
}
