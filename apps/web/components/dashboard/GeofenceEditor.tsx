"use client";
import { useState } from "react";
import type { WorkspaceData } from "@/lib/server/workspace";
export function GeofenceEditor({vehicles,onSaved}:{vehicles:WorkspaceData["vehicles"];onSaved:()=>Promise<unknown>}) {
  const [id,setId]=useState(vehicles[0]?.id??""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const vehicle=vehicles.find(v=>v.id===id)??vehicles[0];
  if(!vehicle) return null;
  const f=vehicle.geofenceConfig;
  return <section className="dashboard-panel" style={{padding:24}}><h2 style={{fontSize:24,marginBottom:12}}>Parking geofence</h2><p>Choose the parked vehicle’s centre and radius. {vehicle.deviceTier==="PLUS"?"Plus uses two owner-shared phone positions and a fresh watch reading. The boundary buffer is at least 25 m and expands with reported phone accuracy. Alerts identify phone-provided evidence.":"Basic uses two fresh NEO-6M fixes beyond the circle plus a 25 m buffer."} Small movement and location jitter near the edge do not establish an exit.</p>
    <label style={{display:"grid",gap:8,maxWidth:480,marginBlock:16}}>Vehicle<select style={{padding:10,border:"1px solid var(--border, #ccc)",borderRadius:8}} value={vehicle.id} onChange={e=>{setId(e.target.value);setNotice("");}}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.registration}</option>)}</select></label>
    <form key={`${vehicle.id}:${f?.version??0}`} className="workflow-form" onSubmit={async e=>{
      e.preventDefault(); const data=new FormData(e.currentTarget);setBusy(true);setNotice("");
      try {const response=await fetch("/api/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"geofence",vehicleId:vehicle.id,version:f?.version??0,enabled:data.get("enabled")==="on",lat:Number(data.get("lat")),lng:Number(data.get("lng")),radiusM:Number(data.get("radiusM"))})});const result=await response.json();if(!response.ok)throw new Error(result.error);await onSaved();setNotice("Geofence saved. Waiting for fresh location evidence.");}catch(e){setNotice(e instanceof Error?e.message:"Unable to save geofence.");}finally{setBusy(false);}
    }}><fieldset disabled={busy} style={{border:0,padding:0}}><div className="form-columns"><label>Parking latitude<input name="lat" type="number" step="any" min="-85" max="85" required defaultValue={f?.lat??vehicle.parkingLat??""}/></label><label>Parking longitude<input name="lng" type="number" step="any" min="-180" max="180" required defaultValue={f?.lng??vehicle.parkingLng??""}/></label><label>Radius (metres)<input name="radiusM" type="number" min="50" max="5000" required defaultValue={f?.radiusM??150}/></label></div><label style={{display:"flex",alignItems:"center",gap:10,marginBlock:18}}><input style={{width:18,height:18}} name="enabled" type="checkbox" defaultChecked={f?.enabled??true}/> Enable parking geofence</label><button type="submit" className="small-button primary">{busy?"Saving…":"Save geofence"}</button></fieldset></form><p role="status">{notice}</p>
  </section>;
}
