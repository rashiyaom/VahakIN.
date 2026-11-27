"use client";
import {useEffect,useState} from 'react';
class SharingError extends Error {constructor(message:string,public code:number){super(message);}}
export function PhoneLocationSharing({vehicleId}:{vehicleId:string}){
 const [consent,setConsent]=useState(false),[active,setActive]=useState(false),[status,setStatus]=useState('Phone location sharing is off.');
 useEffect(()=>{
  if(!active)return;
  let disposed=false,session:string|null=null,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined,wake:WakeLockSentinel|null=null,busy=false,failures=0;
  async function send(body:Record<string,unknown>){
   const requestController=new AbortController();controller=requestController;const timeout=setTimeout(()=>requestController.abort(),12000);
   try{const r=await fetch('/api/devices/phone-location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,vehicleId}),signal:requestController.signal});const d=await r.json();if(!r.ok)throw new SharingError(d.error??'Location upload failed',r.status);return d as {sessionId:string;status:string};}finally{clearTimeout(timeout);if(controller===requestController)controller=undefined;}
  }
  function schedule(ms=3000){clearTimeout(timer);if(!disposed)timer=setTimeout(tick,ms);}
  function position():Promise<GeolocationPosition>{return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(new SharingError('GPS is taking longer than expected. Retrying…',0)),15000);
   navigator.geolocation.getCurrentPosition(p=>{clearTimeout(timeout);resolve(p);},e=>{clearTimeout(timeout);reject(new SharingError(e.code===1?'Location permission denied. Enable precise location, then start again.':'Waiting for GPS. Move outdoors; retrying…',e.code===1?403:0));},{enableHighAccuracy:true,maximumAge:2000,timeout:10000});
  });}
  function requestWake(){if('wakeLock' in navigator&&!wake&&document.visibilityState==='visible')void navigator.wakeLock.request('screen').then(w=>{if(disposed||document.visibilityState!=='visible')void w.release();else{wake=w;w.addEventListener('release',()=>{if(wake===w)wake=null;});}}).catch(()=>{});}
  async function tick(){
   if(disposed||busy)return;
   if(document.visibilityState==='hidden'){setStatus('Paused while this page is hidden. Sharing resumes when you return.');return;}
   if(!navigator.onLine){setStatus('Internet disconnected. Waiting to reconnect…');schedule(3000);return;}
   busy=true;
   try{
    requestWake();
    if(!session){setStatus('Connecting location session…');const d=await send({action:'start',coLocated:true});session=d.sessionId;}
    if(disposed)return;
    setStatus('Getting a fresh GPS fix…');const p=await position();
    if(disposed||String(document.visibilityState)==='hidden')return;
    if(Date.now()-p.timestamp>15000){setStatus('GPS fix is old. Requesting a fresh position…');return;}
    setStatus(`Uploading phone GPS · accuracy ±${Math.round(p.coords.accuracy)} m…`);
    const d=await send({action:'sample',sessionId:session,nonce:crypto.randomUUID(),timestamp:Math.round(p.timestamp),lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});
    failures=0;if(!disposed)setStatus(`${d.status} · updated ${new Date().toLocaleTimeString()}`);
   }catch(e){
    if(disposed)return;
    if(e instanceof SharingError&&[401,403].includes(e.code)){setStatus(e.message);setActive(false);return;}
    if(e instanceof SharingError&&e.code===409){
     if(/expired/i.test(e.message)){session=null;setStatus('Renewing expired location session…');}
     else{setStatus(e.message);setActive(false);return;}
    }else{failures++;setStatus(e instanceof SharingError?`${e.message} Automatic retry enabled.`:'Connection interrupted. Retrying automatically…');}
   }finally{busy=false;if(!disposed)schedule(Math.min(15000,3000*Math.max(1,failures)));}
  }
  const visibility=()=>{if(document.visibilityState==='hidden'){clearTimeout(timer);void wake?.release();wake=null;setStatus('Paused while this page is hidden. Sharing resumes when you return.');}else{requestWake();if(!busy)void tick();}};
  const online=()=>{if(!busy)void tick();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('online',online);void tick();
  return()=>{disposed=true;clearTimeout(timer);controller?.abort();void wake?.release();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',online);if(session)void fetch('/api/devices/phone-location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'stop',vehicleId,sessionId:session}),keepalive:true}).catch(()=>{});};
 },[active,vehicleId]);
 function start(){if(!window.isSecureContext||!navigator.geolocation){setStatus('Open this page through trusted HTTPS on the walking phone.');return;}setActive(true);}
 return <div style={{padding:16,border:'1px solid var(--border, #ddd)',borderRadius:12,marginTop:12}}><h4>Plus · phone location</h4><p>The watch provides IMU readings; this phone provides GPS. Keep this page visible for continuous tracking. Temporary connection failures retry automatically. Switching apps pauses browser GPS; returning here resumes sharing. Screen wake lock is requested where supported.</p><label style={{display:'flex',gap:8,alignItems:'flex-start',marginBlock:12}}><input type="checkbox" checked={consent} disabled={active} onChange={e=>setConsent(e.target.checked)}/>I am keeping this phone beside the paired watch and consent to location sharing for this demonstration.</label><button type="button" className="small-button primary" disabled={!consent&&!active} onClick={()=>active?(setActive(false),setStatus('Phone sharing stopped.')):start()}>{active?'Stop sharing phone location':'Share phone location'}</button><p role="status" aria-live="polite">{status}</p></div>;
}
