import { createFileRoute, Link } from "@tanstack/react-router";
import { useAdminStats, useLiveCareRequests, useLiveCareProgramBookings, useLiveCommunityRequests } from "@/features/mydox/backend";

const PROGRAM_LABEL: Record<string, string> = {
  assistive_living: "Assistive Living",
  rehab: "Rehab",
  ivf_fertility: "IVF / Fertility",
  weight_management: "Weight Mgmt",
};
const COMMUNITY_LABEL: Record<string, string> = {
  society_shield: "Society Shield",
  insurance_benefit: "Insurance Benefit",
  corporate_health: "Corporate Health",
};

export const Route = createFileRoute("/admin/live")({
  head: () => ({
    meta: [
      { title: "Live Admin — MyDox" },
      { name: "description", content: "Real-time user, request and hub statistics." },
    ],
  }),
  component: LiveAdmin,
});

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color: color ?? "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

function LiveAdmin() {
  const { stats, loading } = useAdminStats();
  const { rows } = useLiveCareRequests();
  const { rows: programRows } = useLiveCareProgramBookings(25);
  const { rows: communityRows } = useLiveCommunityRequests(25);

  const programCounts = programRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.program] = (acc[r.program] ?? 0) + 1;
    return acc;
  }, {});
  const communityCounts = communityRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1;
    return acc;
  }, {});

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
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link to="/admin" className="text-xs font-semibold text-teal-700 hover:underline">
              ← Admin console
            </Link>
            <h1 className="text-2xl font-extrabold text-slate-900">Live Admin</h1>
            <p className="text-sm text-slate-600">
              Real numbers, straight from the database, updating in real time.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/admin/wellness"
              className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Wellness console →
            </Link>
            <Link
              to="/admin/users"
              className="inline-flex items-center rounded-full bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800"
            >
              Manage users →
            </Link>
            <Link to="/" className="text-sm font-semibold text-teal-700 hover:underline">
              ← Back to app
            </Link>
          </div>
        </div>

        {loading || !stats ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
            Loading…
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                Users
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Total" value={stats.users.total} />
                <Stat label="Patients" value={stats.users.patient} color="#0D9488" />
                <Stat label="Providers" value={stats.users.provider} color="#4F46E5" />
                <Stat label="Facilities" value={stats.users.facility} color="#B45309" />
                <Stat label="Admins" value={stats.users.admin} color="#DC2626" />
              </div>
            </div>

            <div className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                Care Requests
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Total" value={stats.requests.total} />
                <Stat label="Open" value={stats.requests.open} color="#0D9488" />
                <Stat label="Accepted" value={stats.requests.accepted} color="#4F46E5" />
                <Stat label="Completed" value={stats.requests.completed} color="#059669" />
                <Stat label="Cancelled" value={stats.requests.cancelled} color="#94a3b8" />
              </div>
            </div>

            <div className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                Facilities
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Hubs" value={stats.hubs} color="#0891B2" />
              </div>
            </div>

            <div className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                Care Programs
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Assistive Living" value={programCounts.assistive_living ?? 0} color="#EA580C" />
                <Stat label="Rehab" value={programCounts.rehab ?? 0} color="#4F46E5" />
                <Stat label="IVF / Fertility" value={programCounts.ivf_fertility ?? 0} color="#DB2777" />
                <Stat label="Weight Mgmt" value={programCounts.weight_management ?? 0} color="#16A34A" />
              </div>
            </div>

            <div className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
                Community
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Society Shield" value={communityCounts.society_shield ?? 0} color="#0D9488" />
                <Stat label="Insurance Benefit" value={communityCounts.insurance_benefit ?? 0} color="#B45309" />
                <Stat label="Corporate Health" value={communityCounts.corporate_health ?? 0} color="#0891B2" />
              </div>
            </div>
          </>
        )}

        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
            Latest Care Program Bookings
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Program</th>
                  <th className="px-3 py-2 text-left">Tier / Summary</th>
                  <th className="px-3 py-2 text-left">Fee</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programRows.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No program bookings yet.</td></tr>
                ) : programRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-slate-500">{new Date(r.created_at).toLocaleTimeString()}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{PROGRAM_LABEL[r.program] ?? r.program}</td>
                    <td className="px-3 py-2 text-slate-600">{r.summary || r.tier || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.fee != null ? `₹${r.fee}` : "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
            Latest Community Requests
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Contact</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {communityRows.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No community requests yet.</td></tr>
                ) : communityRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 text-slate-500">{new Date(r.created_at).toLocaleTimeString()}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{COMMUNITY_LABEL[r.type] ?? r.type}</td>
                    <td className="px-3 py-2 text-slate-600">{r.contact_name || r.contact_phone || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
            Live Request Feed
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Specialty</th>
                  <th className="px-3 py-2 text-left">Emergency</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Accepted by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      No requests yet. Create one from the Patient view — it will show up here
                      instantly.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 text-slate-500">
                        {new Date(r.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-800">{r.specialty}</td>
                      <td className="px-3 py-2">
                        {r.emergency ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                            EMERGENCY
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{
                            background:
                              r.status === "open"
                                ? "#ccfbf1"
                                : r.status === "accepted"
                                  ? "#e0e7ff"
                                  : r.status === "completed"
                                    ? "#d1fae5"
                                    : "#f1f5f9",
                            color:
                              r.status === "open"
                                ? "#0f766e"
                                : r.status === "accepted"
                                  ? "#3730a3"
                                  : r.status === "completed"
                                    ? "#065f46"
                                    : "#64748b",
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {r.accepted_by ? r.accepted_by.slice(0, 8) + "…" : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
