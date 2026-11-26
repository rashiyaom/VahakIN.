import { syncTaxEvidence } from "./tax-service";
import type { DemoEvent,DemoStore,Vehicle } from "./demo-store";
// Demo rule only: a 150m circle, 30m quality threshold, two consecutive fixes.
// Device-authenticated ingestion and authoritative geofences remain separate integrations.
function distance(a:number,b:number,c:number,d:number){const rad=Math.PI/180;const x=Math.sin((c-a)*rad/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
export function ingestDemoEvent(store:DemoStore,event:DemoEvent){
 const events=store.events??(store.events=[]);const duplicate=events.find(e=>e.id===event.id);if(duplicate){const keys=["deviceId","vehicleId","eventAt","gpsAt","lat","lng","accuracy","speed","battery","motion","tamper","source","ruleVersion"] as const;const same=keys.every(key=>duplicate[key]===event[key]); if(!same)throw new Error("Event identity conflict");return {duplicate:true,alert:false};}
 const vehicle=store.vehicles.find(v=>v.id===event.vehicleId&&v.deviceId===event.deviceId);if(!vehicle)throw new Error("No matching device assignment");
 if(!Number.isFinite(Date.parse(event.eventAt))||Date.parse(event.eventAt)>Date.now()+1000)throw new Error("Invalid observation timestamp");
 if(event.lat!==null&&(event.lat < -90 || event.lat > 90 || !Number.isFinite(event.lat)))throw new Error("Invalid latitude");
 if(event.lng!==null&&(event.lng < -180 || event.lng > 180 || !Number.isFinite(event.lng)))throw new Error("Invalid longitude");
 if((event.lat===null)!==(event.lng===null))throw new Error("Incomplete GPS coordinates");
 if(event.battery!==null&&(!Number.isFinite(event.battery)||event.battery<0||event.battery>100))throw new Error("Invalid battery measurement");
 if(event.accuracy!==null&&(!Number.isFinite(event.accuracy)||event.accuracy<0))throw new Error("Invalid GPS accuracy");
 events.push({...event});
 if(store.tax)syncTaxEvidence(store);
 vehicle.heartbeat=event.receivedAt;
 const newer=!vehicle.eventAt||Date.parse(event.eventAt)>Date.parse(vehicle.eventAt);
 if(newer){vehicle.eventAt=event.eventAt;vehicle.receivedAt=event.receivedAt;vehicle.processedAt=event.processedAt;vehicle.motion=event.motion;vehicle.battery=event.battery;vehicle.tamper=event.tamper?"Suspected tampering":"Secure";vehicle.gpsStatus=event.lat===null||event.lng===null?"Unavailable":"Valid fix";}
 const valid=event.lat!==null&&event.lng!==null&&event.gpsAt!==null&&event.accuracy!==null&&event.accuracy<=30;
 if(valid&&(!vehicle.gpsAt||Date.parse(event.gpsAt!)>Date.parse(vehicle.gpsAt))){vehicle.lat=event.lat;vehicle.lng=event.lng;vehicle.gpsAt=event.gpsAt;vehicle.accuracy=event.accuracy;vehicle.speed=event.speed;vehicle.geofence=vehicle.parkingLat!=null&&vehicle.parkingLng!=null?(distance(vehicle.parkingLat,vehicle.parkingLng,event.lat!,event.lng!)>150+event.accuracy!?"Outside":"Inside"):"Unknown";}
 const inDeclaration=vehicle.declarationStatus==="Active"&&Date.parse(event.eventAt)>=Date.parse(vehicle.startsAt)&&Date.parse(event.eventAt)<=Date.parse(vehicle.endsAt);
 const previous=events.filter(e=>e.vehicleId===vehicle.id&&e.id!==event.id&&Date.parse(e.eventAt)<Date.parse(event.eventAt)).sort((a,b)=>Date.parse(b.eventAt)-Date.parse(a.eventAt))[0];
 const outside=(e:DemoEvent)=>e.lat!==null&&e.lng!==null&&e.accuracy!==null&&e.accuracy<=30&&vehicle.parkingLat!=null&&vehicle.parkingLng!=null&&distance(vehicle.parkingLat,vehicle.parkingLng,e.lat,e.lng)>150+e.accuracy;
 const movement=valid&&outside(event)&&previous&&outside(previous)&&Date.parse(event.eventAt)-Date.parse(previous.eventAt)<=60000&&event.motion==="Moving";
 if(inDeclaration&&(movement||event.tamper)&&!store.alerts.some(a=>a.vehicleId===vehicle.id&&a.title===(event.tamper?"Simulated enclosure tamper":"Simulated geofence exit")&&a.status!=="Resolved")){
  const title=event.tamper?"Simulated enclosure tamper":"Simulated geofence exit";
  store.alerts.push({id:`ALT-SIM-${event.id.slice(-8)}`,vehicleId:vehicle.id,title,description:event.tamper?"Simulated tamper signal. Physical inspection is required.":"Two quality-accepted simulated fixes lie beyond the 150 m demo parking boundary. This is a signal for review, not a violation determination.",severity:event.tamper?"Critical":"High",status:"New",occurredAt:event.eventAt,receivedAt:event.receivedAt,evidence:movement?[previous.id,event.id]:[event.id],assignee:null,acknowledgedAt:null});vehicle.review="Review required";return {duplicate:false,alert:true};
 }return {duplicate:false,alert:false};
}
export function scenarioEvents(vehicle:Vehicle,scenario:string,requestId:string):DemoEvent[]{
 const now=Date.now();const lat=vehicle.parkingLat??vehicle.lat,lng=vehicle.parkingLng??vehicle.lng;
 if(lat===null||lat===undefined||lng===null||lng===undefined)throw new Error("This device has no simulated parking coordinates.");
 const samples=scenario==="movement"?2:1;
 return Array.from({length:samples},(_,i)=>{const eventAt=new Date(now-(scenario==="delayed"?3600000:(samples-i)*5000)).toISOString();return {id:`${requestId}-${i}`,deviceId:vehicle.deviceId,vehicleId:vehicle.id,eventAt,gpsAt:scenario==="gps_unavailable"?null:eventAt,receivedAt:new Date(now).toISOString(),processedAt:new Date(now).toISOString(),lat:scenario==="gps_unavailable"?null:lat+(scenario==="movement"?.006+i*.001:0),lng:scenario==="gps_unavailable"?null:lng,accuracy:scenario==="gps_unavailable"?null:8,speed:scenario==="gps_unavailable"?null:scenario==="movement"?18:0,battery:vehicle.battery,motion:scenario==="gps_unavailable"?"Unknown":scenario==="movement"?"Moving":"Stationary",tamper:scenario==="tamper",source:"SIMULATOR",ruleVersion:"demo-geofence-v1"};});
}
