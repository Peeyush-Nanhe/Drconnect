/** Device-reported locations, never a selected area or a default city. */
export interface DeviceLocation {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
}
export const LOCATION_MAX_AGE_MS = 60_000;
export const COARSE_LOCATION_METRES = 200;

export function validCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
export function validLocation(location: DeviceLocation | null | undefined): location is DeviceLocation {
  return !!location && validCoordinates(location.lat, location.lng)
    && Number.isFinite(location.accuracy) && location.accuracy >= 0 && location.accuracy <= 100_000
    && Number.isFinite(Date.parse(location.capturedAt));
}
export function isFreshLocation(location: DeviceLocation | null | undefined, now = Date.now()): location is DeviceLocation {
  if (!validLocation(location)) return false;
  const age = now - Date.parse(location.capturedAt);
  return age >= -5_000 && age <= LOCATION_MAX_AGE_MS;
}
export function locationFromPosition(position: GeolocationPosition): DeviceLocation {
  const { latitude: lat, longitude: lng, accuracy } = position.coords;
  if (!Number.isFinite(position.timestamp)) throw new Error("The phone returned an invalid location time. Retry location.");
  const location = { lat, lng, accuracy, capturedAt: new Date(position.timestamp).toISOString() };
  if (!validLocation(location)) throw new Error("The phone returned an invalid location. Retry or enter the pickup manually.");
  if (!isFreshLocation(location)) throw new Error("The phone returned an old location. Retry to get your current position.");
  return location;
}
export function locationErrorMessage(code: number): string {
  if (code === 1) return "Location permission is blocked. Allow location for this app/site in your device settings, then retry.";
  if (code === 3) return "Location timed out. Turn on device location and retry, or enter the pickup manually.";
  return "Current location is unavailable. Turn on device location and retry, or enter the pickup manually.";
}

/** A cancellable watcher used by both portals. No database, profile writes or fallback coordinates. */
export function watchDeviceLocation(
  onLocation: (location: DeviceLocation) => void,
  onError: (message: string) => void,
  geo: Geolocation | undefined = typeof navigator === "undefined" ? undefined : navigator.geolocation,
  secure = typeof window !== "undefined" && window.isSecureContext,
): () => void {
  let stopped = false;
  let watchId: number | undefined;
  if (!secure) { onError("Location needs a secure HTTPS app/site (or localhost for development)."); return () => {}; }
  if (!geo) { onError("This device does not support location. Enter the pickup manually or call for help."); return () => {}; }
  const stop = () => { stopped = true; if (watchId !== undefined) geo.clearWatch(watchId); };
  try {
    watchId = geo.watchPosition(position => {
      if (stopped) return;
      try { onLocation(locationFromPosition(position)); }
      catch (error) { onError(error instanceof Error ? error.message : "Location unavailable."); }
    }, error => {
      if (!stopped) onError(locationErrorMessage(error.code));
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 });
  } catch { onError("The device could not start location detection. Retry or enter the pickup manually."); }
  return stop;
}

export function coordinateText(location: Pick<DeviceLocation, "lat" | "lng">): string {
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
}
export function pickupLocation(request: {
  pickup_lat?: number | null; pickup_lng?: number | null;
  pickup_accuracy_m?: number | null; pickup_captured_at?: string | null;
} | null | undefined): DeviceLocation | null {
  if (!request) return null;
  const loc = { lat: request.pickup_lat, lng: request.pickup_lng, accuracy: request.pickup_accuracy_m, capturedAt: request.pickup_captured_at };
  return validLocation(loc as DeviceLocation) ? loc as DeviceLocation : null;
}

/** Patient coordinates are a fixed pickup snapshot; only the driver's origin needs freshness. */
export function pickupDirectionsUrl(request: Parameters<typeof pickupLocation>[0] & { pickup: string }, origin?: DeviceLocation | null): string {
  const point = pickupLocation(request);
  return drivingDirectionsUrl(point ? coordinateText(point) : request.pickup, origin);
}
export function drivingDirectionsUrl(destination: string, origin?: DeviceLocation | null): string {
  const params = new URLSearchParams({ api: "1", destination, travelmode: "driving", dir_action: "navigate" });
  // If permission is missing/stale, Maps resolves the driver's current position itself.
  // Never use the patient's pickup coordinates as the driver's origin.
  if (isFreshLocation(origin)) params.set("origin", coordinateText(origin));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
