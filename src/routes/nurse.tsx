import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/features/mydox/backend";
import { StaffUI } from "@/features/careteam/StaffUI";
import { NurseRequestsPanel } from "@/features/mydox/nursing/NurseRequestsPanel";
import { NurseShiftsPanel } from "@/features/mydox/nursing/NurseShiftsPanel";
import { listMyNursingShifts, nursingErrorText } from "@/features/mydox/nursing/nursing-client";

/**
 * The nurse's own home screen. Until now a nurse landed on the doctor's
 * provider console with a nursing panel bolted underneath, which is why it
 * looked like a doctor's screen: it was one.
 */

export const Route = createFileRoute("/nurse")({
  head: () => ({
    meta: [
      { title: "Nurse — MyDox" },
      { name: "description", content: "Your duty status, nursing offers, today's shifts and earnings." },
    ],
  }),
  component: NurseHome,
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

function NurseHome() {
  const { user, loading } = useSession();
  const uid = user?.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [online, setOnline] = useState(false);
  const [onlineSince, setOnlineSince] = useState<string | null>(null);
  const [shifts, setShifts] = useState<{ visit_date: string; status: string; payout_amount: number | null }[]>([]);
  const [offerCount, setOfferCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [alerts, setAlerts] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const [p, avail, mine, offers] = await Promise.all([
        supabase.from("profiles").select("id, full_name, specialty, view").eq("id", uid).maybeSingle(),
        supabase.from("provider_availability").select("is_online, updated_at").eq("user_id", uid).maybeSingle(),
        listMyNursingShifts(uid).catch(() => []),
        (supabase as unknown as { rpc: (f: string) => Promise<{ data: unknown[] | null }> })
          .rpc("list_nursing_engagement_offers").catch(() => ({ data: [] })),
      ]);
      setProfile((p.data as Profile) ?? null);
      setOnline(!!(avail.data as { is_online?: boolean } | null)?.is_online);
      setOnlineSince((avail.data as { updated_at?: string } | null)?.updated_at ?? null);
      setShifts(mine as never);
      const rows = (offers.data ?? []) as { primary_nurse_id: string | null }[];
      setOfferCount(rows.filter(r => !r.primary_nurse_id).length);
      setError(null);
    } catch (e) {
      setError(nursingErrorText(e));
    }
  }, [uid]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

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
      () => setError("Location permission was refused. Offers still arrive, but distance will be approximate."),
    );
  }, [uid]);

  const enableAlerts = useCallback(async () => {
    if (typeof Notification === "undefined") { setError("This browser cannot show alerts."); return; }
    const res = await Notification.requestPermission();
    setAlerts(res === "granted");
    if (res !== "granted") setError("Alerts are blocked. Offers still appear on this screen.");
  }, []);

  if (loading) return <div className="ct"><p className="ct-empty">Loading your shift board…</p></div>;
  if (!uid) {
    return (
      <div className="ct">
        <p className="ct-empty">Sign in with your nurse account to see your work.</p>
        <a href="/auth">Sign in</a>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const todays = shifts.filter(s => s.visit_date === today);
  const upcoming = shifts.filter(s => s.visit_date > today);
  const earned = shifts
    .filter(s => s.status === "completed")
    .reduce((n, s) => n + Number(s.payout_amount ?? 0), 0);

  const missing: string[] = [];
  if (!profile?.specialty) missing.push("your speciality");
  const completeness = 100 - missing.length * 20;

  return (
    <StaffUI
      role="nurse"
      name={profile?.full_name ?? null}
      qualifier={[profile?.specialty || "Nurse", profile?.view].filter(Boolean).join(" · ")}
      online={online}
      onlineSince={onlineSince}
      onToggleOnline={toggleDuty}
      stats={[
        { label: "today", value: String(todays.length) },
        { label: "upcoming", value: String(upcoming.length) },
        { label: "earned", value: `₹${earned.toLocaleString("en-IN")}` },
      ]}
      offerCount={offerCount}
      error={error}
      offers={<NurseRequestsPanel userId={uid} />}
      today={<NurseShiftsPanel userId={uid} />}
      upcoming={upcoming.length
        ? <NurseShiftsPanel userId={uid} />
        : <p className="ct-empty">Nothing booked beyond today yet.</p>}
      history={<p className="ct-empty">Finished shifts appear here once you close a day.</p>}
      profile={
        <div className="ct-panel">
          <h3>{profile?.full_name ?? "Your profile"}</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ct-muted)" }}>
            {profile?.specialty ?? "Speciality not set"} · {profile?.view ?? "Role not set"}
          </p>
        </div>
      }
      profileCompleteness={completeness}
      profileMissing={missing}
      locationSharing={sharing}
      onShareLocation={shareLocation}
      phoneAlerts={alerts}
      onEnablePhoneAlerts={enableAlerts}
      onLogout={() => void supabase.auth.signOut()}
    />
  );
}
