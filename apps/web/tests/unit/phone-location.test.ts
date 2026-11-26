import { describe,it,expect } from "vitest";
import { randomUUID } from "node:crypto";
import { applyPhoneLocation,phoneLocationSchema,type PhoneLocationInput } from "../../lib/server/phone-location";
import { applyHardwareReading } from "../../lib/server/hardware";
import type { Account } from "../../lib/permissions/access";
import type { Vehicle } from "../../lib/server/demo-store";
import type { EnrollmentApplication } from "../../lib/enrollment/types";
const now=Date.now();
function fixture(){
 const account={id:"owner",role:"vehicle_owner",status:"Active"} as Account;
 const vehicle={id:"v-plus",ownerId:account.id,deviceTier:"PLUS",ownerVerified:true,heartbeat:new Date(now).toISOString(),eventAt:new Date(now).toISOString(),geofence:"Unknown",geofenceConfig:{enabled:true,lat:22.3,lng:70.8,radiusM:150,version:1}} as Vehicle;
 const app={vehicleId:vehicle.id,ownerId:account.id,status:"Approved",ownerMountedAt:new Date(now-10000).toISOString()} as EnrollmentApplication;
 const start=()=>applyPhoneLocation(account,vehicle,app,{action:"start",vehicleId:vehicle.id,coLocated:true},now);
 const sample=(time=now,accuracy=10):PhoneLocationInput=>({action:"sample",vehicleId:vehicle.id,sessionId:vehicle.phoneLocationSession!.id,nonce:randomUUID(),timestamp:time,lat:22.303,lng:70.8,accuracy});
 return {account,vehicle,app,start,sample};
}
describe("Plus explicit phone location",()=>{
 it("requires consent, the assigned owner, Plus, approval and mounting",()=>{
  expect(phoneLocationSchema.safeParse({action:"start",vehicleId:"v-plus",coLocated:false}).success).toBe(false);
  for(const mutation of [(f:ReturnType<typeof fixture>)=>f.account.id="other",(f:ReturnType<typeof fixture>)=>f.vehicle.deviceTier="BASIC",(f:ReturnType<typeof fixture>)=>f.app.status="Draft",(f:ReturnType<typeof fixture>)=>delete f.app.ownerMountedAt]){const f=fixture();mutation(f);expect(f.start).toThrow();}
 });
 it("stops and expires sessions, rejects stale and inaccurate fixes",()=>{
  const f=fixture();f.start();const sample=f.sample();
  expect(()=>applyPhoneLocation(f.account,f.vehicle,f.app,sample,now+16000)).toThrow(/stale/);
  expect(()=>applyPhoneLocation(f.account,f.vehicle,f.app,sample,now+61000)).toThrow(/expired/);
  applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now,100),now);expect(f.vehicle.gpsStatus).toBe("Unavailable");expect(f.vehicle.lat).toBeUndefined();
  applyPhoneLocation(f.account,f.vehicle,f.app,{action:"stop",vehicleId:f.vehicle.id,sessionId:f.vehicle.phoneLocationSession!.id},now);
  expect(()=>applyPhoneLocation(f.account,f.vehicle,f.app,sample,now)).toThrow(/stopped/);
 });
 it("confirms two distinct fixes, preserves hardware heartbeat and emits phone-labelled evidence",()=>{
  const f=fixture();f.start();const heartbeat=f.vehicle.heartbeat;
  expect(applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(),now).alerts).toHaveLength(0);
  expect(applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(),now).alerts).toHaveLength(0);
  const result=applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now+5000),now+5000);
  expect(result.alerts).toHaveLength(1);expect(result.alerts[0].title).toBe("Phone location outside parking geofence");expect(f.vehicle.heartbeat).toBe(heartbeat);expect(f.vehicle.locationSource).toBe("PHONE_BROWSER");
  expect(applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now+10000),now+10000).alerts).toHaveLength(0);
 });
 it("does not alert for an offline watch or let a replaced session submit",()=>{
  const f=fixture();f.start();const old=f.sample();f.start();expect(()=>applyPhoneLocation(f.account,f.vehicle,f.app,old,now)).toThrow(/replaced/);
  f.vehicle.heartbeat=new Date(now-60000).toISOString();applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(),now);
  expect(applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now+5000),now+5000).alerts).toHaveLength(0);
 });
 it("keeps Plus phone coordinates when a signed watch heartbeat has no GPS",()=>{
  const f=fixture();f.start();applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(),now);
  applyHardwareReading(f.vehicle,f.app,{deviceId:"IG-PLUS-0001",timestamp:now+1,nonce:randomUUID(),firmware:"plus-watch-1.0.0",uptimeMs:30000,imu:{state:"Stationary",accelerationG:.01,rotationDps:.2,qualifiedMotionMs:0,movementId:null,movementAt:null},gps:null},now+1);
  expect(f.vehicle.lat).toBe(22.303);expect(f.vehicle.gpsStatus).toBe("Phone-provided location");expect(f.vehicle.locationSource).toBe("PHONE_BROWSER");
 });
 it("reconfirms after watch reconnection instead of suppressing the exit alert",()=>{
  const f=fixture();f.start();f.vehicle.heartbeat=new Date(now-60000).toISOString();
  for(const offset of [0,5000])expect(applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now+offset),now+offset).alerts).toHaveLength(0);
  f.vehicle.heartbeat=f.vehicle.eventAt=new Date(now+10000).toISOString();
  expect(applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now+10000),now+10000).alerts).toHaveLength(0);
  expect(applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now+15000),now+15000).alerts).toHaveLength(1);
 });
 it("does not treat a newly received old watch packet as a fresh watch reading",()=>{
  const f=fixture();f.start();f.vehicle.eventAt=new Date(now-60000).toISOString();
  for(const offset of [0,5000])expect(applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now+offset),now+offset).alerts).toHaveLength(0);
 });

 it("keeps a confirmed side stable with rapid samples and resets on fence edits",()=>{
  const f=fixture();f.start();let alerts=0;
  for(let i=0;i<10;i++)alerts+=applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now+i*1000),now+i*1000).alerts.length;
  expect(alerts).toBe(1);expect(f.vehicle.geofence).toBe("Outside");
  f.vehicle.geofenceConfig!.version++;
  expect(applyPhoneLocation(f.account,f.vehicle,f.app,f.sample(now+10000),now+10000).alerts).toHaveLength(0);
  expect(f.vehicle.geofence).toBe("Confirming");
 });

});
