import {afterEach,describe,it,expect,vi} from 'vitest';
import {POST as routePlan} from '../app/api/route-plan/route';
import {POST as placeSearch} from '../app/api/places/route';
import {GET as gasPrice} from '../app/api/gas-price/route';
import {GET as conditions} from '../app/api/conditions/route';
import {boundedJson} from './request-json';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('external request gates',()=>{
 it('does not call paid maps services when disabled, even with a key',async()=>{vi.stubEnv('ENABLE_MAPS','false');vi.stubEnv('GOOGLE_MAPS_API_KEY','test-only');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);for(const handler of [routePlan,placeSearch])expect((await handler(new Request('https://example.test/api',{method:'POST',body:'{}'}))).status).toBe(503);expect(fetcher).not.toHaveBeenCalled();});
 it('rejects cross-origin routing before contacting providers',async()=>{vi.stubEnv('ENABLE_MAPS','true');vi.stubEnv('GOOGLE_MAPS_API_KEY','test-only');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect((await routePlan(new Request('https://example.test/api',{method:'POST',headers:{Origin:'https://other.test'},body:'{}'}))).status).toBe(403);expect(fetcher).not.toHaveBeenCalled();});
 it('returns an honest unavailable status with no EIA key',async()=>{vi.stubEnv('EIA_API_KEY','');expect((await gasPrice()).status).toBe(503);});
 it('rejects missing or invalid weather coordinates',async()=>{expect((await conditions(new Request('https://example.test/api?lat=999&lng=0'))).status).toBe(400);expect((await conditions(new Request('https://example.test/api?lng=0'))).status).toBe(400);});
 it('limits request bodies without trusting Content-Length',async()=>{await expect(boundedJson(new Request('https://example.test',{method:'POST',body:'x'.repeat(101)}),100)).rejects.toThrow('large');});
});
