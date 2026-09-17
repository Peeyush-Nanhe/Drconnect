import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import {
  createCareRequest,
  acceptCareRequest,
  useLiveCareRequests,
  useSession,
} from "@/features/mydox/backend";
import { Button } from "@/components/ui/button";

const LiveMap = lazy(() => import("@/features/mydox/LiveMap"));

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live Map — MyDox" },
      { name: "description", content: "See providers and open care requests around you in real time." },
      { property: "og:title", content: "Live Map — MyDox" },
      { property: "og:description", content: "See providers and open care requests around you in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
  ssr: false,
});

function MapPage() {
  const { user, role } = useSession();
  const { rows } = useLiveCareRequests();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [spec, setSpec] = useState("General Physician");
  const [emergency, setEmergency] = useState(false);
  const [focusLocation, setFocusLocation] = useState<[number, number] | null>(null);

  async function broadcast() {
    setBusy(true);
    setMsg(null);
    try {
      // Hardcoded to Koregaon Park for testing
      const lat = 18.5362;
      const lng = 73.8930;

      await createCareRequest({
        specialty: spec,
        emergency,
        lat,
        lng,
      } as never);
      setMsg("Broadcast sent — providers can see it now.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed to broadcast");
    } finally {
      setBusy(false);
    }
  }

  async function accept(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      await acceptCareRequest(id);
      setMsg("Accepted! Patient has been notified.");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Couldn't accept");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen px-4 py-6"
      style={{ background: "#DCE6E1", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Live Map</h1>
            <p className="text-sm text-slate-600">
              Real map · your GPS · real requests · real-time updates.
            </p>
          </div>
          <Link to="/" className="text-sm font-semibold text-teal-700 hover:underline">
            ← Back to app
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="flex h-[480px] items-center justify-center rounded-2xl bg-white text-sm text-slate-500">
              Loading map…
            </div>
          }
        >
          <LiveMap height="min(62dvh, 560px)" focusLocation={focusLocation} />
        </Suspense>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <h3 className="text-sm font-bold text-slate-800">Send a real request</h3>
            {user ? (
              <>
                <div className="mt-2 flex gap-2">
                  <input
                    value={spec}
                    onChange={(e) => setSpec(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Specialty"
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={emergency}
                      onChange={(e) => setEmergency(e.target.checked)}
                    />
                    Emergency
                  </label>
                </div>
                <Button
                  disabled={busy}
                  onClick={broadcast}
                  className="mt-2 w-full bg-teal-700 font-bold text-primary-foreground hover:bg-teal-800"
                >
                  {busy ? "Sending…" : "Broadcast to providers"}
                </Button>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                <Link to="/auth" search={{ admin: undefined, next: undefined }} className="font-semibold text-teal-700">
                  Sign in
                </Link>{" "}
                to broadcast a real request.
              </p>
            )}
            {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}
          </div>

          <div className="rounded-2xl bg-white p-4">
            <h3 className="text-sm font-bold text-slate-800">Open requests</h3>
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {rows.filter((r) => r.status === "open").length === 0 ? (
                <p className="text-xs text-slate-500">Nothing open right now.</p>
              ) : (
                rows
                  .filter((r) => r.status === "open")
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-2 py-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800">
                          {r.emergency ? "🚨 " : ""}
                          {r.specialty}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(r.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {r.lat != null && r.lng != null ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFocusLocation([r.lat as number, r.lng as number])}
                            className="text-[11px] text-teal-700"
                          >
                            View
                          </Button>
                        ) : null}
                        {role === "provider" && (
                          <Button
                            onClick={() => accept(r.id)}
                            disabled={busy}
                            size="sm"
                            className="rounded-full bg-slate-900 text-[11px] font-bold text-primary-foreground hover:bg-slate-800"
                          >
                            Accept
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
