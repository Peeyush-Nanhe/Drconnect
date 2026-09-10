import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/features/mydox/backend";
import { HomeVisitBooking } from "@/features/mydox/home-visits/HomeVisitBooking";
import { HomeVisitOperations, HomeVisitPanel } from "@/features/mydox/home-visits/HomeVisitPanel";

export const Route = createFileRoute("/home-visits")({
  ssr: false,
  head: () => ({ meta: [{ title: "Doctor home visits — MyDox" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { next: "/home-visits", admin: undefined } });
  },
  component: HomeVisitsPage,
});

function HomeVisitsPage() {
  const { session, role, loading } = useSession();
  const [booking, setBooking] = useState<"now" | "later" | null>(null);
  if (loading) return <main className="hv hv-body" role="status">Checking your account…</main>;
  if (!session) return <main className="hv hv-body"><a href="/auth?next=%2Fhome-visits">Sign in to view home visits</a></main>;
  return <main className="hv" style={{ maxWidth: 850, margin: "0 auto", padding: 20 }}>
    <Link to="/">← MyDox</Link>
    <h1>Doctor home visits</h1>
    <p>Request a visit, follow its saved status and review your visit record.</p>
    <div className="hv-actions"><button onClick={() => setBooking("now")}>Visit Now</button><button onClick={() => setBooking("later")}>Book for Later</button></div>
    <HomeVisitPanel key={`patient-${session.user.id}`} audience="patient" />
    {role === "provider" && <HomeVisitPanel key={`doctor-${session.user.id}`} audience="doctor" />}
    {(role === "admin" || role === "super_admin") && <HomeVisitOperations />}
    {booking && <HomeVisitBooking key={session.user.id} initialMode={booking} onClose={() => setBooking(null)} />}
  </main>;
}
