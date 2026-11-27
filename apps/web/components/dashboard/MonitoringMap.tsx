"use client";
import { useEffect, useRef, useState } from "react";
import { fencePolygon, type GeofenceConfig } from "@/lib/monitoring";
import type { Map as MapInstance, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
export interface MapVehicle { accuracy?:number|null; scenario?:string; warning?:boolean; locationSource?:string; geofenceConfig?:GeofenceConfig; id:string; registration:string; lat:number|null; lng:number|null; monitoring:string; gpsAt:string|null; locationStatus?:string; }
type View = "streets" | "satellite" | "hybrid";
const imageryKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
const streets = "https://tiles.openfreemap.org/styles/liberty";
function styleFor(view: View): string | StyleSpecification {
  if (view === "streets" || !imageryKey) return streets;
  const key = encodeURIComponent(imageryKey);
  if (view === "hybrid") return `https://api.maptiler.com/maps/satellite-v4/style.json?key=${key}`;
  return { version: 8, sources: { imagery: { type: "raster", url: `https://api.maptiler.com/tiles/satellite-v4/tiles.json?key=${key}`, tileSize: 256, attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a>' } }, layers: [{ id: "imagery", type: "raster", source: "imagery" }] };
}
const validPoint = (v: MapVehicle) => v.lat !== null && v.lng !== null && Number.isFinite(v.lat) && Number.isFinite(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180;
export function MonitoringMap({vehicles,onSelect,demo=false,route,onPick,live=false}:{vehicles:MapVehicle[];onSelect:(id:string)=>void;demo?:boolean;route?:[number,number][];onPick?:(lat:number,lng:number)=>void;live?:boolean}) {
  const container=useRef<HTMLDivElement>(null), map=useRef<MapInstance|null>(null), markers=useRef<Marker[]>([]), select=useRef(onSelect), latest=useRef(vehicles), fitted=useRef(false);
  const [view,setView]=useState<View>("streets"),[tilted,setTilted]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[revision,setRevision]=useState(0);
  const pick=useRef(onPick);pick.current=onPick;
  const currentView=useRef(view), currentTilt=useRef(tilted);
  currentView.current=view;currentTilt.current=tilted;latest.current=vehicles;select.current=onSelect;
  function showBuildings(instance:MapInstance) {
    for(const layer of instance.getStyle()?.layers??[]) if(layer.type==="fill-extrusion") instance.setLayoutProperty(layer.id,"visibility",currentView.current==="streets"&&currentTilt.current?"visible":"none");
  }
  function currentLocation() {
    const v=latest.current.find(v=>validPoint(v)&&["Current","Approximate"].includes(v.locationStatus??v.monitoring));
    if(v)map.current?.easeTo({center:[v.lng!,v.lat!],zoom:17,duration:window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:500});
  }
  function fitVehicles() {
    const instance=map.current,points=latest.current.filter(validPoint);if(!instance)return;
    const bounds=latest.current.flatMap(v=>[...(validPoint(v)?[[v.lng!,v.lat!]]:[]),...(v.geofenceConfig?.enabled?fencePolygon(v.geofenceConfig):[])]);
    if(!bounds.length){instance.easeTo({center:[72.649,23.235],zoom:13});return;}
    const xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]);
    instance.fitBounds([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:65,maxZoom:15,duration:0});
  }
  useEffect(()=>{
    let cancelled=false,instance:MapInstance|null=null;fitted.current=false;
    const timer=setTimeout(()=>{if(!cancelled)setError(true);},15000);
    import("maplibre-gl").then(lib=>{
      if(cancelled||!container.current)return;
      try {
        lib.setWorkerUrl("/vendor/maplibre/worker.mjs");
        instance=new lib.Map({container:container.current,style:styleFor(currentView.current),center:[72.649,23.235],zoom:13,pitch:currentTilt.current?55:0,maxPitch:65,attributionControl:{compact:true}});
        map.current=instance;
        instance.on("click",e=>pick.current?.(e.lngLat.lat,e.lngLat.lng));
        instance.addControl(new lib.NavigationControl({visualizePitch:true}),"top-right");
        instance.addControl(new lib.FullscreenControl(),"top-right");
        instance.on("style.load",()=>{if(cancelled||!instance)return;clearTimeout(timer);showBuildings(instance);setError(false);setReady(true);setRevision(n=>n+1);});
        instance.on("error",()=>{if(!cancelled)setError(true);});
      }catch{setError(true);}
    }).catch(()=>{if(!cancelled)setError(true);});
    const resize=new ResizeObserver(()=>map.current?.resize());if(container.current)resize.observe(container.current);
    return()=>{cancelled=true;clearTimeout(timer);resize.disconnect();markers.current.forEach(m=>m.remove());markers.current=[];instance?.remove();map.current=null;};
  },[attempt]);
  useEffect(()=>{
    if(!ready||!map.current)return;let cancelled=false;
    import("maplibre-gl").then(lib=>{
      if(cancelled||!map.current)return;
      const previous=new Map(markers.current.map(m=>[m.getElement().dataset.vehicleId,m]));
      markers.current=[];
      for(const vehicle of vehicles.filter(validPoint)){
        const existing=previous.get(vehicle.id);previous.delete(vehicle.id);
        const button=existing?.getElement() as HTMLButtonElement??document.createElement("button");button.dataset.vehicleId=vehicle.id;button.type="button";button.className=`vehicle-marker ${(vehicle.locationStatus??vehicle.monitoring)!=="Current"?"stale":""}`;
        button.title=`${vehicle.registration} · ${vehicle.scenario??vehicle.locationStatus??vehicle.monitoring}`;
        button.style.backgroundColor=vehicle.warning?"#dc453b":live?(vehicle.locationStatus==="Current"?"#1976ff":"#84909c"):"";
        if(live){button.style.width="22px";button.style.height="22px";button.style.border="3px solid white";button.style.borderRadius="50%";button.style.boxShadow=vehicle.locationStatus==="Current"?"0 0 0 8px rgba(25,118,255,.18),0 2px 8px #3336":"0 2px 8px #3336";}
        button.setAttribute("aria-label",`${vehicle.registration}: ${vehicle.locationStatus??vehicle.monitoring} ${vehicle.locationSource==="PHONE_BROWSER"?"phone-provided":"device"} location`);
        button.onclick=e=>{e.stopPropagation();select.current(vehicle.id);};
        const marker=existing??new lib.Marker({element:button}).setLngLat([vehicle.lng!,vehicle.lat!]).addTo(map.current);
        marker.setLngLat([vehicle.lng!,vehicle.lat!]);markers.current.push(marker);
      }
      previous.forEach(m=>m.remove());
      if(!fitted.current&&markers.current.length){fitVehicles();fitted.current=true;}
    });return()=>{cancelled=true;};
  },[vehicles,ready,revision,live]);
  useEffect(()=>{
    const instance=map.current;if(!ready||!instance?.isStyleLoaded())return;
    const data:GeoJSON.FeatureCollection={type:"FeatureCollection",features:vehicles.filter(v=>v.geofenceConfig?.enabled).map(v=>({type:"Feature",properties:{name:v.registration},geometry:{type:"Polygon",coordinates:[fencePolygon(v.geofenceConfig!)]}}))};
    const source=instance.getSource("parking-fences") as import("maplibre-gl").GeoJSONSource|undefined;
    if(source)source.setData(data);else{
      instance.addSource("parking-fences",{type:"geojson",data});
      instance.addLayer({id:"parking-fence-fill",type:"fill",source:"parking-fences",paint:{"fill-color":"#facc15","fill-opacity":0.13}});
      instance.addLayer({id:"parking-fence-line",type:"line",source:"parking-fences",paint:{"line-color":"#d4a000","line-width":3,"line-dasharray":[3,2]}});
    }
    if(!fitted.current&&data.features.length){fitVehicles();fitted.current=true;}
  },[vehicles,ready,revision,live]);
  useEffect(()=>{
    const instance=map.current;if(!ready||!instance?.isStyleLoaded())return;
    const data:GeoJSON.FeatureCollection={type:"FeatureCollection",features:route&&route.length>1?[{type:"Feature",properties:{},geometry:{type:"LineString",coordinates:route}}]:[]};
    const source=instance.getSource("demo-journey") as import("maplibre-gl").GeoJSONSource|undefined;
    if(source)source.setData(data);else{
      instance.addSource("demo-journey",{type:"geojson",data});
      instance.addLayer({id:"demo-journey-line",type:"line",source:"demo-journey",paint:{"line-color":"#e77927","line-width":4,"line-dasharray":[2,1]}});
    }
  },[route,ready,revision]);
  useEffect(()=>{
    const instance=map.current;if(!live||!ready||!instance?.isStyleLoaded())return;
    const data:GeoJSON.FeatureCollection={type:"FeatureCollection",features:vehicles.filter(v=>validPoint(v)&&v.accuracy!=null&&v.accuracy>0).map(v=>({type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[fencePolygon({enabled:true,lat:v.lat!,lng:v.lng!,radiusM:v.accuracy!,version:0,updatedAt:""})]}}))};
    const source=instance.getSource("phone-accuracy") as import("maplibre-gl").GeoJSONSource|undefined;
    if(source)source.setData(data);else{instance.addSource("phone-accuracy",{type:"geojson",data});instance.addLayer({id:"phone-accuracy-fill",type:"fill",source:"phone-accuracy",paint:{"fill-color":"#1976ff","fill-opacity":0.12}});}
  },[vehicles,ready,revision,live]);
  function switchView(next:View){
    if(next===view||!map.current)return;
    currentView.current=next;setView(next);setReady(false);setError(false);map.current.setStyle(styleFor(next));
  }
  useEffect(()=>{if(ready)return;const timer=setTimeout(()=>setError(true),15000);return()=>clearTimeout(timer);},[ready,view,attempt]);
  function perspective(next:boolean){
    setTilted(next);currentTilt.current=next;const instance=map.current;if(!instance)return;
    if(instance.isStyleLoaded())showBuildings(instance);
    instance.easeTo({pitch:next?55:0,bearing:next?-15:0,...(next&&view==="streets"?{zoom:Math.max(instance.getZoom(),15)}:{}),duration:window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:600});
  }
  return <div className="monitoring-map">
    <div ref={container} className="map-canvas" aria-label="Interactive geographic map with authorized vehicle locations"/>
    <div className="map-view-controls" aria-label="Map display controls">
      <div role="group" aria-label="Basemap">{([['streets','Streets'],['satellite','Satellite'],['hybrid','Hybrid']] as const).map(([id,label])=><button key={id} type="button" aria-pressed={view===id} disabled={id!=="streets"&&!imageryKey} title={id!=="streets"&&!imageryKey?"Satellite imagery is not available yet":undefined} onClick={()=>switchView(id)}>{label}</button>)}</div>
      <div role="group" aria-label="Map perspective"><button type="button" aria-pressed={!tilted} disabled={!ready} onClick={()=>perspective(false)}>2D</button><button type="button" aria-pressed={tilted} disabled={!ready} onClick={()=>perspective(true)}>2.5D</button><button type="button" disabled={!ready} onClick={fitVehicles}>Recenter</button>{live&&<button type="button" disabled={!ready||!vehicles.some(v=>validPoint(v)&&["Current","Approximate"].includes(v.locationStatus??""))} onClick={currentLocation}>Current location</button>}</div>
    </div>
    {error&&<div className="map-load-notice" role="status"><span>Some map detail could not load.</span><button type="button" onClick={()=>{setReady(false);setError(false);setAttempt(n=>n+1);}}>Retry</button>{view!=="streets"&&<button type="button" onClick={()=>switchView("streets")}>Use streets</button>}</div>}
    {!ready&&!error&&<div className="map-load-notice" role="status">Loading map…</div>}
    <div className="map-info"><span>{demo?"Demo vehicle markers":"Authorized vehicle locations"}</span>{view!=="streets"?<small>Satellite imagery is not live video.</small>:tilted?<small>Building heights appear where mapped. Zoom in for detail.</small>:!imageryKey?<small>Satellite imagery is not available yet.</small>:null}</div>
    <div className="map-legend"><span><i style={live?{background:"#1976ff"}:undefined}/>{live?"Live phone location":"Current"}</span><span><i className="stale"/>Last known</span><span>Yellow circle: parking geofence</span>{live&&<span>Blue shaded area: phone accuracy · grey dot: approximate or old fix</span>}{demo&&<span>Red: warning · Orange line: selected seeded journey</span>}{vehicles.some(v=>v.locationSource==="PHONE_BROWSER")&&<span>Plus location: owner’s phone</span>}{!vehicles.some(validPoint)&&<small>No vehicle coordinates yet · viewing Gandhinagar / configured geofence</small>}</div>
    {view!=="streets"&&<a className="map-provider-credit" href="https://www.maptiler.com/" target="_blank" rel="noreferrer">MapTiler</a>}
  </div>;
}
