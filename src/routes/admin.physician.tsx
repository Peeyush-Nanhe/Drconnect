import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPhysicianPortal,
  logDutyHours,
  submitDutyFeedback,
} from "@/lib/physician-portal.functions";

export const Route = createFileRoute("/admin/physician")({
  head: () => ({
    meta: [
      { title: "Care Physician Portal — MyDox" },
      {
        name: "description",
        content:
          "Care physician portal: log on-duty hours for hospital locum shifts, submit duty feedback and track your own reliability score.",
      },
      { property: "og:title", content: "Care Physician Portal — MyDox" },
      {
        property: "og:description",
        content: "Log duty hours, review hospital feedback and see your reliability score.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PhysicianPortal,
});

const STATE_META: Record<string, { label: string; color: string }> = {
  applied: { label: "Applied", color: "#7C3AED" },
  scheduled: { label: "Scheduled", color: "#64748B" },
  en_route: { label: "Starting soon", color: "#0284C7" },
  on_duty: { label: "On duty", color: "#059669" },
  overdue: { label: "Not reported", color: "#DC2626" },
  completed: { label: "Completed", color: "#15803D" },
  absent: { label: "Absent", color: "#B91C1C" },
  cancelled: { label: "Cancelled", color: "#94A3B8" },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</div>;
}

function Stat({ label, value, color, sub }: { label: string; value: React.ReactNode; color?: string; sub?: string }) {
  return (
    <Card>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color: color ?? "#0f172a" }}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div> : null}
    </Card>
  );
}

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function PhysicianPortal() {
  const fetchPortal = useServerFn(getPhysicianPortal);
  const logHours = useServerFn(logDutyHours);
  const sendFeedback = useServerFn(submitDutyFeedback);
  const qc = useQueryClient();
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [form, setForm] = useState({ rating: 5, facilitySupport: 4, workload: 3, wouldWorkAgain: true, comment: "" });
  const [notice, setNotice] = useState("");

  const query = useQuery({
    queryKey: ["physician-portal"],
    queryFn: () => fetchPortal({}),
    refetchInterval: 60_000,
  });

  const hoursMutation = useMutation({
    mutationFn: (vars: { assignmentId: string; action: "check_in" | "check_out" }) => logHours({ data: vars }),
    onSuccess: (_d, vars) => {
      setNotice(vars.action === "check_in" ? "Checked in — duty hours started." : "Checked out — duty hours logged.");
      void qc.invalidateQueries({ queryKey: ["physician-portal"] });
    },
    onError: (e: Error) => setNotice(e.message),
  });

  const feedbackMutation = useMutation({
    mutationFn: (vars: { assignmentId: string }) =>
      sendFeedback({
        data: {
          assignmentId: vars.assignmentId,
          rating: form.rating,
          facilitySupport: form.facilitySupport,
          workload: form.workload,
          wouldWorkAgain: form.wouldWorkAgain,
          comment: form.comment,
        },
      }),
    onSuccess: () => {
      setNotice("Feedback submitted. Thank you.");
      setFeedbackFor(null);
      void qc.invalidateQueries({ queryKey: ["physician-portal"] });
    },
    onError: (e: Error) => setNotice(e.message),
  });

  const data = query.data;

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{ background: "#DCE6E1", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/admin" className="text-xs font-semibold text-teal-700 hover:underline">
              ← Admin console
            </Link>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Care Physician Portal</h1>
            <p className="text-sm text-slate-600">
              Log your on-duty hours, rate the hospitals you cover and track your reliability score.
            </p>
          </div>
          {data ? (
            <div className="rounded-xl bg-white px-4 py-2 text-right shadow-sm">
              <div className="text-[11px] uppercase text-slate-500">Signed in as</div>
              <div className="text-sm font-bold text-slate-900">{data.profile.name}</div>
              {data.profile.specialty ? (
                <div className="text-[11px] text-slate-500">{data.profile.specialty}</div>
              ) : null}
            </div>
          ) : null}
        </div>

        {notice ? (
          <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800">
            {notice}
          </div>
        ) : null}

        {query.isLoading ? <Card>Loading your duty record…</Card> : null}
        {query.error ? (
          <Card>
            <p className="text-sm font-semibold text-rose-600">
              {(query.error as Error).message.includes("Unauthorized")
                ? "Please sign in with your care physician account to open this portal."
                : (query.error as Error).message}
            </p>
          </Card>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Reliability score"
                value={`${data.reliability.score}/100`}
                color={data.reliability.score >= 85 ? "#059669" : data.reliability.score >= 65 ? "#B45309" : "#DC2626"}
                sub={`${data.reliability.completed} duties completed`}
              />
              <Stat
                label="Hours this month"
                value={data.hours.thisMonth}
                sub={`${data.hours.total} h lifetime · ${data.hours.avgPerDuty} h avg`}
              />
              <Stat
                label="Hospital rating"
                value={data.reliability.avgRating ? `${data.reliability.avgRating}★` : "—"}
                color="#0284C7"
                sub={`${data.reliability.ratingsCount} rating(s)${
                  data.reliability.rehirePct != null ? ` · ${data.reliability.rehirePct}% would rehire` : ""
                }`}
              />
              <Stat
                label="Attendance issues"
                value={data.reliability.noShows + data.reliability.cancellations}
                color={data.reliability.noShows ? "#DC2626" : "#0f172a"}
                sub={`${data.reliability.noShows} no-show · ${data.reliability.cancellations} cancelled · ${data.reliability.lateArrivals} late`}
              />
            </section>

            <section className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["Attendance", data.reliability.attendancePct, "#059669"],
                ["Punctuality", data.reliability.punctualityPct, "#0284C7"],
                [
                  "Hospital sentiment",
                  data.reliability.avgRating ? Math.round((data.reliability.avgRating / 5) * 100) : 0,
                  "#7C3AED",
                ],
              ].map(([label, pct, color]) => (
                <Card key={String(label)}>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>{label}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: String(color) }} />
                  </div>
                </Card>
              ))}
            </section>

            <h2 className="mt-7 mb-2 text-lg font-extrabold text-slate-900">My duties</h2>
            {data.duties.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-600">
                  No duties yet. Apply to hospital locum shifts from the Care Physician app to start logging hours.
                </p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {data.duties.map((d) => {
                  const meta = STATE_META[d.state] ?? { label: d.state, color: "#64748B" };
                  const canCheckIn = !d.checkedInAt && (d.status === "accepted" || d.state === "en_route" || d.state === "scheduled" || d.state === "overdue");
                  const canCheckOut = Boolean(d.checkedInAt) && !d.checkedOutAt;
                  return (
                    <Card key={d.assignmentId}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">{d.title}</div>
                          <div className="text-xs text-slate-500">
                            {d.hospital} · {d.dutyLabel}
                            {d.area ? ` · ${d.area}` : ""}
                            {d.shiftLabel ? ` · ${d.shiftLabel}` : ""}
                          </div>
                        </div>
                        <span
                          className="rounded-full px-2 py-1 text-[10px] font-extrabold uppercase text-white"
                          style={{ background: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-4">
                        <div>
                          <div className="font-semibold text-slate-500">Shift</div>
                          {fmt(d.startsAt)} → {fmt(d.endsAt)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-500">Checked in</div>
                          {fmt(d.checkedInAt)}
                          {d.lateMinutes > 0 ? <span className="text-rose-600"> (+{d.lateMinutes}m)</span> : null}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-500">Checked out</div>
                          {fmt(d.checkedOutAt)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-500">Hours logged</div>
                          {d.loggedHours ? `${d.loggedHours} h` : "—"}
                          {d.scheduledHours ? ` / ${d.scheduledHours} h` : ""}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {canCheckIn ? (
                          <button
                            onClick={() => hoursMutation.mutate({ assignmentId: d.assignmentId, action: "check_in" })}
                            disabled={hoursMutation.isPending}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                          >
                            Check in
                          </button>
                        ) : null}
                        {canCheckOut ? (
                          <button
                            onClick={() => hoursMutation.mutate({ assignmentId: d.assignmentId, action: "check_out" })}
                            disabled={hoursMutation.isPending}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                          >
                            Check out
                          </button>
                        ) : null}
                        {d.checkedOutAt ? (
                          <button
                            onClick={() => {
                              setFeedbackFor(feedbackFor === d.assignmentId ? null : d.assignmentId);
                              const g = d.feedbackGiven as any;
                              setForm({
                                rating: g?.rating ?? 5,
                                facilitySupport: g?.facility_support ?? 4,
                                workload: g?.workload ?? 3,
                                wouldWorkAgain: g?.would_work_again ?? true,
                                comment: g?.comment ?? "",
                              });
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700"
                          >
                            {d.feedbackGiven ? "Edit my feedback" : "Give feedback"}
                          </button>
                        ) : null}
                        {d.compensation ? (
                          <span className="ml-auto text-xs font-bold text-slate-700">
                            ₹{d.compensation.toLocaleString("en-IN")}/{d.compensationUnit}
                          </span>
                        ) : null}
                      </div>

                      {feedbackFor === d.assignmentId ? (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="grid gap-3 sm:grid-cols-3">
                            {([
                              ["Overall duty", "rating"],
                              ["Hospital support", "facilitySupport"],
                              ["Workload (1 light – 5 heavy)", "workload"],
                            ] as const).map(([label, key]) => (
                              <label key={key} className="text-[11px] font-semibold text-slate-600">
                                {label}
                                <select
                                  value={form[key]}
                                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                                >
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                          </div>
                          <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={form.wouldWorkAgain}
                              onChange={(e) => setForm((f) => ({ ...f, wouldWorkAgain: e.target.checked }))}
                            />
                            I would take a duty at this hospital again
                          </label>
                          <textarea
                            rows={3}
                            value={form.comment}
                            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                            placeholder="What went well or what should the hospital improve?"
                            className="mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => feedbackMutation.mutate({ assignmentId: d.assignmentId })}
                              disabled={feedbackMutation.isPending}
                              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                            >
                              Submit feedback
                            </button>
                            <button
                              onClick={() => setFeedbackFor(null)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            )}

            <h2 className="mt-7 mb-2 text-lg font-extrabold text-slate-900">Feedback hospitals gave me</h2>
            {data.receivedFeedback.length === 0 ? (
              <Card>
                <p className="text-sm text-slate-600">No hospital feedback recorded yet.</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.receivedFeedback.map((f) => (
                  <Card key={f.id}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900">{f.rating}★</span>
                      <span className="text-[11px] text-slate-500">{fmt(f.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      Punctuality {f.punctuality ?? "—"} · Professionalism {f.professionalism ?? "—"}
                      {f.wouldRehire != null ? ` · ${f.wouldRehire ? "Would rehire" : "Would not rehire"}` : ""}
                    </div>
                    {f.comment ? <p className="mt-2 text-xs text-slate-700">“{f.comment}”</p> : null}
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
