/**
 * DEMO GPS — fixed test locations around Koregaon Park, Pune.
 *
 * ON when VITE_DEMO_GPS=true in .env (restart `npm run dev` after changing it).
 * Turn OFF for production by removing that line or setting it to false.
 *
 * Replaces navigator.geolocation for the whole app, so every screen
 * (patient SOS, ambulance portal, nurse/technician maps) gets these points
 * instead of the laptop's real location.
 *
 * Quick overrides from the address bar (no code change needed):
 *   ?gps=18.5362,73.8930   → force this exact point for this tab
 *   ?gps=off               → use the real device GPS in this tab
 */

// Koregaon Park, Lane 5 area — used for patients, hubs, nurses, technicians.
export const DEMO_PATIENT = { lat: 18.5362, lng: 73.893 };
// ~700 m away (North Main Road side) so the ambulance is "nearby" but the map shows a route.
export const DEMO_AMBULANCE = { lat: 18.5401, lng: 73.8877 };

type Point = { lat: number; lng: number };

function pickPoint(): Point | null {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("gps") ?? sessionStorage.getItem("mydox_demo_gps");
  if (params.get("gps")) sessionStorage.setItem("mydox_demo_gps", params.get("gps")!);
  if (q === "off") return null;
  if (q) {
    const [lat, lng] = q.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  // Ambulance crew screens get the ambulance point; everyone else the patient point.
  return /ambulance/i.test(window.location.pathname) ? DEMO_AMBULANCE : DEMO_PATIENT;
}

function makePosition(p: Point): GeolocationPosition {
  const coords = {
    latitude: p.lat, longitude: p.lng, accuracy: 12,
    altitude: null, altitudeAccuracy: null, heading: null, speed: null,
    toJSON() { return { latitude: p.lat, longitude: p.lng, accuracy: 12 }; },
  } as GeolocationCoordinates;
  const timestamp = Date.now(); // always fresh, so "old location" checks pass
  return { coords, timestamp, toJSON() { return { coords, timestamp }; } } as GeolocationPosition;
}

export function installDemoGps() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (import.meta.env.VITE_DEMO_GPS !== "true") return;
  const real = navigator.geolocation;
  const watches = new Map<number, ReturnType<typeof setInterval>>();
  let nextId = 1;

  const fake: Geolocation = {
    getCurrentPosition(success, error, options) {
      const p = pickPoint();
      if (!p) return real?.getCurrentPosition(success, error ?? undefined, options);
      setTimeout(() => success(makePosition(p)), 150);
    },
    watchPosition(success, error, options) {
      const p = pickPoint();
      if (!p) return real ? real.watchPosition(success, error ?? undefined, options) : 0;
      const id = nextId++;
      setTimeout(() => success(makePosition(p)), 150);
      // Re-emit every 5 s so freshness checks and live tracking keep working.
      watches.set(id, setInterval(() => success(makePosition(pickPoint() ?? p)), 5000));
      return id;
    },
    clearWatch(id) {
      const t = watches.get(id);
      if (t) { clearInterval(t); watches.delete(id); } else real?.clearWatch(id);
    },
  };

  Object.defineProperty(navigator, "geolocation", { configurable: true, get: () => fake });
  console.info("[MyDox] Demo GPS active →", pickPoint() ?? "real device GPS");
}
