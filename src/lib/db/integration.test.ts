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
