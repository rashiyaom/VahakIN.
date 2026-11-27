/** Pure POC state machine. No legal tax determination; phone GPS is not watch GPS. */
export type WalkEvent={id:string;kind:string;at:number;text:string;db?:boolean;sent?:boolean;attempts?:number;nextAttempt?:number};
export type WalkState={session:string;phase:'armed'|'outside'|'returning'|'parked';lastTick:number;lastGps?:number;lastMovement?:string;lastHandling?:boolean;candidate?:{side:string;at:number};side?:string;deadline?:number;quietAt?:number;distanceM:number;chargeableM:number;estimate:number;lastPoint?:{lat:number;lng:number;accuracy:number;at:number};events:WalkEvent[];signal:string;timerExpired?:boolean;sequence:number};
export type WalkConfig={enabled:boolean;session:string;vehicleId:string;ownerId:string;office:string;registration:string;recipient:string;sender:string;origin:string;token:string;expiresAt:number;startedAt:number;radiusM:number;lat:number;lng:number;returnSeconds:number;parkSeconds:number;rate:number};
export function metres(a:number,b:number,c:number,d:number){const r=Math.PI/180,h=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));}
export function initialState(c:WalkConfig):WalkState{return {session:c.session,phase:'armed',lastTick:c.startedAt,distanceM:0,chargeableM:0,estimate:0,events:[],signal:'Waiting for phone and watch',sequence:0};}
export function advance(s:WalkState,c:WalkConfig,v:any,now:number){
 const emit=(kind:string,text:string)=>{s.events.push({id:`WALK-${c.session}-${++s.sequence}`,kind,at:now,text});};
 const elapsed=Math.max(0,now-s.lastTick);s.lastTick=now;
 const watchAt=Date.parse(v.eventAt??''),gpsAt=Date.parse(v.gpsAt??'');
 const watch=['Stationary','Moving'].includes(v.imu?.state)&&Number.isFinite(watchAt)&&now-watchAt<=15000&&now-watchAt>=-2000&&now-Date.parse(v.heartbeat??'')<=15000;
 const gps=Number.isFinite(gpsAt)&&gpsAt>=c.startedAt&&now-gpsAt<=15000&&now-gpsAt>=-2000&&v.locationSource==='PHONE_BROWSER'&&v.gpsStatus==='Phone-provided location'&&v.phoneLocationSession?.expiresAt>now&&Number.isFinite(v.lat)&&Number.isFinite(v.lng)&&v.accuracy<=20;
 if(watch&&v.imu?.movementId&&v.imu.movementId!==s.lastMovement){s.lastMovement=v.imu.movementId;if(v.imu.movementAt>=c.startedAt)emit('movement','Movement detected. Watch IMU reports sustained motion; this may be handling or travel.');}
 if(watch&&v.imu?.handling!==undefined){if(v.imu.handling&&!s.lastHandling)emit('handling','Suspected watch handling. Local siren active; return to the calibrated placement and keep still for 5 seconds.');s.lastHandling=v.imu.handling;}
 if(!watch||!gps){s.signal=!watch?'Watch signal unavailable — timers paused':'Phone location unavailable or inaccurate — timers paused';if(s.deadline)s.deadline+=elapsed;s.quietAt=undefined;s.candidate=undefined;s.lastPoint=undefined;return s;}
 if(elapsed>15000){if(s.deadline)s.deadline+=elapsed;s.quietAt=undefined;s.candidate=undefined;s.lastPoint=undefined;}
 s.signal='Phone GPS + watch IMU current';
 if(gpsAt!==s.lastGps){
  const distance=metres(c.lat,c.lng,v.lat,v.lng),buffer=Math.max(8,v.accuracy);
  const side=distance>c.radiusM+buffer?'outside':distance<c.radiusM-buffer?'inside':'boundary';
  const p=s.lastPoint,segment=p?metres(p.lat,p.lng,v.lat,v.lng):0,seconds=p?(gpsAt-p.at)/1000:0;
  // Reject walking-speed jumps and GPS jitter. Do not count device handling as distance.
  if(p&&seconds>0&&seconds<=15&&segment/seconds<=8&&segment>Math.max(5,(p.accuracy+v.accuracy)/2)&&v.imu?.state==='Moving'){
   s.distanceM+=segment;if(s.timerExpired&&s.phase!=='parked')s.chargeableM+=segment;
  }
  s.lastPoint={lat:v.lat,lng:v.lng,accuracy:v.accuracy,at:gpsAt};s.lastGps=gpsAt;
  if(side==='boundary'){s.candidate=undefined;s.quietAt=undefined;}
  else if(s.candidate?.side===side&&gpsAt-s.candidate.at>=3000&&gpsAt-s.candidate.at<=30000){
   s.side=side;
   if(side==='outside'&&s.phase!=='outside'){s.phase='outside';s.deadline=now+c.returnSeconds*1000;s.quietAt=undefined;s.timerExpired=false;emit('exit',`Outside the ${c.radiusM} m geofence. Return within ${c.returnSeconds/60} minutes. Live phone location is linked below.`);}
   if(side==='inside'&&s.phase==='outside'){s.phase='returning';s.deadline=now+c.parkSeconds*1000;s.timerExpired=false;s.quietAt=undefined;emit('return',`Back inside the geofence. Park within ${c.parkSeconds/60} minutes and keep the watch stationary for 5 seconds.`);}
   s.candidate={side,at:gpsAt};
  }else if(!s.candidate||s.candidate.side!==side||gpsAt-s.candidate.at>30000)s.candidate={side,at:gpsAt};
 }
 if(s.phase==='returning'&&s.side==='inside'&&s.candidate?.side==='inside'&&v.imu?.state==='Stationary'&&v.imu.accelerationG<.06&&v.imu.rotationDps<3){
  s.quietAt??=watchAt;if(watchAt-s.quietAt>=5000){s.phase='parked';s.deadline=undefined;s.timerExpired=false;emit('parked','Parked inside the geofence. Five quiet seconds confirmed; monitoring continues.');}
 }else s.quietAt=undefined;
 if(s.deadline&&now>=s.deadline&&!s.timerExpired){s.timerExpired=true;emit('deadline','Return/parking allowance expired. Demo distance-based assessment is now active; this is not a legal fine.');}
 s.estimate=Math.round(s.chargeableM/1000*c.rate*100)/100;return s;
}
