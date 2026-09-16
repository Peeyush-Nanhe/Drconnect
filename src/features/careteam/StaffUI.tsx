import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { Option } from "@/lib/care-staff-catalog";

/** Shared building blocks for the nurse / physio / technician home screens. */

export function StaffShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-[100dvh] bg-[#E7F0EC] text-slate-900"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold sm:text-lg">{title}</h1>
            {subtitle ? <p className="truncate text-[11px] text-slate-500">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">{right}</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:px-4">{children}</main>
      <footer className="mx-auto max-w-3xl flex items-center justify-between px-4 pb-8 pt-2 text-[11px] text-slate-500">
        <a href="/?view=patient" className="font-semibold text-teal-700 hover:underline">
          ← MyDox patient home
        </a>
        <Link to="/auth" search={{ admin: undefined, next: undefined }} className="font-semibold text-slate-500 hover:text-slate-800">
          Switch account / Sign in
        </Link>
      </footer>
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
        online ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-white" : "bg-slate-500"}`} />
      {busy ? "Updating…" : online ? onlineLabel : offlineLabel}
    </button>
  );
}

export function Stat({ label, value, tone = "teal" }: { label: string; value: string | number; tone?: "teal" | "slate" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className={`text-lg font-extrabold ${tone === "teal" ? "text-teal-700" : "text-slate-800"}`}>{value}</div>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
    </div>
  );
}

export function Card({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <article className={`rounded-2xl border bg-white p-4 ${accent ? "border-teal-300" : "border-slate-200"}`}>
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
            value === t.value ? "bg-[#0B201C] text-white" : "bg-white text-slate-600 border border-slate-200"
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
                      on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-700"
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
  "w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500";

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
        on ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {label}
      <span className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition ${on ? "bg-teal-600" : "bg-slate-300"}`}>
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
