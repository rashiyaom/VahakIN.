"use client";
import { useEffect, useRef, useState } from "react";

export function PhoneLocationSharing({vehicleId}:{vehicleId:string}) {
  const [consent,setConsent]=useState(false),[active,setActive]=useState(false),[status,setStatus]=useState("Phone location sharing is off.");
  const session=useRef<string|null>(null),generation=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const stopRef=useRef<()=>void>(()=>{});
  async function send(body:Record<string,unknown>,keepalive=false){
    const response=await fetch("/api/devices/phone-location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,vehicleId}),keepalive});
    const data=await response.json();if(!response.ok)throw new Error(data.error??"Location could not be saved.");return data as {sessionId:string,status:string};
  }
  function stop(message="Phone sharing stopped."){
    generation.current++;if(timer.current)clearTimeout(timer.current);timer.current=null;
    const id=session.current;session.current=null;setActive(false);setStatus(message);
    if(id)void send({action:"stop",sessionId:id},true).catch(()=>{/* Server lease and freshness checks also expire sharing. */});
  }
  stopRef.current=()=>stop();
  useEffect(()=>{
    const hidden=()=>{if(document.visibilityState==="hidden")stopRef.current();};
    const leaving=()=>stopRef.current();
    document.addEventListener("visibilitychange",hidden);window.addEventListener("pagehide",leaving);
    return ()=>{document.removeEventListener("visibilitychange",hidden);window.removeEventListener("pagehide",leaving);stopRef.current();};
  },[vehicleId]);
  async function start(){
    if(!consent)return;
    if(!window.isSecureContext||!navigator.geolocation){setStatus("Open this page on your phone using trusted HTTPS to share location. A laptop's plain HTTP address cannot request phone location.");return;}
    const run=++generation.current;setActive(true);setStatus("Starting phone sharing…");
    try {
      const data=await send({action:"start",coLocated:true});
      if(run!==generation.current){void send({action:"stop",sessionId:data.sessionId},true).catch(()=>{});return;}
      session.current=data.sessionId;
      const sample=()=>{
        if(run!==generation.current)return;
        navigator.geolocation.getCurrentPosition(async position=>{
          if(run!==generation.current)return;
          try{
            const result=await send({action:"sample",sessionId:data.sessionId,nonce:crypto.randomUUID(),timestamp:Math.round(position.timestamp),lat:position.coords.latitude,lng:position.coords.longitude,accuracy:position.coords.accuracy});
            if(run===generation.current)setStatus(result.status);
          }catch(error){if(run===generation.current)stop(error instanceof Error?error.message:"Sharing failed. Start again.");}
          if(run===generation.current)timer.current=setTimeout(sample,5000);
        },error=>{
          if(run!==generation.current)return;
          if(error.code===1){stop("Location permission denied. Allow location in your phone browser, then try again.");return;}
          setStatus("Waiting for an accurate phone location. Keep this page open and try outdoors.");
          timer.current=setTimeout(sample,5000);
        },{enableHighAccuracy:true,maximumAge:0,timeout:10000});
      };
      sample();
    }catch(error){if(run===generation.current)stop(error instanceof Error?error.message:"Unable to start sharing.");}
  }
  return <div style={{padding:16,border:"1px solid var(--border, #ddd)",borderRadius:12,marginTop:12}}><h4>Plus · phone location</h4><p>First confirm dashboard mounting in your application. The watch supplies motion readings. Your phone supplies the map position while this page is open. Sharing stops when you leave or hide this page.</p><label style={{display:"flex",gap:8,alignItems:"flex-start",marginBlock:12}}><input type="checkbox" checked={consent} disabled={active} onChange={e=>setConsent(e.target.checked)}/>I am using my phone beside the watch mounted on the car dashboard, and I agree to share this phone’s location for the demonstration.</label><button type="button" className="small-button primary" disabled={!consent&&!active} onClick={()=>active?stop():void start()}>{active?"Stop sharing phone location":"Share phone location"}</button><p role="status" aria-live="polite">{status}</p></div>;
}
