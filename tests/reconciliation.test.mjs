import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGarage, setMileagePlan, updateOdometer, logService } from '../src/lib/garage.ts';
import { estimateOdometer, itemStatus } from '../src/lib/intervals.ts';
import { isGarage } from '../src/lib/maintenance.ts';
const start = new Date('2026-10-01T12:00:00Z');
const later = new Date('2026-10-08T12:00:00Z');
const car = () => createGarage({year:2019,make:'Honda',model:'Civic',odometer:48000,mpg:32,location:'Buena Park',weeklyMiles:250},start);
test('shared forecast changes maintenance urgency without changing records',()=>{
 const before=car();const plan=setMileagePlan(before,250,300,start);
 const estimated=estimateOdometer(plan.vehicle,new Date(plan.readingAt),later,plan.plannedTripMiles);
 assert.equal(estimated,48550);assert.equal(itemStatus({dueOdometer:48400},later,estimated),'overdue');
 assert.equal(plan.vehicle.odometer,48000);assert.deepEqual(plan.services,before.services);
 const logged=logService(plan,{itemId:'tire_pressure',date:'2026-10-08',odometer:48000,notes:''},later);
 assert.equal(logged.services[0].odometer,48000);assert.equal(logged.vehicle.odometer,48000);
 assert.equal(isGarage(JSON.parse(JSON.stringify(plan))),true);
});
test('fresh odometer resets elapsed time while planned miles remain explicitly separate',()=>{
 const plan=setMileagePlan(car(),250,300,start);const updated=updateOdometer(plan,48200,later);
 assert.equal(updated.readingAt,later.toISOString());assert.equal(updated.vehicle.odometer,48200);
 assert.equal(estimateOdometer(updated.vehicle,new Date(updated.readingAt),later,updated.plannedTripMiles),48500);
 assert.equal(setMileagePlan(updated,250,0,later).plannedTripMiles,0);
});
test('legacy backups remain readable and invalid forecasts are rejected',()=>{
 const legacy=car();delete legacy.readingAt;delete legacy.plannedTripMiles;
 assert.equal(isGarage(legacy),true);assert.equal(setMileagePlan(legacy,250,0,later).readingAt,later.toISOString());
 for(const value of [-1,Infinity,10001])assert.throws(()=>setMileagePlan(legacy,250,value));
 assert.equal(isGarage({...legacy,readingAt:'bad-date'}),false);
 assert.equal(isGarage({...legacy,plannedTripMiles:-1}),false);
});
