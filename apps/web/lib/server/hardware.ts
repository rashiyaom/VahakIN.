import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Vehicle, Alert } from "./demo-store";
import type { EnrollmentApplication } from "../enrollment/types";
import { distanceMetres, type HardwareReading } from "../monitoring";

const finite = z.number().finite();
export const hardwareSchema = z.object({
  deviceId: z.string().regex(/^IG-[A-Z0-9-]{4,80}$/), timestamp: finite.int().positive(), nonce: z.string().uuid(),
  firmware: z.enum(["hotspot-imu-1.0.0", "plus-watch-1.0.0"]), uptimeMs: finite.int().nonnegative().max(4294967295),
  imu: z.object({ state: z.enum(["Calibrating", "Stationary", "Moving", "Sensor fault"]), accelerationG: finite.min(0).max(16), rotationDps: finite.min(0).max(2000), qualifiedMotionMs: finite.int().min(0).max(60000), movementId: z.string().uuid().nullable(), movementAt: finite.int().positive().nullable() }).strict(),
  gps: z.object({ lat: finite.min(-90).max(90), lng: finite.min(-180).max(180), hdop: finite.min(0.1).max(99), satellites: finite.int().min(0).max(99), fixAt: finite.int().positive() }).strict().nullable(),
}).strict().superRefine((v,ctx)=>{
  if ((v.imu.movementId === null) !== (v.imu.movementAt === null)) ctx.addIssue({code:"custom",message:"Incomplete movement evidence"});
  if (v.imu.movementAt && (v.imu.movementAt > v.timestamp || v.imu.qualifiedMotionMs < 1500)) ctx.addIssue({code:"custom",message:"Invalid movement evidence"});
  if (v.imu.state === "Moving" && !v.imu.movementId) ctx.addIssue({code:"custom",message:"Movement requires sustained evidence"});
  if (v.gps && v.gps.fixAt > v.timestamp) ctx.addIssue({code:"custom",message:"Future GPS fix"});
});
export function validHardwareSignature(bytes: Buffer, signature: string, secret: string, timestamp: number, now=Date.now()) {
  return /^[a-f0-9]{64}$/.test(signature) && Math.abs(now-timestamp)<=300000 && timingSafeEqual(Buffer.from(signature,"hex"),createHmac("sha256",secret).update(bytes).digest());
}
export function applyHardwareReading(vehicle: Vehicle, app: EnrollmentApplication, reading: HardwareReading, now=Date.now()): Alert[] {
  const receivedAt=new Date(now).toISOString(), observedAt=new Date(reading.timestamp).toISOString();
  const alerts: Alert[]=[];
  vehicle.heartbeat=receivedAt;
  // Delayed signed packets remain evidence, but cannot rewind the current state.
  if (vehicle.eventAt && Date.parse(vehicle.eventAt)>=reading.timestamp) return alerts;
  const mounted=app.status==="Approved" && !!app.ownerMountedAt && Date.parse(app.ownerMountedAt)<=reading.timestamp;
  const fresh=now-reading.timestamp<=30000;
  vehicle.eventAt=observedAt; vehicle.receivedAt=receivedAt; vehicle.processedAt=receivedAt;
  vehicle.firmware=reading.firmware; vehicle.telemetrySource="HARDWARE_DEMO";
  vehicle.imu={...reading.imu};
  vehicle.motion=mounted && fresh && !["Calibrating","Sensor fault"].includes(reading.imu.state) ? reading.imu.state : "Unknown";
  const addAlert=(id:string,title:string,description:string,evidence:string[])=>{
    alerts.push({id,vehicleId:vehicle.id,title,description,severity:"High",status:"New",occurredAt:observedAt,receivedAt,evidence,assignee:null,acknowledgedAt:null});
    vehicle.review="Review required";
  };
  const m=reading.imu;
  if (mounted && m.movementId && m.movementAt!>=Date.parse(app.ownerMountedAt!) && m.movementId!==vehicle.lastMovementId) {
    vehicle.lastMovementId=m.movementId; vehicle.lastMovementAt=new Date(m.movementAt!).toISOString();
    addAlert(`IMU-${reading.deviceId}-${m.movementId}`,"Sustained device movement detected","Physical IMU motion after dashboard mounting. This may indicate vehicle movement or device handling; GPS displacement is separate evidence. Hardware demonstration, not a violation determination.",[reading.nonce,m.movementId]);
  }
  // Plus has no GNSS module: its signed IMU heartbeat cannot erase phone-sourced location.
  if (vehicle.deviceTier === "PLUS") return alerts;
  const gps=reading.gps;
  const quality=!!gps && now-gps.fixAt<=15000 && reading.timestamp-gps.fixAt<=10000 && gps.hdop<=2.5 && gps.satellites>=5;
  if (!quality) { vehicle.gpsStatus="Unavailable"; vehicle.geofence="Unknown"; vehicle.fenceCandidate=undefined; return alerts; }
  if (vehicle.gpsAt && Date.parse(vehicle.gpsAt)>=gps!.fixAt) return alerts;
  vehicle.locationSource="DEVICE_GPS";
  vehicle.lat=gps!.lat; vehicle.lng=gps!.lng; vehicle.gpsAt=new Date(gps!.fixAt).toISOString(); vehicle.gpsStatus="Valid fix";
  vehicle.accuracy=null; vehicle.speed=null; // HDOP is not a metre-accuracy or speed measurement.
  const fence=vehicle.geofenceConfig;
  if (!fence?.enabled) { vehicle.geofence="Unknown"; vehicle.fenceCandidate=undefined; return alerts; }
  const distance=distanceMetres(fence.lat,fence.lng,gps!.lat,gps!.lng);
  vehicle.fenceDistanceM=Math.round(distance);
  // A 25 m dead band, two fresh fixes at least 3 s apart, and the same fence version.
  const side=distance>fence.radiusM+25?"Outside":distance<Math.max(0,fence.radiusM-25)?"Inside":"Boundary";
  if (side==="Boundary") { vehicle.fenceCandidate=undefined; vehicle.geofence="Boundary"; return alerts; }
  const previous=vehicle.fenceCandidate;
  if(previous?.side===side&&previous.version===fence.version&&gps!.fixAt-previous.at<3000)return alerts;
  if (previous?.side===side && previous.version===fence.version && gps!.fixAt-previous.at>=3000 && gps!.fixAt-previous.at<=30000) {
    const transition=vehicle.geofence!==side;
    vehicle.geofence=side;
    if (mounted && side==="Outside" && transition) addAlert(`GPS-${reading.deviceId}-${reading.nonce}`,"GPS geofence exit detected",`Two quality-accepted NEO-6M fixes are beyond the ${fence.radiusM} m parking boundary plus a 25 m buffer. Review this hardware demonstration evidence; it does not determine a violation.`,[previous.nonce,reading.nonce]);
  } else vehicle.geofence="Confirming";
  if(!previous||previous.side!==side||previous.version!==fence.version||gps!.fixAt-previous.at>=3000)vehicle.fenceCandidate={side,at:gps!.fixAt,nonce:reading.nonce,version:fence.version};
  return alerts;
}
