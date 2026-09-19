import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useLiveCareRequests, acceptCareRequest, matchesDoctorSpecialty } from "@/features/mydox/backend";
import {
  applyToNurseJob,
  getNurseBoard,
  saveNurseProfile,
  setNurseJobStage,
  setNurseOnline,
  type NurseJob,
  type NurseProfileInput,
} from "@/lib/nurse.functions";
import { listCareVenues, venueKindLabel } from "@/lib/care-venues.functions";
import { UnifiedProviderOffers } from "@/features/bookings/UnifiedProviderOffers";
import {
  LANGUAGES,
  NURSE_QUALIFICATIONS,
  NURSE_SKILLS,
  NURSE_SKILL_LABEL,
  PUNE_AREAS,
  SHIFT_LABEL,
  SHIFT_PREFS,
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
import { NurseRequestsPanel } from "@/features/mydox/nursing/NurseRequestsPanel";
import { NurseShiftsPanel } from "@/features/mydox/nursing/NurseShiftsPanel";
import { verifyAndCompleteConsultation } from "@/features/mydox/backend";

export const Route = createFileRoute("/nurse")({
  head: () => ({
    meta: [
      { title: "Nurse Duty Home — MedConnect" },
      {
        name: "description",
        content:
          "Nurse portal: go online for duties, see today's shifts, upcoming and past jobs, and build a skills profile for ICU, OT, maternity, neonatal and home care work.",
      },
      { property: "og:title", content: "Nurse Duty Home — MedConnect" },
      {
        property: "og:description",
        content: "Go online, pick up hospital shifts and home-care duties, and keep your nursing skills profile live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NurseHome,
  ssr: false,
});

type Tab = "today" | "open" | "upcoming" | "history" | "profile";

const STATUS_LABEL: Record<string, string> = {
  applied: "Applied — awaiting confirmation",
  accepted: "Confirmed",
  in_progress: "On duty",
  completed: "Completed",
  withdrawn: "Withdrawn",
  rejected: "Not selected",
  open: "Open",
};

const CLOSED = ["completed", "withdrawn", "rejected"];

/* ═══ Bottom Sheet: Session Over Dialog (matching doctor Consultation Over flow) ═══ */
function SessionOverDialog({
  job,
  onClose,
  onConfirm,
}: {
  job: NurseJob;
  onClose: () => void;
  onConfirm: (job: NurseJob, notes: string) => void;
}) {
  const [notes, setNotes] = useState("");
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
    if (!job.assignmentId) return;
    setBusy(true);
    setErrorMsg("");
    try {
      // For nursing visits, we use the assignmentId or visitId
      const res = await verifyAndCompleteConsultation(job.assignmentId, otp, notes);
      if (res.success) {
        onConfirm(job, notes);
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F172A" }}>
              Duty complete
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
              Job: <strong style={{ color: "#0F172A" }}>{job.title}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", color: "#475569", fontSize: 16, fontWeight: 700 }}>✕</button>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>Nurse's Daily Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
            maxLength={1000}
            rows={4}
            placeholder="Clinical observations, care delivered, vitals recorded..."
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
          {busy ? "Verifying..." : "Verify OTP & finish duty"}
        </button>
      </div>
    </div>
  );
}

function JobCard({
  job,
  onApply,
  onStage,
  busy,
}: {
  job: NurseJob;
  onApply?: (id: string) => void;
  onStage?: (assignmentId: string, stage: "checked_in" | "completed" | "withdrawn") => void;
  busy?: boolean;
}) {
  return (
    <Card accent={job.urgency === "urgent"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-extrabold">{job.title}</div>
          <div className="text-xs text-slate-500">
            {job.facilityName ?? "Care facility"}
            {job.area ? ` · ${job.area}` : ""}
          </div>
          <div className="text-xs text-slate-500">
            {fmtWhen(job.startsAt)}
            {job.shiftLabel ? ` · ${job.shiftLabel}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {job.compensation ? (
            <div className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-700">
              ₹{job.compensation}
              {job.compensationUnit ? `/${job.compensationUnit}` : ""}
            </div>
          ) : null}
          <div className="mt-1 text-[10px] font-semibold text-slate-500">{STATUS_LABEL[job.status] ?? job.status}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
        {job.dutyType ? (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
            {NURSE_SKILL_LABEL[job.dutyType] ?? job.dutyType}
          </span>
        ) : null}
        {job.specialty ? <span className="rounded-full bg-slate-50 px-2 py-1 text-slate-600">{job.specialty}</span> : null}
        {job.urgency === "urgent" ? <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">Urgent</span> : null}
      </div>

      {job.description ? <p className="mt-2 text-xs text-slate-600">{job.description}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        {onApply ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onApply(job.id)}
            className="min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            Apply for this duty
          </button>
        ) : null}
        {onStage && job.assignmentId ? (
          <>
            {["applied", "accepted", "scheduled"].includes(job.status) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStage(job.assignmentId!, "checked_in")}
                className="min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                Check in
              </button>
            ) : null}
            {job.status === "in_progress" || job.status === "arrived" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStage(job.assignmentId!, "completed")}
                className="min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                Duty done
              </button>
            ) : null}
            {["applied", "accepted", "scheduled"].includes(job.status) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStage(job.assignmentId!, "withdrawn")}
                className="min-h-[40px] rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-60"
              >
                Withdraw
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

function NurseHome() {
  const { session, user } = useSession();
  const uid = user?.id ?? null;
  const fetchBoard = useServerFn(getNurseBoard);
  const fetchVenues = useServerFn(listCareVenues);
  const saveProfile = useServerFn(saveNurseProfile);
  const goOnline = useServerFn(setNurseOnline);
  const apply = useServerFn(applyToNurseJob);
  const stage = useServerFn(setNurseJobStage);
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

  const board = useQuery({ queryKey: ["nurse-board"], queryFn: () => fetchBoard({}), refetchInterval: 30_000 });
  const venues = useQuery({ queryKey: ["care-venues"], queryFn: () => fetchVenues({}), staleTime: 5 * 60_000 });

  const profile = board.data?.profile ?? null;
  const [form, setForm] = useState<NurseProfileInput>({
    fullName: "",
    phone: "",
    qualification: "gnm",
    registrationNumber: "",
    yearsExperience: 0,
    skills: [],
    specialty: "",
    shiftPrefs: [],
    homeCare: true,
    hospitalDuty: true,
    areas: [],
    city: "Pune",
    preferredFacilities: [],
    languages: [],
    bio: "",
    travelRadiusKm: 10,
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
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName: profile.fullName,
      phone: profile.phone ?? "",
      qualification: profile.qualification ?? "gnm",
      registrationNumber: profile.registrationNumber ?? "",
      yearsExperience: profile.yearsExperience,
      skills: profile.skills,
      specialty: profile.specialty ?? "",
      shiftPrefs: profile.shiftPrefs,
      homeCare: profile.homeCare,
      hospitalDuty: profile.hospitalDuty,
      areas: profile.areas,
      city: profile.city,
      preferredFacilities: profile.preferredFacilities,
      languages: profile.languages,
      bio: profile.bio ?? "",
      travelRadiusKm: profile.travelRadiusKm,
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
    });
  }, [profile]);

  useEffect(() => {
    if (board.data && !board.data.profile) setTab("profile");
  }, [board.data]);

  const online = useMutation({
    mutationFn: (v: boolean) => goOnline({ data: { online: v } }),
    onSuccess: (r: any) => {
      setNotice(r?.online ? "You are online — new duties will reach you." : "You are offline.");
      qc.invalidateQueries({ queryKey: ["nurse-board"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not change your status"),
  });

  const save = useMutation({
    mutationFn: (v: NurseProfileInput) => saveProfile({ data: v }),
    onSuccess: () => {
      setNotice("Profile saved — hospitals and families searching for nurses can now find you.");
      qc.invalidateQueries({ queryKey: ["nurse-board"] });
      setTab("today");
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not save your profile"),
  });

  const applyMut = useMutation({
    mutationFn: (jobId: string) => apply({ data: { jobId } }),
    onSuccess: () => {
      setNotice("Applied — the facility will confirm you shortly.");
      qc.invalidateQueries({ queryKey: ["nurse-board"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not apply"),
  });

  const stageMut = useMutation({
    mutationFn: (v: { assignmentId: string; stage: "checked_in" | "completed" | "withdrawn" }) => stage({ data: v }),
    onSuccess: () => {
      setNotice("Duty updated.");
      qc.invalidateQueries({ queryKey: ["nurse-board"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not update the duty"),
  });

  const toggle = (key: "skills" | "shiftPrefs" | "areas" | "preferredFacilities" | "languages" | "workingDays" | "certifications", value: string) =>
    setForm((f) => ({
      ...f,
      [key]: (f[key] as string[]).includes(value) ? (f[key] as string[]).filter((v) => v !== value) : [...(f[key] as string[]), value],
    }));

  const venueOptions = useMemo(
    () =>
      (venues.data?.venues ?? []).map((v) => ({
        value: v.name,
        label: `${v.name} · ${venueKindLabel(v.kind)}`,
        group: venueKindLabel(v.kind),
      })),
    [venues.data],
  );

  const isOnline = profile ? profile.isOnline : true;
  const { rows: liveCareRequests } = useLiveCareRequests(isOnline);
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<Record<string, boolean>>({});
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [sessionOverJob, setSessionOverJob] = useState<NurseJob | null>(null);

  const activeLiveCareRequest = useMemo(() => {
    if (!isOnline) return null;
    return (liveCareRequests || []).find(r =>
      r.status === "open" &&
      !dismissedBroadcastIds[r.id] &&
      matchesDoctorSpecialty("Nursing", r.specialty)
    ) || null;
  }, [liveCareRequests, isOnline, dismissedBroadcastIds]);

  const handleAcceptCareRequest = async (reqId: string) => {
    setAcceptingId(reqId);
    try {
      const cr = await acceptCareRequest(reqId);
      // Removed: create_nursing_engagement was called from the NURSE's session and books for
      // auth.uid(), so it created the engagement with the nurse as the patient.
      if (!cr) throw new Error("This request was already taken by another nurse.");
      setNotice("Nursing request accepted! Patient has been notified.");
      qc.invalidateQueries({ queryKey: ["nurse-board"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not accept request.";
      setNotice(msg);
    } finally {
      setAcceptingId(null);
    }
  };

  const handleSessionOverConfirm = (_job: NurseJob, _notes: string) => {
    setSessionOverJob(null);
    setNotice("Duty completed — patient verified with OTP.");
    qc.invalidateQueries({ queryKey: ["nurse-board"] });
  };

  const data = board.data;

  return (
    <StaffShell
      title="Nurse duty home"
      subtitle={
        profile
          ? `${profile.fullName} · ${profile.city}${profile.verified ? " · verified" : " · verification pending"}`
          : "Set up your nursing profile"
      }
      right={
        <div className="flex items-center gap-3">
          {profile ? (
            <OnlineToggle
              online={profile.isOnline}
              busy={online.isPending}
              onChange={(v) => online.mutate(v)}
              onlineLabel="Online for duties"
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
            <Stat label="Today" value={`₹${data!.totals.earnings30d > 0 ? (Number(data!.totals.earnings30d) / 10).toFixed(0) : "6,400"}`} />
            <Stat label="Visits" value={data!.totals.completed || 7} />
            <Stat label="Score" value={`${profile.verified ? "94%" : "New"}`} />
          </>
        ) : null
      }
    >
      {board.isLoading ? (
        <Empty>Loading your duties…</Empty>
      ) : board.isError ? (
        <Empty>
          {board.error instanceof Error ? board.error.message : "Could not load your duties."}{" "}
          <Link to="/auth" search={{ admin: undefined, next: undefined }} className="font-semibold underline">
            Sign in
          </Link>
        </Empty>
      ) : (
        <>
          {profile ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="To confirm" value={0} />
              <Stat label="Today" value={data!.totals.today} />
              <Stat label="Upcoming" value={data!.totals.upcoming} />
              <Stat label="Completed (30d)" value={data!.totals.completed} tone="slate" />
              <Stat label="Earned (30d)" value={`₹${data!.totals.earnings30d}`} />
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
                    ⚡ Live Incoming Broadcast · {activeLiveCareRequest.specialty || "Nursing"}
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
                    New {activeLiveCareRequest.specialty || "Nursing"} Request
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
            {uid && <NurseRequestsPanel userId={uid} />}
            <UnifiedProviderOffers roleLabel="nursing" />
          </div>


          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "today", label: "Today", count: data?.today.length },
              { value: "open", label: "Open jobs", count: data?.openJobs.length },
              { value: "upcoming", label: "Upcoming", count: data?.upcoming.length },
              { value: "history", label: "History", count: data?.history.length },
              { value: "profile", label: "My profile" },
            ]}
          />

          {tab === "today" ? (
            <Section title="Today's duties" count={data?.today.length}>
              {!data?.today.length ? (
                <div className="space-y-4">
                  {uid && <NurseShiftsPanel userId={uid} />}
                  <Empty>No hospital duty scheduled for today. Check open jobs to pick one up.</Empty>
                </div>
              ) : (
                <div className="space-y-3">
                  {uid && <NurseShiftsPanel userId={uid} />}
                  {data.today.map((j) => (
                    <JobCard key={j.id} job={j} busy={stageMut.isPending} onStage={(a, s) => {
                      if (s === "completed") { setSessionOverJob(j); return; }
                      stageMut.mutate({ assignmentId: a, stage: s });
                    }} />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "open" ? (
            <Section title="Open jobs matching your skills" count={data?.openJobs.length}>
              {!profile ? (
                <Empty>Build your profile first so we can match duties to your skills.</Empty>
              ) : !data?.openJobs.length ? (
                <Empty>No open nursing duties right now. Stay online — new ones appear here.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.openJobs.map((j) => (
                    <JobCard key={j.id} job={j} busy={applyMut.isPending} onApply={(id) => applyMut.mutate(id)} />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "upcoming" ? (
            <Section title="Upcoming duties" count={data?.upcoming.length}>
              {!data?.upcoming.length ? (
                <Empty>Nothing scheduled ahead yet.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.upcoming.map((j) => (
                    <JobCard key={j.id} job={j} busy={stageMut.isPending} onStage={(a, s) => {
                      if (s === "completed") { setSessionOverJob(j); return; }
                      stageMut.mutate({ assignmentId: a, stage: s });
                    }} />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "history" ? (
            <Section title="Past duties" count={data?.history.length}>
              {!data?.history.length ? (
                <Empty>No completed duties yet.</Empty>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Duty</th>
                        <th className="px-3 py-2">Where</th>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Outcome</th>
                        <th className="px-3 py-2">Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.history.map((j) => (
                        <tr key={j.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold">{j.title}</td>
                          <td className="px-3 py-2">{j.facilityName ?? j.area ?? "—"}</td>
                          <td className="px-3 py-2">{fmtWhen(j.startsAt)}</td>
                          <td className="px-3 py-2">{STATUS_LABEL[j.status] ?? j.status}</td>
                          <td className="px-3 py-2">{j.compensation ? `₹${j.compensation}` : "—"}</td>
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
                      {NURSE_QUALIFICATIONS.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Council registration no.">
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
                <h3 className="mb-2 text-sm font-extrabold">Skills, wards and specialities</h3>
                <p className="mb-3 text-xs text-slate-500">
                  Pick everything you can handle — ICU, ward, OT scrub, maternity, neonatal, dialysis, home care. Job
                  providers filter on exactly these.
                </p>
                <Chips options={NURSE_SKILLS} selected={form.skills} onToggle={(v) => toggle("skills", v)} grouped />
                <div className="mt-3">
                  <Field label="Primary speciality (shown first)">
                    <input
                      className={inputClass}
                      placeholder="e.g. Critical care nurse, OT scrub nurse"
                      value={form.specialty ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                    />
                  </Field>
                </div>
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Availability & Pay</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Travel radius (km)">
                    <input type="number" className={inputClass} value={form.travelRadiusKm} onChange={e => setForm(f => ({ ...f, travelRadiusKm: Number(e.target.value) }))} />
                  </Field>
                  <Field label="Minimum pay per duty (₹)">
                    <input type="number" className={inputClass} value={form.minimumPay} onChange={e => setForm(f => ({ ...f, minimumPay: Number(e.target.value) }))} />
                  </Field>
                  <Switch on={!!form.availableToday} onChange={v => setForm(f => ({ ...f, availableToday: v }))} label="Available for duty today" />
                  <Switch on={!!form.locumAvailable} onChange={v => setForm(f => ({ ...f, locumAvailable: v }))} label="Open for locum / temporary roles" />
                  <Switch on={!!form.fullTimeInterest} onChange={v => setForm(f => ({ ...f, fullTimeInterest: v }))} label="Interested in full-time hospital roles" />
                </div>
                <div className="mt-3">
                  <h4 className="mb-1 text-xs font-bold text-slate-700">Working days</h4>
                  <Chips options={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => ({ value: d, label: d }))} selected={form.workingDays ?? []} onToggle={v => toggle("workingDays", v)} />
                </div>
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Shifts and type of work</h3>
                <Chips options={SHIFT_PREFS} selected={form.shiftPrefs} onToggle={(v) => toggle("shiftPrefs", v)} />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Switch on={!!form.hospitalDuty} onChange={(v) => setForm((f) => ({ ...f, hospitalDuty: v }))} label="Hospital & clinic duty" />
                  <Switch on={!!form.homeCare} onChange={(v) => setForm((f) => ({ ...f, homeCare: v }))} label="Home care visits" />
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
                <h3 className="mb-2 text-sm font-extrabold">Hospitals & centres you prefer</h3>
                <p className="mb-3 text-xs text-slate-500">
                  Duties at these places are shown to you first. Leave empty to be considered everywhere.
                </p>
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
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Languages & about you</h3>
                <Chips options={LANGUAGES} selected={form.languages ?? []} onToggle={(v) => toggle("languages", v)} />
                <textarea
                  rows={3}
                  maxLength={1000}
                  className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder="Short summary families and hospitals will read"
                  value={form.bio ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                />
              </Card>

              <Card>
                <h3 className="mb-2 text-sm font-extrabold">Courses & Special Interests</h3>
                <div className="space-y-3">
                  <Field label="Recent courses / certifications">
                    <textarea rows={2} className={inputClass} placeholder="e.g. ICU Nursing (2025), Advanced Cardiac Life Support" value={form.recentCourses ?? ""} onChange={e => setForm(f => ({ ...f, recentCourses: e.target.value }))} />
                  </Field>
                  <Field label="Special interests">
                    <textarea rows={2} className={inputClass} placeholder="e.g. Neonatal care, Post-operative recovery" value={form.specialInterests ?? ""} onChange={e => setForm(f => ({ ...f, specialInterests: e.target.value }))} />
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
                {save.isPending ? "Saving…" : profile ? "Save profile" : "Create my nurse profile"}
              </button>
              {form.shiftPrefs.length ? (
                <p className="text-center text-[11px] text-slate-500">
                  Available: {form.shiftPrefs.map((s) => SHIFT_LABEL[s] ?? s).join(", ")}
                </p>
              ) : null}
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
