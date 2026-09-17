import { useEffect, useMemo, useState, type ReactNode } from "react";
import "./careteam.css";

/**
 * One shell for nurse, technician, physiotherapist and care physician, so the
 * four home screens behave identically and none of them inherits the doctor's
 * console. Roles supply their own offers and job lists; the shell owns duty
 * state, the stat strip, alerts, tabs, profile completeness and device actions.
 *
 * Section 3 of the care-staff handover is the contract for what lives here.
 */

export type StaffRole = "nurse" | "technician" | "physiotherapist" | "care_physician";

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  nurse: "Nurse",
  technician: "Technician",
  physiotherapist: "Physiotherapist",
  care_physician: "Care physician",
};

/** What the shell shows when a role has nothing in a tab yet. */
const DEFAULT_EMPTY: Record<string, string> = {
  today: "Nothing booked for today.",
  offers: "No offers right now. They arrive here the moment one matches you.",
  upcoming: "No upcoming work yet.",
  history: "Finished jobs will be listed here.",
  profile: "Your profile is not set up yet.",
};

export interface StaffStat {
  label: string;
  value: string;
}

export interface StaffUIProps {
  role: StaffRole;
  name: string | null;
  /** Speciality or skill line under the name, e.g. "ICU · Koregaon Park". */
  qualifier?: string | null;

  online: boolean;
  onlineSince?: string | null;
  onToggleOnline: (next: boolean) => void | Promise<void>;
  /** Blocks the duty toggle with a reason, e.g. awaiting verification. */
  dutyBlockedReason?: string | null;

  stats?: StaffStat[];
  offerCount?: number;
  hasUrgentOffer?: boolean;

  offers?: ReactNode;
  activeJob?: ReactNode;
  today?: ReactNode;
  upcoming?: ReactNode;
  history?: ReactNode;
  profile?: ReactNode;

  profileCompleteness?: number;
  profileMissing?: string[];

  locationSharing?: boolean;
  onShareLocation?: () => void;
  phoneAlerts?: boolean;
  onEnablePhoneAlerts?: () => void;
  onLogout?: () => void;

  error?: string | null;
}

type TabId = "today" | "offers" | "upcoming" | "history" | "profile";

const TABS: { id: TabId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "offers", label: "New requests" },
  { id: "upcoming", label: "Upcoming" },
  { id: "history", label: "History" },
  { id: "profile", label: "Profile" },
];

function sinceText(iso: string | null | undefined): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min`;
}

export function StaffUI(props: StaffUIProps) {
  const {
    role, name, qualifier, online, onlineSince, onToggleOnline, dutyBlockedReason,
    stats = [], offerCount = 0, hasUrgentOffer = false,
    offers, activeJob, today, upcoming, history, profile,
    profileCompleteness, profileMissing = [],
    locationSharing, onShareLocation, phoneAlerts, onEnablePhoneAlerts, onLogout,
    error,
  } = props;

  // An arriving offer is the reason to open the app, so it takes the screen.
  const [tab, setTab] = useState<TabId>("today");
  const [toggling, setToggling] = useState(false);
  const hasOffers = offerCount > 0;
  useEffect(() => {
    if (hasOffers) setTab("offers");
  }, [hasOffers]);

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!online) return;
    const t = setInterval(() => forceTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, [online]);

  async function toggle() {
    if (dutyBlockedReason) return;
    setToggling(true);
    try { await onToggleOnline(!online); } finally { setToggling(false); }
  }

  const body = useMemo<Record<TabId, ReactNode>>(() => ({
    today, offers, upcoming, history, profile,
  }), [today, offers, upcoming, history, profile]);

  return (
    <div className="ct">
      <div className="ct-id">
        <h1>{name?.trim() || STAFF_ROLE_LABEL[role]}</h1>
        <p>{qualifier?.trim() || STAFF_ROLE_LABEL[role]}</p>
        {onLogout && <button type="button" onClick={onLogout}>Log out</button>}
      </div>

      {error && <p className="ct-error" role="alert">{error}</p>}

      {/* Duty state is the page, not a switch in a settings row. */}
      {online ? (
        <div className="ct-duty ct-duty-on">
          <span className="ct-duty-dot" aria-hidden="true" />
          <div className="ct-duty-body">
            <h2>On duty</h2>
            {onlineSince && <p>Taking work for {sinceText(onlineSince)}</p>}
          </div>
          <button type="button" onClick={toggle} disabled={toggling}>
            {toggling ? "…" : "Go off duty"}
          </button>
        </div>
      ) : (
        <div className="ct-duty ct-duty-off">
          <h2>You are off duty</h2>
          <p>
            {dutyBlockedReason
              ? dutyBlockedReason
              : "Go on duty to start receiving work near you. You can go off again at any time."}
          </p>
          <button type="button" onClick={toggle} disabled={toggling || !!dutyBlockedReason}>
            {toggling ? "…" : "Go on duty"}
          </button>
        </div>
      )}

      {stats.length > 0 && (
        <div className="ct-stats">
          {stats.map(s => (
            <div key={s.label}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {offerCount > 0 && (
        <p className={`ct-alert${hasUrgentOffer ? " ct-alert-urgent" : ""}`} role="status">
          {hasUrgentOffer ? "⚡" : "●"}{" "}
          {offerCount === 1 ? "1 job is waiting for your answer" : `${offerCount} jobs are waiting for your answer`}
        </p>
      )}

      {activeJob && <div className="ct-panel ct-panel-active">{activeJob}</div>}

      {(onShareLocation || onEnablePhoneAlerts) && (
        <div className="ct-device">
          {onEnablePhoneAlerts && (
            <button type="button" data-on={phoneAlerts ? "true" : "false"}
              onClick={onEnablePhoneAlerts}>
              {phoneAlerts ? "Phone alerts on" : "Turn on phone alerts"}
            </button>
          )}
          {onShareLocation && (
            <button type="button" data-on={locationSharing ? "true" : "false"}
              onClick={onShareLocation}>
              {locationSharing ? "Sharing location" : "Share my location"}
            </button>
          )}
        </div>
      )}

      <div className="ct-tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === "offers" && offerCount > 0 && <> <em>{offerCount}</em></>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {body[tab] ?? <p className="ct-empty">{DEFAULT_EMPTY[tab]}</p>}
      </div>

      {tab === "profile" && typeof profileCompleteness === "number" && (
        <div className="ct-panel ct-meter">
          <div className="ct-meter-head">
            <b>Profile {Math.round(profileCompleteness)}% complete</b>
            {profileMissing.length > 0 && <span>{profileMissing.length} left</span>}
          </div>
          <div className="ct-meter-track">
            <div className="ct-meter-fill"
              style={{ width: `${Math.min(100, Math.max(0, profileCompleteness))}%` }} />
          </div>
          {profileMissing.length > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--ct-muted)" }}>
              Still needed: {profileMissing.join(", ")}. Jobs are matched on these,
              so an incomplete profile receives fewer offers.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default StaffUI;
