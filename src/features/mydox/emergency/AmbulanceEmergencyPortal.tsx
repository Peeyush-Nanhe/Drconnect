import { useEffect, useMemo, useRef, useState } from "react";
import { Ambulance, Check, Navigation, Phone, RefreshCw, Timer, X } from "lucide-react";
import { useAmbulanceBeacon, useEmergencyNotifications } from "./hooks";
import { categoryDef } from "./catalog";
import { emergencyContacts, isOpenCase } from "./types";
import type { EmergencyCase } from "./types";
import "./emergency.css";

function mapsUrl(emergency: EmergencyCase) {
  return `https://www.google.com/maps/dir/?api=1&destination=${emergency.pickup_lat},${emergency.pickup_lng}&travelmode=driving`;
}

/** A case with no confirmed pin must not send a crew to coordinates we invented. */
function hasPickup(emergency: EmergencyCase) {
  return emergency.pickup_lat != null && emergency.pickup_lng != null;
}

function Waiting({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return (
    <span className="emg-waiting">
      <Timer size={13} /> waiting {Math.floor(seconds / 60)}m {String(seconds % 60).padStart(2, "0")}s
    </span>
  );
}

/** Everything the crew needs before they move, none of it typed by the patient. */
function CaseDetails({ emergency }: { emergency: EmergencyCase }) {
  const def = categoryDef(emergency.category);
  const contacts = emergencyContacts(emergency);
  return (
    <>
      <div className="emg-case-head">
        <span aria-hidden="true">{def?.emoji ?? "🚑"}</span>
        <div>
          <b>{def?.label ?? "Emergency"}</b>
          <p>{emergency.patient_name || "Patient"}</p>
        </div>
      </div>

      {!!emergency.triage.length && (
        <ul className="emg-triage-list">
          {emergency.triage.map((entry) => (
            <li key={entry.q}>
              {entry.q} <b>{entry.a}</b>
            </li>
          ))}
        </ul>
      )}

      <div className="emg-chips">
        {emergency.blood_group && <span>Blood {emergency.blood_group}</span>}
        {emergency.allergies.map((item) => (
          <span key={item} className="emg-chip-warn">
            Allergy: {item}
          </span>
        ))}
        {emergency.conditions.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <div className="emg-phones">
        {emergency.patient_phone && (
          <a href={`tel:${emergency.patient_phone}`}>
            <Phone size={14} /> Patient · {emergency.patient_phone}
          </a>
        )}
        {contacts.map((contact) => (
          <a key={contact.phone} href={`tel:${contact.phone}`}>
            <Phone size={14} /> {contact.name || "Family"} · {contact.phone}
          </a>
        ))}
      </div>
    </>
  );
}

/** The assigned trip. The beacon runs here, so the patient sees the van move. */
function ActiveTrip({
  emergency,
  userId,
  onAdvance,
  busy,
}: {
  emergency: EmergencyCase;
  userId: string | null;
  onAdvance: (status: "ambulance_arrived" | "transporting" | "handed_over") => void;
  busy: boolean;
}) {
  const beacon = useAmbulanceBeacon(emergency, userId);
  return (
    <section className="emg-card emg-card-active">
      <div className="emg-badge">ACCEPTED · {emergency.status.replace(/_/g, " ").toUpperCase()}</div>
      <CaseDetails emergency={emergency} />

      <p className="emg-note" role="status">
        {beacon.error
          ? beacon.error
          : beacon.lastSentAt
            ? `Sharing position every 10 seconds · last sent ${new Date(beacon.lastSentAt).toLocaleTimeString()}`
            : "Starting position sharing…"}
      </p>

      {hasPickup(emergency) ? (
        <a className="emg-primary" href={mapsUrl(emergency)} target="_blank" rel="noopener noreferrer">
          <Navigation size={16} /> Navigate to patient
        </a>
      ) : (
        <p className="emg-note" role="alert">
          No confirmed pickup on this case. Call the patient or the control room before moving.
        </p>
      )}

      {emergency.status === "ambulance_en_route" && (
        <button type="button" className="emg-ghost" disabled={busy} onClick={() => onAdvance("ambulance_arrived")}>
          Confirm arrival at pickup
        </button>
      )}
      {emergency.status === "ambulance_arrived" && !!emergency.hospital_id && (
        <button type="button" className="emg-ghost" disabled={busy} onClick={() => onAdvance("transporting")}>
          Start transport to hospital
        </button>
      )}
      {emergency.status === "ambulance_arrived" && !emergency.hospital_id && (
        <p className="emg-note">
          No hospital has accepted yet. Transport cannot start without a receiving hospital.
        </p>
      )}
      {emergency.status === "transporting" && (
        <>
          <p className="emg-note">
            {emergency.bed_label
              ? `Hospital bed ${emergency.bed_label} is held for this patient.`
              : "Hospital has been alerted."}
          </p>
          <button type="button" className="emg-ghost" disabled={busy} onClick={() => onAdvance("handed_over")}>
            Handed over to hospital team
          </button>
        </>
      )}
      {emergency.status === "handed_over" && (
        <p className="emg-note">Handed over. The hospital confirms admission from its own screen.</p>
      )}
    </section>
  );
}

/**
 * Crew-facing dispatch portal. Shows only cases this crew was paged for, and
 * locks the first tap in atomically — two crews cannot both win the same case.
 */
export function AmbulanceEmergencyPortal({
  lat,
  lng,
  onNavigate,
}: {
  lat: number | null;
  lng: number | null;
  onNavigate?: (emergency: EmergencyCase) => void;
}) {
  const dispatch = useEmergencyNotifications(lat, lng, "ambulance");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const lock = useRef(false);
  const userId = useMemo(() => dispatch.cases.find((row) => row.ambulance_id)?.ambulance_id ?? null, [dispatch.cases]);

  const mine = dispatch.cases.filter((row) => !!row.ambulance_id && isOpenCase(row));
  const incoming = dispatch.cases.filter((row) => !row.ambulance_id);

  async function guard(id: string, operation: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusyId(id);
    setActionError(null);
    try {
      await operation();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not confirm. Refresh the queue.");
      dispatch.refresh();
    } finally {
      lock.current = false;
      setBusyId(null);
    }
  }

  if (!dispatch.enabled) {
    return (
      <p className="emg-note">
        Turn on location to receive emergency cases. Crews are paged by distance from the patient.
      </p>
    );
  }

  return (
    <div className="emg-portal">
      {(actionError || dispatch.error) && (
        <div className="emg-error" role="alert">
          <p>{actionError || dispatch.error}</p>
          <button
            type="button"
            onClick={() => {
              setActionError(null);
              dispatch.refresh();
            }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Alerts first (to accept), then what this crew has already accepted. */}
      <h3 className="emg-section-title">Emergency alerts ({mine.length ? 0 : incoming.length})</h3>
      {mine.length > 0 ? (
        <p className="emg-empty">New alerts are paused while you have an active case.</p>
      ) : !incoming.length ? (
        <p className="emg-empty">No emergency alerts nearby right now.</p>
      ) : null}
      {!mine.length &&
        incoming.map((emergency) => (
          <section className="emg-card emg-card-incoming" key={emergency.id}>
            <div className="emg-badge emg-badge-alert">
              EMERGENCY NEARBY <Waiting since={emergency.created_at} />
            </div>
            <CaseDetails emergency={emergency} />
            <p className="emg-note">
              Pickup is the patient's live GPS position. Search radius is {Math.round(emergency.search_radius_km)} km
              and widening.
            </p>
            <button
              type="button"
              className="emg-primary"
              disabled={!!busyId}
              onClick={() =>
                guard(emergency.id, async () => {
                  const saved = await dispatch.accept(emergency.id);
                  onNavigate?.(saved);
                })
              }
            >
              <Check size={16} /> {busyId === emergency.id ? "Confirming…" : "Accept case"}
            </button>
            <button
              type="button"
              className="emg-ghost"
              disabled={!!busyId}
              onClick={() => guard(emergency.id, () => dispatch.decline(emergency.id))}
            >
              <X size={14} /> Pass
            </button>
          </section>
        ))}

      <h3 className="emg-section-title">Active assignments ({mine.length})</h3>
      {!mine.length && <p className="emg-empty">No active assignments.</p>}
      {mine.map((emergency) => (
        <div key={emergency.id}>
          <ActiveTrip
            emergency={emergency}
            userId={emergency.ambulance_id ?? userId}
            busy={busyId === emergency.id}
            onAdvance={(status) => guard(emergency.id, () => dispatch.advance(emergency.id, status))}
          />
          {onNavigate && (
            <button type="button" className="emg-ghost" onClick={() => onNavigate(emergency)}>
              Open in trip screen
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default AmbulanceEmergencyPortal;
