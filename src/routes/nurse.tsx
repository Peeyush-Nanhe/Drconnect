import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
            {["applied", "accepted"].includes(job.status) ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStage(job.assignmentId!, "checked_in")}
                className="min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                Check in
              </button>
            ) : null}
            {job.status === "in_progress" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onStage(job.assignmentId!, "completed")}
                className="min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                Duty done
              </button>
            ) : null}
            {["applied", "accepted"].includes(job.status) ? (
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
  const fetchBoard = useServerFn(getNurseBoard);
  const fetchVenues = useServerFn(listCareVenues);
  const saveProfile = useServerFn(saveNurseProfile);
  const goOnline = useServerFn(setNurseOnline);
  const apply = useServerFn(applyToNurseJob);
  const stage = useServerFn(setNurseJobStage);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("today");
  const [notice, setNotice] = useState("");

  const board = useQuery({ queryKey: ["nurse-board"], queryFn: () => fetchBoard({}), refetchInterval: 60_000 });
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

  const toggle = (key: "skills" | "shiftPrefs" | "areas" | "preferredFacilities" | "languages", value: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
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
        profile ? (
          <OnlineToggle
            online={profile.isOnline}
            busy={online.isPending}
            onChange={(v) => online.mutate(v)}
            onlineLabel="Online for duties"
          />
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
              <Stat label="Today" value={data!.totals.today} />
              <Stat label="Upcoming" value={data!.totals.upcoming} />
              <Stat label="Open jobs" value={data!.totals.openMatches} />
              <Stat label="Completed" value={data!.totals.completed} tone="slate" />
              <Stat label="Earned (30d)" value={`₹${data!.totals.earnings30d}`} />
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-teal-700">{notice}</div>
          ) : null}

          <UnifiedProviderOffers roleLabel="nursing" />


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
                <Empty>No duty scheduled for today. Check open jobs to pick one up.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.today.map((j) => (
                    <JobCard key={j.id} job={j} busy={stageMut.isPending} onStage={(a, s) => stageMut.mutate({ assignmentId: a, stage: s })} />
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
                    <JobCard key={j.id} job={j} busy={stageMut.isPending} onStage={(a, s) => stageMut.mutate({ assignmentId: a, stage: s })} />
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
                <h3 className="mb-2 text-sm font-extrabold">Shifts and type of work</h3>
                <Chips options={SHIFT_PREFS} selected={form.shiftPrefs} onToggle={(v) => toggle("shiftPrefs", v)} />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Switch on={form.hospitalDuty} onChange={(v) => setForm((f) => ({ ...f, hospitalDuty: v }))} label="Hospital & clinic duty" />
                  <Switch on={form.homeCare} onChange={(v) => setForm((f) => ({ ...f, homeCare: v }))} label="Home care visits" />
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
                <Chips options={LANGUAGES} selected={form.languages} onToggle={(v) => toggle("languages", v)} />
                <textarea
                  rows={3}
                  maxLength={1000}
                  className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder="Short summary families and hospitals will read"
                  value={form.bio ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                />
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
    </StaffShell>
  );
}
