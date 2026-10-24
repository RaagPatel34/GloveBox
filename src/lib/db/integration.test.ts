import {setWeatherPreference,weatherPreference,claimWeatherChecks} from './weather-check-store';
import {runDailyWeather} from '../daily-weather';
import {checkConditions} from '../nudge-check';
vi.mock('../nudge-check',()=>({checkConditions:vi.fn()}));
import {prepareTransfer} from '../garage-transfer';
import {demoGarage} from '../maintenance';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {SCHEMA_STATEMENTS} from './schema';
import {demoCar} from '../fixtures/demo-car';
import {saveCar,loadCar,updateCar} from './car-store';
import {addProposals,loadProposals,saveDecision} from './proposal-store';
import {addNudge,listNudges} from './nudge-store';
import {decideProposal} from '../proposals';
import type {Proposal} from '../types';
const state=vi.hoisted(()=>({sql:null as unknown}));
vi.mock('./sql',()=>({getSql:()=>state.sql}));
const owner='11111111-1111-4111-8111-111111111111';
const stranger='22222222-2222-4222-8222-222222222222';
let db:PGlite;
type Query={text:string;values:unknown[];then:PromiseLike<unknown>['then']};
beforeAll(async()=>{
 db=new PGlite();
 const sql=(strings:TemplateStringsArray,...values:unknown[]):Query=>{const text=strings.reduce((acc,s,i)=>acc+(i?`$${i}`:'')+s,'');return {text,values,then(resolve,reject){return db.query(text,values).then(r=>r.rows).then(resolve,reject);}};};
 sql.transaction=async(queries:Query[])=>db.transaction(async tx=>{const rows=[];for(const q of queries)rows.push((await tx.query(q.text,q.values)).rows);return rows;});
 state.sql=sql;
 for(let n=0;n<2;n++)for(const statement of SCHEMA_STATEMENTS)await db.exec(statement);
},20000);
beforeEach(async()=>{await saveCar(owner,demoCar(new Date('2026-10-23'),owner,()=>crypto.randomUUID()));});
afterAll(async()=>{await db?.close();});
describe('combined Postgres stores',()=>{
 it('copies a full local archive atomically and never overwrites an existing cloud car',async()=>{
 const local=demoGarage(new Date('2026-10-23'));
 local.items[0].intervalSource={kind:'user',note:'My personal wash interval'};
 local.services=[{id:'local-record',itemId:local.items[0].id,date:'2026-10-01',odometer:47000,notes:'Receipt retained',createdAt:'2026-10-01T12:00:00Z'}];
 local.plannedTripMiles=500;
 const visitor='33333333-3333-4333-8333-333333333333';
 await db.query('DELETE FROM vehicles WHERE visitor_id = $1',[visitor]);
 const copy=prepareTransfer(local,visitor);
 await saveCar(visitor,copy,[],{extra:JSON.stringify(copy)});
 const stored=await loadCar(visitor);
 expect(stored?.plannedTripMiles).toBe(500);
 expect(stored?.items.find(i=>i.kind==='wash')?.intervalSource.note).toBe('My personal wash interval');
 const archive=await db.query<{garage_extra:typeof copy}>('SELECT garage_extra FROM vehicles WHERE visitor_id = $1',[visitor]);
 expect(archive.rows[0].garage_extra.services?.[0].notes).toBe('Receipt retained');
 await expect(saveCar(visitor,prepareTransfer(local,visitor),[],{extra:JSON.stringify(copy)})).rejects.toThrow();
 expect(await loadCar(visitor)).toEqual(stored);
 await db.query('DELETE FROM vehicles WHERE visitor_id = $1',[visitor]);
 });
 it('requires consent and claims each car only once in 24 hours',async()=>{
 const now=new Date('2030-01-01');
 expect(await claimWeatherChecks(now)).toEqual([]);
 expect(await setWeatherPreference(stranger,true)).toBe(false);
 expect(await setWeatherPreference(owner,true)).toBe(true);
 expect((await weatherPreference(owner))?.enabled).toBe(true);
 expect(await claimWeatherChecks(now)).toHaveLength(1);
 expect(await claimWeatherChecks(now)).toEqual([]);
 expect(await claimWeatherChecks(new Date(now.getTime()+86400000))).toHaveLength(1);
 await setWeatherPreference(owner,false);
 expect(await claimWeatherChecks(new Date('2030-01-03'))).toEqual([]);
 });
 it('refreshes nudges without touching the car and does not retry completed work',async()=>{
 await setWeatherPreference(owner,true);
 const before=await loadCar(owner);
 vi.mocked(checkConditions).mockResolvedValue({complete:true,nudge:{text:'Rain soon',reason:'Forecast'}});
 expect(await runDailyWeather(new Date('2030-01-01'))).toEqual({checked:1,complete:1,failed:0});
 expect(await listNudges(owner,new Date('2030-01-01'))).toHaveLength(1);
 expect(await loadCar(owner)).toEqual(before);
 expect(await runDailyWeather(new Date('2030-01-01'))).toEqual({checked:0,complete:0,failed:0});
 });
 it('respects withdrawal of consent during the forecast request',async()=>{
 await setWeatherPreference(owner,true);
 vi.mocked(checkConditions).mockImplementation(async()=>{await setWeatherPreference(owner,false);return {complete:true,nudge:{text:'Do not save',reason:'Test'}};});
 await runDailyWeather(new Date('2030-01-01'));
 expect(await listNudges(owner,new Date('2030-01-01'))).toEqual([]);
 });
 it('keeps previous guidance on a provider failure and records the failure',async()=>{
 await setWeatherPreference(owner,true);
 vi.mocked(checkConditions).mockResolvedValue({complete:false,nudge:null});
 expect(await runDailyWeather(new Date('2030-01-01'))).toEqual({checked:1,complete:0,failed:1});
 expect((await weatherPreference(owner))?.outcome).toContain('unavailable');
 });
 it('migrates twice, saves a car, and scopes records to the visitor',async()=>{const car=demoCar(new Date('2026-10-23'),owner,()=>crypto.randomUUID());await saveCar(owner,car);expect((await loadCar(owner))?.items).toHaveLength(8);expect(await loadCar(stranger)).toBeNull();});
 it('applies a proposal atomically, rejects cross-visitor access and duplicate apply',async()=>{
 const car=(await loadCar(owner))!;const item=car.items.find(i=>i.kind==='oil')!;
 const proposal:Proposal={id:'test-proposal',vehicleId:car.vehicle.id,itemId:item.id,from:{dueAt:item.dueAt,dueOdometer:item.dueOdometer},to:{dueAt:item.dueAt,dueOdometer:item.dueOdometer!-100},reason:'Test reminder',model:'super',state:'pending'};
 await addProposals(owner,[proposal]);expect(await loadProposals(stranger)).toEqual([]);
 const result=decideProposal(car,proposal,'apply',new Date('2026-10-23'));expect(result.ok).toBe(true);if(!result.ok)throw new Error(result.error);
 expect(await saveDecision(stranger,result)).toBe(false);expect(await saveDecision(owner,result)).toBe(true);expect(await saveDecision(owner,result)).toBe(false);
 expect((await loadCar(owner))!.items.find(i=>i.id===item.id)?.dueOdometer).toBe(item.dueOdometer!-100);
 });
 it('invalidates weather nudges when a wash is recorded',async()=>{
 const before=(await loadCar(owner))!;const now=new Date('2026-10-23');await addNudge({id:'test-nudge',vehicleId:before.vehicle.id,text:'Rain soon',reason:'Test forecast',createdAt:now.toISOString()});expect(await listNudges(stranger,now)).toEqual([]);expect(await listNudges(owner,now)).toHaveLength(1);
 const after=structuredClone(before);after.items.find(i=>i.kind==='wash')!.lastDoneAt=now.toISOString();await updateCar(owner,after,before);expect(await listNudges(owner,now)).toEqual([]);
 });
});
