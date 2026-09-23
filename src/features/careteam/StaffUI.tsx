import { ChevronLeft, LogOut, Power, ShieldCheck, User, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Option } from "@/lib/care-staff-catalog";

/** Shared building blocks for the nurse / physio / technician home screens. */

/** Same "Stitch" brand palette as the patient app (features/mydox/stitch/stitch-preview.css), so every portal reads as one product. */
export const STAFF_COLOR = {
  primary: "#177B94",
  primaryDeep: "#10576E",
  primarySoft: "#EAF2F6",
  ink: "#131B2E",
  sub: "#667285",
  faint: "#93A0AE",
  canvas: "#F2F7FA",
  line: "#DCE9EF",
};

export function StaffShell({
  title,
  subtitle,
  right,
  stats,
  children,
  showBack = true,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  stats?: ReactNode;
  children: ReactNode;
  /** window.history.back() can land on the login screen when this is the first
   *  page in the tab's history — off by default for portals reached that way. */
  showBack?: boolean;
}) {
  return (
    /* Phone-locked. These portals are used one-handed on a phone, so the
       column stays at handset width on every screen instead of stretching
       across a desktop. The outer div is only the backdrop behind it. */
    <div
      className="min-h-[100dvh] bg-slate-200/60 text-slate-900"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
     <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[#F2F7FA] shadow-xl">
      <header
        className="sticky top-0 z-20 px-4 pb-6 pt-4 text-white shadow-lg"
        style={{ background: 'linear-gradient(120deg, #105B75 0%, #1B758F 52%, #277D91 100%)' }}
      >
        <div className="w-full space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-3">
              {showBack && (
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="mt-0.5 shrink-0 rounded-full bg-white/20 p-1 hover:bg-white/30"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-base font-black">{title}</h1>
                {subtitle ? <p className="truncate text-[11px] font-bold opacity-80">{subtitle}</p> : null}
              </div>
            </div>
            {right ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{right}</div> : null}
          </div>

          {stats && <div className="mt-2 grid grid-cols-2 gap-3">{stats}</div>}
        </div>
      </header>
      <main className="w-full space-y-4 px-3 py-4">{children}</main>
      <footer className="flex w-full items-center justify-between px-4 pb-8 pt-2 text-[11px] text-slate-500">
        <a href="/?view=patient" className="font-semibold text-[#10576E] hover:underline">
          ← MyDox patient home
        </a>
        <Link to="/auth" search={{ admin: undefined, next: undefined }} className="font-semibold text-slate-500 hover:text-slate-800">
          Switch account / Sign in
        </Link>
      </footer>
     </div>
    </div>
  );
}

export function OnlineToggle({
  online,
  busy,
  onChange,
  onlineLabel = "Online — taking jobs",
  offlineLabel = "Offline",
}: {
  online: boolean;
  busy?: boolean;
  onChange: (next: boolean) => void;
  onlineLabel?: string;
  offlineLabel?: string;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={online}
      onClick={() => onChange(!online)}
      className={`flex min-h-[40px] items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold transition disabled:opacity-60 ${
        online ? "bg-[#177B94] text-white" : "bg-slate-200 text-slate-700"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-white" : "bg-slate-500"}`} />
      {busy ? "Updating…" : online ? onlineLabel : offlineLabel}
    </button>
  );
}

export function Stat({ label, value, tone = "teal" }: { label: string; value: string | number; tone?: "teal" | "slate" }) {
  const valueClass = tone === "slate" ? "text-slate-800" : "text-[#10576E]";
  const labelClass = tone === "slate" ? "text-slate-500" : "text-[#10576E]/80";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm">
      <div className={`text-lg font-black leading-none tabular-nums ${valueClass}`}>{value}</div>
      <div className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${labelClass}`}>{label}</div>
    </div>
  );
}

export function Card({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <article className={`rounded-2xl border bg-white p-4 ${accent ? "border-[#177B94]/50" : "border-slate-200"}`}>
      {children}
    </article>
  );
}

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-extrabold">
        {title}
        {count === undefined ? "" : ` (${count})`}
      </h2>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{children}</div>;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`min-h-[40px] shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
            value === t.value ? "bg-[#131B2E] text-white" : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          {t.label}
          {t.count === undefined ? "" : ` · ${t.count}`}
        </button>
      ))}
    </div>
  );
}

export function Chips({
  options,
  selected,
  onToggle,
  grouped,
}: {
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  grouped?: boolean;
}) {
  const groups = grouped ? Array.from(new Set(options.map((o) => o.group ?? "Other"))) : [null];
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g ?? "all"}>
          {g ? <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{g}</div> : null}
          <div className="flex flex-wrap gap-2">
            {options
              .filter((o) => !g || (o.group ?? "Other") === g)
              .map((o) => {
                const on = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(o.value)}
                    className={`min-h-[36px] rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                      on ? "border-[#177B94] bg-[#177B94] text-white" : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#177B94]";

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
        on ? "border-[#177B94] bg-[#EAF2F6] text-[#10576E]" : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {label}
      <span className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${on ? "bg-[#177B94]" : "bg-slate-300"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

export function fmtWhen(dt: string | null) {
  if (!dt) return "Time to be set";
  return new Date(dt).toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
