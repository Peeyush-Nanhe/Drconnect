import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  assignTechnicianToTest,
  getTechnicianAdminOverview,
  setTechnicianTestStatus,
} from "@/lib/technician-admin.functions";

export const Route = createFileRoute("/admin/technician")({
  head: () => ({
    meta: [
      { title: "Technician Testing Control Room — MedConnect Admin" },
      {
        name: "description",
        content:
          "Monitor every technician-led test in one board: ECG, Holter, EEG, VNG, audiometry and spirometry — assignments, turnaround, reports, area demand and patient ratings.",
      },
      { property: "og:title", content: "Technician Testing Control Room — MedConnect Admin" },
      {
        property: "og:description",
        content: "Live test board, technician reliability, report filing, area hotspots and patient feedback.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TechnicianControlRoom,
});

const STATE_META: Record<string, { label: string; color: string }> = {
  in_progress: { label: "Test in progress", color: "#059669" },
  en_route: { label: "Technician on the way", color: "#0284C7" },
  scheduled: { label: "Scheduled", color: "#64748B" },
  late: { label: "Late", color: "#DC2626" },
  unassigned: { label: "Needs a technician", color: "#C2410C" },
  absent: { label: "Patient absent / no-show", color: "#B91C1C" },
  completed: { label: "Completed", color: "#15803D" },
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

function Bar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">{title}</h2>
      {note ? <p className="mb-2 text-xs text-slate-500">{note}</p> : null}
      {children}
    </section>
  );
}

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function TechnicianControlRoom() {
  const [days, setDays] = useState(30);
  const fetchOverview = useServerFn(getTechnicianAdminOverview);
  const assign = useServerFn(assignTechnicianToTest);
  const setStatus = useServerFn(setTechnicianTestStatus);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["technician-admin-overview", days],
    queryFn: () => fetchOverview({ data: { days } }),
    retry: false,
    refetchInterval: 60_000,
  });

  const assignM = useMutation({
    mutationFn: (v: { testId: string; technicianId: string | null }) => assign({ data: v }),
    onSuccess: () => void refetch(),
  });
  const statusM = useMutation({
    mutationFn: (v: { testId: string; status: string }) => setStatus({ data: v }),
    onSuccess: () => void refetch(),
  });

  const label = (t: string) => data?.testLabels[t] ?? t;
  const mixTotal = data ? Object.values(data.totals.testMix).reduce((a, b) => a + b, 0) : 0;
  const maxHotspot = data ? Math.max(1, ...data.hotspots.map((h) => h.tests)) : 1;

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{ background: "#DCE6E1", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/admin" className="text-xs font-semibold text-teal-700 hover:underline">
              ← Admin console
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900">Technician Testing Control Room</h1>
            <p className="text-sm text-slate-600">
              Every technician-led test — ECG, Holter, EEG, VNG, audiometry, spirometry, OT assist — monitored together.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-slate-300 bg-white">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-teal-700 text-white" : "text-slate-600"}`}
                >
                  {d} days
                </button>
              ))}
            </div>
            <button
              onClick={() => refetch()}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {error ? (
          <Card className="text-sm text-rose-700">
            {(error as Error).message.includes("Forbidden")
              ? "This console is restricted to administrators and active technicians."
              : `Could not load: ${(error as Error).message}`}
          </Card>
        ) : isLoading || !data ? (
          <Card className="p-8 text-center text-sm text-slate-500">Loading…</Card>
        ) : (
          <>
            <Card className="mb-5 flex flex-wrap items-center justify-between gap-2 bg-white/80">
              <div className="text-xs text-slate-600">
                {data.scope.isAdmin
                  ? "Admin view — all technicians and all test bookings."
                  : `Technician view — ${data.scope.technicianName}`}
              </div>
              <div className="text-[11px] text-slate-500">Updated {when(data.generatedAt)}</div>
            </Card>

            <Section title="Today">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Tests today" value={data.today.total} />
                <Stat label="In progress" value={data.today.inProgress} color="#059669" />
                <Stat label="Needs a technician" value={data.today.unassigned} color="#C2410C" />
                <Stat label="Late" value={data.today.late} color="#DC2626" />
                <Stat label="Completed today" value={data.today.completed} color="#15803D" />
                <Stat label="No-shows today" value={data.today.absent} color="#B91C1C" />
                <Stat label="On the way" value={data.today.enRoute} color="#0284C7" />
                <Stat label="Cancelled today" value={data.today.cancelled} color="#94A3B8" />
              </div>
            </Section>

            <Section title={`Last ${data.windowDays} days`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total tests" value={data.totals.tests} />
                <Stat label="Completion rate" value={`${data.totals.completionRate}%`} color="#15803D" />
                <Stat label="No-show rate" value={`${data.totals.noShowRate}%`} color="#B91C1C" />
                <Stat label="Collected" value={`₹${data.totals.revenue.toLocaleString("en-IN")}`} color="#0F766E" />
                <Stat
                  label="Payment pending"
                  value={`₹${data.totals.pendingPayments.toLocaleString("en-IN")}`}
                  color="#C2410C"
                />
                <Stat label="Reports missing" value={data.totals.missingReports} color="#DC2626" sub="completed tests without findings" />
                <Stat label="Home visits" value={data.totals.homeVisits} sub={`${data.totals.urgent} urgent`} />
                <Stat
                  label="Technicians"
                  value={`${data.totals.activeTechnicians}/${data.totals.technicians}`}
                  sub="active / total"
                />
              </div>
            </Section>

            <Section title="Test mix">
              <Card>
                {Object.entries(data.totals.testMix)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <div key={k} className="mb-2">
                      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                        <span>{label(k)}</span>
                        <span>{v}</span>
                      </div>
                      <Bar value={v} total={mixTotal} color="#7C3AED" />
                    </div>
                  ))}
                {mixTotal === 0 ? <div className="text-xs text-slate-500">No tests in this window.</div> : null}
              </Card>
            </Section>

            <Section title="Live test board" note="Today's tests plus anything late, running or waiting for a technician.">
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Patient</th>
                      <th className="px-3 py-2">Test</th>
                      <th className="px-3 py-2">Where</th>
                      <th className="px-3 py-2">Scheduled</th>
                      <th className="px-3 py-2">Technician</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.board.map((b) => {
                      const meta = STATE_META[b.state] ?? { label: b.state, color: "#64748B" };
                      return (
                        <tr key={b.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold text-slate-800">
                            {b.patient}
                            {b.urgency === "urgent" ? (
                              <span className="ml-1 rounded bg-rose-100 px-1 text-[10px] font-bold text-rose-700">URGENT</span>
                            ) : null}
                            {b.referredBy ? <div className="text-[10px] text-slate-500">via {b.referredBy}</div> : null}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{b.testLabel}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {b.homeVisit ? "Home" : "Centre"}
                            {b.area ? ` · ${b.area}` : ""}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {when(b.scheduledAt)}
                            {b.minutesLate ? <div className="text-[10px] text-rose-600">{b.minutesLate} min late</div> : null}
                          </td>
                          <td className="px-3 py-2">
                            {data.scope.isAdmin ? (
                              <select
                                value={b.technicianId ?? ""}
                                onChange={(e) =>
                                  assignM.mutate({ testId: b.id, technicianId: e.target.value || null })
                                }
                                className="rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                              >
                                <option value="">Unassigned</option>
                                {data.roster.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              (b.technician ?? "—")
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: meta.color }}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value=""
                              onChange={(e) => e.target.value && statusM.mutate({ testId: b.id, status: e.target.value })}
                              className="rounded border border-slate-300 px-1.5 py-1 text-[11px]"
                            >
                              <option value="">Update…</option>
                              <option value="en_route">On the way</option>
                              <option value="in_progress">Start test</option>
                              <option value="completed">Completed</option>
                              <option value="no_show">Patient absent</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                    {data.board.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                          Nothing on the board right now.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="Area demand" note="Where tests are being requested, and how many finish.">
              <Card>
                {data.hotspots.map((h) => (
                  <div key={h.area} className="mb-3">
                    <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                      <span>
                        {h.area} · {h.tests} tests · {h.completionRate}% done
                      </span>
                      <span className="text-slate-500">
                        {h.perDay}/day · ₹{h.revenue.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <Bar value={h.tests} total={maxHotspot} color="#0D9488" />
                  </div>
                ))}
                {data.hotspots.length === 0 ? <div className="text-xs text-slate-500">No area data yet.</div> : null}
              </Card>
            </Section>

            <Section title="Technician performance">
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Technician</th>
                      <th className="px-3 py-2">Tests</th>
                      <th className="px-3 py-2">Done</th>
                      <th className="px-3 py-2">No-show</th>
                      <th className="px-3 py-2">Late</th>
                      <th className="px-3 py-2">Reliability</th>
                      <th className="px-3 py-2">Reports filed</th>
                      <th className="px-3 py-2">Avg time</th>
                      <th className="px-3 py-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.technicians.map((t) => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {t.name}
                          <div className="text-[10px] text-slate-500">
                            {[t.org, t.area, t.topTest ? label(t.topTest) : null].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="px-3 py-2">{t.tests}</td>
                        <td className="px-3 py-2 text-emerald-700">{t.completed}</td>
                        <td className="px-3 py-2 text-rose-700">{t.noShows}</td>
                        <td className="px-3 py-2">{t.lateArrivals}</td>
                        <td className="px-3 py-2">{t.reliability == null ? "—" : `${t.reliability}%`}</td>
                        <td className="px-3 py-2">{t.reportRate == null ? "—" : `${t.reportRate}%`}</td>
                        <td className="px-3 py-2">{t.avgTurnaroundMin == null ? "—" : `${t.avgTurnaroundMin} min`}</td>
                        <td className="px-3 py-2">
                          {t.avgRating == null ? "—" : `★ ${t.avgRating}`}
                          {t.reviews ? <span className="text-[10px] text-slate-500"> ({t.reviews})</span> : null}
                        </td>
                      </tr>
                    ))}
                    {data.technicians.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                          No technician activity in this window.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </Card>
              {data.idleTechnicians.length ? (
                <Card className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    No tests in this window
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    {data.idleTechnicians
                      .map((t) => `${t.name}${t.area ? ` (${t.area})` : ""}${t.active ? "" : " — inactive"}`)
                      .join(" · ")}
                  </div>
                </Card>
              ) : null}
            </Section>

            <Section title="Patient feedback">
              <Card>
                <div className="mb-2 text-xs font-semibold text-slate-700">
                  {data.feedback.count} reviews · average {data.feedback.avgRating == null ? "—" : `★ ${data.feedback.avgRating}`}
                </div>
                {data.feedback.recent.map((f) => (
                  <div key={f.id} className="border-t border-slate-100 py-2 text-xs">
                    <div className="font-semibold text-slate-800">
                      {f.technician} · ★ {f.rating}
                      <span className="ml-2 font-normal text-slate-500">{when(f.createdAt)}</span>
                    </div>
                    {f.comment ? <div className="text-slate-600">{f.comment}</div> : null}
                  </div>
                ))}
                {data.feedback.count === 0 ? <div className="text-xs text-slate-500">No reviews yet.</div> : null}
              </Card>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
