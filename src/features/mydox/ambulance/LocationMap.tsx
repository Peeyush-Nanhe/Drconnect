import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { DeviceLocation } from "./location";
import { validLocation } from "./location";
import "leaflet/dist/leaflet.css";

/** Real received points only. Short interpolation smooths two measurements;
 * there is no extrapolation, fabricated route, ETA, acceptance or arrival timer.
 */
export function LocationMap({ own, pickup, ownLabel = "This device", pickupLabel = "Patient pickup", height = 210, ownIsAmbulance = false, ownStale = false, navigationUrl }: {
  own?: DeviceLocation | null; pickup?: DeviceLocation | null; ownLabel?: string; pickupLabel?: string; height?: number;
  ownIsAmbulance?: boolean; ownStale?: boolean; navigationUrl?: string | null;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const libRef = useRef<typeof Leaflet | null>(null);
  const ownMarker = useRef<Leaflet.Marker | null>(null), pickupMarker = useRef<Leaflet.Marker | null>(null);
  const ownCircle = useRef<Leaflet.Circle | null>(null), pickupCircle = useRef<Leaflet.Circle | null>(null);
  const frame = useRef(0), fitted = useRef("");
  const navigation = useRef(navigationUrl); navigation.current = navigationUrl;
  const [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null), [center, setCenter] = useState(0);
  const hasOwn = validLocation(own), hasPickup = validLocation(pickup), available = hasOwn || hasPickup;
  useEffect(() => {
    if (!available || !host.current) return;
    let alive = true;
    let observer: ResizeObserver | undefined;
    let created: Leaflet.Map | null = null;
    void import("leaflet").then(L => {
      if (!alive || !host.current) return;
      libRef.current = L;
      const map = L.map(host.current, { scrollWheelZoom: false, attributionControl: true });
      created = map; mapRef.current = map;
      map.on("click", () => { if (navigation.current) window.open(navigation.current, "_blank", "noopener,noreferrer"); });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).on("tileerror", () => { if (alive) setError("Map tiles unavailable. The Maps navigation link still works."); }).addTo(map);
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(host.current);
      }
      setReady(true);
    }).catch(() => { if (alive) setError("Map could not load. Use the Maps navigation link."); });
    return () => { alive = false; observer?.disconnect(); cancelAnimationFrame(frame.current); created?.remove();
      mapRef.current = null; ownMarker.current = null; pickupMarker.current = null;
      ownCircle.current = null; pickupCircle.current = null; fitted.current = ""; setReady(false);
    };
  }, [available]);
  useEffect(() => {
    const map = mapRef.current, L = libRef.current;
    if (!ready || !map || !L) return;
    cancelAnimationFrame(frame.current);
    const points: [number, number][] = [];
    if (validLocation(own)) {
      const point: [number, number] = [own.lat, own.lng]; points.push(point);
      const icon = L.divIcon({ className: "", html: ownIsAmbulance
        ? `<span class="amb-vehicle-marker${ownStale ? " amb-vehicle-stale" : ""}" aria-label="Ambulance">🚑</span>`
        : '<span class="amb-device-marker"></span>', iconSize: [36, 36], iconAnchor: [18, 18] });
      if (!ownMarker.current) {
        ownMarker.current = L.marker(point, { icon, title: ownLabel }).addTo(map);
        ownMarker.current.on("click", () => { if (navigation.current) window.open(navigation.current, "_blank", "noopener,noreferrer"); });
        ownCircle.current = L.circle(point, { radius: own.accuracy, color: "#2563EB", weight: 1, fillOpacity: .06 }).addTo(map);
      } else {
        const marker = ownMarker.current, from = marker.getLatLng();
        const start = performance.now();
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        // Stale readings are held at the last reported point, never driven toward the pickup.
        if (ownStale || reduced) marker.setLatLng(point);
        else {
          const move = (time: number) => {
            const progress = Math.min(1, (time - start) / 650);
            marker.setLatLng([from.lat + (own.lat - from.lat) * progress, from.lng + (own.lng - from.lng) * progress]);
            if (progress < 1) frame.current = requestAnimationFrame(move);
          };
          frame.current = requestAnimationFrame(move);
        }
        marker.setIcon(icon);
      }
      ownMarker.current.bindTooltip(`${ownLabel}${ownStale ? " · last known" : ""}`, { direction: "top" });
      ownCircle.current?.setLatLng(point).setRadius(own.accuracy);
    } else {
      ownMarker.current?.remove(); ownMarker.current = null; ownCircle.current?.remove(); ownCircle.current = null;
    }
    if (validLocation(pickup)) {
      const point: [number, number] = [pickup.lat, pickup.lng]; points.push(point);
      if (!pickupMarker.current) {
        const icon = L.divIcon({ className: "", html: '<span class="amb-pickup-marker">📍</span>', iconSize: [32, 32], iconAnchor: [16, 28] });
        pickupMarker.current = L.marker(point, { icon, title: pickupLabel }).bindTooltip(pickupLabel, { direction: "top" }).addTo(map);
        pickupMarker.current.on("click", () => { if (navigation.current) window.open(navigation.current, "_blank", "noopener,noreferrer"); });
        pickupCircle.current = L.circle(point, { radius: pickup.accuracy, color: "#DC2626", weight: 1, fillOpacity: .06 }).addTo(map);
      } else pickupMarker.current.setLatLng(point);
      pickupMarker.current.bindTooltip(pickupLabel, { direction: "top" });
      pickupCircle.current?.setLatLng(point).setRadius(pickup.accuracy);
    } else {
      pickupMarker.current?.remove(); pickupMarker.current = null; pickupCircle.current?.remove(); pickupCircle.current = null;
    }
    const key = `${hasOwn}:${hasPickup}:${pickup?.lat}:${pickup?.lng}:${center}`;
    const outsideView = !!fitted.current && points.some(point => !map.getBounds().contains(point));
    if (points.length && (key !== fitted.current || outsideView)) {
      fitted.current = key;
      if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [38, 38], maxZoom: 16 });
      else map.setView(points[0], 16);
    }
    return () => cancelAnimationFrame(frame.current);
  }, [ready, own, pickup, ownLabel, pickupLabel, ownIsAmbulance, ownStale, center, hasOwn, hasPickup]);
  if (!available) return <p className="amb-panel-note">Waiting for a location update.</p>;
  return <div className="amb-location-map">
    <div ref={host} style={{ height, width: "100%", background: "#E6EDE8", borderRadius: 12 }} aria-label={`Map of ambulance and ${pickupLabel.toLowerCase()}`}/>
    {error && <p className="amb-panel-note" role="status">{error}</p>}
    <div className="amb-map-legend"><span>{hasOwn && `${ownIsAmbulance ? "🚑" : "🔵"} ${ownLabel}${ownStale ? " · last known" : ""}`}{hasOwn && hasPickup ? " · " : ""}{hasPickup && `📍 ${pickupLabel}`}</span><button type="button" onClick={() => setCenter(n => n + 1)}>Recenter</button></div>
    {navigationUrl && <a className="amb-map-navigate" href={navigationUrl} target="_blank" rel="noopener noreferrer">Tap the map or here to navigate to {pickupLabel.toLowerCase()} in Maps →</a>}
  </div>;
}

export function LocationDisclosure({ label, own, pickup, ownLabel, children, navigationUrl, ownIsAmbulance }: {
  label: string; own?: DeviceLocation | null; pickup?: DeviceLocation | null; ownLabel?: string;
  children?: import("react").ReactNode; navigationUrl?: string | null; ownIsAmbulance?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{label}</summary>
    {open && <LocationMap own={own} pickup={pickup} ownLabel={ownLabel} navigationUrl={navigationUrl} ownIsAmbulance={ownIsAmbulance}/>}
    {children}
  </details>;
}
