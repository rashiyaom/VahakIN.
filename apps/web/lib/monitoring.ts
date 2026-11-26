export interface GeofenceConfig {
  enabled: boolean; lat: number; lng: number; radiusM: number; version: number; updatedAt: string;
}
export interface ImuReading {
  state: "Calibrating" | "Stationary" | "Moving" | "Sensor fault";
  accelerationG: number; rotationDps: number; qualifiedMotionMs: number;
  movementId: string | null; movementAt: number | null;
}
export interface HardwareReading {
  deviceId: string; timestamp: number; nonce: string; firmware: string; uptimeMs: number;
  imu: ImuReading;
  gps: { lat: number; lng: number; hdop: number; satellites: number; fixAt: number } | null;
}
export function distanceMetres(lat: number, lng: number, otherLat: number, otherLng: number) {
  const r = Math.PI / 180;
  const h = Math.sin((otherLat-lat)*r/2)**2 + Math.cos(lat*r)*Math.cos(otherLat*r)*Math.sin((otherLng-lng)*r/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,h)), Math.sqrt(Math.max(0,1-h)));
}
export function fencePolygon(fence: GeofenceConfig): [number, number][] {
  const points: [number, number][] = [];
  for (let i=0; i<=64; i++) {
    const angle=i/64*Math.PI*2, d=fence.radiusM/6371000, lat=fence.lat*Math.PI/180, lng=fence.lng*Math.PI/180;
    const y=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(angle));
    const x=lng+Math.atan2(Math.sin(angle)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(y));
    points.push([x*180/Math.PI,y*180/Math.PI]);
  }
  return points;
}
