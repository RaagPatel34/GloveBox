import {describe,it,expect} from 'vitest';
import {validateStops,parseDrivingRoute,routeRequest} from './route-planner';
import {parseRegionalPrice} from './gas-price';
describe('non-AI trip providers',()=>{
 it('rejects missing and oversized stop lists',()=>{expect(()=>validateStops(['A'])).toThrow();expect(()=>validateStops(Array(9).fill('A'))).toThrow();expect(()=>validateStops(['A',' '])).toThrow();expect(validateStops([' A ',' B '])).toEqual(['A','B']);});
 it('uses provider stop order and real distance, preserving endpoints',()=>{const stops=['home','wash','gas','destination'];const r=parseDrivingRoute({routes:[{distanceMeters:16093.44,duration:'1200s',optimizedIntermediateWaypointIndex:[1,0]}]},stops,true);expect(r.stops).toEqual(['home','gas','wash','destination']);expect(r.miles).toBeCloseTo(10);expect(r.minutes).toBe(20);expect(routeRequest(stops,true).optimizeWaypointOrder).toBe(true);});
 it('rejects bad distances and invalid optimized order instead of inventing a route',()=>{expect(()=>parseDrivingRoute({routes:[{distanceMeters:-1,duration:'20s'}]},['a','b'],false)).toThrow();expect(()=>parseDrivingRoute({routes:[{distanceMeters:1000,duration:'20s',optimizedIntermediateWaypointIndex:[0,0]}]},['a','b','c','d'],true)).toThrow();});
 it('labels regional prices and stale data rather than claiming a station quote',()=>{const r=parseRegionalPrice({response:{data:[{period:'2026-10-01',value:'4.50'}]}},new Date('2026-10-23'));expect(r.kind).toBe('eia');expect(r.stale).toBe(true);expect(r.price).toBe(4.5);expect(()=>parseRegionalPrice({response:{data:[{period:'bad',value:'0'}]}})).toThrow();});
});
