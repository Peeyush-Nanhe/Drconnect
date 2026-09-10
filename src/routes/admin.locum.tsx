import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getLocumAdminOverview } from "@/lib/locum-admin.functions";

export const Route = createFileRoute("/admin/locum")({
  head: () => ({
    meta: [
      { title: "Locum Control Room — MyDox Admin" },
      {
        name: "description",
        content:
          "Control room for care physician locum duties: ward and ICU cover, attendance, hospital demand hotspots, fulfilment and hospital feedback.",
      },
      { property: "og:title", content: "Locum Control Room — MyDox Admin" },
      {
        property: "og:description",
        content: "Live duty status, hospital demand hotspots, fulfilment rates and hospital ratings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LocumControlRoom,
});

const STATE_META: Record<string, { label: string; color: string }> = {
  on_duty: { label: "On duty", color: "#059669" },
  en_route: { label: "About to go", color: "#0284C7" },
  scheduled: { label: "Scheduled", color: "#64748B" },
  overdue: { label: "Not reported", color: "#DC2626" },
  absent: { label: "Absent", color: "#B91C1C" },
  completed: { label: "Completed", color: "#15803D" },
  cancelled: { label: "Cancelled", color: "#94A3B8" },
  applied: { label: "Applied", color: "#7C3AED" },
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

function LocumControlRoom() {
  const [days, setDays] = useState(90);
  const fetchOverview = useServerFn(getLocumAdminOverview);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["locum-admin-overview", days],
    queryFn: () => fetchOverview({ data: { days } }),
    retry: false,
    refetchInterval: 60_000,
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
            <h1 className="text-2xl font-extrabold text-slate-900">Locum Control Room</h1>
            <p className="text-sm text-slate-600">
              Care physician duty cover, attendance, hospital demand and feedback.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-slate-300 bg-white">
              {[30, 90, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-teal-700 text-white" : "text-slate-600"}`}
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
            <Section title="Live duty status" note="Right now, across every hospital using locum cover.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <Stat label="On duty now" value={data.live.onDuty} color="#059669" />
                <Stat label="About to go" value={data.live.enRoute} color="#0284C7" sub="Starting within 6h" />
                <Stat label="Not reported" value={data.live.notCommitted} color="#DC2626" sub="Commitment missed" />
                <Stat label="Absent today" value={data.live.absentToday} color="#B91C1C" />
                <Stat label="Committed today" value={data.live.committedToday} />
                <Stat label="Completed today" value={data.live.completedToday} color="#15803D" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Card>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Duty mix (committed)
                  </div>
                  {Object.keys(data.live.dutyMix).length === 0 ? (
                    <div className="text-xs text-slate-500">No committed duties in this window.</div>
                  ) : (
                    Object.entries(data.live.dutyMix)
                      .sort((a, b) => b[1] - a[1])
                      .map(([duty, n]) => (
                        <div key={duty} className="mb-2">
                          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                            <span>{data.dutyLabels[duty] ?? duty}</span>
                            <span>{n}</span>
                          </div>
                          <Bar
                            value={n}
                            total={Object.values(data.live.dutyMix).reduce((a, b) => a + b, 0)}
                            color="#4F46E5"
                          />
                        </div>
                      ))
                  )}
                </Card>
                <Card>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Demand fulfilment
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900">{data.demand.fillRate}%</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {data.demand.filled} of {data.demand.slots} requested slots filled ·{" "}
                    {data.demand.hospitalsEnquired} hospitals enquired
                  </div>
                  <div className="mt-2">
                    <Bar value={data.demand.filled} total={data.demand.slots} color="#0D9488" />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <div className="text-lg font-extrabold text-slate-900">{data.demand.jobs}</div>
                      <div className="text-slate-500">Requests</div>
                    </div>
                    <div>
                      <div className="text-lg font-extrabold text-amber-600">{data.demand.unfilled}</div>
                      <div className="text-slate-500">Unfilled</div>
                    </div>
                    <div>
                      <div className="text-lg font-extrabold text-rose-600">{data.demand.unfilledUrgent}</div>
                      <div className="text-slate-500">Urgent gaps</div>
                    </div>
                  </div>
                </Card>
              </div>
            </Section>

            <Section title="Duty board" note="Sorted by what needs attention first.">
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">Care physician</th>
                      <th className="p-3">Hospital</th>
                      <th className="p-3">Duty</th>
                      <th className="p-3">Shift start</th>
                      <th className="p-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.board.length === 0 ? (
                      <tr>
                        <td className="p-4 text-slate-500" colSpan={6}>
                          No locum assignments in this window.
                        </td>
                      </tr>
                    ) : (
                      data.board.map((row) => {
                        const meta = STATE_META[row.state] ?? { label: row.state, color: "#64748B" };
                        return (
                          <tr key={row.assignmentId} className="border-t border-slate-100">
                            <td className="p-3">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                                style={{ background: meta.color }}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-800">{row.provider}</td>
                            <td className="p-3 text-slate-600">
                              {row.hospital}
                              {row.area ? <span className="text-slate-400"> · {row.area}</span> : null}
                            </td>
                            <td className="p-3 text-slate-600">{row.dutyLabel}</td>
                            <td className="p-3 text-slate-600">{when(row.startsAt)}</td>
                            <td className="p-3 text-slate-500">
                              {row.minutesLate != null
                                ? `${row.minutesLate} min past start`
                                : row.endsInMinutes != null
                                  ? `${row.endsInMinutes} min left`
                                  : row.shift || "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="Demand hotspots" note="Areas where locum cover is requested most and hardest to fill.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="overflow-x-auto p-0">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="p-3">Area</th>
                        <th className="p-3">Requests</th>
                        <th className="p-3">Unfilled</th>
                        <th className="p-3">Fill rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hotspots.length === 0 ? (
                        <tr>
                          <td className="p-4 text-slate-500" colSpan={4}>
                            No demand recorded yet.
                          </td>
                        </tr>
                      ) : (
                        data.hotspots.slice(0, 12).map((h) => (
                          <tr key={h.area} className="border-t border-slate-100">
                            <td className="p-3 font-semibold text-slate-800">
                              {h.area}
                              {h.city ? <span className="text-slate-400"> · {h.city}</span> : null}
                            </td>
                            <td className="p-3 text-slate-600">{h.jobs}</td>
                            <td className="p-3 font-semibold" style={{ color: h.unfilled ? "#DC2626" : "#64748B" }}>
                              {h.unfilled}
                            </td>
                            <td className="p-3 text-slate-600">{h.fillRate}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </Card>
                <Card>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Hotspot map
                  </div>
                  <div className="relative h-64 overflow-hidden rounded-xl bg-slate-100">
                    {(() => {
                      const pts = data.hotspots.filter((h) => h.lat != null && h.lng != null);
                      if (pts.length === 0)
                        return (
                          <div className="grid h-full place-items-center px-6 text-center text-xs text-slate-500">
                            Add hospital locations to plot demand hotspots on the map.
                          </div>
                        );
                      const lats = pts.map((p) => p.lat as number);
                      const lngs = pts.map((p) => p.lng as number);
                      const minLat = Math.min(...lats),
                        maxLat = Math.max(...lats),
                        minLng = Math.min(...lngs),
                        maxLng = Math.max(...lngs);
                      const span = (a: number, b: number) => (b - a || 0.02);
                      const maxUnfilled = Math.max(...pts.map((p) => p.unfilled), 1);
                      return pts.map((p) => {
                        const x = ((p.lng! - minLng) / span(minLng, maxLng)) * 80 + 10;
                        const y = 90 - ((p.lat! - minLat) / span(minLat, maxLat)) * 80;
                        const size = 14 + (p.unfilled / maxUnfilled) * 26;
                        return (
                          <div
                            key={p.area}
                            title={`${p.area}: ${p.unfilled} unfilled of ${p.slots}`}
                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              width: size,
                              height: size,
                              background: p.unfilled ? "rgba(220,38,38,.55)" : "rgba(13,148,136,.5)",
                              border: "2px solid #fff",
                            }}
                          />
                        );
                      });
                    })()}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">
                    Bubble size shows unfilled slots; red means demand is going uncovered.
                  </div>
                </Card>
              </div>
            </Section>

            <Section title="Hospitals enquiring" note="Who is asking for locum cover and how well we serve them.">
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Hospital</th>
                      <th className="p-3">Requests</th>
                      <th className="p-3">Slots</th>
                      <th className="p-3">Filled</th>
                      <th className="p-3">Fill rate</th>
                      <th className="p-3">Urgent</th>
                      <th className="p-3">Rating given</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hospitalDemand.length === 0 ? (
                      <tr>
                        <td className="p-4 text-slate-500" colSpan={7}>
                          No hospital enquiries yet.
                        </td>
                      </tr>
                    ) : (
                      data.hospitalDemand.map((h) => (
                        <tr key={h.facilityId} className="border-t border-slate-100">
                          <td className="p-3 font-semibold text-slate-800">{h.hospital}</td>
                          <td className="p-3 text-slate-600">{h.jobs}</td>
                          <td className="p-3 text-slate-600">{h.slots}</td>
                          <td className="p-3 text-slate-600">{h.filled}</td>
                          <td className="p-3">
                            <div className="mb-1 font-semibold text-slate-700">{h.fillRate}%</div>
                            <Bar value={h.filled} total={h.slots} color={h.fillRate >= 80 ? "#0D9488" : "#F59E0B"} />
                          </td>
                          <td className="p-3 text-slate-600">{h.urgent}</td>
                          <td className="p-3 text-slate-600">{h.avgRatingGiven ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section
              title="Care physician performance"
              note="Commitment reliability, hospital ratings and which hospital each doctor prefers."
            >
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="p-3">Care physician</th>
                      <th className="p-3">Accepted</th>
                      <th className="p-3">Completed</th>
                      <th className="p-3">No-shows</th>
                      <th className="p-3">Reliability</th>
                      <th className="p-3">Hospital rating</th>
                      <th className="p-3">Rehire</th>
                      <th className="p-3">Prefers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.providers.length === 0 ? (
                      <tr>
                        <td className="p-4 text-slate-500" colSpan={8}>
                          No care physician activity yet.
                        </td>
                      </tr>
                    ) : (
                      data.providers.map((p) => (
                        <tr key={p.providerId} className="border-t border-slate-100">
                          <td className="p-3 font-semibold text-slate-800">
                            {p.name}
                            {p.topDuty ? (
                              <div className="text-[10px] text-slate-400">{data.dutyLabels[p.topDuty] ?? p.topDuty}</div>
                            ) : null}
                          </td>
                          <td className="p-3 text-slate-600">{p.accepted}</td>
                          <td className="p-3 text-slate-600">{p.completed}</td>
                          <td className="p-3" style={{ color: p.noShows ? "#DC2626" : "#64748B" }}>
                            {p.noShows}
                          </td>
                          <td className="p-3 text-slate-600">{p.reliability == null ? "—" : `${p.reliability}%`}</td>
                          <td className="p-3 text-slate-600">
                            {p.avgRating == null ? "—" : `★ ${p.avgRating}`}{" "}
                            <span className="text-slate-400">({p.reviews})</span>
                          </td>
                          <td className="p-3 text-slate-600">{p.rehireRate == null ? "—" : `${p.rehireRate}%`}</td>
                          <td className="p-3 text-slate-600">{p.preferredHospital ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="Hospital feedback">
              <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Reviews" value={data.feedback.count} />
                <Stat label="Avg rating" value={data.feedback.avgRating ?? "—"} color="#0D9488" />
                <Stat label="Avg punctuality" value={data.feedback.avgPunctuality ?? "—"} />
                <Stat
                  label="Would rehire"
                  value={data.feedback.rehireRate == null ? "—" : `${data.feedback.rehireRate}%`}
                  color="#4F46E5"
                />
              </div>
              {data.feedback.recent.length === 0 ? (
                <Card className="text-xs text-slate-500">No hospital feedback recorded yet.</Card>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.feedback.recent.map((f) => (
                    <Card key={f.id}>
                      <div className="flex justify-between text-xs font-semibold text-slate-800">
                        <span>{f.provider}</span>
                        <span className="text-amber-600">★ {f.rating}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {f.hospital} · {when(f.createdAt)}
                      </div>
                      {f.comment ? <p className="mt-2 text-xs text-slate-600">{f.comment}</p> : null}
                    </Card>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
