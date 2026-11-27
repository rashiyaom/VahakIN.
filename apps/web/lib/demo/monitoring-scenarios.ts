import { distanceMetres } from "../monitoring";
import type { MapVehicle } from "../../components/dashboard/MonitoringMap";
const cases = ["Parked safely", "Authorised trip", "Geofence breach", "Signal lost", "Tamper warning", "Low battery", "Returned to parking", "Boundary uncertainty"] as const;
export function monitoringScenarios(vehicles: MapVehicle[]) {
  return vehicles.map((v,index) => {
    const i=/^v-\d{3}$/.test(v.id)?Math.max(0,Number(v.id.slice(2))-1):index;
    const scenario=cases[i%cases.length];
    const lat=v.geofenceConfig?.lat??v.lat??22.3039, lng=v.geofenceConfig?.lng??v.lng??70.8022;
    const radius=150, travelling=i%8===1||i%8===2, returned=i%8===6, boundary=i%8===7;
    const route:[number,number][] = travelling||returned ? [[lng,lat],[lng+.002,lat+.001],[lng+.006,lat+.001],[lng+.009,lat+.006],...(returned?[[lng+.003,lat+.006],[lng,lat]] as [number,number][]:[])] : [[lng,lat],[lng+(boundary?.00146:.0001),lat]];
    const end=route[route.length-1];
    const distanceKm=route.slice(1).reduce((sum,p,j)=>sum+distanceMetres(route[j][1],route[j][0],p[1],p[0]),0)/1000;
    return {...v, lat:end[1],lng:end[0],locationStatus:i%8===3?"Stale":"Current",scenario,route,distanceKm,
      distanceM:Math.round(distanceMetres(lat,lng,end[1],end[0])),
      warning:i%8===2||i%8===4, assessable:i%8===2,
      geofenceConfig:{enabled:true,lat,lng,radiusM:radius,version:1,updatedAt:"2026-11-27T04:30:00Z"}};
  });
}
export function illustrativeCharge(km:number,rate:number,eligible:boolean) {
  return eligible&&Number.isFinite(km)&&Number.isFinite(rate)&&km>=0&&rate>=0 ? Math.round(km*rate*100)/100 : 0;
}
