import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { THERAPY_LABEL, bookPhysioVisit } from "@/lib/physio-patient.functions";

export const Route = createFileRoute("/physio/book")({
  head: () => ({
    meta: [
      { title: "Book a Home Physiotherapy Session — MyDox" },
      {
        name: "description",
        content:
          "Book a home physiotherapy session: choose neuro, orthopaedic, sports or general therapy, pick a time and a verified therapist visits your home.",
      },
      { property: "og:title", content: "Book a Home Physiotherapy Session — MyDox" },
      { property: "og:description", content: "Book a verified physiotherapist for a home visit at a time that suits you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookPhysioVisit,
  ssr: false,
});

const THERAPY_FEE: Record<string, number> = {
  neuro: 1200,
  orthopaedic: 900,
  sports: 1000,
  paediatric: 900,
  geriatric: 800,
  cardio_respiratory: 1000,
  post_surgical: 1100,
  pelvic_floor: 1000,
  general: 700,
};

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function BookPhysioVisit() {
  const book = useServerFn(bookPhysioVisit);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    therapyType: "general",
    area: "",
    city: "Pune",
    address: "",
    scheduledAt: toLocalInputValue(new Date(Date.now() + 26 * 3600_000)),
    durationMin: 45,
    urgency: "routine",
    notes: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      book({
        data: {
          therapyType: form.therapyType,
          area: form.area,
          city: form.city,
          address: form.address || null,
          scheduledAt: new Date(form.scheduledAt).toISOString(),
          durationMin: form.durationMin,
          urgency: form.urgency,
          fee: THERAPY_FEE[form.therapyType] ?? null,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => navigate({ to: "/physio/visits" }),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Could not book the session"),
  });

  const fee = THERAPY_FEE[form.therapyType];

  return (
    <div className="min-h-[100dvh] bg-[#DCE6E1] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold">Book home physiotherapy</h1>
            <p className="text-xs text-slate-500">A verified therapist visits you at home</p>
          </div>
          <Link to="/physio/visits" className="text-xs font-semibold text-teal-700">
            My visits →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            mutation.mutate();
          }}
        >
          <div>
            <div className="mb-2 text-xs font-bold text-slate-600">Therapy type</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(THERAPY_LABEL).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, therapyType: key }))}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold ${
                    form.therapyType === key
                      ? "border-teal-600 bg-teal-50 text-teal-800"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {label}
                  <span className="block text-[11px] font-normal text-slate-400">₹{THERAPY_FEE[key]}/session</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              Area / locality
              <input
                required
                maxLength={100}
                value={form.area}
                onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
                placeholder="e.g. Koregaon Park"
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              City
              <input
                required
                maxLength={100}
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Full address
            <textarea
              maxLength={500}
              rows={2}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Flat, building, street, landmark"
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-xs font-semibold text-slate-600">
              Date & time
              <input
                required
                type="datetime-local"
                value={form.scheduledAt}
                min={toLocalInputValue(new Date())}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Duration
              <select
                value={form.durationMin}
                onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
              >
                {[30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Urgency
              <select
                value={form.urgency}
                onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent (same day priority)</option>
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold text-slate-600">
            Notes for the therapist (optional)
            <textarea
              maxLength={1000}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Condition, mobility constraints, equipment needed…"
              className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
            />
          </label>

          {error ? <div className="rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-700">{error}</div> : null}

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="text-sm">
              <span className="text-slate-500">Session fee: </span>
              <span className="font-extrabold">₹{fee}</span>
              <span className="block text-[11px] text-slate-400">Payable after the session · therapist assigned by our partner network</span>
            </div>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-full bg-teal-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {mutation.isPending ? "Booking…" : "Book session"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
