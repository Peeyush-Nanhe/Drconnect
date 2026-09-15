import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelPhysioVisit, getMyPhysioVisits, submitPhysioVisitFeedback } from "@/lib/physio-patient.functions";

export const Route = createFileRoute("/physio/visits")({
  head: () => ({
    meta: [
      { title: "My Physiotherapy Visits — MyDox" },
      {
        name: "description",
        content:
          "Track your booked home physiotherapy sessions: therapist arrival, check-in and check-out status, session history and feedback.",
      },
      { property: "og:title", content: "My Physiotherapy Visits — MyDox" },
      {
        property: "og:description",
        content: "See your home physiotherapy sessions, therapist check-in status and rate completed visits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientPhysioVisits,
  ssr: false,
});

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  requested: { label: "Awaiting therapist", color: "#92400E", bg: "#FEF3C7" },
  assigned: { label: "Therapist assigned", color: "#1E40AF", bg: "#DBEAFE" },
  en_route: { label: "Therapist on the way", color: "#0369A1", bg: "#E0F2FE" },
  in_progress: { label: "Session in progress", color: "#065F46", bg: "#D1FAE5" },
  completed: { label: "Completed", color: "#374151", bg: "#E5E7EB" },
  cancelled: { label: "Cancelled", color: "#991B1B", bg: "#FEE2E2" },
  no_show: { label: "Missed", color: "#991B1B", bg: "#FEE2E2" },
};

const UPCOMING = new Set(["requested", "assigned", "en_route", "in_progress"]);

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={`text-lg leading-none ${onChange ? "cursor-pointer" : "cursor-default"}`}
          style={{ color: n <= value ? "#F59E0B" : "#CBD5E1" }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function PatientPhysioVisits() {
  const fetchVisits = useServerFn(getMyPhysioVisits);
  const sendFeedback = useServerFn(submitPhysioVisitFeedback);
  const sendCancel = useServerFn(cancelPhysioVisit);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "previous">("upcoming");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [form, setForm] = useState({ rating: 5, punctuality: 5, professionalism: 5, wouldRebook: true, comment: "" });
  const [notice, setNotice] = useState("");
  const [cancellingFor, setCancellingFor] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const query = useQuery({
    queryKey: ["my-physio-visits"],
    queryFn: () => fetchVisits({}),
    refetchInterval: 60_000,
  });

  const feedbackMutation = useMutation({
    mutationFn: (vars: {
      visitId: string;
      rating: number;
      punctuality: number;
      professionalism: number;
      wouldRebook: boolean;
      comment: string;
    }) => sendFeedback({ data: vars }),
    onSuccess: () => {
      setFeedbackFor(null);
      setNotice("Thanks — your feedback was recorded.");
      qc.invalidateQueries({ queryKey: ["my-physio-visits"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not save feedback"),
  });

  const cancelMutation = useMutation({
    mutationFn: (vars: { visitId: string; reason: string }) => sendCancel({ data: vars }),
    onSuccess: () => {
      setCancellingFor(null);
      setCancelReason("");
      setNotice("Your visit has been cancelled.");
      qc.invalidateQueries({ queryKey: ["my-physio-visits"] });
    },
    onError: (e: unknown) => setNotice(e instanceof Error ? e.message : "Could not cancel visit"),
  });

  const visits = query.data ?? [];
  const shown = visits.filter((v) => (tab === "upcoming" ? UPCOMING.has(v.status) : !UPCOMING.has(v.status)));
  const upcomingCount = visits.filter((v) => UPCOMING.has(v.status)).length;

  return (
    <div className="min-h-[100dvh] bg-[#DCE6E1] text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-extrabold">My physiotherapy visits</h1>
            <p className="text-xs text-slate-500">Home sessions, therapist arrival status and session feedback</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/physio/book"
              className="rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white"
            >
              + Book a session
            </Link>
            <Link to="/bookings" className="text-xs font-semibold text-teal-700">
              All bookings →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">
        {query.isLoading ? (
          <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading your sessions…</div>
        ) : query.isError ? (
          <div className="rounded-2xl bg-white p-6 text-sm text-red-600">
            {query.error instanceof Error ? query.error.message : "Could not load your physiotherapy visits."}{" "}
            <Link to="/auth" search={{ admin: undefined, next: undefined }} className="font-semibold underline">
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-3 flex gap-2">
              {(["upcoming", "previous"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize ${
                    tab === t ? "bg-teal-600 text-white" : "bg-white text-slate-600"
                  }`}
                >
                  {t}
                  {t === "upcoming" && upcomingCount ? ` (${upcomingCount})` : ""}
                </button>
              ))}
            </div>

            {notice ? (
              <div className="mb-3 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-teal-700">{notice}</div>
            ) : null}

            {shown.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">
                No {tab} physiotherapy sessions yet.
              </div>
            ) : (
              <div className="space-y-3">
                {shown.map((v) => {
                  const meta = STATUS_META[v.status] ?? { label: v.status, color: "#374151", bg: "#E5E7EB" };
                  const editing = feedbackFor === v.id;
                  return (
                    <article key={v.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold">{v.therapyLabel}</div>
                          <div className="text-xs text-slate-500">
                            Session {v.sessionNumber} · {v.durationMin} min · {v.area}, {v.city}
                          </div>
                        </div>
                        <span
                          className="whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="text-slate-500">Scheduled</dt>
                          <dd className="font-semibold">{fmt(v.scheduledAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Therapist</dt>
                          <dd className="font-semibold">{v.therapistName ?? "Being assigned"}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Checked in</dt>
                          <dd className="font-semibold" style={{ color: v.checkedInAt ? "#047857" : undefined }}>
                            {v.checkedInAt ? fmtTime(v.checkedInAt) : "Not yet"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Checked out</dt>
                          <dd className="font-semibold" style={{ color: v.checkedOutAt ? "#047857" : undefined }}>
                            {v.checkedOutAt ? fmtTime(v.checkedOutAt) : "Not yet"}
                          </dd>
                        </div>
                        {v.partnerName ? (
                          <div>
                            <dt className="text-slate-500">Service partner</dt>
                            <dd className="font-semibold">{v.partnerName}</dd>
                          </div>
                        ) : null}
                        {v.fee !== null ? (
                          <div>
                            <dt className="text-slate-500">Fee</dt>
                            <dd className="font-semibold">₹{v.fee}</dd>
                          </div>
                        ) : null}
                      </dl>

                      {v.address ? <p className="mt-2 text-xs text-slate-500">{v.address}</p> : null}
                      {v.cancelledAt ? (
                        <p className="mt-2 text-xs text-red-600">
                          Cancelled {fmt(v.cancelledAt)}
                          {v.cancelReason ? ` · ${v.cancelReason}` : ""}
                        </p>
                      ) : null}

                      {UPCOMING.has(v.status) ? (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          {cancellingFor === v.id ? (
                            <form
                              className="space-y-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                setNotice("");
                                cancelMutation.mutate({ visitId: v.id, reason: cancelReason });
                              }}
                            >
                              <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Reason for cancelling (optional)"
                                className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                                rows={2}
                                maxLength={300}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={cancelMutation.isPending}
                                  className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                                >
                                  {cancelMutation.isPending ? "Cancelling…" : "Confirm cancel"}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600"
                                  onClick={() => {
                                    setCancellingFor(null);
                                    setCancelReason("");
                                  }}
                                >
                                  Keep visit
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-600"
                              onClick={() => setCancellingFor(v.id)}
                            >
                              Cancel visit
                            </button>
                          )}
                        </div>
                      ) : null}

                      {v.status === "completed" ? (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          {v.feedback && !editing ? (
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Stars value={v.feedback.rating} />
                                  <span className="text-xs text-slate-500">Your rating</span>
                                </div>
                                {v.feedback.comment ? (
                                  <p className="mt-1 text-xs text-slate-600">“{v.feedback.comment}”</p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                className="text-xs font-semibold text-teal-700"
                                onClick={() => {
                                  setFeedbackFor(v.id);
                                  setForm({
                                    rating: v.feedback!.rating,
                                    punctuality: v.feedback!.punctuality ?? 5,
                                    professionalism: v.feedback!.professionalism ?? 5,
                                    wouldRebook: v.feedback!.wouldRebook ?? true,
                                    comment: v.feedback!.comment ?? "",
                                  });
                                }}
                              >
                                Edit
                              </button>
                            </div>
                          ) : editing ? (
                            <form
                              className="space-y-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                setNotice("");
                                feedbackMutation.mutate({ visitId: v.id, ...form });
                              }}
                            >
                              <label className="flex items-center justify-between text-xs font-semibold">
                                Overall
                                <Stars value={form.rating} onChange={(rating) => setForm((f) => ({ ...f, rating }))} />
                              </label>
                              <label className="flex items-center justify-between text-xs font-semibold">
                                Punctuality
                                <Stars
                                  value={form.punctuality}
                                  onChange={(punctuality) => setForm((f) => ({ ...f, punctuality }))}
                                />
                              </label>
                              <label className="flex items-center justify-between text-xs font-semibold">
                                Professionalism
                                <Stars
                                  value={form.professionalism}
                                  onChange={(professionalism) => setForm((f) => ({ ...f, professionalism }))}
                                />
                              </label>
                              <label className="flex items-center gap-2 text-xs font-semibold">
                                <input
                                  type="checkbox"
                                  checked={form.wouldRebook}
                                  onChange={(e) => setForm((f) => ({ ...f, wouldRebook: e.target.checked }))}
                                />
                                I would book this therapist again
                              </label>
                              <textarea
                                value={form.comment}
                                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                                placeholder="Anything you want the care team to know (optional)"
                                className="w-full rounded-xl border border-slate-200 p-2 text-xs"
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={feedbackMutation.isPending}
                                  className="rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                                >
                                  {feedbackMutation.isPending ? "Saving…" : "Submit feedback"}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600"
                                  onClick={() => setFeedbackFor(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              className="rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white"
                              onClick={() => {
                                setFeedbackFor(v.id);
                                setForm({
                                  rating: 5,
                                  punctuality: 5,
                                  professionalism: 5,
                                  wouldRebook: true,
                                  comment: "",
                                });
                              }}
                            >
                              Rate this session
                            </button>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
