import React, { useState, useEffect, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTechnicianOffers, acceptTechnicianVisit, advanceTechnicianStatus } from "@/lib/technician-provider.functions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, TestTube, MapPin, Check, Clock, Radio, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const POLL_MS = 10_000;

function money(n: number | null | undefined) {
  return "₹" + Number(n ?? 0).toLocaleString("en-IN");
}

function StatusChip({ status }: { status: string }) {
  const meta: Record<string, { bg: string, fg: string }> = {
    requested: { bg: "#FEF3C7", fg: "#92400E" },
    assigned: { bg: "#DBEAFE", fg: "#1E40AF" },
    en_route: { bg: "#E0F2FE", fg: "#0369A1" },
    arrived: { bg: "#D1FAE5", fg: "#065F46" },
    completed: { bg: "#E5E7EB", fg: "#374151" },
    cancelled: { bg: "#FEE2E2", fg: "#991B1B" },
  };
  const s = meta[status] || meta.requested;
  return (
    <span style={{ background: s.bg, color: s.fg, padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
      {status.replace("_", " ")}
    </span>
  );
}

// Lightweight toast for demo-action feedback (matches MyDoxFull)
function notify(msg: string) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("mc-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "mc-toast";
    el.style.cssText = "position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(20px);background:#0B201C;color:#fff;padding:11px 18px;border-radius:14px;font:600 13px/1.4 'Plus Jakarta Sans',system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);z-index:9999;opacity:0;transition:all .25s;max-width:300px;text-align:center;pointer-events:none";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateX(-50%) translateY(0)"; });
  setTimeout(() => { if (el) el.style.opacity = "0"; el.style.transform = "translateX(-50%) translateY(20px)"; }, 3500);
}

export function TechnicianRequestsPanel({ userId }: { userId: string | null }) {
  const fetchOffers = useServerFn(getTechnicianOffers);
  const accept = useServerFn(acceptTechnicianVisit);
  const advance = useServerFn(advanceTechnicianStatus);
  const qc = useQueryClient();
  const lastOffersCount = useRef(0);

  const query = useQuery({
    queryKey: ["technician-offers"],
    queryFn: () => fetchOffers({}),
    refetchInterval: POLL_MS,
    enabled: !!userId,
  });

  const acceptMutation = useMutation({
    mutationFn: (visitId: string) => accept({ data: { visitId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["technician-offers"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { visitId: string, status: string }) => advance({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["technician-offers"] });
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("technician_tests_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "technician_tests" }, () => {
        qc.invalidateQueries({ queryKey: ["technician-offers"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  if (!userId) return null;

  // The server function returns an untyped row shape; name it once here
  // rather than annotating every callback.
  type TechVisit = Record<string, any> & { id: string; status: string; technician_id: string | null };
  const data: TechVisit[] = (query.data ?? []) as TechVisit[];
  const mine = data.filter(v => v.technician_id === userId && v.status !== "completed" && v.status !== "cancelled");
  const offers = data.filter(v => v.status === "requested");

  useEffect(() => {
    if (query.isSuccess && offers.length > lastOffersCount.current) {
      notify(`🧪 New Lab/Technician Request in Koregaon Park!`);
    }
    lastOffersCount.current = offers.length;
  }, [offers.length, query.isSuccess]);

  if (query.isLoading) return <div className="p-4 text-center text-xs text-slate-500">Loading technician work…</div>;

  return (
    <div className="space-y-4">
      {mine.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Your Active Jobs</h3>
          {mine.map(v => (
            <div key={v.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-extrabold text-slate-900">{v.test_type.toUpperCase()} Visit</div>
                  <div className="text-xs text-slate-600">{v.patient_name} · {v.area}</div>
                </div>
                <StatusChip status={v.status} />
              </div>
              <div className="mt-3 flex gap-2">
                {v.status === "assigned" && (
                  <button onClick={() => statusMutation.mutate({ visitId: v.id, status: "en_route" })}
                    className="flex-1 rounded-full bg-blue-600 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95">
                    I'm on my way
                  </button>
                )}
                {v.status === "en_route" && (
                  <button onClick={() => statusMutation.mutate({ visitId: v.id, status: "arrived" })}
                    className="flex-1 rounded-full bg-teal-600 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95">
                    Confirm Arrival
                  </button>
                )}
                {v.status === "arrived" && (
                  <button onClick={() => statusMutation.mutate({ visitId: v.id, status: "completed" })}
                    className="flex-1 rounded-full bg-slate-900 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95">
                    Finish Visit
                  </button>
                )}
                <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700">
                  <Navigation size={14} />
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Available Near You</h3>
          {offers.length > 0 && <span className="flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{offers.length}</span>}
        </div>

        {offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <Radio size={24} className="mb-2 text-slate-300" />
            <p className="text-xs font-medium text-slate-400">Waiting for real-time requests in Pune...</p>
          </div>
        ) : (
          <div className="space-y-2">
            {offers.map(v => (
              <div key={v.id} className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm" style={{ animation: 'slidedown .35s ease', boxShadow: '0 8px 22px rgba(239,68,68,0.08)' }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 shadow-sm">
                    {v.test_type.includes("lab") ? <TestTube size={20} /> : <Activity size={20} />}
                  </div>
                  <div className="flex-1 min-width-0">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="text-sm font-black text-slate-900">{v.test_type.toUpperCase()}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#EF4444' }}>NEW</span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-1 font-semibold"><MapPin size={10} /> {v.area} · {v.city}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900">{money(v.fee)}</div>
                    <div className="text-[10px] font-bold text-red-600 uppercase tracking-tighter">{v.urgency}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => acceptMutation.mutate(v.id)}
                    disabled={acceptMutation.isPending}
                    className="flex-1 rounded-xl bg-slate-900 py-3 text-xs font-black text-white shadow-lg transition active:scale-95 disabled:opacity-50">
                    {acceptMutation.isPending ? "Accepting..." : "ACCEPT JOB"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
