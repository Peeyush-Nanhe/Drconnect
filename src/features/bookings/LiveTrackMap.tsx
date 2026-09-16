import { useEffect, useRef, useState } from "react";

let mapsPromise: Promise<unknown> | null = null;

function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("Map unavailable"));
  const w = window as unknown as { google?: { maps?: unknown }; __mcInitLiveMap?: () => void };
  if (w.google?.maps) return Promise.resolve(w.google.maps);
  if (mapsPromise) return mapsPromise;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Map key missing"));
  mapsPromise = new Promise((resolve, reject) => {
    w.__mcInitLiveMap = () => resolve(w.google!.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry&loading=async&callback=__mcInitLiveMap${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    script.onerror = () => {
      mapsPromise = null;
      reject(new Error("Map failed to load"));
    };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

type Point = { lat: number; lng: number };

export function LiveTrackMap({ destination, provider, accent = "#0D9488", height = 200 }: { destination: Point | null; provider: Point | null; accent?: string; height?: number }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lineRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const anchor = destination ?? provider;
    if (!anchor) return;
    loadGoogleMaps()
      .then((maps: any) => {
        if (cancelled || !holder.current) return;
        if (!mapRef.current) {
          mapRef.current = new maps.Map(holder.current, {
            center: anchor,
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
            clickableIcons: false,
          });
        }
        const map = mapRef.current;
        markersRef.current.forEach((marker) => marker.setMap(null));
        markersRef.current = [];
        lineRef.current?.setMap(null);

        if (destination) {
          markersRef.current.push(new maps.Marker({
            map,
            position: destination,
            title: "Where care is needed",
            icon: { path: maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#ffffff", fillOpacity: 1, strokeColor: accent, strokeWeight: 3 },
          }));
        }
        if (provider) {
          markersRef.current.push(new maps.Marker({
            map,
            position: provider,
            title: "Professional on the way",
            icon: { path: maps.SymbolPath.CIRCLE, scale: 9, fillColor: accent, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 },
          }));
        }
        if (destination && provider) {
          lineRef.current = new maps.Polyline({ map, path: [provider, destination], strokeColor: accent, strokeOpacity: 0.8, strokeWeight: 3 });
          const bounds = new maps.LatLngBounds();
          bounds.extend(destination);
          bounds.extend(provider);
          map.fitBounds(bounds, 48);
        } else {
          map.setCenter(anchor);
        }
      })
      .catch((cause: Error) => setError(cause.message));
    return () => {
      cancelled = true;
    };
  }, [destination?.lat, destination?.lng, provider?.lat, provider?.lng, accent]);

  if (!destination && !provider) {
    return <div className="flex items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground" style={{ height }}>Location not shared yet</div>;
  }
  if (error) {
    return <div className="flex items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground" style={{ height }}>Map unavailable right now</div>;
  }
  return <div ref={holder} className="overflow-hidden rounded-xl border border-border" style={{ height }} aria-label="Live location map" />;
}
