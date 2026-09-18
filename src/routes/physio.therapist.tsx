import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  claimPhysioVisit,
  getTherapistBoard,
  getTherapistProfile,
  saveTherapistProfile,
  setPhysioVisitStage,
  setTherapistOnline,
  type TherapistProfileInput,
  type TherapistVisit,
  insertEmergencyPhysioVisit,
} from "@/lib/physio-therapist.functions";
import { listCareVenues, venueKindLabel } from "@/lib/care-venues.functions";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UnifiedProviderOffers } from "@/features/bookings/UnifiedProviderOffers";
import { useLiveCareRequests, acceptCareRequest, matchesDoctorSpecialty, verifyAndCompleteConsultation } from "@/features/mydox/backend";
import {
  LANGUAGES,
  PHYSIO_QUALIFICATIONS,
  PHYSIO_SPECIALIZATIONS,
  PUNE_AREAS,
} from "@/lib/care-staff-catalog";
import {
  Card,
  Chips,
  Empty,
  Field,
  OnlineToggle,
  Section,
  StaffShell,
  Stat,
  Switch,
  Tabs,
  fmtWhen,
  inputClass,
} from "@/features/careteam/StaffUI";

export const Route = createFileRoute("/physio/therapist")({
  head: () => ({
    meta: [
      { title: "Physiotherapist Home — MedConnect" },
      {
        name: "description",
        content:
          "Physiotherapist portal: go online, see today's sessions, upcoming visits and past history, pick your preferred clinics and centres, and move sessions from on-the-way to completed.",
      },
      { property: "og:title", content: "Physiotherapist Home — MedConnect" },
      {
        property: "og:description",
        content: "Go online, manage today's and future physiotherapy sessions and set your preferred centres.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TherapistHome,
  ssr: false,
});

type Tab = "today" | "open" | "upcoming" | "history" | "profile";

const NEXT_STAGES: Record<string, { stage: string; label: string }[]> = {
  assigned: [
    { stage: "confirmed", label: "Confirm this session" },
    { stage: "cancelled", label: "Can't take it" },
  ],
  confirmed: [
    { stage: "en_route", label: "I'm on the way" },
    { stage: "cancelled", label: "Cancel" },
  ],
  en_route: [
    { stage: "in_progress", label: "Start session" },
    { stage: "no_show", label: "Patient not available" },
  ],
  in_progress: [{ stage: "completed", label: "Complete session" }],
  requested: [{ stage: "confirmed", label: "Accept session" }],
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Awaiting assignment",
  assigned: "Needs your confirmation",
  confirmed: "Confirmed",
  en_route: "On the way",
  in_progress: "In progress",
  completed: "Session over",
  cancelled: "Cancelled",
  no_show: "Patient absent",
};

const CLOSED = ["completed", "cancelled", "no_show"];

/* ═══ Bottom Sheet: Session Over Dialog (matching doctor Consultation Over flow) ═══ */
function SessionOverDialog({
  visit,
  onClose,
  onConfirm,
}: {
  visit: TherapistVisit;
  onClose: () => void;
  onConfirm: (visit: TherapistVisit, notes: string) => void;
}) {
  const [notes, setNotes] = useState(() => (visit.notes && visit.notes.includes("request (ID:")) ? "" : (visit.notes ?? ""));
  const [otp, setOtp] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setOtp(val);
    if (errorMsg) setErrorMsg("");
  };

  const handleVerify = async () => {
    if (otp.length !== 4 || busy) return;
    setBusy(true);
    setErrorMsg("");
    try {
      const res = await verifyAndCompleteConsultation(visit.id, otp, notes);
      if (res.success) {
        onConfirm(visit, notes);
      } else {
        setErrorMsg(res.error || "Incorrect OTP. Ask the patient to read the code shown in their app.");
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to verify session OTP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Session over"
        style={{
          background: "#ffffff",
          width: "100%",
          maxWidth: 540,
          borderRadius: "24px 24px 0 0",
          padding: "20px 20px calc(24px + env(safe-area-inset-bottom))",
          boxShadow: "0 -10px 30px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F172A" }}>
              Session over
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
              Patient: <strong style={{ color: "#0F172A" }}>{visit.patientName}</strong> · {visit.therapyLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "#F1F5F9",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475569",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        {/* Section A: Notes */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
              Therapist's Instructions & Notes
            </label>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>{notes.length}/1000</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
            maxLength={1000}
            rows={4}
            placeholder="Advice, exercise plan, recovery observations, follow-up…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1.5px solid #E2E8F0",
              fontSize: 13.5,
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              color: "#0F172A",
              background: "#F8FAFC",
            }}
          />
        </div>

        {/* Section B: 4-digit OTP */}
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
            Patient Verification Code
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={handleOtpChange}
            placeholder="• • • •"
            maxLength={4}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 16px",
              borderRadius: 14,
              border: errorMsg ? "1.5px solid #EF4444" : "1.5px solid #E2E8F0",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "12px",
              textAlign: "center",
              fontFamily: "monospace",
              outline: "none",
              color: "#0F172A",
              background: "#F8FAFC",
            }}
          />
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#64748B", textAlign: "center" }}>
            Ask the patient to read the 4-digit code shown in their app
          </p>
          {errorMsg && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#DC2626", fontWeight: 600, textAlign: "center" }}>
              {errorMsg}
            </p>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleVerify}
          disabled={otp.length !== 4 || busy}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: "none",
            background: otp.length === 4 && !busy ? "#0D9488" : "#CBD5E1",
            color: "#ffffff",
            fontSize: 14.5,
            fontWeight: 800,
            cursor: otp.length === 4 && !busy ? "pointer" : "not-allowed",
            transition: "all 0.15s",
            boxShadow: otp.length === 4 && !busy ? "0 4px 12px rgba(13,148,136,0.3)" : "none",
          }}
        >
          {busy ? "Verifying with backend…" : "Verify OTP & close"}
        </button>
      </div>
    </div>
  );
}

function VisitCard({
  v,
  note,
  onNote,
  onStage,
  onClaim,
  busy,
}: {
  v: TherapistVisit;
  note?: string;
  onNote?: (val: string) => void;
  onStage?: (id: string, stage: string) => void;
  onClaim?: (id: string) => void;
  busy?: boolean;
}) {
  let displayFee = v.fee ?? 0;
  if (v.urgency === "urgent") {
    if (displayFee === 700) displayFee = 840;
    if (displayFee === 1500) displayFee = 1800;
  }

  return (
    <Card accent={!!onClaim || v.urgency === "urgent"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold">
            {v.patientName} · {v.therapyLabel}
          </div>
          <div className="text-xs text-slate-500">
            {fmtWhen(v.scheduledAt)} · {v.durationMin} min · session {v.sessionNumber}
          </div>
          <div className="text-xs text-slate-500">
            {v.area}, {v.city}
            {v.address ? ` · ${v.address}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-700">₹{displayFee}</div>
          <div className="mt-1 text-[10px] font-semibold text-slate-500">{STATUS_LABEL[v.status] ?? v.status}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
        {v.urgency === "urgent" ? <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">Urgent</span> : null}
        <span className="rounded-full bg-slate-50 px-2 py-1 text-slate-600">
          {v.fromPack
            ? "Paid from session pack"
            : v.paymentStatus === "paid"
              ? `Paid ₹${displayFee}`
              : `Payment pending ₹${displayFee}`}
        </span>
      </div>

      {v.notes && !v.notes.includes("request (ID:") ? (
        <div className="mt-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-700">
          <span className="font-semibold text-slate-500">
            {v.status === "completed" ? "Session notes: " : "Note: "}
          </span>
          {v.notes}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {onClaim ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onClaim(v.id)}
            className="min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            Take this session
          </button>
        ) : null}
        {onStage
          ? (NEXT_STAGES[v.status] ?? []).map((a) => (
              <button
                key={a.stage}
                type="button"
                disabled={busy}
                onClick={() => onStage(v.id, a.stage)}
                className={`min-h-[40px] rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-60 ${
                  a.stage === "cancelled" || a.stage === "no_show"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-teal-600 text-white"
                }`}
              >
                {a.label}
              </button>
            ))
          : null}
      </div>
    </Card>
  );
}

function TherapistHome() {
  const fetchBoard = useServerFn(getTherapistBoard);
  const fetchProfile = useServerFn(getTherapistProfile);
  const fetchVenues = useServerFn(listCareVenues);
  const saveProfileFn = useServerFn(saveTherapistProfile);
  const goOnline = useServerFn(setTherapistOnline);
  const setStage = useServerFn(setPhysioVisitStage);
  const claimVisit = useServerFn(claimPhysioVisit);
  const insertVisit = useServerFn(insertEmergencyPhysioVisit);
  const qc = useQueryClient();

  const signOut = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("mc_view");
      window.location.href = "/";
    }
  };

  const [tab, setTab] = useState<Tab>("today");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  const board = useQuery({ queryKey: ["therapist-board"], queryFn: () => fetchBoard({}), refetchInterval: 30_000 });
  const profileQ = useQuery({ queryKey: ["therapist-profile"], queryFn: () => fetchProfile({}) });
  const venues = useQuery({ queryKey: ["care-venues"], queryFn: () => fetchVenues({}), staleTime: 5 * 60_000 });

  const profile = profileQ.data?.profile ?? null;

  const [form, setForm] = useState<TherapistProfileInput>({
    fullName: "",
    phone: "",
    specializations: [],
    qualification: "bpt",
    registrationNumber: "",
    yearsExperience: 0,
    areas: [],
    city: "Pune",
    homeVisits: true,
    clinicVisits: true,
    preferredFacilities: [],
    languages: [],
    bio: "",
    recentCourses: "",
    specialInterests: "",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.fullName,
      phone: profile.phone ?? "",
      specializations: profile.specializations,
      qualification: profile.qualification ?? "bpt",
      registrationNumber: profile.registrationNumber ?? "",
      yearsExperience: profile.yearsExperience ?? 0,
      areas: profile.areas,
      city: profile.city,
      homeVisits: profile.homeVisits,
      clinicVisits: profile.clinicVisits,
      preferredFacilities: profile.preferredFacilities,
      languages: profile.languages,
      bio: profile.bio ?? "",
      recentCourses: profile.recentCourses ?? "",
      specialInterests: profile.specialInterests ?? "",
    });
  }, [profile]);

  useEffect(() => {
    if (profileQ.data && !profileQ.data.profile) setTab("profile");
  }, [profileQ.data]);

  const online = useMutation({
    mutationFn: (v: boolean) => goOnline({ data: { online: v } }),
    onSuccess: (r: any) => {
      setNotice(r?.online ? "You are online — new session requests will reach you." : "You are offline.");
      qc.invalidateQueries({ queryKey: ["therapist-profile"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not change your status"),
  });

  const save = useMutation({
    mutationFn: (v: TherapistProfileInput) => saveProfileFn({ data: v }),
    onSuccess: () => {
      setNotice("Profile saved — patients booking these therapies can now be matched to you.");
      qc.invalidateQueries({ queryKey: ["therapist-profile"] });
      qc.invalidateQueries({ queryKey: ["therapist-board"] });
      setTab("today");
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not save your profile"),
  });

  const stageMut = useMutation({
    mutationFn: (v: { visitId: string; stage: string; note?: string | null }) => setStage({ data: v }),
    onSuccess: () => {
      setNotice("Session updated — the patient has been notified.");
      qc.invalidateQueries({ queryKey: ["therapist-board"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not update the session"),
  });

  const claim = useMutation({
    mutationFn: (visitId: string) => claimVisit({ data: { visitId } }),
    onSuccess: (_data, visitId) => {
      setNotice("Session taken — confirm the slot to let the patient know.");
      qc.invalidateQueries({ queryKey: ["therapist-board"] });
      const claimedVisit = (board.data?.openRequests ?? []).find((v) => v.id === visitId);
      if (claimedVisit?.scheduledAt) {
        const sod = new Date();
        sod.setHours(0, 0, 0, 0);
        const eod = sod.getTime() + 24 * 3600_000;
        const t = new Date(claimedVisit.scheduledAt).getTime();
        if (t >= eod) {
          setTab("upcoming");
          return;
        }
      }
      setTab("today");
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not take this session"),
  });

  const toggle = (key: "specializations" | "areas" | "preferredFacilities" | "languages", value: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));

  const venueOptions = useMemo(
    () =>
      (venues.data?.venues ?? []).map((v) => ({
        value: v.name,
        label: v.area ? `${v.name} · ${v.area}` : v.name,
        group: venueKindLabel(v.kind),
      })),
    [venues.data],
  );

  const data = board.data;
  const visits = data?.visits ?? [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = startOfDay.getTime() + 24 * 3600_000;

  const today = visits.filter((v) => {
    const t = v.scheduledAt ? new Date(v.scheduledAt).getTime() : null;
    return !CLOSED.includes(v.status) && t != null && t >= startOfDay.getTime() && t < endOfDay;
  });
  const upcoming = visits.filter((v) => {
    const t = v.scheduledAt ? new Date(v.scheduledAt).getTime() : null;
    return !CLOSED.includes(v.status) && (t == null || t >= endOfDay);
  });
  const history = visits.filter((v) => CLOSED.includes(v.status));
  const openRequests = data?.openRequests ?? [];
  const [sessionOverVisit, setSessionOverVisit] = useState<TherapistVisit | null>(null);

  const stageProps = (v: TherapistVisit) => ({
    note: notes[v.id],
    onNote: (val: string) => setNotes((n) => ({ ...n, [v.id]: val })),
    onStage: (id: string, s: string) => {
      if (s === "completed") {
        setSessionOverVisit(v);
        return;
      }
      setNotice("");
      stageMut.mutate({ visitId: id, stage: s, note: notes[id] ?? null });
    },
    busy: stageMut.isPending,
  });

  const handleSessionOverConfirm = (_visit: TherapistVisit, _completionNotes: string) => {
    setSessionOverVisit(null);
    setNotice("Session completed — patient verified with OTP.");
    qc.invalidateQueries({ queryKey: ["therapist-board"] });
  };

  const isOnline = profile ? profile.isOnline : true;
  const { rows: liveCareRequests } = useLiveCareRequests(isOnline);
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<Record<string, boolean>>({});
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const activeLiveCareRequest = useMemo(() => {
    if (!isOnline) return null;
    return (liveCareRequests || []).find(r =>
      r.status === "open" &&
      !dismissedBroadcastIds[r.id] &&
      matchesDoctorSpecialty("Physiotherapy", r.specialty)
    ) || null;
  }, [liveCareRequests, isOnline, dismissedBroadcastIds]);

  const handleAcceptCareRequest = async (reqId: string) => {
    setAcceptingId(reqId);
    try {
      const cr = await acceptCareRequest(reqId);
      if (cr && (String(cr.specialty || "").toLowerCase().includes("physio") || String(cr.specialty || "").toLowerCase().includes("therap"))) {
        const { data: pData } = await supabase.from("profiles").select("full_name").eq("id", cr.patient_id).maybeSingle();
        await insertVisit({
          data: {
            reqId: cr.id,
            patientId: cr.patient_id,
            patientName: pData?.full_name || "Emergency Patient",
            specialty: cr.specialty || "Physiotherapy",
            fare: cr.fare ? Math.round(cr.fare * 1.2) : Math.round(700 * 1.2)
          }
        });
      }
      setNotice("Physiotherapy request accepted! Patient has been notified.");
      qc.invalidateQueries({ queryKey: ["therapist-board"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not accept request.";
      setNotice(msg);
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <StaffShell
      title="Physiotherapist home"
      subtitle={
        profile
          ? `${profile.fullName} · ${profile.specializations.length} therapies · ${profile.areas[0] ?? profile.city}`
          : "Set up your therapy profile"
      }
      right={
        <div className="flex items-center gap-3">
          {profile ? (
            <OnlineToggle
              online={profile.isOnline}
              busy={online.isPending}
              onChange={(v) => online.mutate(v)}
              onlineLabel="Taking sessions"
            />
          ) : null}
          <button
            type="button"
            onClick={() => setTab("profile")}
            className="min-h-[36px] rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-700"
          >
            Profile & settings
          </button>
          <button
            type="button"
            onClick={signOut}
            className="min-h-[36px] rounded-full bg-slate-900 px-3 text-xs font-bold text-white"
          >
            Log out
          </button>
        </div>
      }
    >
      {board.isLoading || profileQ.isLoading ? (
        <Empty>Loading your sessions…</Empty>
      ) : board.isError ? (
        <Empty>
          {board.error instanceof Error ? board.error.message : "Could not load your sessions."}{" "}
          <Link to="/auth" search={{ admin: undefined, next: undefined }} className="font-semibold underline">
            Sign in
          </Link>
        </Empty>
      ) : (
        <>
          {data?.therapist ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="To confirm" value={data.totals.toConfirm} />
              <Stat label="Today" value={data.totals.today} />
              <Stat label="Upcoming" value={data.totals.upcoming} />
              <Stat label="Completed (30d)" value={data.totals.completed30d} tone="slate" />
              <Stat label="Earnings (30d)" value={`₹${data.totals.earnings30d}`} />
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-teal-700">{notice}</div>
          ) : null}

          {activeLiveCareRequest && (
            <div className="rounded-2xl border-2 border-teal-500 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-3 rounded-full bg-teal-500 animate-ping" />
                  <span className="text-xs font-black uppercase tracking-wider text-teal-800">
                    ⚡ Live Incoming Broadcast · {activeLiveCareRequest.specialty || "Physiotherapy"}
                  </span>
                </div>
                {activeLiveCareRequest.emergency ? (
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-extrabold text-red-700">
                    EMERGENCY (≤2h)
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    New {activeLiveCareRequest.specialty || "Physiotherapy"} Request
                  </h3>
                  <p className="text-xs text-slate-600">
                    {activeLiveCareRequest.notes?.replace(/^Hub:\s*/, "") || "Nearby Pune Area"} · First to accept wins
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-teal-800">
                    ₹{activeLiveCareRequest.fare || 700}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setDismissedBroadcastIds(prev => ({ ...prev, [activeLiveCareRequest.id]: true }))}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Decline
                </button>
                <button
                  type="button"
                  disabled={acceptingId === activeLiveCareRequest.id}
                  onClick={() => handleAcceptCareRequest(activeLiveCareRequest.id)}
                  className="flex-1 rounded-xl bg-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-teal-700 disabled:opacity-50"
                >
                  {acceptingId === activeLiveCareRequest.id ? "Accepting..." : "Accept Request · Start Visit"}
                </button>
              </div>
            </div>
          )}

          <UnifiedProviderOffers roleLabel="physiotherapy" />

          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "today", label: "Today", count: today.length },
              { value: "open", label: "New requests", count: openRequests.length },
              { value: "upcoming", label: "Upcoming", count: upcoming.length },
              { value: "history", label: "History", count: history.length },
              { value: "profile", label: "My profile" },
            ]}
          />

          {tab === "today" ? (
            <Section title="Today's sessions" count={today.length}>
              {!today.length ? (
                <Empty>No sessions booked for today.</Empty>
              ) : (
                <div className="space-y-3">
                  {today.map((v) => (
                    <VisitCard key={v.id} v={v} {...stageProps(v)} />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "open" ? (
            <Section title="New requests near you" count={openRequests.length}>
              {!openRequests.length ? (
                <Empty>No unassigned home sessions in {data?.therapist?.city ?? "your city"} right now.</Empty>
              ) : (
                <div className="space-y-3">
                  {openRequests.map((v) => (
                    <VisitCard
                      key={v.id}
                      v={v}
                      busy={claim.isPending}
                      onClaim={(id) => {
                        setNotice("");
                        claim.mutate(id);
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "upcoming" ? (
            <Section title="Upcoming sessions" count={upcoming.length}>
              {!upcoming.length ? (
                <Empty>Nothing scheduled ahead yet.</Empty>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((v) => (
                    <VisitCard key={v.id} v={v} {...stageProps(v)} />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "history" ? (
            <Section title="Recent history" count={history.length}>
              {!history.length ? (
                <Empty>Nothing closed in the last 30 days.</Empty>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Patient</th>
                        <th className="px-3 py-2">Therapy</th>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Outcome</th>
                        <th className="px-3 py-2">Fee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((v) => (
                        <tr key={v.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold">{v.patientName}</td>
                          <td className="px-3 py-2">{v.therapyLabel}</td>
                          <td className="px-3 py-2">{fmtWhen(v.scheduledAt)}</td>
                          <td className="px-3 py-2">{STATUS_LABEL[v.status] ?? v.status}</td>
                          <td className="px-3 py-2">₹{v.fee ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          ) : null}

          {tab === "profile" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setNotice("");
                save.mutate(form);
              }}
            >
              <Card>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name">
                    <input
                      className={inputClass}
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      className={inputClass}
                      value={form.phone ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </Field>
                  <Field label="Qualification">
                    <select
                      className={inputClass}
                      value={form.qualification ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))}
                    >
                      {PHYSIO_QUALIFICATIONS.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Registration number">
                    <input
                      className={inputClass}
                      value={form.registrationNumber ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                    />
                  </Field>
                  <Field label="Years of experience">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      className={inputClass}
                      value={form.yearsExperience ?? 0}
                      onChange={(e) => setForm((f) => ({ ...f, yearsExperience: Number(e.target.value) }))}
                    />
                  </Field>
                  <Field label="City">
                    <input
                      className={inputClass}
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </Field>
                </div>
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Therapies you offer</h3>
                <Chips
                  options={PHYSIO_SPECIALIZATIONS}
                  selected={form.specializations}
                  onToggle={(v) => toggle("specializations", v)}
                />
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Where you work</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Switch on={form.homeVisits} onChange={(v) => setForm((f) => ({ ...f, homeVisits: v }))} label="Home visits" />
                  <Switch
                    on={form.clinicVisits}
                    onChange={(v) => setForm((f) => ({ ...f, clinicVisits: v }))}
                    label="Clinics, centres & hospitals"
                  />
                </div>
                <div className="mt-3">
                  <h4 className="mb-1 text-xs font-bold text-slate-700">
                    Physiotherapy centres, clinics & hospitals you prefer
                  </h4>
                  {venues.isLoading ? (
                    <p className="text-xs text-slate-500">Loading places…</p>
                  ) : (
                    <Chips
                      options={venueOptions}
                      selected={form.preferredFacilities}
                      onToggle={(v) => toggle("preferredFacilities", v)}
                      grouped
                    />
                  )}
                </div>
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Areas you cover</h3>
                <Chips
                  options={PUNE_AREAS.map((a) => ({ value: a, label: a }))}
                  selected={form.areas}
                  onToggle={(v) => toggle("areas", v)}
                />
                <h4 className="mt-3 mb-1 text-xs font-bold text-slate-700">Languages</h4>
                <Chips
                  options={LANGUAGES}
                  selected={form.languages}
                  onToggle={(v) => toggle("languages", v)}
                />
                <textarea
                  rows={3}
                  maxLength={1000}
                  className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder="Short summary patients will see (optional)"
                  value={form.bio ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                />
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Recent courses & special interest</h3>
                <div className="space-y-3">
                  <Field label="New courses, certifications or specialities completed">
                    <textarea
                      rows={3}
                      maxLength={1000}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                      placeholder="e.g. Certified Dry Needling (2026), Advanced Manual Therapy — Pune, Vestibular rehab course"
                      value={form.recentCourses ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, recentCourses: e.target.value }))}
                    />
                  </Field>
                  <Field label="Special interest">
                    <textarea
                      rows={2}
                      maxLength={500}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                      placeholder="e.g. post-stroke gait training, sports shoulder, paediatric neuro"
                      value={form.specialInterests ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, specialInterests: e.target.value }))}
                    />
                  </Field>
                </div>
              </Card>

              <Card>
                <h3 className="mb-1 text-sm font-extrabold">Account</h3>
                <p className="mb-3 text-xs text-slate-500">Sign out of this device.</p>
                <button
                  type="button"
                  onClick={signOut}
                  className="min-h-[44px] w-full rounded-full border border-slate-300 px-6 text-sm font-bold text-slate-700"
                >
                  Log out
                </button>
              </Card>

              <button
                type="submit"
                disabled={save.isPending}
                className="min-h-[48px] w-full rounded-full bg-teal-600 px-6 text-sm font-bold text-white disabled:opacity-60"
              >
                {save.isPending ? "Saving…" : profile ? "Save profile" : "Create my physiotherapist profile"}
              </button>
            </form>
          ) : null}
        </>
      )}

      {sessionOverVisit && (
        <SessionOverDialog
          visit={sessionOverVisit}
          onClose={() => setSessionOverVisit(null)}
          onConfirm={handleSessionOverConfirm}
        />
      )}
    </StaffShell>
  );
}
