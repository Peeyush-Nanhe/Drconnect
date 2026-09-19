import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Ambulance, Building2, Car, Check, Loader2, Phone, RefreshCw, Stethoscope, X } from "lucide-react";
import { EMERGENCY_CATALOG, categoryDef } from "./catalog";
import { useAmbulanceTrack, useEmergencyCase } from "./hooks";
import { emergencyContacts, etaLabel, statusHeadline } from "./types";
import type { EmergencyCase, EmergencyCategory, TransportMode, TriageAnswer } from "./types";
import { LocationMap } from "../ambulance/LocationMap";
import type { DeviceLocation } from "../ambulance/location";
import { useDeviceLocation } from "../ambulance/useDeviceLocation";
import { EmergencyProfileForm, FamilyAlert, familyAlertMessage, useEmergencyProfile } from "./EmergencyProfile";
import "./emergency.css";

/** 108 and 112 stay on screen at every step. The app is never the only option. */
function EmergencyCalls() {
  return (
    <div className="emg-calls">
      <a href="tel:108">
        <Phone size={17} /> Call 108 · Ambulance
      </a>
      <a href="tel:112">
        <Phone size={16} /> 112
      </a>
    </div>
  );
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <span className="emg-elapsed">
      {mm}:{ss}
    </span>
  );
}

function TrackRow({
  icon,
  title,
  waiting,
  done,
  doneText,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  waiting: string;
  done: boolean;
  doneText: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className={`emg-track ${done ? "emg-track-done" : ""}`}>
      <span className="emg-track-icon" aria-hidden="true">
        {done ? <Check size={18} /> : icon}
      </span>
      <div>
        <b>{title}</b>
        <p>{done ? doneText : waiting}</p>
        {done && detail}
      </div>
    </div>
  );
}

/** Snapshotted at the moment of the emergency, so the ER reads what was true then. */
function MedicalSummary({ emergency }: { emergency: EmergencyCase }) {
  const rows: [string, string][] = [];
  if (emergency.blood_group) rows.push(["Blood group", emergency.blood_group]);
  if (emergency.allergies.length) rows.push(["Allergies", emergency.allergies.join(", ")]);
  if (emergency.conditions.length) rows.push(["Conditions", emergency.conditions.join(", ")]);
  if (emergency.medications.length) rows.push(["Medicines", emergency.medications.join(", ")]);
  if (!rows.length) {
    return (
      <section className="emg-medical emg-medical-thin">
        <p>
          Your profile has no blood group, allergies or regular medicines saved. Add them in your profile so the ER
          has them next time.
        </p>
      </section>
    );
  }
  return (
    <section className="emg-medical" aria-label="Medical information shared with the hospital">
      <div className="emg-medical-head">
        <Check size={15} /> Shared with the ER from your profile
      </div>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The crew rings these if the patient cannot speak. Saved once, in the emergency profile. */
function ContactsCard({ emergency }: { emergency: EmergencyCase }) {
  const caseContacts = emergencyContacts(emergency);
  const { profile, reload } = useEmergencyProfile();
  const [editing, setEditing] = useState(false);
  // Contacts are copied into the case when it is created. If the patient adds them
  // during the emergency, use the freshly saved profile for the family alert.
  const saved = profile
    ? [
        { name: profile.emergency_contact_1_name, phone: profile.emergency_contact_1_phone },
        { name: profile.emergency_contact_2_name, phone: profile.emergency_contact_2_phone },
      ].filter((c): c is { name: string | null; phone: string } => !!c.phone)
    : [];
  const contacts = caseContacts.length ? caseContacts : saved;
  const message = familyAlertMessage({
    category: categoryDef(emergency.category)?.label ?? null,
    lat: emergency.pickup_lat,
    lng: emergency.pickup_lng,
  });

  if (!contacts.length) {
    return (
      <>
        <section className="emg-contacts emg-contacts-empty">
          <p>No emergency contact saved. Add one so you can alert your family and the crew can reach them.</p>
          <button type="button" className="emg-add-contacts" onClick={() => setEditing(true)}>
            Add emergency contacts
          </button>
        </section>
        {editing && <EmergencyProfileForm onClose={() => setEditing(false)} onSaved={() => void reload()} />}
      </>
    );
  }
  return (
    <>
      <FamilyAlert contacts={contacts} message={message} />
      {caseContacts.length > 0 && (
        <section className="emg-contacts" aria-label="Emergency contacts shared with the crew">
          <b>The crew can call</b>
          {caseContacts.map((contact) => (
            <a key={contact.phone} href={`tel:${contact.phone}`}>
              <Phone size={14} /> {contact.name || "Emergency contact"} · {contact.phone}
            </a>
          ))}
        </section>
      )}
    </>
  );
}

/** Live dispatch board. Nothing here is asked of the patient — it only reports. */
function LiveDispatch({
  emergency,
  busy,
  onCancel,
  onRefresh,
}: {
  emergency: EmergencyCase;
  busy: boolean;
  onCancel: () => void;
  onRefresh: () => void;
}) {
  const track = useAmbulanceTrack(emergency);
  const def = categoryDef(emergency.category);
  const eta = etaLabel(track.latest?.eta_seconds ?? emergency.ambulance_eta_seconds);

  const pickup: DeviceLocation | null = useMemo(
    () =>
      emergency.pickup_lat != null && emergency.pickup_lng != null
        ? {
            lat: emergency.pickup_lat,
            lng: emergency.pickup_lng,
            accuracy: emergency.pickup_accuracy_m ?? 50,
            capturedAt: emergency.pickup_captured_at ?? emergency.created_at,
          }
        : null,
    [
      emergency.pickup_lat,
      emergency.pickup_lng,
      emergency.pickup_accuracy_m,
      emergency.pickup_captured_at,
      emergency.created_at,
    ],
  );

  const vehicle: DeviceLocation | null = track.latest
    ? {
        lat: track.latest.lat,
        lng: track.latest.lng,
        accuracy: track.latest.accuracy_m ?? 30,
        capturedAt: track.latest.captured_at,
      }
    : null;

  const searching = emergency.status === "searching";
  const self = emergency.transport_mode === "self";
  const radius = Math.round(emergency.search_radius_km);

  return (
    <>
      {def && (
        <div className="emg-banner">
          <span aria-hidden="true">{def.emoji}</span>
          <div>
            <b>{def.label}</b>
            <p>{def.routing}</p>
          </div>
        </div>
      )}

      <p className="emg-headline" role="status">
        {statusHeadline(emergency)}
      </p>

      {emergency.location_status === "needs_location" && (
        <div className="emg-nogps" role="alert">
          <p>
            Nobody can be matched to you without a location. Turn location on, or keep this screen open — the control
            room can confirm your pickup by phone.
          </p>
          <a href="tel:108">Call 108 now</a>
        </div>
      )}

      {self ? (
        <TrackRow
          icon={<Car size={18} />}
          title="Travelling by own vehicle"
          waiting="No ambulance is being sent."
          done
          doneText={
            emergency.hospital_id
              ? "Drive straight to the hospital below."
              : "Drive once a hospital accepts, or call 108 if this worsens."
          }
        />
      ) : (
      <TrackRow
        icon={<Ambulance size={18} />}
        title="Ambulance"
        waiting={
          searching
            ? `Paging crews within ${radius} km · widening every 20 seconds`
            : "Waiting for a crew to accept…"
        }
        done={!!emergency.ambulance_id}
        doneText={
          emergency.status === "ambulance_arrived"
            ? "Crew has reached you"
            : emergency.status === "transporting"
              ? "Taking you to the hospital"
              : eta
                ? `On the way · ${eta}`
                : "Accepted · on the way"
        }
        detail={
          track.enabled && !track.live && vehicle ? (
            <span className="emg-stale">Last position shown · waiting for a newer GPS update</span>
          ) : null
        }
      />
      )}

      <TrackRow
        icon={<Building2 size={18} />}
        title="Hospital"
        waiting={`Alerting emergency-ready hospitals within ${radius} km…`}
        done={!!emergency.hospital_id}
        doneText={emergency.bed_label ? `Bed ready · ${emergency.bed_label}` : "Bed being kept ready"}
      />

      <TrackRow
        icon={<Stethoscope size={18} />}
        title={def?.team ?? "Specialist"}
        waiting={
          emergency.doctor_wave >= 3
            ? `Asking every ${def?.team?.toLowerCase() ?? "specialist"} in the area…`
            : emergency.doctor_wave === 2
              ? "Asking the other doctors on duty…"
              : "Asking the hospital's on-call specialist…"
        }
        done={!!emergency.doctor_id}
        doneText="Specialist accepted and heading in"
      />

      {track.enabled && pickup && (
        <section className="emg-map" aria-label="Ambulance position">
          <div className="emg-map-head">
            <Ambulance size={16} />
            <b>Your ambulance</b>
            <span className={track.live ? "emg-dot-live" : "emg-dot-stale"} />
          </div>
          <LocationMap
            own={vehicle}
            pickup={pickup}
            ownLabel="Ambulance"
            ownIsAmbulance
            ownStale={!track.live}
            height={240}
          />
          <p className="emg-note">
            {track.latest
              ? `Last update ${new Date(track.latest.captured_at).toLocaleTimeString()}. The pin moves only when the crew's phone sends a new position.`
              : "Waiting for the crew to start sharing position."}
          </p>
        </section>
      )}

      <MedicalSummary emergency={emergency} />
      <ContactsCard emergency={emergency} />

      <button type="button" className="emg-ghost" onClick={onRefresh} disabled={busy}>
        <RefreshCw size={14} /> Refresh
      </button>
      <button
        type="button"
        className="emg-cancel"
        disabled={busy}
        onClick={() => {
          if (window.confirm("Cancel this emergency? If a crew has already accepted, call them as well.")) onCancel();
        }}
      >
        Cancel emergency
      </button>
      <p className="emg-note">Closing this screen does not cancel the emergency.</p>
    </>
  );
}

/**
 * The whole patient flow: tap a symptom, answer two or three questions, done.
 * Phone number, name, emergency contacts and pickup are never typed — they come
 * from the profile and the live GPS fix.
 */
export function EmergencyWizard({ onClose }: { onClose: () => void }) {
  const controller = useEmergencyCase();
  const emergency = controller.case;
  const live = controller.open && !!emergency;

  const [category, setCategory] = useState<EmergencyCategory | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [stage, setStage] = useState<"entry" | "triage" | "transport">("entry");
  const [actionError, setActionError] = useState<string | null>(null);
  // Stable for this attempt. A retry after a dropped response returns the same
  // case rather than opening a second one.
  const requestKey = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  );

  // Warm the GPS from the moment the screen opens, so tapping Send does not
  // wait on a cold fix.
  const gps = useDeviceLocation(controller.userId ? `emergency:${controller.userId}` : null, !live);
  const def = categoryDef(category);

  /**
   * Losing GPS must never lose the emergency. Without a fix the case is still
   * saved, flagged for a callback, and matching starts the moment a pin lands.
   */
  async function send(transport: TransportMode, withoutLocation = false) {
    if (!def) return;
    if (!withoutLocation && (!gps.fresh || !gps.location)) {
      setActionError("Turn on location. Help goes to your live position.");
      gps.refresh();
      return;
    }
    const triage: TriageAnswer[] = def.triage
      .map((question, index) => ({ q: question.q, a: answers[index] }))
      .filter((entry): entry is TriageAnswer => !!entry.a);
    setActionError(null);
    try {
      await controller.create({
        category: def.id,
        triage,
        transport,
        location: withoutLocation ? null : gps.location,
        requestKey: requestKey.current,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not send. Call 108 now.");
    }
  }

  const error = actionError || controller.error;
  const ready = !!def && !!gps.fresh && !controller.busy;
  const canSendWithoutGps = !!def && !gps.fresh && !gps.loading && !controller.busy;

  return (
    <div className="emg-shell" role="dialog" aria-modal="true" aria-label="Emergency">
      <header className="emg-header">
        <div className="emg-header-inner">
          <button onClick={onClose} aria-label="Close emergency screen">
            <X size={17} />
          </button>
          <AlertTriangle size={18} />
          <div className="emg-header-text">
            <h2>EMERGENCY</h2>
            <p>{live ? "Help is being arranged" : "Routed to the right hospital"}</p>
          </div>
          {live && emergency && <Elapsed since={emergency.created_at} />}
        </div>
      </header>

      <div className="emg-body">
        <div className="emg-column">
        <EmergencyCalls />
        <p className="emg-note">
          If this is life-threatening, call 108 first. The steps below alert an ambulance, a hospital and a specialist
          at the same time.
        </p>

        {error && (
          <div className="emg-error" role="alert">
            {error}
          </div>
        )}

        {live && emergency ? (
          <LiveDispatch
            emergency={emergency}
            busy={controller.busy}
            onCancel={() => {
              controller.cancel().catch((e: Error) => setActionError(e.message));
            }}
            onRefresh={controller.refresh}
          />
        ) : (
          <>
            {stage === "entry" && (
              <>
                <h3>What is happening?</h3>
                <div className="emg-grid">
                  {EMERGENCY_CATALOG.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setCategory(entry.id);
                        setAnswers({});
                        setStage("triage");
                      }}
                    >
                      <span aria-hidden="true">{entry.emoji}</span>
                      <b>{entry.label}</b>
                    </button>
                  ))}
                </div>
              </>
            )}

            {stage === "triage" && def && (
              <>
                <div className="emg-banner">
                  <span aria-hidden="true">{def.emoji}</span>
                  <div>
                    <b>{def.label}</b>
                    <p>{def.routing}</p>
                  </div>
                </div>

                {def.triage.map((question, index) => (
                  <div className="emg-question" key={question.q}>
                    <p>{question.q}</p>
                    <div>
                      {question.opts.map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={answers[index] === option}
                          onClick={() => setAnswers((prev) => ({ ...prev, [index]: option }))}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* The one thing worth saying about location: it is already handled. */}
                <div className="emg-auto" aria-live="polite">
                  {gps.loading && !gps.fresh ? (
                    <p>
                      <Loader2 size={14} className="emg-spin" /> Getting your live location…
                    </p>
                  ) : gps.fresh ? (
                    <p>
                      <Check size={14} /> Your live location and phone number go with the alert. Nothing to type.
                    </p>
                  ) : (
                    <>
                      <p role="alert">{gps.error || "Location is off. The ambulance needs your live position."}</p>
                      <button type="button" onClick={gps.refresh}>
                        Turn on location and retry
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  className="emg-send"
                  disabled={!ready}
                  onClick={() => setStage("transport")}
                >
                  Continue
                </button>
                <button
                  type="button"
                  className="emg-ghost"
                  onClick={() => {
                    setCategory(null);
                    setStage("entry");
                    setActionError(null);
                  }}
                >
                  Back
                </button>
              </>
            )}

            {stage === "transport" && def && (
              <>
                <div className="emg-banner">
                  <span aria-hidden="true">{def.emoji}</span>
                  <div>
                    <b>{def.label}</b>
                    <p>{def.routing}</p>
                  </div>
                </div>

                <h3>How will the patient reach the hospital?</h3>
                <p className="emg-note">
                  Either way, the hospital bed and the specialist are booked right now.
                </p>

                <button
                  type="button"
                  className="emg-transport"
                  disabled={!ready}
                  onClick={() => send("ambulance")}
                >
                  <span aria-hidden="true">🚑</span>
                  <div>
                    <b>{controller.busy ? "Sending…" : "Send an ambulance to me"}</b>
                    <p>Every crew nearby is alerted at once. You can track the ambulance live.</p>
                  </div>
                </button>

                <button
                  type="button"
                  className="emg-transport"
                  disabled={!ready}
                  onClick={() => send("self")}
                >
                  <span aria-hidden="true">🚗</span>
                  <div>
                    <b>We will drive to the hospital</b>
                    <p>No crew is sent. The hospital keeps the bed and team ready for you.</p>
                  </div>
                </button>

                {canSendWithoutGps && (
                  <div className="emg-nogps">
                    <p role="alert">{gps.error || "Still no location fix."}</p>
                    <button type="button" onClick={gps.refresh}>
                      Retry location
                    </button>
                    <button type="button" onClick={() => send("ambulance", true)}>
                      Send without location · we will call you
                    </button>
                  </div>
                )}

                <button type="button" className="emg-ghost" onClick={() => setStage("triage")}>
                  Back
                </button>
              </>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export default EmergencyWizard;
