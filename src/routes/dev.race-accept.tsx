import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase as appSupabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dev/race-accept")({
  component: RaceAcceptTester,
  head: () => ({
    meta: [
      { title: "Race Accept Tester" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const DEV_TOOLS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_TOOLS === "true";

type LogEntry = { t: number; who: string; msg: string; ok?: boolean };

function makeClient() {
  // In-memory storage so each client is a fully independent session and
  // doesn't clobber the app's own supabase session in localStorage.
  const mem = new Map<string, string>();
  return createClient<Database>(URL, KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      storage: {
        getItem: (k) => mem.get(k) ?? null,
        setItem: (k, v) => void mem.set(k, v),
        removeItem: (k) => void mem.delete(k),
      },
    },
  });
}

export default function RaceAcceptTester() {
  if (!DEV_TOOLS_ENABLED) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-bold">Developer tool disabled</h1>
        <p className="mt-2 text-sm text-slate-600">Enable VITE_ENABLE_DEV_TOOLS=true only in a local development environment.</p>
      </main>
    );
  }
  return <RaceAcceptTesterInner />;
}

function RaceAcceptTesterInner() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [reqId, setReqId] = useState<string>("");
  const [winner, setWinner] = useState<string | null>(null);
  const [emailA, setEmailA] = useState("");
  const [emailB, setEmailB] = useState("");
  const [password, setPassword] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [specialty, setSpecialty] = useState("General Physician");

  const push = (who: string, msg: string, ok?: boolean) =>
    setLog((l) => [...l, { t: Date.now(), who, msg, ok }]);

  async function ensureOpenRequest(): Promise<string | null> {
    // Try newest open request first (any patient).
    const { data: open } = await appSupabase
      .from("care_requests")
      .select("id, specialty")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1);
    if (open && open.length) {
      push("setup", `Using existing open request ${open[0].id.slice(0, 8)} (${open[0].specialty})`, true);
      return open[0].id;
    }
    // Otherwise, sign in as the seed patient and broadcast one.
    push("setup", `No open request found. Signing in as ${patientEmail} to broadcast one…`);
    const c = makeClient();
    const { data: s, error: sErr } = await c.auth.signInWithPassword({
      email: patientEmail,
      password,
    });
    if (sErr || !s.user) {
      push("setup", `Patient sign-in failed: ${sErr?.message ?? "unknown"}`, false);
      return null;
    }
    const { error } = await c.from("care_requests").insert({
      patient_id: s.user.id,
      specialty,
      emergency: false,
      status: "open",
      lat: 19.05,
      lng: 72.83,
    } as never);
    if (error) {
      push("setup", `Broadcast failed: ${error.message}`, false);
      return null;
    }
    const { data: fresh } = await c
      .from("care_requests")
      .select("id")
      .eq("patient_id", s.user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1);
    const id = fresh?.[0]?.id ?? null;
    if (id) push("setup", `Broadcast succeeded → request ${id.slice(0, 8)}`, true);
    return id;
  }

  async function acceptAs(email: string, id: string, tag: string) {
    const c = makeClient();
    const t0 = performance.now();
    const { data: s, error: sErr } = await c.auth.signInWithPassword({ email, password });
    if (sErr || !s.user) {
      push(tag, `Sign-in failed: ${sErr?.message ?? "unknown"}`, false);
      return { tag, ok: false, ms: 0, err: sErr?.message ?? "sign-in failed", updated: 0 };
    }
    push(tag, `Signed in as ${email.split("@")[0]}`);
    // Fire the race update. `.eq("status","open")` is the atomicity guard —
    // whichever transaction commits first flips the row to 'accepted' and the
    // other's WHERE stops matching (updated=0).
    const t1 = performance.now();
    const { data, error } = await c
      .from("care_requests")
      .update({
        status: "accepted",
        accepted_by: s.user.id,
        accepted_at: new Date().toISOString(),
      } as never)
      .eq("id", id)
      .eq("status", "open")
      .select("id, accepted_by");
    const ms = Math.round(performance.now() - t1);
    if (error) {
      push(tag, `❌ Update error after ${ms}ms: ${error.message}`, false);
      return { tag, ok: false, ms, err: error.message, updated: 0 };
    }
    const updated = data?.length ?? 0;
    if (updated > 0) push(tag, `✅ Update returned ${updated} row(s) in ${ms}ms — CLAIMED`, true);
    else push(tag, `⏳ Update returned 0 rows in ${ms}ms — LOST RACE (row was already accepted)`, false);
    return { tag, ok: true, ms, err: null as string | null, updated, signInMs: Math.round(t1 - t0) };
  }

  async function run() {
    setBusy(true);
    setLog([]);
    setWinner(null);
    try {
      const id = await ensureOpenRequest();
      if (!id) return;
      setReqId(id);
      push("race", "Firing both Accept calls in parallel…");
      const [rA, rB] = await Promise.all([
        acceptAs(emailA, id, "A"),
        acceptAs(emailB, id, "B"),
      ]);
      // Verify final DB state
      const { data: final } = await appSupabase
        .from("care_requests")
        .select("status, accepted_by, accepted_at")
        .eq("id", id)
        .maybeSingle();
      push("verify", `Final state → status=${final?.status} accepted_by=${(final?.accepted_by ?? "").slice(0, 8)}`, !!final);
      const win =
        rA.updated > 0 && rB.updated === 0
          ? "A"
          : rB.updated > 0 && rA.updated === 0
          ? "B"
          : rA.updated > 0 && rB.updated > 0
          ? "BOTH (race guard failed!)"
          : "NEITHER";
      setWinner(win);
      push(
        "result",
        `Winner: ${win}. A updated=${rA.updated} in ${rA.ms}ms, B updated=${rB.updated} in ${rB.ms}ms.`,
        win === "A" || win === "B",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 text-sm">
      <h1 className="text-xl font-semibold">Race-Accept Tester</h1>
      <p className="mt-1 text-muted-foreground">
        Simulates two providers pressing <b>Accept</b> at nearly the same instant on the newest
        open care request. Shows which one claimed the row and why.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="flex flex-col text-xs">
          Provider A email
          <input className="mt-1 rounded border px-2 py-1" value={emailA} onChange={(e) => setEmailA(e.target.value)} />
        </label>
        <label className="flex flex-col text-xs">
          Provider B email
          <input className="mt-1 rounded border px-2 py-1" value={emailB} onChange={(e) => setEmailB(e.target.value)} />
        </label>
        <label className="flex flex-col text-xs">
          Shared password
          <input className="mt-1 rounded border px-2 py-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="flex flex-col text-xs">
          Patient email (fallback broadcaster)
          <input className="mt-1 rounded border px-2 py-1" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} />
        </label>
        <label className="col-span-2 flex flex-col text-xs">
          Specialty (used if a new request must be broadcast)
          <input className="mt-1 rounded border px-2 py-1" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
        </label>
      </div>

      <button
        onClick={run}
        disabled={busy}
        className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Running race…" : "Run race"}
      </button>

      {winner && (
        <div className="mt-4 rounded-md border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Winner</div>
          <div className={`text-lg font-semibold ${winner === "A" || winner === "B" ? "text-emerald-600" : "text-rose-600"}`}>
            Provider {winner}
          </div>
          {reqId && <div className="mt-1 text-xs text-muted-foreground">Request {reqId}</div>}
          <p className="mt-2 text-xs text-muted-foreground">
            <b>Why:</b> both clients sent{" "}
            <code>UPDATE care_requests SET status='accepted', accepted_by=me WHERE id=? AND status='open'</code>{" "}
            at the same moment. Postgres serialises row locks — the first transaction to commit flips
            <code> status </code> to <code>accepted</code>. The second transaction's <code>WHERE status='open'</code>
            no longer matches, so it updates <b>0 rows</b> and its client shows "already taken".
          </p>
        </div>
      )}

      <div className="mt-4 rounded-md border bg-muted/30 p-3 font-mono text-xs">
        {log.length === 0 ? (
          <div className="text-muted-foreground">Log will appear here…</div>
        ) : (
          log.map((e, i) => (
            <div key={i} className={e.ok === false ? "text-rose-600" : e.ok ? "text-emerald-700" : ""}>
              [{new Date(e.t).toISOString().slice(11, 23)}] <b>{e.who}</b> — {e.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
