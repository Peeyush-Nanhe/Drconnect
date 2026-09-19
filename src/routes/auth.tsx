import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/features/mydox/backend";
import { DEMO_ACCOUNTS } from "@/features/medconnect/demo-accounts";

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
    { view: "nurse", label: "Nurse", desc: "Home nursing & hospital duty shifts" },
    { view: "technician", label: "Diagnostic Technician", desc: "Sample collection & diagnostics" },
    { view: "physio_staff", label: "Physiotherapist", desc: "Rehabilitation & physio sessions" },
    { view: "ambulance", label: "Ambulance", desc: "Emergency transport crew" },
    { view: "seva", label: "Seva", desc: "Charitable and community care" },
    { view: "coordinator", label: "Health Coordinator", desc: "Patient cases, referrals and care navigation" },
    { view: "care_physician", label: "Care Physician / RMO", desc: "Hospital shifts, locum and full-time roles" },
    { view: "medico", label: "Other medico staff", desc: "Doctor, clinic, allied" },
  ],
  facility: [
    { view: "hub", label: "Hospital / Hub", desc: "Beds, admissions, ER" },
    { view: "diagnostic", label: "Diagnostic centre", desc: "Imaging & scans" },
    { view: "pharmacy", label: "Pharmacy", desc: "Medicines & fulfilment" },
    { view: "labs", label: "Lab", desc: "Pathology & samples" },
  ],
};

interface DemoAccountItem {
  label: string;
  email: string;
  defaultPass: string;
  fallbackEmail?: string;
  isAdmin?: boolean;
  testNote?: string;
}

const DEMO_BUTTONS: DemoAccountItem[] = [
  { label: "Patient 1", email: "patient1@demo.med", defaultPass: "CareDemo!2026", testNote: "One-Click Demo Patient Access" },
  { label: "Patient 2", email: "patient2@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Medico 1 (Dr. Anita Rao - Cardiology)", email: "medico1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Medico 2 (Dr. Vikram Iyer - Neurology)", email: "medico2@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Dr. Rahul Nair", email: "rahul.nair@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Nurse (Sister Asha)", email: "nurse1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Technician (Rohit Kale)", email: "tech1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Physio (Dr. Kavita Deshmukh - Physiotherapy)", email: "physio1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Hub 1", email: "hub1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Hub 2", email: "hub2@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Scan 1", email: "scan1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Scan 2", email: "scan2@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Ambulance 1", email: "ambulance1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Ambulance 2", email: "ambulance2@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Pharmacy 1", email: "pharmacy1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Pharmacy 2", email: "pharmacy2@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Labs 1", email: "labs1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Labs 2", email: "labs2@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Seva 1", email: "seva1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Seva 2", email: "seva2@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Coordinator", email: "coordinator1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Care Physician", email: "carephysician1@demo.med", defaultPass: "CareDemo!2026" },
  { label: "Admin console", email: "admin.demo@careconnect.health", defaultPass: "CareDemo!2026", fallbackEmail: "admin1@demo.med", isAdmin: true },
  { label: "Super admin console", email: "superadmin.demo@careconnect.health", defaultPass: "CareDemo!2026", fallbackEmail: "admin2@demo.med", isAdmin: true },
];

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

  async function afterLogin(userId: string, viewOverride?: string, nameOverride?: string) {
    const [rolesRes, profileRes, authRes, requestRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, view, specialty").eq("id", userId).maybeSingle(),
      supabase.auth.getUser(),
      supabase.from("account_role_requests").select("requested_role, requested_view, status").eq("user_id", userId).maybeSingle(),
    ]);
    const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
    const order: AppRole[] = ["super_admin", "admin", "facility", "provider", "patient"];
    const primary = order.find((r) => roles.includes(r)) ?? "patient";
    const fullName = nameOverride || profileRes.data?.full_name || name || email.split("@")[0] || "You";
    const metadata = authRes.data.user?.user_metadata ?? {};
    const storedSubtype = typeof metadata.subtype === "string" ? metadata.subtype : undefined;
    const request = requestRes.data;

    const providerViews = new Set([
      "medico",
      "ambulance",
      "seva",
      "coordinator",
      "care_physician",
      "nurse",
      "technician",
      "physio_staff",
      "therapist",
      "diagnostic",
      "labs"
    ]);
    const facilityViews = new Set(["hub", "diagnostic", "pharmacy", "labs"]);
    const requestedView = viewOverride || storedSubtype || request?.requested_view || profileRes.data?.view || undefined;
    let derivedView = ROLE_TO_VIEW[primary];
    if (primary === "provider" && requestedView && providerViews.has(requestedView)) derivedView = requestedView;
    if (primary === "facility" && requestedView && facilityViews.has(requestedView)) derivedView = requestedView;

    // Dedicated staff portals (Nurse/Tech) have their own landing pages
    if (derivedView === "nurse") {
      window.location.assign("/nurse");
      return;
    }
    if (derivedView === "technician") {
      window.location.assign("/technician");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("mc_view", derivedView);
      localStorage.setItem("mc_user_name", fullName);
      localStorage.setItem("mc_user_role", primary);
      localStorage.setItem("mc_profile_id", userId);
      if (profileRes.data?.specialty) {
        localStorage.setItem("mc_user_specialty", profileRes.data.specialty);
      } else {
        localStorage.removeItem("mc_user_specialty");
      }
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
    if (derivedView === "nurse") {
      navigate({ to: "/nurse" });
      return;
    }
    if (derivedView === "technician") {
      navigate({ to: "/technician" });
      return;
    }
    if (derivedView === "physio_staff" || derivedView === "therapist") {
      navigate({ to: "/physio/therapist" });
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

  async function handleQuickDemoLogin(demoEmail: string, preferredPass = "CareDemo!2026", fallbackEmail?: string) {
    setBusy(true);
    setMsg(null);
    const primaryEmail = fallbackEmail || demoEmail;
    const emails = Array.from(new Set([primaryEmail, demoEmail]));
    const passwords = Array.from(new Set([preferredPass, "CareDemo!2026", "demo123456"]));
    let lastError: unknown = null;
    for (const em of emails) {
      for (const pwd of passwords) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: em,
            password: pwd,
          });
          if (!error && data.user) {
            const isTherapist = demoEmail.toLowerCase().includes("therapist");
            const demoAccount = DEMO_ACCOUNTS.find(
              (a) => a.email.toLowerCase() === demoEmail.toLowerCase() || a.email.toLowerCase() === em.toLowerCase()
            );
            const targetView = demoAccount?.view || (isTherapist ? "therapist" : undefined);
            const targetName = demoAccount?.name || (isTherapist ? "Therapist" : undefined);
            await afterLogin(data.user.id, targetView, targetName);
            return;
          }
          if (error) lastError = error;
        } catch (err: unknown) {
          lastError = err;
        }
      }
    }
    setMsg(lastError instanceof Error ? lastError.message : "Quick demo access failed.");
    setBusy(false);
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
          let targetEmail = email.trim();
          const normalizedEmail = targetEmail.toLowerCase();
          const isRahulNair = normalizedEmail === "rahul.nair@demo.med" || normalizedEmail === "therapist1@demo.med";
          const demoAccount = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === normalizedEmail);

          let { data, error } = await supabase.auth.signInWithPassword({ email: targetEmail, password });
          if (error && (password === "demo123456" || password === "CareDemo!2026")) {
            const altPass = password === "demo123456" ? "CareDemo!2026" : "demo123456";
            const retry = await supabase.auth.signInWithPassword({ email: targetEmail, password: altPass });
            if (!retry.error && retry.data) {
              data = retry.data;
              error = null;
            }
          }
          if (error && isRahulNair) {
            targetEmail = "medico1@demo.med";
            let retry = await supabase.auth.signInWithPassword({ email: targetEmail, password });
            if (retry.error && (password === "demo123456" || password === "CareDemo!2026")) {
              const altPass = password === "demo123456" ? "CareDemo!2026" : "demo123456";
              retry = await supabase.auth.signInWithPassword({ email: targetEmail, password: altPass });
            }
            if (!retry.error && retry.data) {
              data = retry.data;
              error = null;
            }
          }
          if (error) throw error;
          if (data?.user) {
            const targetView = demoAccount?.view || (isRahulNair ? "medico" : undefined);
            const targetName = demoAccount?.name || (isRahulNair ? "Dr. Rahul Nair" : undefined);
            await afterLogin(data.user.id, targetView, targetName);
          }
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
      className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${mode === k ? "bg-slate-900 text-white" : "text-slate-600"
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
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-xs"
            style={{ background: "#0D9488" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 leading-tight">
              {adminMode ? "MedConnect · Super Admin" : "MedConnect"}
            </div>
            <div className="text-xs text-slate-500 font-normal">
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
                      className={`rounded-full px-1 py-1.5 text-[10px] font-bold capitalize transition ${kind === k ? "bg-teal-600 text-white" : "text-slate-600"
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
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
            style={{ background: "#0D9488" }}
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

        {mode === "password" && !adminMode && (
          <p className="mt-3 text-center text-xs text-slate-600">
            {isSignup ? "Already have an account?" : "New here?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignup((s) => !s)}
              className="font-bold text-teal-700 hover:underline"
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </p>
        )}

        <div className="my-4 text-center">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            DEMO ONE-CLICK LOGIN
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {DEMO_BUTTONS.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={busy}
              onClick={() => handleQuickDemoLogin(item.email, item.defaultPass, item.fallbackEmail)}
              className={
                item.isAdmin
                  ? "w-full rounded-full border border-teal-400 bg-white py-2 px-3 text-center text-xs font-semibold text-teal-700 shadow-xs transition hover:bg-teal-50/50 hover:border-teal-500 disabled:opacity-50"
                  : "w-full rounded-full border border-slate-200 bg-white py-2 px-3 text-center text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
              }
            >
              {item.label}
              {item.testNote && <span className="sr-only"> ({item.testNote})</span>}
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-[10.5px] leading-relaxed text-slate-400">
          Most demo accounts use <span className="font-mono font-medium text-slate-600">demo123456</span> ; Coordinator, Care Physician and the admin consoles use <span className="font-semibold text-slate-600">CareDemo!2026</span>
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition"
          >
            <span>←</span>
            <span>Continue browsing without an account</span>
          </Link>
          <Link
            to="/auth"
            search={{ admin: "1" } as never}
            aria-label="Super admin login"
            title="Super admin"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-1 text-slate-400 hover:text-slate-600 transition"
          >
            <ShieldCheck size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
