import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { PUNE_AREAS, TECHNICIAN_QUALIFICATIONS, TECHNICIAN_TESTS } from "@/lib/care-staff-catalog";
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

const STATUS_LABEL: Record<string, string> = {
  requested: "Awaiting a technician",
  pending: "Awaiting a technician",
  assigned: "Needs your acceptance",
  accepted: "Accepted",
  en_route: "On the way",
  in_progress: "Test running",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "Patient absent",
};

const NEXT: Record<string, { stage: string; label: string; soft?: boolean }[]> = {
  assigned: [
    { stage: "accepted", label: "Accept test" },
    { stage: "cancelled", label: "Can't take it", soft: true },
  ],
  accepted: [
    { stage: "en_route", label: "Collected machine · on the way" },
    { stage: "cancelled", label: "Cancel", soft: true },
  ],
  en_route: [
    { stage: "in_progress", label: "Start test" },
    { stage: "no_show", label: "Patient not available", soft: true },
  ],
  in_progress: [{ stage: "completed", label: "Test done" }],
};

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
    <Card accent={job.urgency === "urgent"}>
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
  const fetchBoard = useServerFn(getTechnicianBoard);
  const fetchVenues = useServerFn(listCareVenues);
  const saveProfile = useServerFn(saveTechnicianProfile);
  const goOnline = useServerFn(setTechnicianOnline);
  const claim = useServerFn(claimTechnicianTest);
  const stage = useServerFn(setTechnicianTestStage);
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("today");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const board = useQuery({ queryKey: ["technician-board"], queryFn: () => fetchBoard({}), refetchInterval: 45_000 });
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

  const toggle = (key: "testTypes" | "areas" | "preferredHubs" | "preferredFacilities", value: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
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

  const data = board.data;

  return (
    <StaffShell
      title="Technician test home"
      subtitle={
        profile
          ? `${profile.fullName} · ${profile.testTypes.length} tests · ${profile.city}`
          : "Set up which tests you can run"
      }
      right={
        profile ? (
          <OnlineToggle
            online={profile.isOnline}
            busy={online.isPending}
            onChange={(v) => online.mutate(v)}
            onlineLabel="Online for tests"
          />
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
              <Stat label="Today" value={data!.totals.today} />
              <Stat label="Upcoming" value={data!.totals.upcoming} />
              <Stat label="Open requests" value={data!.totals.openMatches} />
              <Stat label="Done (30d)" value={data!.totals.completed30d} tone="slate" />
              <Stat label="Earned (30d)" value={`₹${data!.totals.earnings30d}`} />
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-teal-700">{notice}</div>
          ) : null}

          <UnifiedProviderOffers roleLabel="test" />


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
            <Section title="Today's tests" count={data?.today.length}>
              {!data?.today.length ? (
                <Empty>No tests booked for today.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.today.map((j) => (
                    <TestCard
                      key={j.id}
                      job={j}
                      busy={stageMut.isPending}
                      note={notes[j.id]}
                      onNote={(v) => setNotes((n) => ({ ...n, [j.id]: v }))}
                      onStage={(id, s) => stageMut.mutate({ testId: id, stage: s, note: notes[id] ?? null })}
                    />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "open" ? (
            <Section title="Test requests you can take" count={data?.openTests.length}>
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
            <Section title="Upcoming tests" count={data?.upcoming.length}>
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
                      onStage={(id, s) => stageMut.mutate({ testId: id, stage: s, note: notes[id] ?? null })}
                    />
                  ))}
                </div>
              )}
            </Section>
          ) : null}

          {tab === "history" ? (
            <Section title="Completed & closed tests" count={data?.history.length}>
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
                <h3 className="mb-2 text-sm font-extrabold">Where you work</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Switch on={form.homeVisits} onChange={(v) => setForm((f) => ({ ...f, homeVisits: v }))} label="Home visits" />
                  <Switch on={form.clinicVisits} onChange={(v) => setForm((f) => ({ ...f, clinicVisits: v }))} label="Clinics & hospitals" />
                  <Switch
                    on={form.carriesMachine}
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
                <h3 className="mb-2 text-sm font-extrabold">Areas you cover</h3>
                <Chips
                  options={PUNE_AREAS.map((a) => ({ value: a, label: a }))}
                  selected={form.areas}
                  onToggle={(v) => toggle("areas", v)}
                />
                <textarea
                  rows={3}
                  maxLength={1000}
                  className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder="Short summary about your experience (optional)"
                  value={form.bio ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                />
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
    </StaffShell>
  );
}
