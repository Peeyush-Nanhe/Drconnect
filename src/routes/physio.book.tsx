import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlotPickerCalendarStandalone } from "@/features/mydox/SlotPickerCalendar";
import {
  THERAPY_LABEL,
  bookPhysioVisit,
  bookPhysioVisitWithTherapist,
  getPhysioTherapistRoster,
  getPhysioTherapistSlots,
  togglePhysioFavoriteTherapist,
} from "@/lib/physio-patient.functions";

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
  const bookWithTherapist = useServerFn(bookPhysioVisitWithTherapist);
  const fetchRoster = useServerFn(getPhysioTherapistRoster);
  const fetchSlots = useServerFn(getPhysioTherapistSlots);
  const toggleFavorite = useServerFn(togglePhysioFavoriteTherapist);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    therapyType: "general",
    area: "",
    city: "Pune",
    address: "",
    scheduledAt: toLocalInputValue(new Date(Date.now() + 26 * 3600_000)),
    durationMin: 45,
    urgency: "planned",
    notes: "",
  });
  const [error, setError] = useState("");
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
  const [slotIso, setSlotIso] = useState("");

  const rosterQuery = useQuery({
    queryKey: ["physio-therapist-roster"],
    queryFn: () => fetchRoster({}),
  });
  const roster = rosterQuery.data ?? [];
  const selectedTherapist = roster.find((t) => t.therapistId === selectedTherapistId) ?? null;

  const slotsQuery = useQuery({
    queryKey: ["physio-therapist-slots", selectedTherapistId, form.durationMin],
    queryFn: () =>
      fetchSlots({
        data: {
          therapistId: selectedTherapistId as string,
          durationMin: form.durationMin,
          startDate: toLocalInputValue(new Date()).slice(0, 10),
          endDate: toLocalInputValue(new Date(Date.now() + 14 * 86400_000)).slice(0, 10),
        },
      }),
    enabled: !!selectedTherapistId,
  });
  const openSlotCount = (slotsQuery.data ?? []).filter((s) => s.isAvailable).length;

  const favoriteMutation = useMutation({
    mutationFn: (therapistId: string) => toggleFavorite({ data: { therapistId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["physio-therapist-roster"] }),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Could not update favourite"),
  });

  const anyAvailableMutation = useMutation({
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

  const withTherapistMutation = useMutation({
    mutationFn: () =>
      bookWithTherapist({
        data: {
          therapistId: selectedTherapistId as string,
          therapyType: form.therapyType,
          area: form.area,
          city: form.city,
          address: form.address || null,
          startTime: slotIso,
          durationMin: form.durationMin,
          urgency: form.urgency,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => navigate({ to: "/physio/visits" }),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Could not book that slot"),
  });

  const pending = anyAvailableMutation.isPending || withTherapistMutation.isPending;
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
            if (selectedTherapistId) {
              if (!slotIso) {
                setError("Pick an available time slot");
                return;
              }
              withTherapistMutation.mutate();
            } else {
              anyAvailableMutation.mutate();
            }
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

          <div>
            <div className="mb-2 text-xs font-bold text-slate-600">Choose your physiotherapist</div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedTherapistId(null);
                  setSlotIso("");
                }}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                  selectedTherapistId === null ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base">
                  📡
                </span>
                <span>
                  <span className="block text-sm font-bold text-slate-900">Any available therapist</span>
                  <span className="block text-[11px] text-slate-500">
                    Request a time — our partner network assigns a therapist for you
                  </span>
                </span>
              </button>

              {rosterQuery.isLoading ? (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Loading therapists…</div>
              ) : (
                roster.map((t) => (
                  <div
                    key={t.therapistId}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                      selectedTherapistId === t.therapistId ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTherapistId(t.therapistId);
                        setSlotIso("");
                      }}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                        {t.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900">{t.name}</span>
                        <span className="block text-[11px] text-slate-500">
                          {t.area ? `${t.area} · ` : ""}
                          {t.specializations.length ? t.specializations.join(", ") : "Physiotherapist"}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => favoriteMutation.mutate(t.therapistId)}
                      aria-label="Favourite"
                      className="shrink-0 p-1 text-lg"
                      style={{ color: t.isFavorite ? "#EF4444" : "#CBD5E1" }}
                    >
                      ♥
                    </button>
                  </div>
                ))
              )}
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              Duration
              <select
                value={form.durationMin}
                onChange={(e) => {
                  setForm((f) => ({ ...f, durationMin: Number(e.target.value) }));
                  setSlotIso("");
                }}
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
                <option value="planned">Planned</option>
                <option value="urgent">Urgent (same day priority)</option>
              </select>
            </label>
          </div>

          {selectedTherapistId ? (
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-xs font-bold text-slate-600">
                  {selectedTherapist?.name ?? "Therapist"}'s availability
                </div>
                {slotsQuery.isFetched ? (
                  <div className="text-[11px] text-slate-500">{openSlotCount} open slots in the next 2 weeks</div>
                ) : null}
              </div>
              <SlotPickerCalendarStandalone
                days={14}
                accent="#0D9488"
                value={slotIso}
                onChange={setSlotIso}
              />
            </div>
          ) : (
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
          )}

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
              <span className="block text-[11px] text-slate-400">
                {selectedTherapistId
                  ? "Payable after the session · confirmed instantly for this therapist's slot"
                  : "Payable after the session · therapist assigned by our partner network"}
              </span>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-teal-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {pending ? "Booking…" : "Book session"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
