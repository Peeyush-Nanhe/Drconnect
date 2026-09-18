import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  assignPhysioVisitTherapist,
  getPhysioAdminOverview,
  updatePhysioVisitStatus,
} from "@/lib/physio-admin.functions";

export const Route = createFileRoute("/admin/physio")({
  head: () => ({
    meta: [
      { title: "Home Physiotherapy Control Room — MyDox Admin" },
      {
        name: "description",
        content:
          "Monitor home physiotherapy visits by area and therapy type: neuro, orthopaedic, paediatric and geriatric cover, late or absent therapists, demand hotspots and patient feedback.",
      },
      { property: "og:title", content: "Home Physiotherapy Control Room — MyDox Admin" },
      {
        property: "og:description",
        content: "Live home-visit board, therapy mix, area hotspots, therapist reliability and service quality ratings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PhysioControlRoom,
});

const STATE_META: Record<string, { label: string; color: string }> = {
  on_visit: { label: "In session", color: "#059669" },
  en_route: { label: "Going for visit", color: "#0284C7" },
  scheduled: { label: "Scheduled", color: "#64748B" },
  late: { label: "Late for duty", color: "#DC2626" },
  unassigned: { label: "Unassigned", color: "#C2410C" },
  absent: { label: "Absent / no-show", color: "#B91C1C" },
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

function PhysioControlRoom() {
  const [days, setDays] = useState(30);
  const fetchOverview = useServerFn(getPhysioAdminOverview);
  const assignFn = useServerFn(assignPhysioVisitTherapist);
  const statusFn = useServerFn(updatePhysioVisitStatus);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["physio-admin-overview", days],
    queryFn: () => fetchOverview({ data: { days } }),
    retry: false,
    refetchInterval: 60_000,
  });

  const [assignChoice, setAssignChoice] = useState<Record<string, string>>({});
  const [cancelingRow, setCancelingRow] = useState<string | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const assignMutation = useMutation({
    mutationFn: (vars: { visitId: string; therapistId: string }) => assignFn({ data: vars }),
    onSuccess: () => {
      setRowError(null);
      refetch();
    },
    onError: (e: unknown, vars) =>
      setRowError({ id: vars.visitId, message: e instanceof Error ? e.message : "Could not assign therapist" }),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { visitId: string; action: string; reason?: string | null }) => statusFn({ data: vars }),
    onSuccess: () => {
      setRowError(null);
      setCancelingRow(null);
      setCancelReasonInput("");
      refetch();
    },
    onError: (e: unknown, vars) =>
      setRowError({ id: vars.visitId, message: e instanceof Error ? e.message : "Could not update visit" }),
  });

  const mixTotal = data ? Object.values(data.totals.therapyMix).reduce((a, b) => a + b, 0) : 0;
  const todayMixTotal = data ? Object.values(data.today.therapyMix).reduce((a, b) => a + b, 0) : 0;
  const maxHotspot = data ? Math.max(1, ...data.hotspots.map((h) => h.visits)) : 1;

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
            <h1 className="text-2xl font-extrabold text-slate-900">Home Physiotherapy Control Room</h1>
            <p className="text-sm text-slate-600">
              Home visits by area and therapy type, therapist attendance, demand hotspots and service quality.
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
              ? "This console is restricted to administrators and approved home-physiotherapy partners."
              : `Could not load: ${(error as Error).message}`}
          </Card>
        ) : isLoading || !data ? (
          <Card className="p-8 text-center text-sm text-slate-500">Loading…</Card>
        ) : (
          <>
            <Card className="mb-5 flex flex-wrap items-center justify-between gap-2 bg-white/80">
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-800">
                  {data.scope.isAdmin ? "MyDox operations view" : data.scope.partnerName}
                </span>{" "}
                · {data.scope.isAdmin ? "all partners and areas" : "partner view"}
              </div>
              <div className="flex flex-wrap gap-1">
                {data.scope.areas.slice(0, 12).map((a) => (
                  <span key={a} className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
                    {a}
                  </span>
                ))}
              </div>
            </Card>

            <Section title="Today" note="Home visits scheduled for today across your areas.">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                <Stat label="Visits today" value={data.today.total} />
                <Stat label="In session" value={data.today.onVisit} color="#059669" />
                <Stat label="Going for visit" value={data.today.enRoute} color="#0284C7" sub="Within 3h" />
                <Stat label="Late for duty" value={data.today.lateForDuty} color="#DC2626" />
                <Stat label="Absent / no-show" value={data.today.absentToday} color="#B91C1C" />
                <Stat label="Unassigned" value={data.today.unassignedToday} color="#C2410C" />
                <Stat label="Completed" value={data.today.completedToday} color="#15803D" />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Card>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Today by therapy type
                  </div>
                  {todayMixTotal === 0 ? (
                    <div className="text-xs text-slate-500">No visits scheduled today.</div>
                  ) : (
                    Object.entries(data.today.therapyMix)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, n]) => (
                        <div key={k} className="mb-2">
                          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                            <span>{data.therapyLabels[k] ?? k}</span>
                            <span>{n}</span>
                          </div>
                          <Bar value={n} total={todayMixTotal} color="#4F46E5" />
                        </div>
                      ))
                  )}
                </Card>
                <Card>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Today by area
                  </div>
                  {Object.keys(data.today.areaMix).length === 0 ? (
                    <div className="text-xs text-slate-500">No visits scheduled today.</div>
                  ) : (
                    Object.entries(data.today.areaMix)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, n]) => (
                        <div key={k} className="mb-2">
                          <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                            <span>{k}</span>
                            <span>{n}</span>
                          </div>
                          <Bar value={n} total={data.today.total || 1} color="#0D9488" />
                        </div>
                      ))
                  )}
                </Card>
              </div>
            </Section>

            <Section title="Visit board" note="Late and unassigned visits float to the top.">
              <Card className="overflow-x-auto p-0">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Patient</th>
                      <th className="px-3 py-2">Therapy</th>
                      <th className="px-3 py-2">Area</th>
                      <th className="px-3 py-2">Therapist</th>
                      <th className="px-3 py-2">Scheduled</th>
                      <th className="px-3 py-2">Partner</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.board.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                          Nothing on the board right now.
                        </td>
                      </tr>
                    ) : (
                      data.board.map((b) => {
                        const meta = STATE_META[b.state] ?? { label: b.state, color: "#64748B" };
                        const cancellable = ["requested", "assigned", "en_route"].includes(b.status);
                        const rowBusy =
                          (assignMutation.isPending && assignMutation.variables?.visitId === b.id) ||
                          (statusMutation.isPending && statusMutation.variables?.visitId === b.id);
                        return (
                          <tr key={b.id} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              <span
                                className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                                style={{ background: meta.color }}
                              >
                                {meta.label}
                              </span>
                              {b.minutesLate ? (
                                <div className="mt-0.5 text-[10px] font-semibold text-rose-600">
                                  {b.minutesLate} min late
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-800">
                              {b.patient}
                              {b.urgency === "urgent" ? (
                                <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700">
                                  URGENT
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{b.therapyLabel}</td>
                            <td className="px-3 py-2 text-slate-700">{b.area}</td>
                            <td className="px-3 py-2 text-slate-700">{b.therapist ?? "— not assigned —"}</td>
                            <td className="px-3 py-2 text-slate-500">{when(b.scheduledAt)}</td>
                            <td className="px-3 py-2 text-slate-500">{b.partner ?? "—"}</td>
                            <td className="px-3 py-2">
                              {cancelingRow === b.id ? (
                                <div className="flex flex-col gap-1">
                                  <input
                                    autoFocus
                                    value={cancelReasonInput}
                                    onChange={(e) => setCancelReasonInput(e.target.value)}
                                    placeholder="Cancellation reason"
                                    maxLength={300}
                                    className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      disabled={!cancelReasonInput.trim() || rowBusy}
                                      onClick={() =>
                                        statusMutation.mutate({ visitId: b.id, action: "cancelled", reason: cancelReasonInput })
                                      }
                                      className="rounded-full bg-rose-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCancelingRow(null);
                                        setCancelReasonInput("");
                                      }}
                                      className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
                                    >
                                      Back
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1">
                                  {b.status === "requested" ? (
                                    <>
                                      {(() => {
                                        const availableRoster = data.roster.filter((t) => t.verified && t.active);
                                        const preferred = b.preferredTherapistId
                                          ? availableRoster.find((t) => t.id === b.preferredTherapistId)
                                          : null;
                                        const chosen = assignChoice[b.id] ?? (preferred ? preferred.id : "");
                                        return (
                                          <div className="flex flex-col gap-1">
                                            {preferred ? (
                                              <div className="text-[10px] font-semibold text-teal-700">
                                                Requested: {preferred.name}
                                              </div>
                                            ) : null}
                                            <div className="flex items-center gap-1">
                                              <select
                                                value={chosen}
                                                onChange={(e) => setAssignChoice((m) => ({ ...m, [b.id]: e.target.value }))}
                                                className="rounded-lg border border-slate-200 px-1.5 py-1 text-[11px]"
                                              >
                                                <option value="">Pick therapist…</option>
                                                {availableRoster.map((t) => (
                                                  <option key={t.id} value={t.id}>
                                                    {t.name}
                                                    {t.area ? ` (${t.area})` : ""}
                                                  </option>
                                                ))}
                                              </select>
                                              <button
                                                type="button"
                                                disabled={!chosen || rowBusy}
                                                onClick={() => assignMutation.mutate({ visitId: b.id, therapistId: chosen })}
                                                className="rounded-full bg-teal-700 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                                              >
                                                Assign
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </>
                                  ) : b.status === "assigned" ? (
                                    <button
                                      type="button"
                                      disabled={rowBusy}
                                      onClick={() => statusMutation.mutate({ visitId: b.id, action: "en_route" })}
                                      className="rounded-full bg-sky-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                                    >
                                      Send en route
                                    </button>
                                  ) : b.status === "en_route" ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={rowBusy}
                                        onClick={() => statusMutation.mutate({ visitId: b.id, action: "in_progress" })}
                                        className="rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                                      >
                                        Check in
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rowBusy}
                                        onClick={() => statusMutation.mutate({ visitId: b.id, action: "no_show" })}
                                        className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 disabled:opacity-50"
                                      >
                                        No-show
                                      </button>
                                    </>
                                  ) : b.status === "in_progress" ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={rowBusy}
                                        onClick={() => statusMutation.mutate({ visitId: b.id, action: "completed" })}
                                        className="rounded-full bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                                      >
                                        Complete
                                      </button>
                                      <button
                                        type="button"
                                        disabled={rowBusy}
                                        onClick={() => statusMutation.mutate({ visitId: b.id, action: "no_show" })}
                                        className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 disabled:opacity-50"
                                      >
                                        No-show
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                  {cancellable ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCancelingRow(b.id);
                                        setCancelReasonInput("");
                                      }}
                                      className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
                                    >
                                      Cancel
                                    </button>
                                  ) : null}
                                </div>
                              )}
                              {rowError && rowError.id === b.id ? (
                                <div className="mt-1 max-w-[200px] text-[10px] font-semibold text-rose-600">
                                  {rowError.message}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title={`Demand · last ${data.windowDays} days`}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                <Stat label="Visits" value={data.totals.visits} />
                <Stat label="Completed" value={`${data.totals.completionRate}%`} color="#15803D" />
                <Stat label="No-show rate" value={`${data.totals.noShowRate}%`} color="#B91C1C" />
                <Stat label="Cancelled" value={data.totals.cancelled} color="#94A3B8" />
                <Stat label="Therapists" value={`${data.totals.activeTherapists}/${data.totals.therapists}`} sub="Active / on roster" />
                <Stat label="Service value" value={`₹${data.totals.revenue.toLocaleString("en-IN")}`} color="#0D9488" />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Card>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Therapy mix
                  </div>
                  {Object.entries(data.totals.therapyMix)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => (
                      <div key={k} className="mb-2">
                        <div className="mb-1 flex justify-between text-xs font-semibold text-slate-700">
                          <span>{data.therapyLabels[k] ?? k}</span>
                          <span>
                            {n} · {mixTotal ? Math.round((n / mixTotal) * 100) : 0}%
                          </span>
                        </div>
                        <Bar value={n} total={mixTotal} color="#7C3AED" />
                      </div>
                    ))}
                </Card>
                <Card>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    High-demand areas
                  </div>
                  <div className="relative h-48 overflow-hidden rounded-xl bg-slate-50">
                    {data.hotspots
                      .filter((h) => h.lat != null && h.lng != null)
                      .slice(0, 24)
                      .map((h) => {
                        const size = 14 + (h.visits / maxHotspot) * 42;
                        const lats = data.hotspots.filter((x) => x.lat != null).map((x) => x.lat as number);
                        const lngs = data.hotspots.filter((x) => x.lng != null).map((x) => x.lng as number);
                        const minLat = Math.min(...lats), maxLat = Math.max(...lats);
                        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
                        const top = maxLat === minLat ? 50 : ((maxLat - (h.lat as number)) / (maxLat - minLat)) * 80 + 10;
                        const left = maxLng === minLng ? 50 : (((h.lng as number) - minLng) / (maxLng - minLng)) * 80 + 10;
                        return (
                          <div
                            key={h.area}
                            title={`${h.area}: ${h.visits} visits`}
                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                            style={{
                              top: `${top}%`,
                              left: `${left}%`,
                              width: size,
                              height: size,
                              background: "rgba(13,148,136,0.35)",
                              border: "1px solid #0D9488",
                            }}
                          />
                        );
                      })}
                    {data.hotspots.every((h) => h.lat == null) ? (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        No map coordinates on these visits yet.
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-1">
                    {data.hotspots.slice(0, 6).map((h) => (
                      <div key={h.area} className="flex justify-between text-xs text-slate-700">
                        <span className="font-semibold">{h.area}</span>
                        <span>
                          {h.visits} visits · {h.perDay}/day · {h.fillRate}% completed
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </Section>

            <Section title="Area performance">
              <Card className="overflow-x-auto p-0">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Area</th>
                      <th className="px-3 py-2">Visits</th>
                      <th className="px-3 py-2">Per day</th>
                      <th className="px-3 py-2">Completed</th>
                      <th className="px-3 py-2">No-shows</th>
                      <th className="px-3 py-2">Cancelled</th>
                      <th className="px-3 py-2">Urgent</th>
                      <th className="px-3 py-2">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.hotspots.map((h) => (
                      <tr key={h.area} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-800">{h.area}</td>
                        <td className="px-3 py-2">{h.visits}</td>
                        <td className="px-3 py-2">{h.perDay}</td>
                        <td className="px-3 py-2 text-emerald-700">{h.completed}</td>
                        <td className="px-3 py-2 text-rose-700">{h.noShows}</td>
                        <td className="px-3 py-2 text-slate-500">{h.cancelled}</td>
                        <td className="px-3 py-2 text-amber-700">{h.urgent}</td>
                        <td className="px-3 py-2">₹{Math.round(h.revenue).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </Section>

            <Section title="Therapist performance" note="Reliability = visits kept after removing no-shows and cancellations.">
              <Card className="overflow-x-auto p-0">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Therapist</th>
                      <th className="px-3 py-2">Base area</th>
                      <th className="px-3 py-2">Main therapy</th>
                      <th className="px-3 py-2">Visits</th>
                      <th className="px-3 py-2">Completed</th>
                      <th className="px-3 py-2">No-show</th>
                      <th className="px-3 py-2">Late</th>
                      <th className="px-3 py-2">Reliability</th>
                      <th className="px-3 py-2">Rating</th>
                      <th className="px-3 py-2">Rebook</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.therapists.map((t) => (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {t.name}
                          {t.partner ? <div className="text-[10px] text-slate-500">{t.partner}</div> : null}
                        </td>
                        <td className="px-3 py-2">{t.area ?? "—"}</td>
                        <td className="px-3 py-2">{t.topTherapy ? data.therapyLabels[t.topTherapy] ?? t.topTherapy : "—"}</td>
                        <td className="px-3 py-2">{t.visits}</td>
                        <td className="px-3 py-2 text-emerald-700">{t.completed}</td>
                        <td className="px-3 py-2 text-rose-700">{t.noShows}</td>
                        <td className="px-3 py-2 text-amber-700">{t.lateArrivals}</td>
                        <td className="px-3 py-2">{t.reliability == null ? "—" : `${t.reliability}%`}</td>
                        <td className="px-3 py-2">
                          {t.avgRating == null ? "—" : `${t.avgRating}★`}
                          {t.reviews ? <span className="text-slate-400"> ({t.reviews})</span> : null}
                        </td>
                        <td className="px-3 py-2">{t.rebookRate == null ? "—" : `${t.rebookRate}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              {data.idleTherapists.length ? (
                <div className="mt-2 text-xs text-slate-600">
                  Idle in this window: {data.idleTherapists.map((t) => t.name).join(", ")}
                </div>
              ) : null}
            </Section>

            <Section title="Outsourcing partners" note="Third-party companies running home physiotherapy in assigned areas.">
              <div className="grid gap-3 sm:grid-cols-2">
                {data.partners.map((p) => (
                  <Card key={p.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">{p.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.areas.map((a) => (
                            <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-teal-700">{p.completionRate}%</div>
                        <div className="text-[10px] text-slate-500">completed</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="font-extrabold text-slate-900">{p.visits}</div>
                        <div className="text-slate-500">Visits</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-rose-700">{p.noShows}</div>
                        <div className="text-slate-500">No-show</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900">{p.avgRating ?? "—"}</div>
                        <div className="text-slate-500">Rating</div>
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900">₹{p.revenue.toLocaleString("en-IN")}</div>
                        <div className="text-slate-500">Value</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Section>

            <Section title="Patient feedback">
              <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Reviews" value={data.feedback.count} />
                <Stat label="Avg rating" value={data.feedback.avgRating ?? "—"} color="#0D9488" />
                <Stat label="Punctuality" value={data.feedback.avgPunctuality ?? "—"} />
                <Stat label="Would rebook" value={data.feedback.rebookRate == null ? "—" : `${data.feedback.rebookRate}%`} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.feedback.recent.map((f) => (
                  <Card key={f.id}>
                    <div className="flex justify-between text-xs font-semibold text-slate-800">
                      <span>{f.therapist}</span>
                      <span className="text-amber-600">{f.rating}★</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {f.partner ? `${f.partner} · ` : ""}
                      {when(f.createdAt)}
                    </div>
                    {f.comment ? <p className="mt-1 text-xs text-slate-700">{f.comment}</p> : null}
                  </Card>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
