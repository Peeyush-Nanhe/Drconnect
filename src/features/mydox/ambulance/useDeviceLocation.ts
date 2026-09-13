import { useCallback, useEffect, useState } from "react";
import { isFreshLocation, watchDeviceLocation } from "./location";
import type { DeviceLocation } from "./location";

/** Per-account, foreground-only GPS. Nothing is written to the shared profiles directory. */
export function useDeviceLocation(scope: string | null, enabled = true) {
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [snapshot, setSnapshot] = useState<{
    scope: string | null; retry: number; location: DeviceLocation | null;
    loading: boolean; error: string | null;
  }>({ scope: null, retry: -1, location: null, loading: false, error: null });
  useEffect(() => {
    if (!scope || !enabled) return;
    let alive = true;
    let stopWatch = () => {};
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    const stop = () => { generation++; stopWatch(); clearTimeout(watchdog); };
    const start = () => {
      stop();
      if (document.hidden) return;
      const token = generation;
      setSnapshot({ scope, retry, location: null, loading: true, error: null });
      const fail = (error: string) => {
        if (!alive || generation !== token) return;
        clearTimeout(watchdog);
        setSnapshot({ scope, retry, location: null, loading: false, error });
      };
      watchdog = setTimeout(() => fail("Still waiting for location. Allow the permission prompt, retry, or enter the pickup manually."), 16_000);
      stopWatch = watchDeviceLocation(location => {
        if (!alive || generation !== token) return;
        clearTimeout(watchdog);
        setNow(Date.now());
        setSnapshot({ scope, retry, location, loading: false, error: null });
      }, fail);
    };
    const visibility = () => {
      if (document.hidden) {
        stop();
        setSnapshot({ scope, retry, location: null, loading: false, error: "Location paused while the app is in the background." });
      } else start();
    };
    start();
    // This clock only labels stale GPS. It never changes any ambulance request status.
    const clock = setInterval(() => setNow(Date.now()), 5_000);
    document.addEventListener("visibilitychange", visibility);
    return () => { alive = false; stop(); clearInterval(clock); document.removeEventListener("visibilitychange", visibility); };
  }, [scope, enabled, retry]);
  const current = !!scope && enabled && snapshot.scope === scope && snapshot.retry === retry;
  const location = current ? snapshot.location : null;
  const fresh = isFreshLocation(location, now);
  const refresh = useCallback(() => setRetry(value => value + 1), []);
  return {
    location, fresh, refresh,
    loading: !!scope && enabled && (!current || snapshot.loading),
    error: current ? snapshot.error || (location && !fresh ? "Location is old. Retry before using it as your current position." : null) : null,
  };
}
export type DeviceLocationController = ReturnType<typeof useDeviceLocation>;
