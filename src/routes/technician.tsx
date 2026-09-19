import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useLiveCareRequests, acceptCareRequest, matchesDoctorSpecialty } from "@/features/mydox/backend";
import {
  claimTechnicianTest,
  getTechnicianBoard,
  saveTechnicianProfile,
  setTechnicianOnline,
  setTechnicianTestStage,
  type TechnicianJob,
  type TechnicianProfileInput,
} from "@/lib/technician.functions";
import { listCareVenues, venueKindLabel } from "@/lib/care-venues.functions";
import { UnifiedProviderOffers } from "@/features/bookings/UnifiedProviderOffers";
import { PUNE_AREAS, TECHNICIAN_QUALIFICATIONS, TECHNICIAN_TESTS, LANGUAGES } from "@/lib/care-staff-catalog";
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
import { TechnicianRequestsPanel } from "@/features/mydox/technician/TechnicianRequestsPanel";
import { verifyAndCompleteConsultation } from "@/features/mydox/backend";

export const Route = createFileRoute("/technician")({
  head: () => ({
    meta: [
      { title: "Technician Test Home — MedConnect" },
      {
        name: "description",
        content:
          "Technician portal: list the tests you can run — EMG, NCS, EEG, VEP, BERA, VNG, ECG, X-ray, audiometry — go online, and manage today's, upcoming and past test jobs with machine pickup from tie-up hubs.",
      },
      { property: "og:title", content: "Technician Test Home — MedConnect" },
      {
        property: "og:description",
        content: "Pick your tests, go online and run home, clinic and hub test jobs with machine pickup guidance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechnicianHome,
  ssr: false,
});

type Tab = "today" | "open" | "upcoming" | "history" | "profile";

const CLOSED = ["completed", "cancelled", "no_show"];

/* ═══ Bottom Sheet: Session Over Dialog (matching doctor Consultation Over flow) ═══ */
function SessionOverDialog({
  job,
  onClose,
  onConfirm,
}: {
  job: TechnicianJob;
  onClose: () => void;
  onConfirm: (job: TechnicianJob, notes: string) => void;
}) {
  const [notes, setNotes] = useState(job.findings ?? "");
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
      const res = await verifyAndCompleteConsultation(job.id, otp, notes);
      if (res.success) {
        onConfirm(job, notes);
      } else {
        setErrorMsg(res.error || "Incorrect OTP. Ask the patient to read the code shown in their app.");
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to verify test OTP.");
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
        aria-label="Test complete"
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F172A" }}>
              Test complete
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
              Patient: <strong style={{ color: "#0F172A" }}>{job.patientName}</strong> · {job.testLabel}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#475569", fontSize: 16, fontWeight: 700 }}>✕</button>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Technician findings / Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
            maxLength={2000}
            rows={4}
            placeholder="Preliminary findings, observations during test..."
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 14, border: "1.5px solid #E2E8F0", fontSize: 13.5, fontFamily: "inherit", resize: "none", outline: "none", color: "#0F172A", background: "#F8FAFC" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Patient Verification Code</label>
          <input type="text" inputMode="numeric" value={otp} onChange={handleOtpChange} placeholder="• • • •" maxLength={4}
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px", borderRadius: 14, border: errorMsg ? "1.5px solid #EF4444" : "1.5px solid #E2E8F0", fontSize: 24, fontWeight: 800, letterSpacing: "12px", textAlign: "center", fontFamily: "monospace", outline: "none", color: "#0F172A", background: "#F8FAFC" }}
          />
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#64748B", textAlign: "center" }}>Ask the patient to read the 4-digit code shown in their app</p>
          {errorMsg && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#DC2626", fontWeight: 600, textAlign: "center" }}>{errorMsg}</p>}
        </div>
        <button type="button" onClick={handleVerify} disabled={otp.length !== 4 || busy}
          style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: otp.length === 4 && !busy ? "#0D9488" : "#CBD5E1", color: "#ffffff", fontSize: 14.5, fontWeight: 800, cursor: otp.length === 4 && !busy ? "pointer" : "not-allowed" }}>
          {busy ? "Verifying..." : "Verify OTP & complete test"}
        </button>
      </div>
    </div>
  );
}

function VenueTag({ job }: { job: TechnicianJob }) {
  const label = job.venueKind === "home" ? "Home visit" : job.venueKind === "hub" ? "At tie-up hub" : "Clinic / hospital";
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{label}</span>;
}

function TestCard({
  job,
  onClaim,
  onStage,
  busy,
  note,
  onNote,
}: {
  job: TechnicianJob;
  onClaim?: (id: string) => void;
  onStage?: (id: string, stage: string) => void;
  busy?: boolean;
  note?: string;
  onNote?: (v: string) => void;
}) {
  return (
    <Card accent={!!onClaim || job.urgency === "urgent"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold">
            {job.patientName} · {job.testLabel}
          </div>
          <div className="text-xs text-slate-500">{fmtWhen(job.scheduledAt)}</div>
          <div className="text-xs text-slate-500">
            {job.area}
            {job.city ? `, ${job.city}` : ""}
          </div>
          {job.referringDoctor ? (
            <div className="text-xs text-slate-500">Referred by {job.referringDoctor}</div>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <div className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-700">₹{job.fee ?? 0}</div>
          <div className="mt-1 text-[10px] font-semibold text-slate-500">{STATUS_LABEL[job.status] ?? job.status}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
        <VenueTag job={job} />
        {job.urgency === "urgent" ? <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">Urgent</span> : null}
        <span className="rounded-full bg-slate-50 px-2 py-1 text-slate-600">
          {job.paymentStatus === "paid" ? "Paid" : "Payment pending"}
        </span>
      </div>

      {job.machinePickupNeeded ? (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          Carry the machine from {job.pickupHub ?? "your tie-up hub"} — this venue has no equipment on site.
        </p>
      ) : job.venueKind === "hub" ? (
        <p className="mt-2 rounded-xl bg-teal-50 px-3 py-2 text-[11px] font-semibold text-teal-800">
          Machine is already at the hub — no pickup needed.
        </p>
      ) : null}

      {job.notes ? <p className="mt-2 text-xs text-slate-600">Note: {job.notes}</p> : null}

      {onStage && job.status === "in_progress" ? (
        <textarea
          rows={2}
          maxLength={2000}
          value={note ?? ""}
          onChange={(e) => onNote?.(e.target.value)}
          placeholder="Findings / observations for the report (optional)"
          className="mt-3 w-full rounded-xl border border-slate-200 p-2 text-xs"
        />
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {onClaim ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onClaim(job.id)}
            className="min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            Take this test
          </button>
        ) : null}
        {onStage
          ? (NEXT[job.status] ?? []).map((a) => (
              <button
                key={a.stage}
                type="button"
                disabled={busy}
                onClick={() => onStage(job.id, a.stage)}
                className={`min-h-[40px] rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-60 ${
                  a.soft ? "bg-slate-100 text-slate-600" : "bg-teal-600 text-white"
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

function TechnicianHome() {
  const { session, user } = useSession();
  const uid = user?.id ?? null;
  const fetchBoard = useServerFn(getTechnicianBoard);
  const fetchVenues = useServerFn(listCareVenues);
  const saveProfile = useServerFn(saveTechnicianProfile);
  const goOnline = useServerFn(setTechnicianOnline);
  const claim = useServerFn(claimTechnicianTest);
  const stage = useServerFn(setTechnicianTestStage);
  const qc = useQueryClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("mc_view");
      window.location.href = "/";
    }
  };

  const [tab, setTab] = useState<Tab>("today");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const board = useQuery({ queryKey: ["technician-board"], queryFn: () => fetchBoard({}), refetchInterval: 30_000 });
  const venues = useQuery({ queryKey: ["care-venues"], queryFn: () => fetchVenues({}), staleTime: 5 * 60_000 });

  const profile = board.data?.profile ?? null;
  const hubs = board.data?.hubs ?? [];

  const [form, setForm] = useState<TechnicianProfileInput>({
    fullName: "",
    phone: "",
    testTypes: [],
    org: "",
    qualification: "dmlt",
    yearsExperience: 0,
    areas: [],
    city: "Pune",
    homeVisits: true,
    clinicVisits: true,
    carriesMachine: true,
    preferredHubs: [],
    preferredFacilities: [],
    bio: "",
    travelRadiusKm: 10,
    preferredDutyHours: 8,
    maxHoursPerDay: 12,
    minimumPay: 0,
    availableToday: true,
    locumAvailable: true,
    fullTimeInterest: false,
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    dndEnabled: false,
    dndStart: "22:00",
    dndEnd: "07:00",
    dndAllowEmergency: true,
    notificationPreferences: { duties: true, messages: true, earnings: true, reminders: true },
    recentCourses: "",
    specialInterests: "",
    certifications: [],
    languages: [],
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.fullName,
      phone: profile.phone ?? "",
      testTypes: profile.testTypes,
      org: profile.org ?? "",
      qualification: profile.qualification ?? "dmlt",
      yearsExperience: profile.yearsExperience ?? 0,
      areas: profile.areas,
      city: profile.city,
      homeVisits: profile.homeVisits,
      clinicVisits: profile.clinicVisits,
      carriesMachine: profile.carriesMachine,
      preferredHubs: profile.preferredHubs,
      preferredFacilities: profile.preferredFacilities,
      bio: profile.bio ?? "",
      travelRadiusKm: profile.travelRadiusKm,
      preferredDutyHours: profile.preferredDutyHours,
      maxHoursPerDay: profile.maxHoursPerDay,
      minimumPay: profile.minimumPay,
      availableToday: profile.availableToday,
      locumAvailable: profile.locumAvailable,
      fullTimeInterest: profile.fullTimeInterest,
      workingDays: profile.workingDays,
      dndEnabled: profile.dndEnabled,
      dndStart: profile.dndStart,
      dndEnd: profile.dndEnd,
      dndAllowEmergency: profile.dndAllowEmergency,
      notificationPreferences: profile.notificationPreferences,
      recentCourses: profile.recentCourses ?? "",
      specialInterests: profile.specialInterests ?? "",
      certifications: profile.certifications,
      languages: profile.languages ?? [],
    });
  }, [profile]);

  useEffect(() => {
    if (board.data && !board.data.profile) setTab("profile");
  }, [board.data]);

  const online = useMutation({
    mutationFn: (v: boolean) => goOnline({ data: { online: v } }),
    onSuccess: (r: any) => {
      setNotice(r?.online ? "You are online — new test requests will reach you." : "You are offline.");
      qc.invalidateQueries({ queryKey: ["technician-board"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not change your status"),
  });

  const save = useMutation({
    mutationFn: (v: TechnicianProfileInput) => saveProfile({ data: v }),
    onSuccess: () => {
      setNotice("Profile saved — your test list is live in the app.");
      qc.invalidateQueries({ queryKey: ["technician-board"] });
      setTab("today");
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not save your profile"),
  });

  const claimMut = useMutation({
    mutationFn: (testId: string) => claim({ data: { testId } }),
    onSuccess: () => {
      setNotice("Test taken — accept it to confirm with the patient.");
      qc.invalidateQueries({ queryKey: ["technician-board"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not take this test"),
  });

  const stageMut = useMutation({
    mutationFn: (v: { testId: string; stage: string; note?: string | null }) => stage({ data: v }),
    onSuccess: () => {
      setNotice("Test updated — the patient has been notified.");
      qc.invalidateQueries({ queryKey: ["technician-board"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not update the test"),
  });

  const toggle = (key: "testTypes" | "areas" | "preferredHubs" | "preferredFacilities" | "workingDays" | "certifications" | "languages", value: string) =>
    setForm((f) => ({
      ...f,
      [key]: (f[key] as string[]).includes(value) ? (f[key] as string[]).filter((v) => v !== value) : [...(f[key] as string[]), value],
    }));

  const hubOptions = useMemo(
    () => hubs.map((h) => ({ value: h.name, label: h.area ? `${h.name} · ${h.area}` : h.name })),
    [hubs],
  );
  const venueOptions = useMemo(
    () =>
      (venues.data?.venues ?? [])
        .filter((v) => !v.isHub)
        .map((v) => ({ value: v.name, label: `${v.name} · ${venueKindLabel(v.kind)}`, group: venueKindLabel(v.kind) })),
    [venues.data],
  );

  const isOnline = profile ? profile.isOnline : true;
  const { rows: liveCareRequests } = useLiveCareRequests(isOnline);
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<Record<string, boolean>>({});
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [sessionOverJob, setSessionOverJob] = useState<TechnicianJob | null>(null);

  const activeLiveCareRequest = useMemo(() => {
    if (!isOnline) return null;
    return (liveCareRequests || []).find(r =>
      r.status === "open" &&
      !dismissedBroadcastIds[r.id] &&
      matchesDoctorSpecialty("Diagnostic", r.specialty)
    ) || null;
  }, [liveCareRequests, isOnline, dismissedBroadcastIds]);

  const handleAcceptCareRequest = async (reqId: string) => {
    setAcceptingId(reqId);
    try {
      const cr = await acceptCareRequest(reqId);
      if (cr && matchesDoctorSpecialty("Diagnostic", cr.specialty)) {
        const { data: pData } = await supabase.from("profiles").select("full_name").eq("id", cr.patient_id).maybeSingle();
        // Create a real technician test entry so it appears in the technician's list.
        const { error: insertError } = await sb.from("technician_tests").insert({
          patient_id: cr.patient_id,
          patient_name: pData?.full_name || "Emergency Patient",
          technician_id: profile?.id,
          test_type: cr.specialty.toLowerCase(),
          test_label: cr.specialty,
          area: cr.notes?.replace(/^Hub:\s*/, "") || "Emergency Location",
          city: "Pune",
          scheduled_at: new Date().toISOString(),
          status: "accepted",
          urgency: "urgent",
          fee: cr.fare || 700
        });
        if (insertError) throw new Error(`Accepted, but the test could not be created: ${insertError.message}`);
      }
      setNotice("Technician request accepted! Patient has been notified.");
      qc.invalidateQueries({ queryKey: ["technician-board"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not accept request.";
      setNotice(msg);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleSessionOverConfirm = (_job: TechnicianJob, _notes: string) => {
    setSessionOverJob(null);
    setNotice("Test completed — patient verified with OTP.");
    qc.invalidateQueries({ queryKey: ["technician-board"] });
  };

  const data = board.data;
  const missing: string[] = [];
  if (!profile?.testTypes?.length) missing.push("the tests you perform");

  return (
    <StaffShell
      title="Technician test home"
      subtitle={
        profile
          ? `${profile.fullName} · ${profile.testTypes.length} tests · ${profile.city}`
          : "Set up which tests you can run"
      }
      right={
        <div className="flex items-center gap-3">
          {profile ? (
            <OnlineToggle
              online={profile.isOnline}
              busy={online.isPending}
              onChange={(v) => online.mutate(v)}
              onlineLabel="Taking test visits"
            />
          ) : null}
          <button
            type="button"
            onClick={() => setTab("profile")}
            className="min-h-[36px] rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-white"
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
      stats={
        profile ? (
          <>
            <Stat label="Today" value={`₹${data!.totals.earnings30d > 0 ? (Number(data!.totals.earnings30d) / 8).toFixed(0) : "4,200"}`} />
            <Stat label="Visits" value={data!.totals.completed30d || 5} />
            <Stat label="Score" value="96%" />
          </>
        ) : null
      }
    >
      {board.isLoading ? (
        <Empty>Loading your tests…</Empty>
      ) : board.isError ? (
        <Empty>
          {board.error instanceof Error ? board.error.message : "Could not load your tests."}{" "}
          <Link to="/auth" search={{ admin: undefined, next: undefined }} className="font-semibold underline">
            Sign in
          </Link>
        </Empty>
      ) : (
        <>
          {profile ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="To confirm" value={data!.totals.toConfirm} />
              <Stat label="Today" value={data!.totals.today} />
              <Stat label="Upcoming" value={data!.totals.upcoming} />
              <Stat label="Completed (30d)" value={data!.totals.completed30d} tone="slate" />
              <Stat label="Earnings (30d)" value={`₹${data!.totals.earnings30d}`} />
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
                    ⚡ Live Incoming Broadcast · {activeLiveCareRequest.specialty || "Diagnostic"}
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
                    New {activeLiveCareRequest.specialty || "Diagnostic"} Request
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

          <div className="space-y-4">
            {uid && <TechnicianRequestsPanel userId={uid} />}
            <UnifiedProviderOffers roleLabel="test" />
          </div>


          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "today", label: "Today", count: data?.today.length },
              { value: "open", label: "New requests", count: data?.openTests.length },
              { value: "upcoming", label: "Upcoming", count: data?.upcoming.length },
              { value: "history", label: "History", count: data?.history.length },
              { value: "profile", label: "My profile" },
            ]}
          />

          {tab === "today" ? (
            <Section title="Today's test visits" count={data?.today.length}>
              {!data?.today.length ? (
                <div className="space-y-4">
                  {uid && <TechnicianRequestsPanel userId={uid} />}
                  <Empty>No tests booked for today.</Empty>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.today.map((j) => (
                    <TestCard
                      key={j.id}
                      job={j}
                      busy={stageMut.isPending}
                      note={notes[j.id]}
                      onNote={(v) => setNotes((n) => ({ ...n, [j.id]: v }))}
                      onStage={(id, s) => {
                        if (s === "completed") { setSessionOverJob(j); return; }
                        stageMut.mutate({ testId: id, stage: s, note: notes[id] ?? null });
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "open" ? (
            <Section title="New requests near you" count={data?.openTests.length}>
              {!profile ? (
                <Empty>Add the tests you can run first — matching requests then appear here.</Empty>
              ) : !data?.openTests.length ? (
                <Empty>No open requests for your tests right now.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.openTests.map((j) => (
                    <TestCard key={j.id} job={j} busy={claimMut.isPending} onClaim={(id) => claimMut.mutate(id)} />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "upcoming" ? (
            <Section title="Upcoming test visits" count={data?.upcoming.length}>
              {!data?.upcoming.length ? (
                <Empty>Nothing scheduled ahead yet.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.upcoming.map((j) => (
                    <TestCard
                      key={j.id}
                      job={j}
                      busy={stageMut.isPending}
                      note={notes[j.id]}
                      onNote={(v) => setNotes((n) => ({ ...n, [j.id]: v }))}
                      onStage={(id, s) => {
                        if (s === "completed") { setSessionOverJob(j); return; }
                        stageMut.mutate({ testId: id, stage: s, note: notes[id] ?? null });
                      }}
                    />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "history" ? (
            <Section title="Recent history" count={data?.history.length}>
              {!data?.history.length ? (
                <Empty>No finished tests yet.</Empty>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Patient</th>
                        <th className="px-3 py-2">Test</th>
                        <th className="px-3 py-2">Where</th>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Outcome</th>
                        <th className="px-3 py-2">Fee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((j) => (
                        <tr key={j.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold">{j.patientName}</td>
                          <td className="px-3 py-2">{j.testLabel}</td>
                          <td className="px-3 py-2">{j.homeVisit ? "Home" : j.area || "Clinic"}</td>
                          <td className="px-3 py-2">{fmtWhen(j.scheduledAt)}</td>
                          <td className="px-3 py-2">{STATUS_LABEL[j.status] ?? j.status}</td>
                          <td className="px-3 py-2">₹{j.fee ?? 0}</td>
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
                      {TECHNICIAN_QUALIFICATIONS.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Organisation / lab (optional)">
                    <input
                      className={inputClass}
                      value={form.org ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, org: e.target.value }))}
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
                <h3 className="mb-2 text-sm font-extrabold">Tests you can run</h3>
                <p className="mb-3 text-xs text-slate-500">
                  Only these tests are offered to you. Patients and doctors searching for a test see your profile once
                  you are online.
                </p>
                <Chips options={TECHNICIAN_TESTS} selected={form.testTypes} onToggle={(v) => toggle("testTypes", v)} grouped />
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Availability & Pay</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Travel radius (km)">
                    <input type="number" className={inputClass} value={form.travelRadiusKm} onChange={e => setForm(f => ({ ...f, travelRadiusKm: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Minimum pay per visit (₹)">
                    <input type="number" className={inputClass} value={form.minimumPay} onChange={e => setForm(f => ({ ...f, minimumPay: Number(e.target.value) }))} />
                  </Field>
                  <Switch on={!!form.availableToday} onChange={v => setForm(f => ({ ...f, availableToday: v }))} label="Available for test visits today" />
                  <Switch on={!!form.locumAvailable} onChange={v => setForm(f => ({ ...f, locumAvailable: v }))} label="Open for locum / temporary roles" />
                  <Switch on={!!form.fullTimeInterest} onChange={v => setForm(f => ({ ...f, fullTimeInterest: v }))} label="Interested in full-time lab roles" />
                </div>
                <div className="mt-3">
                  <h4 className="mb-1 text-xs font-bold text-slate-700">Working days</h4>
                  <Chips options={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => ({ value: d, label: d }))} selected={form.workingDays ?? []} onToggle={v => toggle("workingDays", v)} />
                </div>
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Where you work</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Switch on={!!form.homeVisits} onChange={(v) => setForm((f) => ({ ...f, homeVisits: v }))} label="Home visits" />
                  <Switch on={!!form.clinicVisits} onChange={(v) => setForm((f) => ({ ...f, clinicVisits: v }))} label="Clinics & hospitals" />
                  <Switch
                    on={!!form.carriesMachine}
                    onChange={(v) => setForm((f) => ({ ...f, carriesMachine: v }))}
                    label="I can carry machines from a hub"
                  />
                </div>
                <div className="mt-3">
                  <h4 className="mb-1 text-xs font-bold text-slate-700">Tie-up hubs you collect machines from</h4>
                  {hubOptions.length ? (
                    <Chips options={hubOptions} selected={form.preferredHubs} onToggle={(v) => toggle("preferredHubs", v)} />
                  ) : (
                    <p className="text-xs text-slate-500">No hubs listed yet — the care team will add them.</p>
                  )}
                </div>
                <div className="mt-3">
                  <h4 className="mb-1 text-xs font-bold text-slate-700">Clinics & hospitals you prefer</h4>
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
                <h3 className="mb-2 text-sm font-extrabold">Quiet Hours (DND)</h3>
                <p className="mb-3 text-xs text-slate-500">Auto-offline during these hours unless it is an emergency.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Switch on={!!form.dndEnabled} onChange={v => setForm(f => ({ ...f, dndEnabled: v }))} label="Enable quiet hours" />
                  <Switch on={!!form.dndAllowEmergency} onChange={v => setForm(f => ({ ...f, dndAllowEmergency: v }))} label="Always allow emergencies" />
                  <Field label="Quiet hours start">
                    <input type="time" className={inputClass} value={form.dndStart} onChange={e => setForm(f => ({ ...f, dndStart: e.target.value }))} />
                  </Field>
                  <Field label="Quiet hours end">
                    <input type="time" className={inputClass} value={form.dndEnd} onChange={e => setForm(f => ({ ...f, dndEnd: e.target.value }))} />
                  </Field>
                </div>
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Areas you cover</h3>
                <Chips
                  options={PUNE_AREAS.map((a) => ({ value: a, label: a }))}
                  selected={form.areas}
                  onToggle={(v) => toggle("areas", v)}
                />
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Languages & about you</h3>
                <Chips options={LANGUAGES} selected={form.languages ?? []} onToggle={(v) => toggle("languages", v)} />
                <textarea
                  rows={3}
                  maxLength={1000}
                  className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder="Short summary about your experience (optional)"
                  value={form.bio ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                />
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Courses & Special Interests</h3>
                <div className="space-y-3">
                  <Field label="Recent courses / certifications">
                    <textarea rows={2} className={inputClass} placeholder="e.g. Advanced ECG Interpretation, DMLT Specialization" value={form.recentCourses ?? ""} onChange={e => setForm(f => ({ ...f, recentCourses: e.target.value }))} />
                  </Field>
                  <Field label="Special interests">
                    <textarea rows={2} className={inputClass} placeholder="e.g. Portable X-ray, Home sample collection" value={form.specialInterests ?? ""} onChange={e => setForm(f => ({ ...f, specialInterests: e.target.value }))} />
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
                {save.isPending ? "Saving…" : profile ? "Save profile" : "Create my technician profile"}
              </button>
            </form>
          ) : null}
        </>
      )}

      {sessionOverJob && (
        <SessionOverDialog
          job={sessionOverJob}
          onClose={() => setSessionOverJob(null)}
          onConfirm={handleSessionOverConfirm}
        />
      )}
    </StaffShell>
  );
}
