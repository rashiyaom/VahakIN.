import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EnrollmentError } from "./enrollment";
import type { Account } from "../permissions/access";
import type { Vehicle, Alert } from "./demo-store";
import type { EnrollmentApplication } from "../enrollment/types";
import { distanceMetres } from "../monitoring";

const id=z.string().uuid(), finite=z.number().finite();
export const phoneLocationSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("start"),vehicleId:z.string().max(100),coLocated:z.literal(true)}).strict(),
  z.object({action:z.literal("stop"),vehicleId:z.string().max(100),sessionId:id}).strict(),
  z.object({action:z.literal("sample"),vehicleId:z.string().max(100),sessionId:id,nonce:id,timestamp:finite.int().positive(),lat:finite.min(-90).max(90),lng:finite.min(-180).max(180),accuracy:finite.min(0).max(100000)}).strict(),
]);
export type PhoneLocationInput=z.infer<typeof phoneLocationSchema>;
export function applyPhoneLocation(account:Account,vehicle:Vehicle,app:EnrollmentApplication,input:PhoneLocationInput,now=Date.now()) {
  if(account.status!=="Active"||account.role!=="vehicle_owner"||vehicle.ownerId!==account.id||app.ownerId!==account.id)throw new EnrollmentError("Only this vehicle's owner may share phone location.",403);
  if(vehicle.deviceTier!=="PLUS"||!vehicle.ownerVerified||app.status!=="Approved"||!app.ownerMountedAt||app.vehicleId!==vehicle.id)throw new EnrollmentError("An approved Plus device and dashboard mounting confirmation are required.",409);
  const alerts:Alert[]=[];
  if(input.action==="start") {
    vehicle.phoneLocationSession={id:randomUUID(),ownerId:account.id,expiresAt:now+60000};
    vehicle.fenceCandidate=undefined;vehicle.geofence="Unknown";vehicle.gpsStatus="Unavailable";
    return {sessionId:vehicle.phoneLocationSession.id,alerts,status:"Waiting for phone location"};
  }
  const session=vehicle.phoneLocationSession;
  if(!session||session.id!==input.sessionId||session.ownerId!==account.id)throw new EnrollmentError("This sharing session was replaced or stopped. Start sharing again.",409);
  if(input.action==="stop") {
    vehicle.phoneLocationSession=undefined;vehicle.gpsStatus="Unavailable";vehicle.geofence="Unknown";vehicle.fenceCandidate=undefined;
    return {sessionId:session.id,alerts,status:"Phone sharing stopped"};
  }
  if(session.expiresAt<now)throw new EnrollmentError("Phone sharing expired. Start sharing again.",409);
  if(now-input.timestamp>15000||input.timestamp>now+2000)throw new EnrollmentError("Phone location is stale or its clock is incorrect.",422);
  if(vehicle.gpsAt&&Date.parse(vehicle.gpsAt)>=input.timestamp)return {sessionId:session.id,alerts,status:"Repeated or older location ignored"};
  session.expiresAt=now+60000;
  vehicle.locationSource="PHONE_BROWSER";
  vehicle.lat=input.lat;vehicle.lng=input.lng;vehicle.accuracy=input.accuracy;vehicle.gpsAt=new Date(input.timestamp).toISOString();
  if(input.accuracy>30) {
    vehicle.gpsStatus="Unavailable";vehicle.geofence="Unknown";vehicle.fenceCandidate=undefined;
    return {sessionId:session.id,alerts,status:`Approximate phone position (±${Math.round(input.accuracy)} m) shown on map; move outdoors for geofence accuracy`};
  }
  vehicle.lat=input.lat;vehicle.lng=input.lng;vehicle.accuracy=input.accuracy;vehicle.gpsAt=new Date(input.timestamp).toISOString();vehicle.gpsStatus="Phone-provided location";vehicle.speed=null;
  // Never turn a phone fix into a device heartbeat or claim the watch itself has GPS.
  const fence=vehicle.geofenceConfig;
  if(!fence?.enabled){vehicle.geofence="Unknown";return {sessionId:session.id,alerts,status:"Phone location received; no geofence enabled"};}
  const distance=distanceMetres(fence.lat,fence.lng,input.lat,input.lng),buffer=Math.max(fence.radiusM<=75?8:25,input.accuracy);
  vehicle.fenceDistanceM=Math.round(distance);
  const side=distance>fence.radiusM+buffer?"Outside":distance<Math.max(0,fence.radiusM-buffer)?"Inside":"Boundary";
  if(side==="Boundary"){vehicle.geofence=side;vehicle.fenceCandidate=undefined;return {sessionId:session.id,alerts,status:"Phone is near the boundary; exit not established"};}
  const previous=vehicle.fenceCandidate;
  const watchOnline=!!vehicle.heartbeat&&now-Date.parse(vehicle.heartbeat)<=30000&&!!vehicle.eventAt&&now-Date.parse(vehicle.eventAt)<=30000;
  if(!watchOnline){
    vehicle.geofence="Unknown";vehicle.fenceCandidate=undefined;
    return {sessionId:session.id,alerts,status:"Phone location received; watch offline, no vehicle alert created"};
  }
  if(previous?.side===side&&previous.version===fence.version&&input.timestamp-previous.at<3000)return {sessionId:session.id,alerts,status:`Phone location received · ${vehicle.geofence}`};
  if(previous?.side===side&&previous.version===fence.version&&input.timestamp-previous.at>=3000&&input.timestamp-previous.at<=30000){
    const transition=vehicle.geofence!==side;vehicle.geofence=side;
    if(transition&&side==="Outside"&&watchOnline){
      alerts.push({id:`PHONE-${input.nonce}`,vehicleId:vehicle.id,title:"Phone location outside parking geofence",description:"Two owner-shared phone positions are outside the parking circle while the Plus watch is online. This is phone-provided demonstration evidence, not GPS measured by the watch or proof that the vehicle moved.",severity:"High",status:"New",occurredAt:new Date(input.timestamp).toISOString(),receivedAt:new Date(now).toISOString(),evidence:[previous.nonce,input.nonce],assignee:null,acknowledgedAt:null});
      vehicle.review="Review required";
    }
  }else vehicle.geofence="Confirming";
  // Preserve the first fix if a caller samples too frequently to meet the 3 s gate.
  if(!previous||previous.side!==side||previous.version!==fence.version||input.timestamp-previous.at>=3000)vehicle.fenceCandidate={side,at:input.timestamp,nonce:input.nonce,version:fence.version};
  return {sessionId:session.id,alerts,status:watchOnline?`Phone location received · ${vehicle.geofence}`:"Phone location received; watch offline, no vehicle alert created"};
}
