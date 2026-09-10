import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/features/mydox/backend";
import {
  PROCEDURE_PRESETS,
  SURGERY_ROLE_LABELS,
  SURGERY_TEST_OTP,
  BLOOD_GROUPS,
  type SurgeryRoleKey,
  type SurgeryRole,
  type SurgeryBooking,
  createSurgeryBooking,
  cancelSurgeryBooking,
  acceptSurgeryRole,
  declineSurgeryRole,
  hubConfirmSurgeryRole,
  providerVerifySurgeryOtp,
  confirmSurgeryOtpExchanged,
  completeSurgeryRole,
  failSurgeryRole,
  rateSurgeryRole,
  useSurgeryRoleChat,
  useSurgeryBookingAuditLog,
  useMyFacilitySurgeries,
  useProviderSurgeryInvites,
} from "@/features/mydox/surgery";
import { SlotPickerCalendarStandalone } from "@/features/mydox/SlotPickerCalendar";

export const Route = createFileRoute("/surgery")({
  head: () => ({
    meta: [
      { title: "Surgery Planning — MyDox" },
      { name: "description", content: "Coordinate multi-provider surgeries: surgeon, anaesthetist, OT technician, and more — booked together in one broadcast." },
    ],
  }),
  component: SurgeryPage,
  ssr: false,
});

const BG = "#DCE6E1";
const TEAL = "#0D9488";
const INK = "#0F172A";

const ALL_ROLES: SurgeryRoleKey[] = [
  "surgeon", "anaesthetist", "obstetrician", "paediatrician",
  "ot_technician", "scrub_nurse", "other",
];

function Shell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="min-h-screen px-4 py-6" style={{ background: BG, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: INK }}>{title}</h1>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>
          <Link to="/" className="text-sm font-semibold" style={{ color: TEAL }}>← Back to app</Link>
        </div>
        {children}
      </div>
    </div>
  );
}

function SurgeryPage() {
  const { user, role, loading } = useSession();

  if (loading) {
    return <Shell title="Surgery Planning" subtitle="Loading…"><div /></Shell>;
  }
  if (!user) {
    return (
      <Shell title="Surgery Planning" subtitle="Sign in required">
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-600">
          <Link to="/auth" search={{ admin: undefined, next: undefined }} className="font-semibold" style={{ color: TEAL }}>Sign in</Link> to plan or accept surgery bookings.
        </div>
      </Shell>
    );
  }

  if (role === "facility" || role === "admin" || role === "super_admin") {
    return (
      <Shell title="Surgery Planning" subtitle="Book a full surgical team in one broadcast.">
        <FacilityPlanner />
      </Shell>
    );
  }

  if (role === "provider") {
    return (
      <Shell title="Surgery Invitations" subtitle="Open surgeries needing a team member.">
        <ProviderInvites />
      </Shell>
    );
  }

  return (
    <Shell title="Surgery Planning" subtitle="Not available for this account">
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-600">
        Surgery planning is for hospitals, hubs, and providers only.
      </div>
    </Shell>
  );
}

/* ================= Facility ================= */

function FacilityPlanner() {
  const { bookings, roles, loading, refresh } = useMyFacilitySurgeries();
  const [showNew, setShowNew] = useState(false);

  const rolesByBooking = useMemo(() => {
    const m: Record<string, typeof roles> = {};
    for (const r of roles) (m[r.booking_id] ||= []).push(r);
    return m;
  }, [roles]);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowNew(true)}
        className="w-full rounded-2xl py-3 text-sm font-bold text-white"
        style={{ background: `linear-gradient(135deg,${TEAL},#14B8A6)` }}
      >
        + New surgery booking
      </button>

      {showNew && <NewBookingDialog onClose={() => { setShowNew(false); refresh(); }} />}

      <div className="rounded-2xl bg-white p-4">
        <h3 className="text-sm font-bold" style={{ color: INK }}>Your bookings</h3>
        {loading ? (
          <p className="mt-2 text-xs text-slate-500">Loading…</p>
        ) : bookings.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No surgeries yet. Create your first booking above.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {bookings.map((b) => {
              const rs = rolesByBooking[b.id] ?? [];
              const done = rs.filter((r) => r.status === "accepted").length;
              return (
                <div key={b.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold" style={{ color: INK }}>
                        {b.mode === "emergency" ? "🚨 " : ""}{b.procedure}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Patient: {b.patient_name}
                        {b.patient_phone ? ` · ${b.patient_phone}` : ""}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {b.mode === "planned" && b.scheduled_at
                          ? `Planned · ${new Date(b.scheduled_at).toLocaleString()}`
                          : b.mode === "emergency"
                          ? "Emergency · ASAP"
                          : "Planned · time TBD"}
                      </div>
                      {(b.ot_room || b.blood_units || b.blood_group) && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {b.ot_room && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                              OT: {b.ot_room}
                            </span>
                          )}
                          {b.blood_units ? (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              🩸 {b.blood_units} unit{b.blood_units > 1 ? "s" : ""}{b.blood_group ? ` · ${b.blood_group}` : ""}
                            </span>
                          ) : b.blood_group ? (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              🩸 {b.blood_group}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rs.map((r) => (
                      <span
                        key={r.id}
                        className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                        style={{
                          background:
                            r.status === "accepted" ? "#D1FAE5" :
                            r.status === "declined" ? "#FEE2E2" : "#F1F5F9",
                          color:
                            r.status === "accepted" ? "#065F46" :
                            r.status === "declined" ? "#991B1B" : "#334155",
                        }}
                      >
                        {SURGERY_ROLE_LABELS[r.role]}{r.fee ? ` · ₹${r.fee}` : ""}{" "}
                        {r.status === "accepted" ? "✓" : r.status === "declined" ? "✗" : "…"}
                      </span>
                    ))}
                  </div>

                  {rs.filter((r) => r.status === "accepted").map((r) => (
                    <RoleLifecyclePanel
                      key={`life-${r.id}`}
                      role={r}
                      booking={b}
                      side="hub"
                      onChange={refresh}
                    />
                  ))}
                  <BookingAuditTimeline bookingId={b.id} />
                  <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500">
                    <span>{done}/{rs.length} team members accepted</span>
                    {b.status !== "cancelled" && b.status !== "completed" && (
                      <button
                        onClick={async () => {
                          if (!confirm("Cancel this surgery booking?")) return;
                          await cancelSurgeryBooking(b.id);
                          refresh();
                        }}
                        className="font-semibold text-red-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; c: string; label: string }> = {
    broadcasting: { bg: "#DBEAFE", c: "#1E40AF", label: "Broadcasting" },
    confirmed: { bg: "#D1FAE5", c: "#065F46", label: "Confirmed" },
    in_progress: { bg: "#FEF3C7", c: "#92400E", label: "In progress" },
    completed: { bg: "#E5E7EB", c: "#374151", label: "Completed" },
    cancelled: { bg: "#FEE2E2", c: "#991B1B", label: "Cancelled" },
    draft: { bg: "#F1F5F9", c: "#334155", label: "Draft" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: s.bg, color: s.c }}>
      {s.label}
    </span>
  );
}

function NewBookingDialog({ onClose }: { onClose: () => void }) {
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [procedure, setProcedure] = useState("");
  const [mode, setMode] = useState<"planned" | "emergency">("planned");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<SurgeryRoleKey[]>([]);
  const [roleFees, setRoleFees] = useState<Partial<Record<SurgeryRoleKey, string>>>({});
  const [otRoom, setOtRoom] = useState("");
  const [bloodUnits, setBloodUnits] = useState("");
  const [bloodGroup, setBloodGroup] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function applyPreset(p: (typeof PROCEDURE_PRESETS)[number]) {
    setProcedure(p.name);
    setSelectedRoles(p.roles);
  }

  function toggleRole(r: SurgeryRoleKey) {
    setSelectedRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function submit() {
    setErr(null);
    if (!patientName.trim() || !procedure.trim() || selectedRoles.length === 0) {
      setErr("Patient name, procedure, and at least one team role are required.");
      return;
    }
    setBusy(true);
    try {
      const fees: Partial<Record<SurgeryRoleKey, number | null>> = {};
      for (const r of selectedRoles) {
        const raw = roleFees[r];
        const num = raw != null && raw !== "" ? Number(raw) : NaN;
        fees[r] = Number.isFinite(num) ? num : null;
      }
      await createSurgeryBooking({
        patient_name: patientName.trim(),
        patient_phone: patientPhone.trim() || null,
        procedure: procedure.trim(),
        mode,
        scheduled_at: mode === "planned" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        notes: notes.trim() || null,
        roles: selectedRoles,
        ot_room: otRoom.trim() || null,
        blood_units: bloodUnits ? Math.max(0, parseInt(bloodUnits, 10) || 0) : null,
        blood_group: bloodGroup || null,
        role_fees: fees,
      });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create booking");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-extrabold" style={{ color: INK }}>New surgery booking</h3>
          <button onClick={onClose} className="text-slate-400">✕</button>
        </div>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Patient name"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={patientPhone}
              onChange={(e) => setPatientPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Procedure</label>
            <input
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              placeholder="e.g. C-section, Appendectomy…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PROCEDURE_PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Mode</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("planned")}
                className="rounded-lg border py-2 text-sm font-bold"
                style={{
                  borderColor: mode === "planned" ? TEAL : "#E5E7EB",
                  color: mode === "planned" ? TEAL : "#334155",
                  background: mode === "planned" ? "#F0FDFA" : "#fff",
                }}
              >
                Planned
              </button>
              <button
                type="button"
                onClick={() => setMode("emergency")}
                className="rounded-lg border py-2 text-sm font-bold"
                style={{
                  borderColor: mode === "emergency" ? "#EF4444" : "#E5E7EB",
                  color: mode === "emergency" ? "#EF4444" : "#334155",
                  background: mode === "emergency" ? "#FEF2F2" : "#fff",
                }}
              >
                🚨 Emergency
              </button>
            </div>
            {mode === "planned" && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Pick OT slot
                </p>
                <SlotPickerCalendarStandalone
                  days={14}
                  seed={`ot|${procedure || "custom"}`}
                  accent={TEAL}
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  size="md"
                />
                {scheduledAt && (
                  <p className="mt-2 text-[11.5px] font-semibold text-teal-700">
                    ✓ Scheduled for {new Date(scheduledAt).toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Required team + per-role fee (₹)</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {ALL_ROLES.map((r) => {
                const on = selectedRoles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className="rounded-lg border py-2 text-[12px] font-semibold"
                    style={{
                      borderColor: on ? TEAL : "#E5E7EB",
                      background: on ? "#F0FDFA" : "#fff",
                      color: on ? TEAL : "#334155",
                    }}
                  >
                    {on ? "✓ " : ""}{SURGERY_ROLE_LABELS[r]}
                  </button>
                );
              })}
            </div>
            {selectedRoles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {selectedRoles.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="w-32 text-[11.5px] font-semibold text-slate-600">{SURGERY_ROLE_LABELS[r]}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={roleFees[r] ?? ""}
                      onChange={(e) => setRoleFees((prev) => ({ ...prev, [r]: e.target.value }))}
                      placeholder="Fee (₹)"
                      className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">OT / Blood requirements</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <input
                value={otRoom}
                onChange={(e) => setOtRoom(e.target.value)}
                placeholder="OT room"
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={bloodUnits}
                onChange={(e) => setBloodUnits(e.target.value)}
                placeholder="Blood units"
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="">Group…</option>
                {BLOOD_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for the team (optional)"
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />

          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-bold text-slate-700">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 rounded-lg py-2 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: `linear-gradient(135deg,${TEAL},#14B8A6)` }}
          >
            {busy ? "Broadcasting…" : "Broadcast to team"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Provider ================= */

function ProviderInvites() {
  const { roles, bookings, loading, refresh } = useProviderSurgeryInvites();

  const bookingById = useMemo(() => {
    const m: Record<string, (typeof bookings)[number]> = {};
    for (const b of bookings) m[b.id] = b;
    return m;
  }, [bookings]);

  const [busy, setBusy] = useState<string | null>(null);

  async function accept(id: string) {
    setBusy(id);
    try { await acceptSurgeryRole(id); await refresh(); }
    finally { setBusy(null); }
  }
  async function decline(id: string) {
    setBusy(id);
    try { await declineSurgeryRole(id); await refresh(); }
    finally { setBusy(null); }
  }

  const pending = roles.filter((r) => r.status === "pending");
  const mine = roles.filter((r) => r.status === "accepted");

  return (
    <div className="space-y-4">
      <Section title="Open invitations">
        {loading ? <Muted>Loading…</Muted> :
          pending.length === 0 ? <Muted>No open surgery invitations right now.</Muted> :
          pending.map((r) => {
            const b = bookingById[r.booking_id];
            if (!b) return null;
            return (
              <InviteRow key={r.id} role={SURGERY_ROLE_LABELS[r.role]} booking={b} fee={r.fee} otRoom={b.ot_room} bloodUnits={b.blood_units} bloodGroup={b.blood_group}>
                <button
                  onClick={() => accept(r.id)}
                  disabled={busy === r.id}
                  className="rounded-full px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                  style={{ background: TEAL }}
                >
                  Accept
                </button>
                <button
                  onClick={() => decline(r.id)}
                  disabled={busy === r.id}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600 disabled:opacity-50"
                >
                  Decline
                </button>
              </InviteRow>
            );
          })
        }
      </Section>

      <Section title="My surgeries">
        {mine.length === 0 ? <Muted>You haven't accepted any surgeries yet.</Muted> :
          mine.map((r) => {
            const b = bookingById[r.booking_id];
            if (!b) return null;
            return (
              <div key={r.id} className="rounded-lg border border-slate-100 p-2">
                <InviteRow role={SURGERY_ROLE_LABELS[r.role]} booking={b} fee={r.fee} otRoom={b.ot_room} bloodUnits={b.blood_units} bloodGroup={b.blood_group}>
                  <StatusPill status={b.status} />
                </InviteRow>
                <RoleLifecyclePanel role={r} booking={b} side="provider" onChange={refresh} />
              </div>
            );
          })
        }
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <h3 className="text-sm font-bold" style={{ color: INK }}>{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}
function InviteRow({
  role, booking, children, fee, otRoom, bloodUnits, bloodGroup,
}: {
  role: string;
  booking: { procedure: string; mode: string; scheduled_at: string | null; patient_name: string };
  children: React.ReactNode;
  fee?: number | null;
  otRoom?: string | null;
  bloodUnits?: number | null;
  bloodGroup?: string | null;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-bold" style={{ color: INK }}>
          {booking.mode === "emergency" ? "🚨 " : ""}{booking.procedure} · <span style={{ color: TEAL }}>{role}</span>
          {fee ? <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">₹{fee}</span> : null}
        </div>
        <div className="text-[11px] text-slate-500 truncate">
          Patient: {booking.patient_name} ·{" "}
          {booking.mode === "planned" && booking.scheduled_at
            ? new Date(booking.scheduled_at).toLocaleString()
            : "ASAP"}
        </div>
        {(otRoom || bloodUnits || bloodGroup) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {otRoom && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">OT: {otRoom}</span>
            )}
            {(bloodUnits || bloodGroup) && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                🩸 {bloodUnits ? `${bloodUnits} unit${bloodUnits > 1 ? "s" : ""}` : ""}{bloodUnits && bloodGroup ? " · " : ""}{bloodGroup ?? ""}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
    </div>
  );
}

/* ================= Lifecycle panel (OTP · chat · rating) ================= */

function RoleLifecyclePanel({
  role, booking, side, onChange,
}: {
  role: SurgeryRole;
  booking: SurgeryBooking;
  side: "hub" | "provider";
  onChange: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpErr, setOtpErr] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const counterpartId =
    side === "hub" ? role.assigned_to : booking.facility_id;

  const verified = !!role.otp_verified_at;
  const completed = role.status === "accepted" && !!role.completed_at;
  const chatExpired = !!role.chat_expires_at && new Date(role.chat_expires_at).getTime() < Date.now();

  async function runHubConfirm() {
    setBusy(true);
    try { await hubConfirmSurgeryRole(role.id); await onChange(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function runOtpExchanged() {
    setBusy(true);
    try { await confirmSurgeryOtpExchanged(role.id); await onChange(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function runVerifyOtp() {
    setOtpErr(null); setBusy(true);
    try {
      const ok = await providerVerifySurgeryOtp(role.id, otpInput.trim());
      if (!ok) { setOtpErr("Wrong OTP"); return; }
      setOtpInput("");
      await onChange();
    } finally { setBusy(false); }
  }
  async function runComplete() {
    setBusy(true);
    try { await completeSurgeryRole(role.id); await onChange(); }
    finally { setBusy(false); }
  }

  const myRating = side === "hub" ? role.rating_hub : role.rating_provider;

  const overdue = !!role.arrival_deadline && !verified && new Date(role.arrival_deadline).getTime() < Date.now();

  async function runFail() {
    if (!confirm("Mark this team member as no-show?")) return;
    setBusy(true);
    try { await failSurgeryRole(role.id); await onChange(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold" style={{ color: INK }}>
          {SURGERY_ROLE_LABELS[role.role]} · lifecycle
        </div>
        {role.arrival_deadline && !completed && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              background: overdue ? "#FEE2E2" : "#EEF2FF",
              color: overdue ? "#B91C1C" : "#3730A3",
            }}
          >
            {overdue ? "⏱ Overdue" : "⏱"} {new Date(role.arrival_deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {side === "hub" && overdue && !completed && (
        <button
          onClick={runFail}
          disabled={busy}
          className="w-full rounded-lg border border-red-200 bg-red-50 py-1.5 text-[11px] font-bold text-red-700 disabled:opacity-50"
        >
          Mark no-show
        </button>
      )}

      {/* Stage 1: hub confirms → OTP */}
      {!role.paid_at && side === "hub" && (
        <button
          onClick={runHubConfirm}
          disabled={busy}
          className="w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-50"
          style={{ background: TEAL }}
        >
          Confirm engagement & generate OTP
        </button>
      )}
      {!role.paid_at && side === "provider" && (
        <p className="text-[11px] text-slate-500">Waiting for hub to confirm engagement…</p>
      )}

      {/* Stage 2: OTP exchange */}
      {role.paid_at && !verified && (
        <div className="rounded-md bg-white p-2">
          {side === "hub" ? (
            <>
              <p className="text-[11px] font-semibold text-slate-600">Share OTP with {SURGERY_ROLE_LABELS[role.role]}</p>
              <p className="my-1 text-center text-2xl font-black tracking-[6px]" style={{ color: TEAL }}>
                {role.otp ?? SURGERY_TEST_OTP}
              </p>
              <button
                onClick={runOtpExchanged}
                disabled={busy}
                className="w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-50"
              >
                Mark OTP exchanged
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold text-slate-600">Enter OTP from hub</p>
              <div className="mt-1 flex gap-1.5">
                <input
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="0000"
                  className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-center text-sm tracking-[4px]"
                />
                <button
                  onClick={runVerifyOtp}
                  disabled={busy || !otpInput.trim()}
                  className="rounded-md px-3 text-[11px] font-bold text-white disabled:opacity-50"
                  style={{ background: TEAL }}
                >
                  Verify
                </button>
              </div>
              {otpErr && <p className="mt-1 text-[10.5px] text-red-600">{otpErr}</p>}
              <button
                onClick={runOtpExchanged}
                disabled={busy}
                className="mt-1.5 w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-50"
              >
                Or tap: OTP exchanged in person
              </button>
            </>
          )}
        </div>
      )}

      {/* Stage 3: chat + complete */}
      {verified && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              ✓ OTP exchanged
            </span>
            {role.chat_expires_at && (
              <span className="text-[10px] text-slate-500">
                Chat {chatExpired ? "closed" : `open · until ${new Date(role.chat_expires_at).toLocaleString()}`}
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowChat((s) => !s)}
              disabled={chatExpired && !showChat}
              className="flex-1 rounded-lg border border-slate-200 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-50"
            >
              💬 {showChat ? "Hide chat" : chatExpired ? "Chat closed" : "Open chat"}
            </button>
            {!completed && (
              <button
                onClick={runComplete}
                disabled={busy}
                className="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                style={{ background: TEAL }}
              >
                Mark completed
              </button>
            )}
          </div>
          {showChat && (
            <SurgeryChat
              roleId={role.id}
              counterpartId={counterpartId ?? null}
              chatExpiresAt={role.chat_expires_at}
            />
          )}
        </div>
      )}

      {/* Stage 4: rating */}
      {completed && (
        <div className="rounded-md bg-white p-2">
          <p className="text-[11px] font-semibold text-slate-600">
            {side === "hub" ? "Rate the team member" : "Rate the hub"}
          </p>
          <StarRow
            value={myRating ?? 0}
            disabled={busy || !!myRating}
            onPick={async (v) => {
              setBusy(true);
              try { await rateSurgeryRole(role.id, side, v); await onChange(); }
              finally { setBusy(false); }
            }}
          />
          {myRating ? (
            <p className="mt-1 text-[10.5px] text-slate-500">Thanks — your rating is saved.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StarRow({ value, disabled, onPick }: { value: number; disabled?: boolean; onPick: (v: number) => void }) {
  return (
    <div className="mt-1 flex gap-1">
      {[1,2,3,4,5].map((n) => (
        <button
          key={n}
          disabled={disabled}
          onClick={() => onPick(n)}
          className="text-2xl leading-none disabled:cursor-not-allowed"
          style={{ color: n <= value ? "#F59E0B" : "#CBD5E1" }}
          aria-label={`${n} star`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function SurgeryChat({
  roleId, counterpartId, chatExpiresAt,
}: { roleId: string; counterpartId: string | null; chatExpiresAt: string | null }) {
  const { messages, send, meId, ready, expired } = useSurgeryRoleChat(roleId, counterpartId, chatExpiresAt);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div ref={scrollRef} className="max-h-56 overflow-y-auto p-2 space-y-1.5">
        {!ready ? (
          <p className="text-[11px] text-slate-400">Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className="text-[11px] text-slate-400">No messages yet — say hello.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] rounded-2xl px-3 py-1.5 text-[12px]"
                  style={{
                    background: mine ? TEAL : "#F1F5F9",
                    color: mine ? "#fff" : INK,
                  }}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim() || expired) return;
          const ok = await send(text);
          if (ok) setText("");
        }}
        className="flex gap-1.5 border-t border-slate-100 p-1.5"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={expired}
          placeholder={expired ? "Chat window closed" : "Message…"}
          className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-[12px] disabled:bg-slate-50"
        />
        <button
          type="submit"
          disabled={expired || !text.trim()}
          className="rounded-md px-3 text-[11px] font-bold text-white disabled:opacity-40"
          style={{ background: TEAL }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

function BookingAuditTimeline({ bookingId }: { bookingId: string }) {
  const { events, loading } = useSurgeryBookingAuditLog(bookingId);
  const [open, setOpen] = useState(false);
  if (loading || events.length === 0) return null;
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="mt-2 rounded-lg bg-slate-50 p-2"
    >
      <summary className="cursor-pointer text-[11px] font-bold text-slate-600">
        Timeline · {events.length} events
      </summary>
      <ul className="mt-2 space-y-1">
        {events.slice().reverse().map((e) => (
          <li key={e.id} className="flex items-start gap-2 text-[10.5px] text-slate-600">
            <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: TEAL }} />
            <div className="min-w-0">
              <div className="font-semibold">{e.note ?? e.event_type}</div>
              <div className="text-slate-400">
                {new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {e.actor_role ? ` · ${e.actor_role}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

