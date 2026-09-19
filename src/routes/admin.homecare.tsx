import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getHomeCareBoard } from "@/lib/homecare-admin.functions";

export const Route = createFileRoute("/admin/homecare")({
  head: () => ({
    meta: [
      { title: "Home Care Board — Physiotherapy & Visiting Doctors" },
      {
        name: "description",
        content: "Monitor home physiotherapy positions, visiting doctor bookings and who is available today.",
      },
      { property: "og:title", content: "Home Care Board — Physiotherapy & Visiting Doctors" },
      {
        property: "og:description",
        content: "Monitor home physiotherapy positions, visiting doctor bookings and who is available today.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomeCareBoardPage,
});

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>{children}</div>;
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <Card>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color: color ?? "#0f172a" }}>{value}</div>
    </Card>
  );
}

function fmt(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

function Dot({ on }: { on: boolean | null }) {
  const color = on === null ? "#CBD5E1" : on ? "#16A34A" : "#94A3B8";
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: color, marginRight: 6 }} />;
}

function HomeCareBoardPage() {
  const fetchData = useServerFn(getHomeCareBoard);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["homecare-board"],
    queryFn: () => fetchData({ data: { days: 30 } }),
    refetchInterval: 15000,
  });

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: "#EDE9FE", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/admin" className="text-xs font-semibold text-violet-700 hover:underline">← Admin console</Link>
            <h1 className="text-2xl font-extrabold text-slate-900">Home Care Board</h1>
            <p className="text-sm text-slate-600">Physiotherapy positions and visiting doctors: bookings, attendance and availability.</p>
          </div>
          <button onClick={() => refetch()} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {error ? (
          <Card className="text-sm text-rose-700">
            {(error as Error).message.includes("Forbidden")
              ? "This board is open to administrators and technicians only."
              : `Could not load: ${(error as Error).message}`}
          </Card>
        ) : isLoading || !data ? (
          <Card className="p-8 text-center text-sm text-slate-500">Loading…</Card>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Physio visits (30d)" value={data.totals.physioVisits} color="#7C3AED" />
              <Stat label="Physio upcoming" value={data.totals.physioUpcoming} color="#2563EB" />
              <Stat label="Therapists active" value={data.totals.therapistsActive} color="#0D9488" />
              <Stat label="Doctor bookings" value={data.totals.doctorBookings} />
              <Stat label="Doctor upcoming" value={data.totals.doctorUpcoming} color="#2563EB" />
              <Stat label="Doctors on duty" value={data.totals.doctorsOnDuty} color="#16A34A" />
              <Stat label="Home care plans" value={data.totals.homeCarePlans} color="#BE185D" />
              <Stat label="Physio completed" value={data.totals.physioCompleted} color="#16A34A" />
            </div>

            <Card className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Physiotherapy positions &amp; visits</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Therapy</th>
                      <th className="px-3 py-2">Area</th>
                      <th className="px-3 py-2">Patient</th>
                      <th className="px-3 py-2">Therapist</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.physioVisits.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No physiotherapy visits in this period.</td></tr>
                    ) : (
                      data.physioVisits.map((v) => (
                        <tr key={v.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-600">{fmt(v.scheduledAt ?? v.createdAt)}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{v.therapyType}</td>
                          <td className="px-3 py-2 text-slate-600">{[v.area, v.city].filter(Boolean).join(", ")}</td>
                          <td className="px-3 py-2 text-slate-600">{v.patientName ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{v.therapistName ?? <span className="text-amber-600 font-semibold">Unassigned</span>}</td>
                          <td className="px-3 py-2 text-slate-600">{v.status}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {v.noShow ? <span className="font-bold text-rose-600">No show</span> : v.checkedOut ? "Finished" : v.checkedIn ? "In progress" : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Therapist availability</h2>
                <div className="space-y-2">
                  {data.therapists.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-400">No therapists on record.</p>
                  ) : (
                    data.therapists.map((t) => (
                      <div key={t.id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs last:border-0">
                        <div>
                          <div className="font-bold text-slate-800"><Dot on={t.online} />{t.name}</div>
                          <div className="text-slate-500">
                            {[t.area, t.city].filter(Boolean).join(", ")}
                            {t.partnerName ? ` · ${t.partnerName}` : ""}
                            {t.verified ? " · verified" : " · unverified"}
                          </div>
                        </div>
                        <div className="text-right text-slate-600">
                          <div className="font-bold">{t.upcoming} upcoming</div>
                          <div className="text-slate-400">{t.completed} done</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Home care doctors on duty</h2>
                <div className="space-y-2">
                  {data.doctorRoster.length === 0 ? (
                    <p className="py-4 text-center text-sm text-slate-400">No visiting doctors with bookings yet.</p>
                  ) : (
                    data.doctorRoster.map((d) => (
                      <div key={d.id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs last:border-0">
                        <div>
                          <div className="font-bold text-slate-800"><Dot on={d.online} />{d.name}</div>
                          <div className="text-slate-500">{d.acceptingHomeVisits === false ? "Not accepting visits" : "Accepting visits"}</div>
                        </div>
                        <div className="text-right text-slate-600">
                          <div className="font-bold">{d.upcoming} upcoming</div>
                          <div className="text-slate-400">{d.completed} done</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <Card>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Home care doctor bookings</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Speciality</th>
                      <th className="px-3 py-2">Patient</th>
                      <th className="px-3 py-2">Doctor</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.doctorBookings.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No doctor bookings in this period.</td></tr>
                    ) : (
                      data.doctorBookings.map((b) => (
                        <tr key={b.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-600">{fmt(b.scheduledFor ?? b.createdAt)}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{b.specialty}</td>
                          <td className="px-3 py-2 text-slate-600">{b.patientName ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{b.doctorName ?? "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{b.status}</td>
                          <td className="px-3 py-2 text-slate-600">{b.amount != null ? `₹${b.amount}` : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
