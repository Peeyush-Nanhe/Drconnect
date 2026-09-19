import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, Phone, RefreshCw, Stethoscope, X } from "lucide-react";
import { EmergencyWizard } from "./EmergencyUI";
import { AmbulanceEmergencyPortal } from "./AmbulanceEmergencyPortal";
import { useEmergencyNotifications } from "./hooks";
import { categoryDef } from "./catalog";
import { emergencyContacts } from "./types";
import type { EmergencyCase, ResponderRole } from "./types";
import { fetchAllOpenCases, fetchMyHospital, setHospitalEmergencyMode } from "./service";
import { useSession } from "@/features/mydox/backend";
import { useDeviceLocation } from "../ambulance/useDeviceLocation";
import "./emergency.css";

/**
 * Master switch for the profile-driven dispatch flow. Flip to false and the app
 * falls back to the older ambulance-request screens, which is the escape hatch
 * if dispatch has to be turned off in production without a redeploy.
 */
export const EMERGENCY_V2 = true;

/**
 * Patient entry point. Both the SOS button and the guided pathway land here —
 * the flow is identical, because there is nothing left to vary: pick a symptom,
 * answer the triage questions, send. Phone and pickup come from the profile and
 * the live GPS fix, never from a form.
 */
export function EmergencyPatient({
  onClose,
  variant = "guided",
}: {
  onClose: () => void;
  variant?: "sos" | "guided";
}) {
  void variant;
  return <EmergencyWizard onClose={onClose} />;
}

function CaseSummary({ emergency, showPhones }: { emergency: EmergencyCase; showPhones: boolean }) {
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
        {emergency.medications.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      {showPhones && (
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
      )}
    </>
  );
}

/** Hospital console: emergency mode, incoming cases, bed assignment on accept. */
function HospitalPanel() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const [hospital, setHospital] = useState<Awaited<ReturnType<typeof fetchMyHospital>>>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [beds, setBeds] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    fetchMyHospital(userId)
      .then((row) => {
        setHospital(row);
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [userId]);
  useEffect(load, [load]);

  const dispatch = useEmergencyNotifications(hospital?.lat ?? null, hospital?.lng ?? null, "hospital");

  if (!userId) return null;
  if (loadError) {
    return (
      <div className="emg-error" role="alert">
        {loadError}
      </div>
    );
  }
  if (!hospital) {
    return (
      <p className="emg-note">
        No hospital is linked to this account yet. An administrator sets <code>hospitals.owner_id</code> before
        emergency cases can be routed here.
      </p>
    );
  }

  const assigned = dispatch.cases.filter((row) => row.hospital_id === hospital.id);
  const incoming = dispatch.cases.filter((row) => !row.hospital_id);

  async function guard(id: string, operation: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await operation();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not confirm. Refresh the queue.");
      dispatch.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="emg-portal">
      <section className="emg-card">
        <div className="emg-case-head">
          <span aria-hidden="true">
            <Building2 size={19} />
          </span>
          <div>
            <b>{hospital.name}</b>
            <p>{hospital.area || "Emergency department"}</p>
          </div>
        </div>
        <div className="emg-chips">
          {hospital.has_cath_lab && <span>Cath lab</span>}
          {hospital.has_icu && <span>ICU</span>}
          {hospital.has_ot && <span>OT</span>}
          {hospital.has_nicu && <span>NICU</span>}
          {hospital.has_blood_bank && <span>Blood bank</span>}
          <span>{hospital.er_beds_available} ER beds free</span>
        </div>
        <button
          type="button"
          className={hospital.emergency_mode ? "emg-ghost" : "emg-primary"}
          disabled={busyId === hospital.id}
          onClick={() =>
            guard(hospital.id, async () => {
              await setHospitalEmergencyMode(hospital.id, !hospital.emergency_mode);
              load();
            })
          }
        >
          {hospital.emergency_mode ? "Emergency mode is ON · turn off" : "Turn on emergency mode"}
        </button>
        {!hospital.emergency_mode && (
          <p className="emg-note">While this is off, no emergency case is routed to this hospital.</p>
        )}
      </section>

      {(actionError || dispatch.error) && (
        <div className="emg-error" role="alert">
          <p>{actionError || dispatch.error}</p>
          <button type="button" onClick={() => dispatch.refresh()}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      <h3 className="emg-section-title">Emergency alerts ({incoming.length})</h3>
      {!incoming.length && <p className="emg-empty">No new emergency alerts for this hospital.</p>}
      {incoming.map((emergency) => (
        <section className="emg-card emg-card-incoming" key={emergency.id}>
          <div className="emg-badge emg-badge-alert">INCOMING EMERGENCY</div>
          <CaseSummary emergency={emergency} showPhones={false} />
          <label className="emg-bed">
            Bed or bay
            <input
              value={beds[emergency.id] ?? ""}
              onChange={(event) => setBeds((prev) => ({ ...prev, [emergency.id]: event.target.value }))}
              placeholder="e.g. Red Bay 2"
              maxLength={40}
            />
          </label>
          <button
            type="button"
            className="emg-primary"
            disabled={!!busyId}
            onClick={() =>
              guard(emergency.id, () =>
                dispatch.accept(emergency.id, { hospitalId: hospital.id, bedLabel: beds[emergency.id] }),
              )
            }
          >
            <Check size={16} /> {busyId === emergency.id ? "Confirming…" : "Accept · keep a bed ready"}
          </button>
          <button
            type="button"
            className="emg-ghost"
            disabled={!!busyId}
            onClick={() => guard(emergency.id, () => dispatch.decline(emergency.id))}
          >
            <X size={14} /> Cannot take this case
          </button>
        </section>
      ))}

      <h3 className="emg-section-title">Active assignments ({assigned.length})</h3>
      {!assigned.length && <p className="emg-empty">No active emergency admissions.</p>}
      {assigned.map((emergency) => (
        <section className="emg-card emg-card-active" key={emergency.id}>
          <div className="emg-badge">ACCEPTED · BED READY</div>
          <CaseSummary emergency={emergency} showPhones />
          <p className="emg-note">
            {emergency.bed_label ? `Bed ${emergency.bed_label} held.` : "No bed label recorded."}{" "}
            {emergency.doctor_id ? "Specialist accepted." : "Still paging a specialist."}{" "}
            {emergency.ambulance_id ? "Ambulance assigned." : "No crew assigned yet."}
          </p>
          <button
            type="button"
            className="emg-ghost"
            disabled={busyId === emergency.id}
            onClick={() => guard(emergency.id, () => dispatch.advance(emergency.id, "admitted"))}
          >
            <Check size={15} /> Mark admitted
          </button>
        </section>
      ))}

    </div>
  );
}

/** Specialist console. Shows which wave paged them and which hospital to reach. */
function DoctorPanel({ onDuty }: { onDuty: boolean }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const gps = useDeviceLocation(userId ? `doctor:${userId}` : null, onDuty);
  const dispatch = useEmergencyNotifications(
    gps.location?.lat ?? null,
    gps.location?.lng ?? null,
    "doctor",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const mine = useMemo(() => dispatch.cases.filter((row) => row.doctor_id === userId), [dispatch.cases, userId]);
  const offers = dispatch.cases.filter((row) => !row.doctor_id);

  if (!onDuty) return <p className="emg-note">Off duty. Emergency cases are not being offered to this account.</p>;
  if (!dispatch.enabled) {
    return <p className="emg-note">Turn on location to be offered emergency cases in your area.</p>;
  }

  async function guard(id: string, operation: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await operation();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not confirm. Refresh the queue.");
      dispatch.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="emg-portal">
      {(actionError || dispatch.error) && (
        <div className="emg-error" role="alert">
          <p>{actionError || dispatch.error}</p>
        </div>
      )}

      <h3 className="emg-section-title">Emergency alerts ({mine.length ? 0 : offers.length})</h3>
      {mine.length > 0 ? (
        <p className="emg-empty">New calls are paused while you are attending a case.</p>
      ) : !offers.length ? (
        <p className="emg-empty">No emergency calls right now.</p>
      ) : null}
      {!mine.length &&
        offers.map((emergency) => (
          <section className="emg-card emg-card-incoming" key={emergency.id}>
            <div className="emg-badge emg-badge-alert">
              {emergency.doctor_wave >= 3
                ? "AREA CALL · ANY SPECIALIST"
                : emergency.doctor_wave === 2
                  ? "SECOND CALL · ON-DUTY DOCTORS"
                  : "FIRST CALL · YOU ARE ON CALL"}
            </div>
            <CaseSummary emergency={emergency} showPhones={false} />
            <p className="emg-note">
              {emergency.hospital_id
                ? "The hospital has accepted and is holding a bed. Confirm if you can reach it."
                : "A hospital has not accepted yet. You would be attending wherever the case lands."}
            </p>
            <button
              type="button"
              className="emg-primary"
              disabled={!!busyId}
              onClick={() => guard(emergency.id, () => dispatch.accept(emergency.id))}
            >
              <Stethoscope size={16} /> {busyId === emergency.id ? "Confirming…" : "Accept · I can attend"}
            </button>
            <button
              type="button"
              className="emg-ghost"
              disabled={!!busyId}
              onClick={() => guard(emergency.id, () => dispatch.decline(emergency.id))}
            >
              <X size={14} /> Cannot attend
            </button>
          </section>
        ))}

      <h3 className="emg-section-title">Active assignments ({mine.length})</h3>
      {!mine.length && <p className="emg-empty">No active assignments.</p>}
      {mine.map((emergency) => (
        <section className="emg-card emg-card-active" key={emergency.id}>
          <div className="emg-badge">ACCEPTED · ATTENDING</div>
          <CaseSummary emergency={emergency} showPhones />
          <p className="emg-note">
            {emergency.bed_label ? `Bed ${emergency.bed_label}.` : ""}{" "}
            {emergency.ambulance_id ? "Ambulance is bringing the patient in." : "Patient is making their own way in."}
          </p>
        </section>
      ))}

    </div>
  );
}

function CrewPanel({ onDuty }: { onDuty: boolean }) {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const gps = useDeviceLocation(userId ? `ambulance:${userId}` : null, onDuty);
  if (!onDuty) {
    return <p className="emg-note">Off duty. New cases are hidden; any accepted case stays active.</p>;
  }
  return <AmbulanceEmergencyPortal lat={gps.location?.lat ?? null} lng={gps.location?.lng ?? null} />;
}

/**
 * One responder surface for all three roles. Each only ever sees cases it was
 * actually paged for, and accepting is a single atomic call: two responders
 * tapping at the same moment cannot both win.
 */
export function EmergencyResponderPanel({
  kind,
  onDuty = true,
}: {
  kind: ResponderRole;
  onDuty?: boolean;
}) {
  if (kind === "hospital") return <HospitalPanel />;
  if (kind === "doctor") return <DoctorPanel onDuty={onDuty} />;
  return <CrewPanel onDuty={onDuty} />;
}

/** Read-only operations board. Admins watch every live case without touching it. */
function AdminBoard() {
  const [rows, setRows] = useState<EmergencyCase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      fetchAllOpenCases()
        .then((next) => {
          setRows(next);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    };
    load();
    const timer = setInterval(load, 5_000);
    return () => clearInterval(timer);
  }, []);

  if (error) {
    return (
      <div className="emg-error" role="alert">
        {error}
      </div>
    );
  }
  if (!rows.length) return <p className="emg-note">No live emergency cases.</p>;

  return (
    <div className="emg-portal">
      {rows.map((emergency) => (
        <section className="emg-card" key={emergency.id}>
          <div className="emg-badge">{emergency.status.replace(/_/g, " ").toUpperCase()}</div>
          <CaseSummary emergency={emergency} showPhones={false} />
          <p className="emg-note">
            Radius {Math.round(emergency.search_radius_km)} km · specialist wave {emergency.doctor_wave} ·{" "}
            {emergency.ambulance_id ? "crew assigned" : "no crew"} ·{" "}
            {emergency.hospital_id ? "hospital accepted" : "no hospital"} ·{" "}
            {emergency.doctor_id ? "specialist accepted" : "no specialist"}
          </p>
        </section>
      ))}
    </div>
  );
}

/**
 * Standalone page for each role, used by the /emergency/* and /admin/emergency
 * routes. The in-app panels above are the same components without the shell.
 */
export function EmergencyPortal({ kind }: { kind: ResponderRole | "patient" | "admin" }) {
  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
  }, []);

  // No phone frame on a standalone route, so supply the positioned ancestor
  // the overlay needs.
  if (kind === "patient") {
    return (
      <div className="emg-standalone">
        <EmergencyPatient onClose={goBack} />
      </div>
    );
  }

  const title =
    kind === "admin" ? "Emergency dispatch operations" : kind === "hospital" ? "Emergency department" : "Emergency cases";

  return (
    <div className={kind === "admin" ? "emg-page emg-page-wide" : "emg-page"}>
      <header className="emg-page-head">
        <h1>{title}</h1>
        <a href="tel:108">
          <Phone size={15} /> 108
        </a>
      </header>
      <div className="emg-page-body">
        {kind === "admin" ? <AdminBoard /> : <EmergencyResponderPanel kind={kind} />}
      </div>
    </div>
  );
}

export default EmergencyResponderPanel;
