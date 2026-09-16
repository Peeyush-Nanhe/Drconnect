import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shareProviderLocation } from "@/lib/booking-tracking.functions";

type State = "off" | "on" | "error";

// Live location is opt-in: the professional taps once, and the browser keeps
// sending their position while the job is active so patients see a real ETA.
export function ShareLocationToggle({ active }: { active: boolean }) {
  const share = useServerFn(shareProviderLocation);
  const [state, setState] = useState<State>("off");
  const [message, setMessage] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const stop = () => {
    if (watchRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  };

  useEffect(() => stop, []);
  useEffect(() => {
    if (!active && watchRef.current != null) {
      stop();
      setState("off");
    }
  }, [active]);

  const start = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState("error");
      setMessage("This device cannot share location.");
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSentRef.current < 20_000) return;
        lastSentRef.current = now;
        void share({ data: { lat: position.coords.latitude, lng: position.coords.longitude } })
          .then(() => {
            setState("on");
            setMessage(null);
          })
          .catch((cause: Error) => {
            setState("error");
            setMessage(cause.message);
          });
      },
      (cause) => {
        setState("error");
        setMessage(cause.code === cause.PERMISSION_DENIED ? "Allow location for MedConnect in your browser settings." : "Could not read your location.");
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
    );
    setState("on");
  };

  return (
    <div className="space-y-1">
      {state === "on" ? (
        <Button size="sm" variant="outline" onClick={() => { stop(); setState("off"); }}>
          <Navigation className="text-clinical-strong" />
          Sharing my location — stop
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={start}>
          <Navigation />
          Share my location
        </Button>
      )}
      {message ? <p className="text-[11px] font-semibold text-rose-700">{message}</p> : null}
    </div>
  );
}
