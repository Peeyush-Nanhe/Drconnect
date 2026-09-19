import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/features/mydox/backend";
import {
  acceptEmergencyCase,
  advanceEmergencyCase,
  createEmergencyCase,
  declineEmergencyCase,
  emergencyDb,
  escalateSpecialists,
  expandSearch,
  fetchDispatchQueue,
  fetchLatestPing,
  fetchMyActiveCase,
  fetchPingTrail,
  heartbeatResponder,
  postAmbulancePing,
} from "./service";
import type { CreateCaseInput } from "./service";
import type { AmbulancePing, EmergencyCase, EmergencyStatus, ResponderRole } from "./types";
import { isOpenCase } from "./types";

/** Realtime is the fast path; the interval is the safety net on a flaky link. */
const POLL_MS = 4_000;
const PING_INTERVAL_MS = 10_000;
const HEARTBEAT_MS = 45_000;
/** Radius grows 4 km -> 5 -> 6 ... one step per interval until someone accepts. */
/**
 * Left undefined on purpose: the server reads its own emergency_settings row,
 * so the 20-25 second window is tuned in the database, not in a rebuild. These
 * client timers are a backup for the pg_cron worker, not the source of truth.
 */
const RADIUS_STEP_SECONDS = undefined;
const SPECIALIST_WAVE_SECONDS = undefined;
/** The server owns the clock, so asking often is cheap and never skips ahead. */
const ESCALATION_TICK_MS = 5_000;

function useLiveRefresh(key: string, refresh: () => void, table: string, filter?: string) {
  useEffect(() => {
    if (!key) return;
    refresh();
    const channel = supabase
      .channel(`emergency:${table}:${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => refresh())
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") refresh();
      });
    const poll = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    const onWake = () => {
      if (!document.hidden) refresh();
    };
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      clearInterval(poll);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
      void supabase.removeChannel(channel);
    };
  }, [key, table, filter, refresh]);
}

// --------------------------------------------------------------- patient ---
export function useEmergencyCase() {
  const { user, loading: authLoading } = useSession();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ row: EmergencyCase | null; loading: boolean; error: string | null }>({
    row: null,
    loading: true,
    error: null,
  });
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId || inFlight.current) return;
    inFlight.current = true;
    try {
      const row = await fetchMyActiveCase(userId);
      if (alive.current) setState({ row, loading: false, error: null });
    } catch (error) {
      if (alive.current) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Status could not be refreshed.",
        }));
      }
    } finally {
      inFlight.current = false;
    }
  }, [userId]);

  const refreshNow = useCallback(() => {
    void refresh();
  }, [refresh]);
  useLiveRefresh(userId ?? "", refreshNow, "emergency_cases", userId ? `patient_id=eq.${userId}` : undefined);

  const row = state.row;
  const open = isOpenCase(row);
  const caseId = open && row ? row.id : "";
  // A self-transport case has no crew to wait for, but the radius still widens
  // until a hospital accepts.
  const needsAmbulance = open && !!row && !row.ambulance_id && row.transport_mode === "ambulance";
  const needsHospital = open && !!row && !row.hospital_id;
  const needsDoctor = open && !!row && !row.doctor_id;

  /**
   * Drives both escalations while nobody has accepted: widen the radius, and
   * step the specialist page through its waves. Each call is a no-op until the
   * server's own timer says it is due.
   */
  useEffect(() => {
    if (!caseId || (!needsAmbulance && !needsHospital && !needsDoctor)) return;
    const tick = () => {
      if (document.hidden) return;
      if (needsAmbulance || needsHospital) {
        expandSearch(caseId, RADIUS_STEP_SECONDS)
          .then(() => refreshNow())
          .catch(() => undefined);
      }
      if (needsDoctor) {
        escalateSpecialists(caseId, SPECIALIST_WAVE_SECONDS)
          .then((added) => {
            if (added) refreshNow();
          })
          .catch(() => undefined);
      }
    };
    const timer = setInterval(tick, ESCALATION_TICK_MS);
    return () => clearInterval(timer);
  }, [caseId, needsAmbulance, needsHospital, needsDoctor, refreshNow]);

  const run = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      setBusy(true);
      try {
        return await operation();
      } finally {
        if (alive.current) setBusy(false);
        refreshNow();
      }
    },
    [refreshNow],
  );

  return {
    userId,
    case: row,
    open,
    busy,
    loading: authLoading || (!!userId && state.loading),
    error: !authLoading && !userId ? "Sign in to raise an emergency." : state.error,
    refresh: refreshNow,
    create: (input: CreateCaseInput) =>
      run(async () => {
        const created = await createEmergencyCase(input);
        if (alive.current) setState({ row: created, loading: false, error: null });
        return created;
      }),
    cancel: (reason?: string) =>
      run(async () => {
        if (!row) throw new Error("No emergency to cancel.");
        const next = await advanceEmergencyCase(row.id, "cancelled", reason);
        if (alive.current) setState({ row: next, loading: false, error: null });
        return next;
      }),
  };
}
export type EmergencyCaseController = ReturnType<typeof useEmergencyCase>;

/** Patient-side view of the crew's GPS. Draws only points the crew actually sent. */
export function useAmbulanceTrack(caseRow: EmergencyCase | null) {
  const enabled = !!caseRow?.ambulance_id && isOpenCase(caseRow);
  const caseId = enabled ? caseRow!.id : "";
  const [latest, setLatest] = useState<AmbulancePing | null>(null);
  const [trail, setTrail] = useState<AmbulancePing[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!caseId) return;
    fetchLatestPing(caseId)
      .then((ping) => {
        setLatest(ping);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
    fetchPingTrail(caseId).then(setTrail).catch(() => undefined);
  }, [caseId]);

  useLiveRefresh(caseId, refresh, "emergency_ambulance_pings", caseId ? `case_id=eq.${caseId}` : undefined);

  useEffect(() => {
    if (!caseId) {
      setLatest(null);
      setTrail([]);
    }
  }, [caseId]);

  // A pin that has not moved in half a minute is stale, not "arrived".
  const live = useMemo(
    () => !!latest && Date.now() - Date.parse(latest.received_at) < 30_000,
    [latest],
  );

  return { enabled, latest, trail, live, error, refresh };
}

// ------------------------------------------------------------- responder ---
/**
 * Paging for an ambulance, hospital or doctor account. Keeps the account in the
 * online pool and surfaces only cases it was actually targeted for.
 * Pass nulls for a patient session and the hook does nothing.
 */
export function useEmergencyNotifications(
  lat: number | null,
  lng: number | null,
  role: ResponderRole = "ambulance",
) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const enabled = !!userId && lat !== null && lng !== null;
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const [incoming, setIncoming] = useState<EmergencyCase | null>(null);

  const refresh = useCallback(() => {
    if (!enabled) return;
    fetchDispatchQueue(role)
      .then((rows) => {
        setCases(rows);
        setError(null);
        const fresh = rows.find((row) => !seen.current.has(row.id));
        rows.forEach((row) => seen.current.add(row.id));
        if (fresh) setIncoming(fresh);
      })
      .catch((e: Error) => setError(e.message));
  }, [enabled, role]);

  useLiveRefresh(enabled ? `${userId}:${role}` : "", refresh, "emergency_dispatch_targets");

  // Presence, so page_emergency_responders can find this account as online
  // nearby. 0,0 is the classic "no fix yet" value; storing it would page crews
  // in the Gulf of Guinea for a case in Pune.
  useEffect(() => {
    if (!enabled) return;
    const usable = lat !== null && lng !== null && (Math.abs(lat) > 0.001 || Math.abs(lng) > 0.001);
    const beat = () => {
      heartbeatResponder(usable ? lat : null, usable ? lng : null).catch(() => undefined);
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [enabled, lat, lng]);

  return {
    enabled,
    cases,
    incoming,
    error,
    refresh,
    dismissIncoming: () => setIncoming(null),
    accept: async (caseId: string, options?: { hospitalId?: string | null; bedLabel?: string | null }) => {
      const saved = await acceptEmergencyCase(caseId, role, options ?? {});
      refresh();
      return saved;
    },
    decline: async (caseId: string) => {
      await declineEmergencyCase(caseId, role);
      setCases((prev) => prev.filter((row) => row.id !== caseId));
      refresh();
    },
    advance: async (caseId: string, status: EmergencyStatus) => {
      const saved = await advanceEmergencyCase(caseId, status);
      refresh();
      return saved;
    },
  };
}
export type EmergencyNotifications = ReturnType<typeof useEmergencyNotifications>;

/**
 * Posts the crew's GPS roughly every ten seconds while a case is live, so the
 * patient watches a vehicle that is really moving.
 */
export function useAmbulanceBeacon(caseRow: EmergencyCase | null, userId: string | null) {
  const active = !!caseRow && caseRow.ambulance_id === userId && isOpenCase(caseRow);
  const caseId = active ? caseRow!.id : "";
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    if (!caseId || typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;

    const send = () => {
      if (sending.current || cancelled) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) return;
          sending.current = true;
          postAmbulancePing(caseId, {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
            speed: Number.isFinite(position.coords.speed) ? (position.coords.speed ?? 0) * 3.6 : null,
            capturedAt: new Date(position.timestamp).toISOString(),
          })
            .then((ping) => {
              if (!cancelled) {
                setLastSentAt(ping.received_at);
                setError(null);
              }
            })
            .catch((e: Error) => {
              if (!cancelled) setError(e.message);
            })
            .finally(() => {
              sending.current = false;
            });
        },
        (geoError) => {
          if (!cancelled) {
            setError(geoError.message || "Allow location so the patient can see the ambulance moving.");
          }
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 9_000 },
      );
    };

    send();
    const timer = setInterval(send, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [caseId]);

  return { active, lastSentAt, error };
}

export { emergencyDb };
