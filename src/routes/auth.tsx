import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/features/mydox/backend";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    admin: s.admin === "1" || s.admin === 1 ? ("1" as const) : undefined,
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — MyDox" },
      { name: "description", content: "Sign in or create your MyDox account." },
      { property: "og:title", content: "Sign in — MyDox" },
      { property: "og:description", content: "Securely access your MyDox care workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const ROLE_TO_VIEW: Record<AppRole, string> = {
  patient: "patient",
  provider: "medico",
  facility: "hub",
  admin: "admin",
  super_admin: "admin",
};

type SignupKind = "patient" | "doctor" | "provider" | "facility" | "admin";

const KIND_TO_ROLE: Record<SignupKind, AppRole> = {
  patient: "patient",
  doctor: "provider",
  provider: "provider",
  facility: "facility",
  admin: "admin",
};

// Subtypes shown after signup for kinds that have multiple flavours.
// "view" is what we store in localStorage.mc_view and drives the dashboard shown.
const SUBTYPES: Record<"provider" | "facility", { view: string; label: string; desc: string }[]> = {
  provider: [
    { view: "ambulance", label: "Ambulance",   desc: "Emergency transport crew" },
    { view: "seva",      label: "Seva", desc: "Charitable and community care" },
    { view: "coordinator", label: "Health Coordinator", desc: "Patient cases, referrals and care navigation" },
    { view: "care_physician", label: "Care Physician / RMO", desc: "Hospital shifts, locum and full-time roles" },
    { view: "medico",    label: "Other medico staff", desc: "Nurse, technician, allied" },
  ],
  facility: [
    { view: "hub",        label: "Hospital / Hub",  desc: "Beds, admissions, ER" },
    { view: "diagnostic", label: "Diagnostic centre", desc: "Imaging & scans" },
    { view: "pharmacy",   label: "Pharmacy",        desc: "Medicines & fulfilment" },
    { view: "labs",       label: "Lab",             desc: "Pathology & samples" },
  ],
};

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const adminMode = search.admin === "1";
  const [mode, setMode] = useState<"password" | "email-otp" | "phone-otp">("password");
  const [isSignup, setIsSignup] = useState(false);
  const [kind, setKind] = useState<SignupKind>("patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // After signup, if the kind has subtypes, we hold the new user id here and
  // render the subtype picker instead of navigating away.
  const [pendingSubtype, setPendingSubtype] = useState<{
    userId: string;
    kind: "provider" | "facility";
  } | null>(null);
  const role: AppRole = KIND_TO_ROLE[kind];

  async function afterLogin(userId: string, viewOverride?: string) {
    const [rolesRes, profileRes, authRes, requestRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, view").eq("id", userId).maybeSingle(),
      supabase.auth.getUser(),
      supabase.from("account_role_requests").select("requested_role, requested_view, status").eq("user_id", userId).maybeSingle(),
    ]);
    const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
    const order: AppRole[] = ["super_admin", "admin", "facility", "provider", "patient"];
    const primary = order.find((r) => roles.includes(r)) ?? "patient";
    const fullName = profileRes.data?.full_name || name || email.split("@")[0] || "You";
    const metadata = authRes.data.user?.user_metadata ?? {};
    const storedSubtype = typeof metadata.subtype === "string" ? metadata.subtype : undefined;
    const request = requestRes.data;

    const providerViews = new Set(["medico", "ambulance", "seva", "coordinator", "care_physician"]);
    const facilityViews = new Set(["hub", "diagnostic", "pharmacy", "labs"]);
    const requestedView = viewOverride || storedSubtype || request?.requested_view || profileRes.data?.view || undefined;
    let derivedView = ROLE_TO_VIEW[primary];
    if (primary === "provider" && requestedView && providerViews.has(requestedView)) derivedView = requestedView;
    if (primary === "facility" && requestedView && facilityViews.has(requestedView)) derivedView = requestedView;

    if (typeof window !== "undefined") {
      localStorage.setItem("mc_view", derivedView);
      localStorage.setItem("mc_user_name", fullName);
      localStorage.setItem("mc_user_role", primary);
      localStorage.setItem("mc_profile_id", userId);
    }

    // Provider/facility claims are requests, not privileges. Keep the user on
    // the sign-in screen until a super administrator approves the role.
    if (primary === "patient" && request?.status === "pending") {
      if (!requestedView && (request.requested_role === "provider" || request.requested_role === "facility")) {
        setPendingSubtype({ userId, kind: request.requested_role });
        return;
      }
      setPendingSubtype(null);
      setMsg(`Your ${request.requested_role} access request is pending administrator approval. You can still use the patient account meanwhile.`);
      return;
    }

    if (search.next) {
      window.location.assign(search.next);
      return;
    }
    navigate({ to: "/" });
  }

  // After signup for a kind that has subtypes, hold the flow so the user can
  // choose the specific type instead of dropping into a default view.
  async function handleSignupSuccess(userId: string, hasSession: boolean) {
    if (!hasSession) {
      setMsg("Account created. Confirm your email, then sign in. Provider/facility access will remain pending until administrator approval.");
      return;
    }
    if (kind === "provider" || kind === "facility") {
      setPendingSubtype({ userId, kind });
      return;
    }
    await afterLogin(userId);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "password") {
        if (isSignup) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { full_name: name, role, kind, subtype: kind === "doctor" ? "medico" : undefined },
            },
          });
          if (error) throw error;
          if (data.user) await handleSignupSuccess(data.user.id, Boolean(data.session));
          else setMsg("Check your email to confirm your account.");
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (data.user) await afterLogin(data.user.id);
        }
      } else if (mode === "email-otp") {
        if (!otpSent) {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: true,
              emailRedirectTo: window.location.origin,
              data: { full_name: name, role },
            },
          });
          if (error) throw error;
          setOtpSent(true);
          setMsg("6-digit code sent to your email.");
        } else {
          const { data, error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: "email",
          });
          if (error) throw error;
          if (data.user) await afterLogin(data.user.id);
        }
      } else {
        // phone OTP
        if (!otpSent) {
          const { error } = await supabase.auth.signInWithOtp({
            phone,
            options: {
              shouldCreateUser: true,
              data: { full_name: name, role },
            },
          });
          if (error) throw error;
          setOtpSent(true);
          setMsg("SMS code sent to your phone.");
        } else {
          const { data, error } = await supabase.auth.verifyOtp({
            phone,
            token: otp,
            type: "sms",
          });
          if (error) throw error;
          if (data.user) await afterLogin(data.user.id);
        }
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Something went wrong.";
      // friendly hint if SMS provider isn't configured
      if (mode === "phone-otp" && /sms|provider|twilio|msg91/i.test(m)) {
        setMsg(
          "Phone OTP is wired but no SMS provider is enabled yet. Add one in Cloud → Auth Settings → Phone to switch it on. Email OTP works right now.",
        );
      } else {
        setMsg(m);
      }
    } finally {
      setBusy(false);
    }
  }


  const tab = (k: typeof mode, label: string) => (
    <button
      key={k}
      type="button"
      onClick={() => {
        setMode(k);
        setOtpSent(false);
        setMsg(null);
      }}
      className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
        mode === k ? "bg-slate-900 text-white" : "text-slate-600"
      }`}
    >
      {label}
    </button>
  );

  if (pendingSubtype) {
    const opts = SUBTYPES[pendingSubtype.kind];
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4 py-10"
        style={{ background: "#DCE6E1", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-teal-700">
            One last step
          </div>
          <h1 className="mb-1 text-xl font-extrabold text-slate-900">
            What kind of {pendingSubtype.kind} are you?
          </h1>
          <p className="mb-4 text-xs text-slate-500">
            Pick the type that best matches you — this sets your dashboard.
          </p>
          <div className="space-y-2">
            {opts.map((o) => (
              <button
                key={o.view}
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await supabase.auth.updateUser({ data: { subtype: o.view } });
                    const { error: requestError } = await supabase
                      .from("account_role_requests")
                      .update({ requested_view: o.view, updated_at: new Date().toISOString() })
                      .eq("user_id", pendingSubtype.userId);
                    if (requestError) throw requestError;
                    const { error: profileError } = await supabase
                      .from("profiles")
                      .update({ view: o.view })
                      .eq("id", pendingSubtype.userId);
                    if (profileError) throw profileError;
                    await afterLogin(pendingSubtype.userId, o.view);
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Could not save.");
                    setBusy(false);
                  }
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-teal-500 hover:bg-white disabled:opacity-60"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900">{o.label}</div>
                  <div className="text-[11px] text-slate-500">{o.desc}</div>
                </div>
                <span className="text-teal-600">→</span>
              </button>
            ))}
          </div>
          {msg && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">{msg}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "#DCE6E1", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
      />
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: "linear-gradient(135deg,#0D9488,#14B8A6)" }}
          >
            ❤
          </div>
          <div>
            <div className="text-lg font-extrabold text-slate-900">
              {adminMode ? "MyDox · Super Admin" : "MyDox"}
            </div>
            <div className="text-[11px] text-slate-500">
              {adminMode
                ? "Restricted — platform administrators only"
                : isSignup
                  ? "Create your account"
                  : "Welcome back"}
            </div>
          </div>
        </div>

        {adminMode && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            You are on the super admin sign-in. Public sign-up is disabled here.
          </div>
        )}

        <div className="mb-4 flex gap-1 rounded-full bg-slate-100 p-1">
          {tab("password", "Password")}
          {tab("email-otp", "Email OTP")}
          {tab("phone-otp", "Phone OTP")}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {isSignup && !adminMode && (
            <>
              <input
                required
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
              />
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                  I am a…
                </label>
                <div className="grid grid-cols-4 gap-1 rounded-full bg-slate-100 p-1">
                  {(["patient", "doctor", "provider", "facility"] as SignupKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`rounded-full px-1 py-1.5 text-[10px] font-bold capitalize transition ${
                        kind === k ? "bg-teal-600 text-white" : "text-slate-600"
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  {kind === "doctor" && "Licensed MBBS / specialist physician."}
                  {kind === "provider" && "Non-doctor care staff — ambulance, seva, nurse, technician."}
                  {kind === "facility" && "Hospital, diagnostic centre, pharmacy or lab."}
                  {kind === "patient" && "Book care, track records."}
                </p>
              </div>
            </>
          )}

          {mode === "phone-otp" ? (
            <input
              required
              type="tel"
              aria-label="Phone number"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={otpSent}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
            />
          ) : (
            <input
              required
              type="email"
              aria-label="Email address"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={otpSent}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
            />
          )}

          {mode === "password" && (
            <input
              required
              type="password"
              aria-label="Password"
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
            />
          )}

          {mode !== "password" && otpSent && (
            <input
              required
              inputMode="numeric"
              aria-label="Verification code"
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-lg tracking-[0.4em] outline-none focus:border-teal-500"
            />
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white transition disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#0D9488,#14B8A6)" }}
          >
            {busy
              ? "Please wait…"
              : mode === "password"
                ? isSignup
                  ? "Create account"
                  : "Sign in"
                : otpSent
                  ? "Verify code"
                  : "Send code"}
          </button>

          {msg && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700">{msg}</p>
          )}
        </form>

        {!adminMode && (
          <div className="mt-3">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMsg(null);
                try {
                  const { data, error } = await supabase.auth.signInWithPassword({
                    email: "patient1@demo.med",
                    password: "CareDemo!2026",
                  });
                  if (error) throw error;
                  if (data.user) await afterLogin(data.user.id);
                } catch (err: unknown) {
                  setMsg(err instanceof Error ? err.message : "Quick demo access failed.");
                } finally {
                  setBusy(false);
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50/90 py-2 text-xs font-bold text-teal-800 transition hover:bg-teal-100 hover:border-teal-300 disabled:opacity-60 shadow-xs"
            >
              <span>⚡</span>
              <span>One-Click Demo Patient Access (Priya Sharma)</span>
            </button>
          </div>
        )}

        {mode === "password" && !adminMode && (
          <p className="mt-4 text-center text-xs text-slate-600">
            {isSignup ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignup((s) => !s)}
              className="font-bold text-teal-700"
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
        )}

        <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>Sign in to access your care dashboard</span>
          <Link
            to="/auth"
            search={{ admin: "1" } as never}
            aria-label="Super admin login"
            title="Super admin"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1 text-slate-400 hover:text-slate-600"
          >
            <ShieldCheck size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
