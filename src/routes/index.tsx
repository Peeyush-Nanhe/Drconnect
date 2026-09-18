import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { ShieldCheck } from "lucide-react";
import { useSession } from "@/features/mydox/backend";
import { supabase } from "@/integrations/supabase/client";

// Keep the complete role workflows behind the patient navigation and service groups.
const MyDoxFull = lazy(() => import("@/features/mydox/MyDoxFull.jsx"));
const MyDoxApp = MyDoxFull as ComponentType<{ initialView: string }>;

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "stylesheet", href: "/design/stitch/fonts.css" }],
    meta: [
      { title: "MyDox — Real-time care, on demand" },
      {
        name: "description",
        content:
          "MyDox connects patients, doctors, hubs and hospitals in real time — book care, dispatch responders, and see everything live.",
      },
      { property: "og:title", content: "MyDox — Real-time care, on demand" },
      {
        property: "og:description",
        content:
          "MyDox connects patients, doctors, hubs and hospitals in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
  ssr: false,
});

function Home() {
  const { user, role, loading } = useSession();
  const [profileView, setProfileView] = useState<string | null>(null);
  const viewQuery = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("view") : null;

  useEffect(() => {
    let active = true;
    if (!user) {
      setProfileView(null);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("view, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;

      const fallbackView = role === "provider" ? "medico" : role === "facility" ? "hub" : role === "admin" || role === "super_admin" ? "admin" : "patient";
      const nextView = viewQuery || data?.view || fallbackView;
      setProfileView(nextView);
      if (typeof window !== "undefined") {
        localStorage.setItem("mc_view", nextView);
        const existingName = localStorage.getItem("mc_user_name");
        const effectiveName = existingName && existingName !== "You" ? existingName : (data?.full_name || "You");
        localStorage.setItem("mc_user_name", effectiveName);
        if (role) localStorage.setItem("mc_user_role", role);
        localStorage.setItem("mc_profile_id", user.id);
      }
    })();

    return () => {
      active = false;
    };
  }, [user, role, viewQuery]);

  if (!loading && !user) return <Navigate to="/auth" search={{ admin: undefined, next: undefined }} />;

  // Care staff have their own portals. auth.tsx redirects them at sign-in, but
  // that only fires on the sign-in itself: a nurse with a live session, or one
  // who reloads or opens "/" directly, otherwise lands back on the shared
  // provider console. Redirect here too, so the portal is where the role lives
  // rather than where one code path happens to send them.
  // An explicit ?view= override still wins, so the old console stays reachable.
  if (!viewQuery && profileView) {
    if (profileView === "nurse") return <Navigate to="/nurse" />;
    if (profileView === "technician") return <Navigate to="/technician" />;
    if (profileView === "physio_staff" || profileView === "therapist") {
      return <Navigate to="/physio/therapist" />;
    }
  }

  if (loading || (user && !profileView)) {
    return (
      <div style={{ minHeight: "100vh", background: "#DCE6E1" }} className="flex items-center justify-center text-sm text-slate-600">
        Loading MyDox…
      </div>
    );
  }
  if (!viewQuery) {
    if (profileView === "nurse") return <Navigate to="/nurse" />;
    if (profileView === "technician") return <Navigate to="/technician" />;
    if (profileView === "physio_staff" || profileView === "therapist") return <Navigate to="/physio/therapist" />;
  }
  return (
    <div>
      <Suspense
        fallback={
          <div
            style={{ minHeight: "80vh", background: "#DCE6E1" }}
            className="flex items-center justify-center text-sm text-slate-600"
          >
            Loading MyDox…
          </div>
        }
      >
        <MyDoxApp key={`${user?.id ?? "guest"}:${profileView ?? "patient"}`} initialView={profileView ?? "patient"} />
      </Suspense>
      {profileView !== "patient" && <footer
        style={{
          background: "#0B201C",
          color: "rgba(255,255,255,.6)",
          padding: "14px",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          fontSize: 11,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255,255,255,.08)",
        }}
      >
        <span>© MyDox</span>
        <Link
          to="/auth"
          search={{ admin: "1" } as never}
          aria-label="Super admin login"
          title="Super admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: 999,
            color: "rgba(255,255,255,.55)",
            border: "1px solid rgba(255,255,255,.15)",
            textDecoration: "none",
          }}
        >
          <ShieldCheck size={14} />
        </Link>
      </footer>}
    </div>
  );
}
