import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrip, tripCost, vehicleMpg } from '../src/lib/trip.ts';
const input={miles:42,mpg:32,gallons:12,usualPrice:4.89,alternatePrice:4.59,extraMiles:8,extraMinutes:15,hourlyValue:0};
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.000001,`${a} differs from ${b}`);
test('compares pump savings with entire additional distance without double-counting purchase and trip cost',()=>{
  const r=calculateTrip(input);close(r.purchaseSavings,3.6);close(r.detourFuelCost,1.2225);close(r.netFuelSavings,2.3775);close(r.baselineFuelCost,6.418125);assert.equal(r.totalMiles,50);assert.equal(r.worthIt,true);
});
test('time cost can reverse the verdict',()=>{const r=calculateTrip({...input,hourlyValue:20});close(r.timeCost,5);close(r.netAfterTime,-2.6225);assert.equal(r.worthIt,false);assert.equal(r.breakEvenExtraMiles,0);});
test('same price, higher price and break-even have no positive verdict',()=>{
  assert.equal(calculateTrip({...input,alternatePrice:4.89}).worthIt,false);
  assert.equal(calculateTrip({...input,alternatePrice:5.1}).worthIt,false);
  const r=calculateTrip(input);assert.equal(calculateTrip({...input,extraMiles:r.breakEvenExtraMiles}).worthIt,false);
});
test('rejects impossible, non-finite and missing numeric inputs',()=>{
  for(const change of [{mpg:0},{gallons:-1},{extraMiles:-1},{usualPrice:Infinity},{miles:NaN},{hourlyValue:1001}])assert.throws(()=>calculateTrip({...input,...change}));
});
test('tripCost prices the fuel a drive burns: 64 mi at 32 MPG and $4.50/gal is $9.00',()=>{
  close(tripCost(64,32,4.5),9);close(tripCost(0,32,4.5),0);close(tripCost(24.3,30,4.659),3.77379);
});
test('tripCost refuses impossible miles, MPG and prices rather than pricing them',()=>{
  for(const [miles,mpg,price] of [[-1,32,4.5],[NaN,32,4.5],[10,0,4.5],[10,151,4.5],[10,32,0],[10,32,31],[10,32,Infinity]])assert.throws(()=>tripCost(miles,mpg,price));
});
test('vehicleMpg is the real-world MPG the driver set, else the EPA figure',()=>{
  assert.equal(vehicleMpg({epaMpg:34}),34);
  assert.equal(vehicleMpg({epaMpg:34,mpgOverride:29}),29);
  assert.equal(vehicleMpg({epaMpg:34,mpgOverride:0}),34);
});
