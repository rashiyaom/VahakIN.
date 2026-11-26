import { describe, it, expect } from "vitest";
import { randomUUID,createHmac } from "node:crypto";
import { applyHardwareReading, hardwareSchema, validHardwareSignature } from "../../lib/server/hardware";
import type { Vehicle } from "../../lib/server/demo-store";
import type { EnrollmentApplication } from "../../lib/enrollment/types";
import type { HardwareReading } from "../../lib/monitoring";
const now=Date.now();
function fixture(){
  const vehicle={id:"v-test",deviceId:"IG-DEMO-0001",geofence:"Unknown",geofenceConfig:{enabled:true,lat:22.3,lng:70.8,radiusM:150,version:1,updatedAt:new Date(now).toISOString()}} as Vehicle;
  const app={status:"Approved",ownerMountedAt:new Date(now-10000).toISOString()} as EnrollmentApplication;
  const reading:HardwareReading={deviceId:vehicle.deviceId,timestamp:now,nonce:randomUUID(),firmware:"hotspot-imu-1.0.0",uptimeMs:30000,imu:{state:"Stationary",accelerationG:.01,rotationDps:.2,qualifiedMotionMs:0,movementId:null,movementAt:null},gps:null};
  return {vehicle,app,reading};
}
describe("signed hardware demo",()=>{
  it("requires exact-body signatures and a fresh authenticated timestamp",()=>{
    const bytes=Buffer.from('{"deviceId":"IG-DEMO-0001"}'),key="a".repeat(64),sig=createHmac("sha256",key).update(bytes).digest("hex");
    expect(validHardwareSignature(bytes,sig,key,now,now)).toBe(true);
    expect(validHardwareSignature(Buffer.concat([bytes,Buffer.from(" ")]),sig,key,now,now)).toBe(false);
    expect(validHardwareSignature(bytes,sig,key,now-300001,now)).toBe(false);
    expect(validHardwareSignature(bytes,"bad",key,now,now)).toBe(false);
  });
  it("rejects unqualified moving packets and impossible sensor values",()=>{
    const {reading}=fixture();expect(hardwareSchema.safeParse(reading).success).toBe(true);
    expect(hardwareSchema.safeParse({...reading,imu:{...reading.imu,state:"Moving"}}).success).toBe(false);
    expect(hardwareSchema.safeParse({...reading,imu:{...reading.imu,accelerationG:NaN}}).success).toBe(false);
    expect(hardwareSchema.safeParse({...reading,imu:{...reading.imu,movementId:randomUUID(),movementAt:now,qualifiedMotionMs:100}}).success).toBe(false);
  });
  it("keeps bumps quiet, records sustained motion once, and never invents GPS",()=>{
    const {vehicle,app,reading}=fixture();expect(applyHardwareReading(vehicle,app,reading,now)).toHaveLength(0);
    reading.timestamp+=5000;reading.imu={...reading.imu,state:"Moving",qualifiedMotionMs:1600,movementId:randomUUID(),movementAt:now+4000};
    expect(applyHardwareReading(vehicle,app,reading,now+5000)).toHaveLength(1);
    expect(vehicle.gpsStatus).toBe("Unavailable");expect(vehicle.geofence).toBe("Unknown");expect(vehicle.lat).toBeUndefined();
    reading.timestamp+=5000;expect(applyHardwareReading(vehicle,app,reading,now+10000)).toHaveLength(0);
  });
  it("ignores handling before mounting and delayed state replacement",()=>{
    const {vehicle,app,reading}=fixture();reading.imu={...reading.imu,state:"Moving",qualifiedMotionMs:1600,movementId:randomUUID(),movementAt:now-15000};
    expect(applyHardwareReading(vehicle,app,reading,now)).toHaveLength(0);
    vehicle.eventAt=new Date(now+1000).toISOString();vehicle.motion="Stationary";
    applyHardwareReading(vehicle,app,reading,now);expect(vehicle.motion).toBe("Stationary");
    delete app.ownerMountedAt;reading.timestamp+=5000;applyHardwareReading(vehicle,app,reading,now+5000);expect(vehicle.motion).toBe("Unknown");
  });
  it("requires distinct quality GPS fixes beyond the dead band for a geofence exit",()=>{
    const {vehicle,app,reading}=fixture();reading.gps={lat:22.303,lng:70.8,hdop:1.2,satellites:7,fixAt:now};
    expect(applyHardwareReading(vehicle,app,reading,now)).toHaveLength(0);expect(vehicle.geofence).toBe("Confirming");
    reading.timestamp+=5000;reading.nonce=randomUUID();reading.gps.fixAt+=5000;
    expect(applyHardwareReading(vehicle,app,reading,now+5000)).toHaveLength(1);expect(vehicle.geofence).toBe("Outside");
    reading.timestamp+=5000;reading.gps.fixAt+=5000;
    expect(applyHardwareReading(vehicle,app,reading,now+10000)).toHaveLength(0);
    reading.timestamp+=5000;reading.gps.hdop=4;
    expect(applyHardwareReading(vehicle,app,reading,now+15000)).toHaveLength(0);expect(vehicle.geofence).toBe("Unknown");
  });
  it("does not count repeated GPS timestamps, old fixes or near-edge jitter",()=>{
    const {vehicle,app,reading}=fixture();reading.gps={lat:22.30135,lng:70.8,hdop:1,satellites:8,fixAt:now};
    expect(applyHardwareReading(vehicle,app,reading,now)).toHaveLength(0);expect(vehicle.geofence).toBe("Boundary");
    reading.timestamp+=5000;expect(applyHardwareReading(vehicle,app,reading,now+5000)).toHaveLength(0);
    reading.timestamp+=20000;applyHardwareReading(vehicle,app,reading,now+25000);expect(vehicle.geofence).toBe("Unknown");
  });
  it("can confirm a geofence with GPS fixes arriving every second",()=>{
    const {vehicle,app,reading}=fixture();let alerts=0;
    for(let i=0;i<10;i++){
      reading.timestamp=now+i*1000;reading.nonce=randomUUID();reading.gps={lat:22.303,lng:70.8,hdop:1.2,satellites:7,fixAt:reading.timestamp};
      alerts+=applyHardwareReading(vehicle,app,reading,reading.timestamp).length;
    }
    expect(alerts).toBe(1);expect(vehicle.geofence).toBe("Outside");
  });

});
