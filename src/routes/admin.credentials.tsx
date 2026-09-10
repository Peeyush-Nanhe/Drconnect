import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCarePhysicianVerificationQueue,
  setCarePhysicianRegistrationVerification,
} from "@/lib/care-physician-admin.functions";

export const Route = createFileRoute("/admin/credentials")({
  head: () => ({
    meta: [
      { title: "Care Physician Verification — MyDox Admin" },
      { name: "description", content: "Verify Care Physician registration before ICU and gated clinical duties are enabled." },
    ],
  }),
  component: CredentialVerification,
});

const gated = new Set(["intubation", "centralline", "ventilator", "acls", "lp"]);
const labels: Record<string, string> = {
  intubation: "Intubation",
  centralline: "Central line",
  ventilator: "Ventilator",
  acls: "ACLS",
  lp: "Lumbar puncture",
  iv: "IV cannulation",
  catheter: "Catheterisation",
  nasogastric: "Ryle's tube",
  suturing: "Suturing",
  abg: "ABG",
};

function CredentialVerification() {
  const fetchQueue = useServerFn(getCarePhysicianVerificationQueue);
  const setVerification = useServerFn(setCarePhysicianRegistrationVerification);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["care-physician-verification"], queryFn: () => fetchQueue({}), retry: false });
  const mutation = useMutation({
    mutationFn: (input: { userId: string; verified: boolean }) => setVerification({ data: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["care-physician-verification"] }),
  });

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8" style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <div className="mx-auto max-w-5xl">
        <Link to="/admin" className="text-xs font-semibold text-teal-700 hover:underline">← Admin console</Link>
        <div className="mt-1 mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Care Physician credential verification</h1>
            <p className="max-w-2xl text-sm text-slate-600">Verify the medical council registration after checking the submitted credentials. Verification unlocks ICU and other gated clinical duties; it does not certify each self-declared procedure.</p>
          </div>
          <button onClick={() => query.refetch()} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Refresh</button>
        </div>

        {query.isLoading ? <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading credential queue…</div> : null}
        {query.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{(query.error as Error).message}</div> : null}
        {mutation.error ? <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{(mutation.error as Error).message}</div> : null}

        <div className="grid gap-3">
          {(query.data ?? []).map((row: any) => (
            <article key={row.user_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-base text-slate-900">{row.full_name}</strong>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${row.registration_verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{row.registration_verified ? "VERIFIED" : "PENDING"}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{String(row.qualification || "").toUpperCase()} · {row.experience_years ?? 0} years{row.primary_specialty ? ` · ${row.primary_specialty}` : ""}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">{row.council_name || "Council not specified"} · {row.council_registration_number || "Registration number missing"}</div>
                </div>
                <button
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ userId: row.user_id, verified: !row.registration_verified })}
                  className={`rounded-xl px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50 ${row.registration_verified ? "bg-slate-500" : "bg-emerald-600"}`}
                >
                  {row.registration_verified ? "Revoke verification" : "Mark registration verified"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(row.procedures ?? []).map((id: string) => <span key={id} className={`rounded-full px-2 py-1 text-[10px] font-bold ${gated.has(id) ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200" : "bg-blue-50 text-blue-700"}`}>{labels[id] || id}{gated.has(id) ? " 🔒" : ""}</span>)}
              </div>
              <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                <div><b>Duty preferences:</b> {(row.duty_types ?? []).join(", ") || "—"}</div>
                <div><b>Preferred areas:</b> {(row.preferred_areas ?? []).join(", ") || "—"}</div>
                <div><b>Profile created:</b> {new Date(row.created_at).toLocaleDateString("en-IN")}</div>
              </div>
            </article>
          ))}
          {query.data?.length === 0 ? <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">No Care Physician profiles have been submitted yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
