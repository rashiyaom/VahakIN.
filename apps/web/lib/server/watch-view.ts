import type { Vehicle } from "./demo-store";

/** Only returned after device authentication, for the vehicle linked to that device. */
export function watchView(vehicle: Vehicle | null | undefined, now = Date.now()) {
  if (!vehicle || vehicle.deviceTier !== "PLUS") return null;
  const at = vehicle.gpsAt ? Date.parse(vehicle.gpsAt) : NaN;
  const fresh = vehicle.locationSource === "PHONE_BROWSER" &&
    vehicle.gpsStatus === "Phone-provided location" &&
    !!vehicle.phoneLocationSession && vehicle.phoneLocationSession.expiresAt > now &&
    Number.isFinite(at) && now - at >= -2000 && now - at <= 15000 &&
    vehicle.lat != null && vehicle.lng != null && vehicle.accuracy != null && vehicle.accuracy <= 30;
  return {
    registration: vehicle.registration,
    declaration: vehicle.declarationStatus,
    geofence: vehicle.geofence,
    radiusM: vehicle.geofenceConfig?.enabled ? vehicle.geofenceConfig.radiusM : null,
    location: fresh ? {lat: vehicle.lat, lng: vehicle.lng, accuracy: vehicle.accuracy, at, source: "PHONE_BROWSER"} : null,
  };
}
