import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getWellnessAdminOverview } from "@/lib/mw-admin.functions";
import { MW_TRACKS } from "@/features/mydox/mw-tracks";

export const Route = createFileRoute("/admin/wellness")({
  head: () => ({
    meta: [
      { title: "Wellness Console — MyDox Admin" },
      {
        name: "description",
        content:
          "Admin console for the mental wellness module: screening scores, provider performance, care-team SLA compliance and patient outcome trends.",
      },
      { property: "og:title", content: "Wellness Console — MyDox Admin" },
      {
        property: "og:description",
        content: "Screening scores, provider performance, SLA compliance and patient trends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WellnessAdminPage,
});

const TRACK_LABEL: Record<string, string> = Object.fromEntries(
  MW_TRACKS.map((t) => [t.id, t.label]),
);
const BAND_TONE: Record<string, string> = {
  Minimal: "#16A34A",
  Mild: "#65A30D",
  Moderate: "#D97706",
  "Moderately severe": "#EA580C",
  Severe: "#DC2626",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</div>
  );
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

function WellnessAdminPage() {
  const [days, setDays] = useState(90);
  const fetchOverview = useServerFn(getWellnessAdminOverview);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["mw-admin-overview", days],
    queryFn: () => fetchOverview({ data: { days } }),
    retry: false,
  });

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
            <h1 className="text-2xl font-extrabold text-slate-900">Wellness Console</h1>
            <p className="text-sm text-slate-600">
              Screening scores, provider performance, care-team SLA and patient trends.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-slate-300 bg-white">
              {[30, 90, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-xs font-semibold ${
                    days === d ? "bg-teal-700 text-white" : "text-slate-600"
                  }`}
                >
                  {d === 365 ? "1 year" : `${d} days`}
                </button>
              ))}
            </div>
            <button
              onClick={() => refetch()}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
            >
              {isFetching ? "Refreshing…" : "Refresh"}
            </button>
            <Link to="/admin/live" className="text-sm font-semibold text-teal-700 hover:underline">
              Live admin
            </Link>
            <Link to="/" className="text-sm font-semibold text-teal-700 hover:underline">
              ← App
            </Link>
          </div>
        </div>

        {error ? (
          <Card className="text-sm text-rose-700">
            {(error as Error).message.includes("Forbidden")
              ? "This console is restricted to administrators."
              : `Could not load: ${(error as Error).message}`}
          </Card>
        ) : isLoading || !data ? (
          <Card className="p-8 text-center text-sm text-slate-500">Loading…</Card>
        ) : (
          <>
            <Section title="Overview">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <Stat label="Care teams" value={data.totals.teams} />
                <Stat label="Urgent" value={data.totals.urgent} color="#DC2626" />
                <Stat label="Safety flags" value={data.totals.redFlag} color="#EA580C" />
                <Stat label="Review flags" value={data.totals.reviewFlag} color="#D97706" />
                <Stat label="No coordinator" value={data.totals.unassigned} color="#4F46E5" />
                <Stat label="Measurements" value={data.totals.measurements} color="#0D9488" />
              </div>
            </Section>

            <Section title="Tracks & status">
              <div className="grid gap-3 md:grid-cols-3">
                <Card>
                  <div className="mb-2 text-xs font-bold text-slate-700">By track</div>
                  {Object.entries(data.totals.byTrack).length === 0 ? (
                    <div className="text-xs text-slate-400">No teams yet.</div>
                  ) : (
                    Object.entries(data.totals.byTrack).map(([k, v]) => (
                      <div key={k} className="mb-2">
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>{TRACK_LABEL[k] ?? k}</span>
                          <span className="font-semibold">{v}</span>
                        </div>
                        <Bar value={v} total={data.totals.teams} color="#4F46E5" />
                      </div>
                    ))
                  )}
                </Card>
                <Card>
                  <div className="mb-2 text-xs font-bold text-slate-700">By status</div>
                  {Object.entries(data.totals.byStatus).map(([k, v]) => (
                    <div key={k} className="mb-2">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span className="capitalize">{k.replace(/_/g, " ")}</span>
                        <span className="font-semibold">{v}</span>
                      </div>
                      <Bar value={v} total={data.totals.teams} color="#0D9488" />
                    </div>
                  ))}
                </Card>
                <Card>
                  <div className="mb-2 text-xs font-bold text-slate-700">First appointment modality</div>
                  {Object.entries(data.totals.byModality).map(([k, v]) => (
                    <div key={k} className="mb-2">
                      <div className="flex justify-between text-xs text-slate-600">
                        <span className="capitalize">{k.replace(/_/g, " ")}</span>
                        <span className="font-semibold">{v}</span>
                      </div>
                      <Bar value={v} total={data.totals.teams} color="#DB2777" />
                    </div>
                  ))}
                </Card>
              </div>
            </Section>

            <Section
              title="SLA compliance"
              note="First contact target: 4 working hours. Full team assembly target: 48 hours."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { label: "First contact", s: data.sla.firstContact as any },
                  { label: "Team assembly", s: data.sla.assembly as any },
                ].map(({ label, s }) => {
                  const total = s.met + s.breached + s.pending || 1;
                  return (
                    <Card key={label}>
                      <div className="mb-2 flex items-baseline justify-between">
                        <div className="text-xs font-bold text-slate-700">{label}</div>
                        <div className="text-xs text-slate-500">
                          {Math.round((s.met / total) * 100)}% on time
                        </div>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                        <div style={{ width: `${(s.met / total) * 100}%`, background: "#16A34A" }} />
                        <div style={{ width: `${(s.breached / total) * 100}%`, background: "#DC2626" }} />
                        <div style={{ width: `${(s.pending / total) * 100}%`, background: "#CBD5E1" }} />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                        <div>
                          <div className="font-bold text-emerald-600">{s.met}</div>on time
                        </div>
                        <div>
                          <div className="font-bold text-rose-600">{s.breached}</div>breached
                        </div>
                        <div>
                          <div className="font-bold text-slate-500">{s.pending}</div>in window
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        Average time taken: {s.avgHours != null ? `${s.avgHours} h` : "—"}
                        {"avgLateHours" in s && s.avgLateHours != null
                          ? ` · average overrun ${s.avgLateHours} h`
                          : ""}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Section>

            <Section title="Screening scores">
              <div className="grid gap-3 md:grid-cols-3">
                {data.scores.instrumentStats.map((i) => (
                  <Card key={i.instrument}>
                    <div className="flex items-baseline justify-between">
                      <div className="text-xs font-bold text-slate-700">{i.instrument}</div>
                      <div className="text-[11px] text-slate-500">{i.measurements} recorded</div>
                    </div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">
                      {i.avgScore ?? "—"}
                      <span className="ml-1 text-xs font-semibold text-slate-500">avg score</span>
                    </div>
                    {i.redFlags > 0 && (
                      <div className="mt-1 text-[11px] font-semibold text-rose-600">
                        {i.redFlags} safety-item endorsement{i.redFlags > 1 ? "s" : ""}
                      </div>
                    )}
                    <div className="mt-2 space-y-1">
                      {Object.entries(i.bands).map(([band, n]) => (
                        <div key={band} className="flex items-center gap-2 text-[11px]">
                          <span className="w-32 shrink-0 text-slate-600">{band}</span>
                          <Bar value={n} total={i.measurements} color={BAND_TONE[band] ?? "#64748B"} />
                          <span className="w-6 text-right font-semibold text-slate-700">{n}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
                <Card>
                  <div className="text-xs font-bold text-slate-700">Outcome direction</div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Teams with two or more measurements, comparing the latest score with the first.
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Improved</span>
                      <span className="font-bold">{data.scores.improved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">No change</span>
                      <span className="font-bold">{data.scores.unchanged}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-rose-600">Worsened</span>
                      <span className="font-bold">{data.scores.worsened}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Only one score so far</span>
                      <span className="font-bold">{data.scores.singleOnly}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </Section>

            <Section title="Patient trends" note="Worst movement first. Patients are shown by case reference only.">
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Case</th>
                      <th className="px-3 py-2">Track</th>
                      <th className="px-3 py-2">Instrument</th>
                      <th className="px-3 py-2">First</th>
                      <th className="px-3 py-2">Latest</th>
                      <th className="px-3 py-2">Change</th>
                      <th className="px-3 py-2">Band</th>
                      <th className="px-3 py-2">Scores</th>
                      <th className="px-3 py-2">Last taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.scores.deltas.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                          No measurements recorded yet.
                        </td>
                      </tr>
                    ) : (
                      data.scores.deltas.map((d) => (
                        <tr key={d.teamId} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                            {d.teamId.slice(0, 8)}
                            {d.urgent && <span className="ml-1 text-rose-600">●</span>}
                          </td>
                          <td className="px-3 py-2">{TRACK_LABEL[d.track] ?? d.track}</td>
                          <td className="px-3 py-2">{d.instrument}</td>
                          <td className="px-3 py-2">{d.first}</td>
                          <td className="px-3 py-2 font-semibold">{d.latest}</td>
                          <td
                            className="px-3 py-2 font-bold"
                            style={{ color: d.delta > 0 ? "#DC2626" : d.delta < 0 ? "#16A34A" : "#64748B" }}
                          >
                            {d.delta > 0 ? `+${d.delta}` : d.delta}
                          </td>
                          <td className="px-3 py-2" style={{ color: BAND_TONE[d.band] ?? "#334155" }}>
                            {d.band}
                          </td>
                          <td className="px-3 py-2">{d.points}</td>
                          <td className="px-3 py-2 text-slate-500">
                            {new Date(d.lastAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="Provider performance">
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Provider</th>
                      <th className="px-3 py-2">Specialty</th>
                      <th className="px-3 py-2">Roles covered</th>
                      <th className="px-3 py-2">Assignments</th>
                      <th className="px-3 py-2">Confirmed</th>
                      <th className="px-3 py-2">Confirm rate</th>
                      <th className="px-3 py-2">Avg time to confirm</th>
                      <th className="px-3 py-2">Registration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.providerPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                          No providers assigned to wellness teams yet.
                        </td>
                      </tr>
                    ) : (
                      data.providerPerformance.map((p) => (
                        <tr key={p.providerId} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold text-slate-800">{p.name}</td>
                          <td className="px-3 py-2 text-slate-600">{p.specialty ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{p.roles.join(", ")}</td>
                          <td className="px-3 py-2">{p.assignments}</td>
                          <td className="px-3 py-2">{p.confirmed}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Bar value={p.confirmRate} total={100} color="#0D9488" />
                              <span className="w-9 text-right font-semibold">{p.confirmRate}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">{p.avgFillHours != null ? `${p.avgFillHours} h` : "—"}</td>
                          <td className="px-3 py-2">
                            {p.verified ? (
                              <span className="font-semibold text-emerald-600">Verified</span>
                            ) : (
                              <span className="font-semibold text-rose-600">Unverified</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="Role coverage" note="Lowest fill rate first — these roles are the assembly bottleneck.">
              <div className="grid gap-3 md:grid-cols-2">
                <Card>
                  {data.roleCoverage.length === 0 ? (
                    <div className="text-xs text-slate-400">No team roles yet.</div>
                  ) : (
                    data.roleCoverage.map((r) => (
                      <div key={r.role} className="mb-2">
                        <div className="flex justify-between text-xs text-slate-600">
                          <span>
                            {r.label}
                            {r.required === r.total ? " · required" : ""}
                          </span>
                          <span className="font-semibold">
                            {r.filled}/{r.total}
                          </span>
                        </div>
                        <Bar value={r.filled} total={r.total} color={r.fillRate < 50 ? "#DC2626" : "#16A34A"} />
                      </div>
                    ))
                  )}
                </Card>
                <Card>
                  <div className="mb-2 text-xs font-bold text-slate-700">Coordinator load</div>
                  {data.coordinators.length === 0 ? (
                    <div className="text-xs text-slate-400">No cases claimed yet.</div>
                  ) : (
                    data.coordinators.map((c) => (
                      <div key={c.id} className="flex justify-between border-b border-slate-100 py-1.5 text-xs last:border-0">
                        <span className="text-slate-700">{c.name}</span>
                        <span className="text-slate-500">
                          {c.teams} cases · {c.open} open
                          {c.breaches > 0 && (
                            <span className="ml-1 font-semibold text-rose-600">{c.breaches} overdue</span>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </Card>
              </div>
            </Section>

            <Section title="Needs attention">
              <Card className="p-0">
                {data.attention.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No overdue, flagged or urgent cases. 🎉
                  </div>
                ) : (
                  data.attention.map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-0">
                      <span className="font-mono text-[11px] text-slate-500">{t.id.slice(0, 8)}</span>
                      <span className="font-semibold text-slate-800">{TRACK_LABEL[t.track] ?? t.track}</span>
                      <span className="text-slate-500">{t.coordinator ?? "unassigned"}</span>
                      {t.urgent && <Chip tone="#DC2626">Urgent</Chip>}
                      {t.redFlag && <Chip tone="#EA580C">Safety flag</Chip>}
                      {t.reviewFlag && <Chip tone="#D97706">Review</Chip>}
                      {t.firstContactOverdue && <Chip tone="#DC2626">First call overdue</Chip>}
                      {t.assemblyOverdue && <Chip tone="#B91C1C">Assembly overdue</Chip>}
                      <span className="ml-auto text-slate-400">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </Card>
            </Section>

            <p className="pb-6 text-[11px] text-slate-500">
              Window: last {data.windowDays} days · generated {new Date(data.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: `${tone}18`, color: tone }}
    >
      {children}
    </span>
  );
}
