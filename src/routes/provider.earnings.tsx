import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/provider/earnings")({
  head: () => ({
    meta: [
      { title: "Provider Earnings — MyDox" },
      { name: "description", content: "Track your earnings, completed jobs, acceptance rate, ratings and pending payouts." },
    ],
  }),
  component: ProviderEarnings,
});

type CareRow = {
  id: string;
  status: string;
  amount: number | null;
  fare: number | null;
  completed_at: string | null;
  cancelled_at: string | null;
  accepted_at: string | null;
  rating_patient: number | null;
  specialty: string;
};

type SurgeryRow = {
  id: string;
  status: string;
  role: string;
  completed_at: string | null;
  accepted_at: string | null;
  rating_hub: number | null;
};

const startOfDay = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const startOfWeek = () => { const d = startOfDay(); d.setDate(d.getDate() - d.getDay()); return d; };
const startOfMonth = () => { const d = startOfDay(); d.setDate(1); return d; };

function money(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold" style={{ color: color ?? "#0f172a" }}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function ProviderEarnings() {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [care, setCare] = useState<CareRow[]>([]);
  const [surgery, setSurgery] = useState<SurgeryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUid(data.user?.id ?? null); setReady(true); });
  }, []);

  useEffect(() => {
    if (!ready || !uid) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      setLoading(true);
      const [cr, sr] = await Promise.all([
        supabase.from("care_requests")
          .select("id,status,amount,fare,completed_at,cancelled_at,accepted_at,rating_patient,specialty")
          .eq("accepted_by", uid).order("accepted_at", { ascending: false }).limit(500),
        supabase.from("surgery_booking_roles")
          .select("id,status,role,completed_at,accepted_at,rating_hub")
          .eq("assigned_to", uid).order("accepted_at", { ascending: false }).limit(500),
      ]);
      if (!mounted) return;
      setCare((cr.data as any) ?? []);
      setSurgery((sr.data as any) ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [uid, ready]);

  const metrics = useMemo(() => {
    const now = new Date();
    const day = startOfDay(), week = startOfWeek(), month = startOfMonth();
    const completed = care.filter((r) => r.status === "completed" && r.completed_at);
    const surgeryCompleted = surgery.filter((r) => r.status === "accepted" && r.completed_at);
    const priceOf = (r: CareRow) => Number(r.amount ?? r.fare ?? 0);

    const earnIn = (from: Date) =>
      completed.filter((r) => r.completed_at && new Date(r.completed_at) >= from).reduce((s, r) => s + priceOf(r), 0);

    const today = earnIn(day);
    const weekE = earnIn(week);
    const monthE = earnIn(month);
    const total = completed.reduce((s, r) => s + priceOf(r), 0);

    const jobsToday = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= day).length;
    const jobsWeek = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= week).length;
    const jobsMonth = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= month).length;
    const jobsTotal = completed.length + surgeryCompleted.length;

    const cancelledAfterAccept = care.filter((r) => r.status === "cancelled" && r.accepted_at).length;
    const acceptedTotal = care.filter((r) => r.accepted_at).length;
    const completionRate = acceptedTotal ? Math.round((completed.length / acceptedTotal) * 100) : 0;

    const ratings = [
      ...care.map((r) => r.rating_patient).filter((v): v is number => typeof v === "number"),
      ...surgery.map((r) => r.rating_hub).filter((v): v is number => typeof v === "number"),
    ];
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;

    // Pending payout heuristic: completed jobs in the current week that likely
    // haven't been settled yet (weekly cycle). Includes completed care requests
    // + surgery role fees are not tracked, so limit to care_requests amounts.
    const pending = completed
      .filter((r) => r.completed_at && new Date(r.completed_at) >= week)
      .reduce((s, r) => s + priceOf(r), 0);

    // Rating breakdown (last 20)
    const recentRatings = [...ratings].slice(-20);

    return {
      today, weekE, monthE, total,
      jobsToday, jobsWeek, jobsMonth, jobsTotal,
      completionRate, acceptedTotal, cancelledAfterAccept,
      avgRating, ratingCount: ratings.length, recentRatings,
      pending,
      now,
    };
  }, [care, surgery]);

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: "#DCE6E1", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" />
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Provider Earnings</h1>
            <p className="text-sm text-slate-600">Your jobs, ratings and payout status at a glance.</p>
          </div>
          <Link to="/" className="text-sm font-semibold text-teal-700 hover:underline">← Back to app</Link>
        </div>

        {!ready ? null : !uid ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
            Sign in as a provider to view earnings.
          </div>
        ) : loading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Earnings</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Today" value={money(metrics.today)} sub={`${metrics.jobsToday} job${metrics.jobsToday===1?"":"s"}`} color="#059669" />
                <Stat label="This week" value={money(metrics.weekE)} sub={`${metrics.jobsWeek} job${metrics.jobsWeek===1?"":"s"}`} color="#0D9488" />
                <Stat label="This month" value={money(metrics.monthE)} sub={`${metrics.jobsMonth} job${metrics.jobsMonth===1?"":"s"}`} color="#4F46E5" />
                <Stat label="Lifetime" value={money(metrics.total)} sub={`${metrics.jobsTotal} completed`} color="#0f172a" />
              </div>
            </div>

            <div className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Performance</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Completed jobs" value={metrics.jobsTotal} sub={`${care.filter(r=>r.status==="completed").length} care + ${surgery.filter(r=>r.status==="accepted"&&r.completed_at).length} surgery`} color="#059669" />
                <Stat label="Acceptance rate" value={`${metrics.completionRate}%`} sub={`${metrics.acceptedTotal} accepted · ${metrics.cancelledAfterAccept} cancelled`} color="#4F46E5" />
                <Stat label="Average rating" value={metrics.ratingCount ? `${metrics.avgRating.toFixed(1)} ★` : "—"} sub={`${metrics.ratingCount} rating${metrics.ratingCount===1?"":"s"}`} color="#B45309" />
                <Stat label="Pending payout" value={money(metrics.pending)} sub="Settles at end of week" color="#DC2626" />
              </div>
            </div>

            <div className="mb-6">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Recent completed jobs</h2>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">When</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {care.filter(r=>r.status==="completed").slice(0,15).length === 0 && surgery.filter(r=>r.completed_at).slice(0,15).length === 0 ? (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No completed jobs yet.</td></tr>
                    ) : (
                      [
                        ...care.filter(r=>r.status==="completed").map(r => ({
                          id: `c:${r.id}`, when: r.completed_at, label: r.specialty,
                          amount: Number(r.amount ?? r.fare ?? 0), rating: r.rating_patient,
                        })),
                        ...surgery.filter(r=>r.status==="accepted"&&r.completed_at).map(r => ({
                          id: `s:${r.id}`, when: r.completed_at, label: `Surgery · ${r.role}`,
                          amount: 0, rating: r.rating_hub,
                        })),
                      ].sort((a,b)=>((a.when??"")<(b.when??"")?1:-1)).slice(0,20).map(r => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 text-slate-500">{r.when ? new Date(r.when).toLocaleString([], { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—"}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800 capitalize">{r.label}</td>
                          <td className="px-3 py-2 text-slate-700">{r.amount ? money(r.amount) : "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{r.rating ? `${r.rating} ★` : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
