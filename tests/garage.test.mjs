import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGarage, logService, setSchedule, updateOdometer } from '../src/lib/garage.ts';
import { isGarage, addProposals, makeProposals } from '../src/lib/maintenance.ts';
const now = new Date('2026-10-22T12:00:00Z');
const create = () => createGarage({year:2019,make:'Honda',model:'Civic',odometer:48000,mpg:32,location:'Buena Park'},now);
test('own car starts with unknown service history and manual MPG provenance',()=>{
  const garage=create();assert.equal(isGarage(garage),true);assert.equal(garage.vehicle.isDemo,false);
  assert.equal(garage.vehicle.mpgSource.kind,'manual');assert.ok(garage.items.every(i=>i.dueAt===undefined&&i.dueOdometer===undefined));
  assert.equal(garage.items.find(i=>i.kind==='tire_pressure').intervalSource.kind,'nhtsa');
});
test('source-backed interval and logged service calculate both due thresholds',()=>{
  const configured=setSchedule(create(),{itemId:'oil',days:180,miles:5000,url:'https://example.com/manual',note:'Entered manual interval'});
  assert.equal(configured.items.find(i=>i.id==='oil').dueAt,undefined);
  const logged=logService(configured,{itemId:'oil',date:'2026-10-01',odometer:47000,notes:'Oil replaced'},now);
  const oil=logged.items.find(i=>i.id==='oil');assert.equal(oil.dueOdometer,52000);assert.equal(oil.dueAt.slice(0,10),'2027-03-30');
  assert.equal(logged.services.length,1);assert.equal(logged.vehicle.odometer,48000);assert.equal(isGarage(JSON.parse(JSON.stringify(logged))),true);
});
test('historical entries do not roll the schedule back; duplicates and impossible dates fail',()=>{
  const first=logService(create(),{itemId:'tire_pressure',date:'2026-10-20',odometer:47900,notes:''},now);
  const older=logService(first,{itemId:'tire_pressure',date:'2026-10-10',odometer:47500,notes:''},now);
  assert.equal(older.items.find(i=>i.id==='tire_pressure').lastDoneOdometer,47900);
  for(const input of [{date:'2026-10-20',odometer:47900},{date:'2026-10-23',odometer:48000},{date:'2026-02-30',odometer:48000},{date:'2026-10-22',odometer:49000},{date:'2026-10-22',odometer:47000}])assert.throws(()=>logService(first,{itemId:'tire_pressure',notes:'',...input},now));
});
test('logging service dismisses pending advice and unknown intervals stay unknown',()=>{
  let garage=create();garage=addProposals(garage,makeProposals([{itemId:'engine_filter',daysUntilDue:2,reason:'Inspect'}],garage,'sample',now));
  garage=logService(garage,{itemId:'engine_filter',date:'2026-10-22',odometer:48000,notes:'Inspected; not replaced'},now);
  assert.equal(garage.proposals[0].state,'dismissed');assert.equal(garage.items.find(i=>i.id==='engine_filter').dueAt,undefined);
});
test('unsafe source links and malformed backup fields are rejected',()=>{
  for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com'])assert.throws(()=>setSchedule(create(),{itemId:'oil',days:365,url,note:'manual'}));
  const garage=create();garage.items[0].intervalDays=-1;assert.equal(isGarage(garage),false);
  assert.throws(()=>createGarage({year:2019,make:'Honda',model:'Civic',odometer:NaN,mpg:32,location:''},now));
  assert.throws(()=>updateOdometer(create(),47000));assert.equal(updateOdometer(create(),48100).vehicle.odometer,48100);
});
