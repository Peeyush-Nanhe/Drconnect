import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/features/mydox/backend";
import { StaffUI } from "@/features/careteam/StaffUI";
import { TechnicianRequestsPanel } from "@/features/mydox/technician/TechnicianRequestsPanel";

/**
 * The technician's home screen. Previously a technician was routed to the
 * doctor console by a specialty string check (view === "medico" || specialty
 * contains "tech"), so the screen said doctor and the detection was guesswork.
 */

export const Route = createFileRoute("/technician")({
  head: () => ({
    meta: [
      { title: "Technician — MyDox" },
      { name: "description", content: "Your duty status, test jobs, machine pickup and earnings." },
    ],
  }),
  component: TechnicianHome,
  errorComponent: ({ error }) => (
    <div className="ct">
      <p className="ct-error">This screen could not load: {String((error as Error)?.message ?? error)}</p>
      <a href="/">Back to MyDox</a>
    </div>
  ),
  notFoundComponent: () => (
    <div className="ct"><p className="ct-empty">That page does not exist.</p></div>
  ),
});

type Profile = {
  id: string;
  full_name: string | null;
  specialty: string | null;
  view: string | null;
};

function TechnicianHome() {
  const { user, loading } = useSession();
  const uid = user?.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [online, setOnline] = useState(false);
  const [onlineSince, setOnlineSince] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [alerts, setAlerts] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    const [p, avail] = await Promise.all([
      supabase.from("profiles").select("id, full_name, specialty, view").eq("id", uid).maybeSingle(),
      supabase.from("provider_availability").select("is_online, updated_at").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile((p.data as Profile) ?? null);
    setOnline(!!(avail.data as { is_online?: boolean } | null)?.is_online);
    setOnlineSince((avail.data as { updated_at?: string } | null)?.updated_at ?? null);
  }, [uid]);

  useEffect(() => { void load(); }, [load]);

  const toggleDuty = useCallback(async (next: boolean) => {
    if (!uid) return;
    const { error: e } = await supabase
      .from("provider_availability")
      .upsert({ user_id: uid, is_online: next }, { onConflict: "user_id" });
    if (e) { setError(e.message); return; }
    setOnline(next);
    setOnlineSince(new Date().toISOString());
  }, [uid]);

  const shareLocation = useCallback(() => {
    if (!navigator.geolocation) { setError("This device cannot share a location."); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        if (!uid) return;
        await supabase.from("profiles")
          .update({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          .eq("id", uid);
        setSharing(true);
      },
      () => setError("Location permission was refused. Jobs still arrive, but distance will be approximate."),
    );
  }, [uid]);

  const enableAlerts = useCallback(async () => {
    if (typeof Notification === "undefined") { setError("This browser cannot show alerts."); return; }
    const res = await Notification.requestPermission();
    setAlerts(res === "granted");
    if (res !== "granted") setError("Alerts are blocked. Jobs still appear on this screen.");
  }, []);

  if (loading) return <div className="ct"><p className="ct-empty">Loading your job board…</p></div>;
  if (!uid) {
    return (
      <div className="ct">
        <p className="ct-empty">Sign in with your technician account to see your work.</p>
        <a href="/auth">Sign in</a>
      </div>
    );
  }

  const missing: string[] = [];
  if (!profile?.specialty) missing.push("the tests you perform");

  return (
    <StaffUI
      role="technician"
      name={profile?.full_name ?? null}
      qualifier={[profile?.specialty || "Technician", profile?.view].filter(Boolean).join(" · ")}
      online={online}
      onlineSince={onlineSince}
      onToggleOnline={toggleDuty}
      stats={[]}
      error={error}
      offers={<TechnicianRequestsPanel userId={uid} />}
      today={<TechnicianRequestsPanel userId={uid} />}
      history={<p className="ct-empty">Finished tests appear here once you close a job.</p>}
      profile={
        <div className="ct-panel">
          <h3>{profile?.full_name ?? "Your profile"}</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ct-muted)" }}>
            {profile?.specialty ?? "Tests not set"} · {profile?.view ?? "Role not set"}
          </p>
        </div>
      }
      profileCompleteness={100 - missing.length * 25}
      profileMissing={missing}
      locationSharing={sharing}
      onShareLocation={shareLocation}
      phoneAlerts={alerts}
      onEnablePhoneAlerts={enableAlerts}
      onLogout={() => void supabase.auth.signOut()}
    />
  );
}
