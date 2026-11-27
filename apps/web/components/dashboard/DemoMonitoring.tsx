"use client";
import {useMemo,useState} from "react";
import {MonitoringMap,type MapVehicle} from "./MonitoringMap";
import {monitoringScenarios,illustrativeCharge} from "@/lib/demo/monitoring-scenarios";
export function DemoMonitoring({vehicles,onInspect,owner=false}:{vehicles:MapVehicle[];onInspect:(id:string)=>void;owner?:boolean}) {
 const records=useMemo(()=>monitoringScenarios(vehicles),[vehicles]);
 const [id,setId]=useState(""),[filter,setFilter]=useState("all"),[rate,setRate]=useState(12);
 const selected=records.find(v=>v.id===id)??records[0];
 const visible=records.filter(v=>filter==="all"|| (filter==="warnings"?v.warning:v.scenario===filter));
 if(!selected)return <section className="dashboard-panel" style={{padding:24}}>No vehicles match your jurisdiction or search filters.</section>;
 return <section className="dashboard-panel" style={{padding:24}}>
  <h2>{owner?"Your vehicle demonstration":"Fleet demonstration"}</h2><p>Seeded scenario snapshot · fictional locations and journeys. Select a car to preview its movement and review outcome.</p>
  <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBlock:16}}>
   <strong>{records.length} cars</strong><span>{records.filter(v=>v.warning).length} warnings</span><span>{records.filter(v=>v.scenario==="Signal lost").length} signal lost</span>
   <label>Show <select value={filter} onChange={e=>{const next=e.target.value;setFilter(next);setId(records.find(v=>next==="all"||(next==="warnings"?v.warning:v.scenario===next))?.id??"");}}><option value="all">All cases</option><option value="warnings">Warnings</option>{Array.from(new Set(records.map(v=>v.scenario))).map(s=><option key={s}>{s}</option>)}</select></label>
  </div>
  <MonitoringMap vehicles={visible} onSelect={setId} demo route={visible.some(v=>v.id===selected.id)?selected.route:undefined}/>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,300px),1fr))",gap:24,marginTop:24}}>
   <div style={{maxHeight:410,overflowY:"auto",display:"grid",gap:8}} aria-label="Seeded vehicle cases">
    {visible.map(v=><button key={v.id} type="button" className="small-button" aria-pressed={selected.id===v.id} onClick={()=>setId(v.id)} style={{padding:14,textAlign:"left",display:"block",borderColor:selected.id===v.id?"var(--accent, #128c87)":undefined}}><strong>{v.registration}</strong><br/>{v.warning?"⚠ ":""}{v.scenario} · {v.distanceKm.toFixed(2)} km{v.locationStatus==="Stale"?" · last known position":""}</button>)}
    {!visible.length&&<p>No cars match this case.</p>}
   </div>
   <article aria-live="polite"><h3>{selected.registration}</h3><p><strong>{selected.scenario}</strong></p>
    <dl className="detail-grid"><div><dt>Parking geofence</dt><dd>{selected.geofenceConfig.radiusM} m radius · 25 m review buffer</dd></div><div><dt>Distance from centre</dt><dd>{selected.distanceM} m{selected.locationStatus==="Stale"?" · last known":""}</dd></div><div><dt>Seeded journey length</dt><dd>{selected.distanceKm.toFixed(2)} km</dd></div><div><dt>Position</dt><dd>{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</dd></div></dl>
    <p>{selected.assessable?"Warning: simulated journey crosses the parking boundary without an approved movement request. Officer review required.":selected.scenario==="Authorised trip"?"Approved workshop journey. Movement is visible but excluded from this illustrative assessment.":selected.scenario==="Signal lost"?"Current position is unknown. The map shows a seeded last known position; no charge is calculated.":selected.scenario==="Boundary uncertainty"?"Position falls within the boundary buffer. Await better evidence; no confirmed breach.":selected.scenario==="Tamper warning"?"Enclosure signal requires inspection. Tampering alone does not prove travel.":selected.scenario==="Returned to parking"?"Journey ended inside the parking circle. Historical movement remains available for review.":selected.scenario==="Low battery"?"Battery maintenance required. No movement assessment is triggered.":"Vehicle remains within its parking geofence. No movement warning."}</p>
    {owner&&<div className="info-strip"><p>{selected.assessable?"You can review the evidence and submit your explanation in Compliance & tax. A warning is not a payable demand.":"Check your movement request and its approved window before moving. For missing signals or battery warnings, inspect the device and contact support."}</p></div>}
    <h3>Distance-based assessment preview</h3><p>Illustrative demo formula only; this is not a statutory tax rate or payable demand. Location identifies the journey and jurisdiction, not a legal tariff.</p>
    <label>Hypothetical rate (₹/km) <input aria-label="Hypothetical rate per kilometre" type="number" min="0" max="10000" step="0.5" value={rate} onChange={e=>setRate(Math.max(0,Math.min(10000,Number(e.target.value)||0)))}/></label>
    <p>{selected.assessable?selected.distanceKm.toFixed(4):"0"} km × ₹{rate.toFixed(2)}/km = <strong>₹{illustrativeCharge(selected.distanceKm,rate,selected.assessable).toFixed(2)}</strong></p>
    <p>{selected.assessable?"Draft illustration · review evidence, permissions and applicable rules before any decision.":"Excluded from this illustration; no confirmed unauthorised journey in this scenario."}</p>
    <button type="button" className="small-button" onClick={()=>onInspect(selected.id)}>Open vehicle record</button>{owner&&<div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:16}}><a className="small-button" href="/owner/requests">Movement requests</a><a className="small-button" href="/owner/compliance">Review evidence & respond</a><a className="small-button" href="/owner/alerts">Your alerts</a></div>}
   </article>
  </div>
 </section>;
}
