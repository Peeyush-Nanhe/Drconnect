import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { adjustProviderReliability, getUnifiedBookingOperations, resolveUnifiedBookingIssue, updateUnifiedMatchingSettings } from "@/lib/unified-booking.functions";
import { useUnifiedBookingRealtime } from "@/features/bookings/useUnifiedBookingRealtime";

export const Route = createFileRoute("/admin/booking-operations")({
  head: () => ({
    meta: [
      { title: "Booking Operations — MedConnect" },
      { name: "description", content: "Set matching parameters, review offer history, and manage staff reliability across every care service." },
      { property: "og:title", content: "Booking Operations — MedConnect" },
      { property: "og:description", content: "Matching controls, offer history and staff reliability management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingOperations,
  ssr: false,
});

type Tab = "controls" | "queue" | "offers" | "reliability" | "issues";

const TABS: { value: Tab; label: string }[] = [
  { value: "controls", label: "Matching controls" },
  { value: "queue", label: "Live queue" },
  { value: "offers", label: "Offer history" },
  { value: "reliability", label: "Staff reliability" },
  { value: "issues", label: "Service issues" },
];

const CONTROL_FIELDS = [
  ["initialRadiusKm", "Starting radius (km)", "Where the search begins for every new request."],
  ["expansionIntervalMinutes", "Expand every (min)", "How long before the search widens."],
  ["expansionStepKm", "Expansion step (km)", "How much wider each time."],
  ["maxRadiusKm", "Maximum radius (km)", "The search never goes past this."],
  ["offerExpiryMinutes", "Offer expires (min)", "Time a professional has to accept."],
  ["minimumReliabilityScore", "Minimum reliability", "Staff below this get no offers."],
  ["providerCancellationPenalty", "Provider cancellation points", "Deducted when staff drop a job."],
  ["lateArrivalPenalty", "Late arrival points", "Deducted for late arrivals."],
  ["noShowPenalty", "No-show points", "Deducted when staff never arrive."],
] as const;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <b className="text-2xl text-clinical-strong">{value}</b>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function BookingOperations() {
  const fetchOps = useServerFn(getUnifiedBookingOperations);
  const saveFn = useServerFn(updateUnifiedMatchingSettings);
  const resolveFn = useServerFn(resolveUnifiedBookingIssue);
  const adjustFn = useServerFn(adjustProviderReliability);
  const qc = useQueryClient();
  useUnifiedBookingRealtime(qc, false);
  const query = useQuery({ queryKey: ["booking-operations"], queryFn: () => fetchOps({}), refetchInterval: 15000 });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["booking-operations"] });

  const [tab, setTab] = useState<Tab>("controls");
  const [form, setForm] = useState({ initialRadiusKm: 4, expansionIntervalMinutes: 1, expansionStepKm: 1, maxRadiusKm: 11, offerExpiryMinutes: 5, minimumReliabilityScore: 45, providerCancellationPenalty: -8, lateArrivalPenalty: -3, noShowPenalty: -20 });
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [adjust, setAdjust] = useState<Record<string, { delta: string; note: string }>>({});
  const [offerFilter, setOfferFilter] = useState("all");
  const [staffSearch, setStaffSearch] = useState("");
  const qData: any = query.data;

  useEffect(() => {
    const s = qData?.settings;
    if (s) setForm({ initialRadiusKm: Number(s.initial_radius_km), expansionIntervalMinutes: s.expansion_interval_minutes, expansionStepKm: Number(s.expansion_step_km), maxRadiusKm: Number(s.max_radius_km), offerExpiryMinutes: s.offer_expiry_minutes, minimumReliabilityScore: Number(s.minimum_reliability_score), providerCancellationPenalty: s.provider_cancellation_penalty, lateArrivalPenalty: s.late_arrival_penalty, noShowPenalty: s.no_show_penalty });
  }, [qData?.settings]);

  const save = useMutation({ mutationFn: () => saveFn({ data: form }), onSuccess: refresh });
  const resolve = useMutation({ mutationFn: (data: { issueId: string; status: "reviewing" | "resolved" | "dismissed"; resolution: string }) => resolveFn({ data }), onSuccess: refresh });
  const adjustScore = useMutation({
    mutationFn: (data: { providerId: string; scoreDelta: number; note: string }) => adjustFn({ data }),
    onSuccess: (_result, variables) => { setAdjust((prev) => ({ ...prev, [variables.providerId]: { delta: "", note: "" } })); refresh(); },
  });

  const bookings = qData?.bookings ?? [];
  const offers = qData?.offers ?? [];
  const staff = qData?.staff ?? [];
  const titleById = qData?.bookingTitleById ?? {};
  const nameById = qData?.nameById ?? {};
  const pending = bookings.filter((b: any) => ["requested", "searching", "expanded", "offered", "unavailable"].includes(b.status));
  const openIssues = (qData?.issues ?? []).filter((issue: any) => issue.status !== "resolved" && issue.status !== "dismissed");
  const filteredOffers = offerFilter === "all" ? offers : offers.filter((offer: any) => offer.status === offerFilter);
  const visibleStaff = staffSearch.trim() ? staff.filter((member: any) => member.name.toLowerCase().includes(staffSearch.trim().toLowerCase())) : staff;

  return (
    <main className="min-h-screen bg-clinical-soft p-4">
      <div className="mx-auto max-w-6xl space-y-5">
        <header>
          <Link to="/admin" className="text-xs font-bold text-clinical-strong">← Admin console</Link>
          <h1 className="text-2xl font-extrabold">Booking Operations</h1>
          <p className="text-sm text-muted-foreground">Set the matching rules, review every offer, and manage staff reliability.</p>
        </header>

        {query.error ? <p role="alert" className="rounded-lg bg-card p-4 text-destructive">{(query.error as Error).message}</p> : null}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Open matching" value={pending.length} />
          <Stat label="Active jobs" value={bookings.filter((b: any) => ["accepted", "en_route", "arrived", "started"].includes(b.status)).length} />
          <Stat label="Offers sent" value={offers.length} />
          <Stat label="Staff below limit" value={staff.filter((member: any) => member.score < form.minimumReliabilityScore).length} />
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-bold ${tab === item.value ? "bg-clinical-strong text-white" : "border border-border bg-card"}`}
            >
              {item.label}
              {item.value === "issues" && openIssues.length ? ` · ${openIssues.length}` : ""}
            </button>
          ))}
        </div>

        {tab === "controls" ? (
          <form className="rounded-lg border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <h2 className="mb-1 font-bold">Matching parameters</h2>
            <p className="mb-3 text-xs text-muted-foreground">These apply to every service — nursing, tests, physiotherapy, consultations and ambulance.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {CONTROL_FIELDS.map(([key, label, help]) => (
                <label key={key} className="text-xs font-bold">
                  {label}
                  <input
                    type="number"
                    step={key.includes("Radius") || key === "expansionStepKm" ? "0.5" : "1"}
                    className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
                    value={form[key]}
                    onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })}
                  />
                  <span className="mt-1 block font-normal text-muted-foreground">{help}</span>
                </label>
              ))}
            </div>
            <Button className="mt-3" type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save controls"}</Button>
            {save.error ? <p role="alert" className="mt-2 text-sm font-semibold text-destructive">{(save.error as Error).message}</p> : null}
            {save.isSuccess && !save.isPending ? <p className="mt-2 text-sm font-semibold text-clinical-strong">Saved — new requests use these rules.</p> : null}
          </form>
        ) : null}

        {tab === "queue" ? (
          <section className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full text-sm">
              <thead className="bg-muted text-left text-xs"><tr><th className="p-3">Created</th><th className="p-3">Service</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Radius</th><th className="p-3">Notified</th><th className="p-3">Assigned to</th></tr></thead>
              <tbody>
                {bookings.map((b: any) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="p-3">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="p-3 font-semibold">{b.title}</td>
                    <td className="p-3 capitalize">{b.provider_role.replaceAll("_", " ")}</td>
                    <td className="p-3 capitalize">{b.status.replaceAll("_", " ")}</td>
                    <td className="p-3">{b.current_radius_km} km</td>
                    <td className="p-3">{b.notified_provider_count}</td>
                    <td className="p-3">{b.assigned_provider_id ? nameById[b.assigned_provider_id] ?? "Assigned" : "—"}</td>
                  </tr>
                ))}
                {bookings.length === 0 ? <tr><td className="p-4 text-muted-foreground" colSpan={7}>No bookings yet.</td></tr> : null}
              </tbody>
            </table>
          </section>
        ) : null}

        {tab === "offers" ? (
          <section className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {["all", "pending", "accepted", "declined", "expired", "cancelled"].map((status) => (
                <button key={status} type="button" onClick={() => setOfferFilter(status)} className={`min-h-9 rounded-full px-3 text-xs font-bold capitalize ${offerFilter === status ? "bg-clinical-strong text-white" : "border border-border bg-card"}`}>
                  {status}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="min-w-full text-sm">
                <thead className="bg-muted text-left text-xs"><tr><th className="p-3">Sent</th><th className="p-3">Service</th><th className="p-3">Offered to</th><th className="p-3">Role</th><th className="p-3">Distance</th><th className="p-3">Fee</th><th className="p-3">Status</th><th className="p-3">Answered in</th></tr></thead>
                <tbody>
                  {filteredOffers.map((offer: any) => {
                    const answered = offer.responded_at ? Math.max(0, Math.round((new Date(offer.responded_at).getTime() - new Date(offer.offered_at).getTime()) / 1000)) : null;
                    return (
                      <tr key={offer.id} className="border-t border-border">
                        <td className="p-3">{new Date(offer.offered_at).toLocaleString()}</td>
                        <td className="p-3 font-semibold">{titleById[offer.booking_id] ?? "Booking"}</td>
                        <td className="p-3">{offer.provider_id ? nameById[offer.provider_id] ?? "Staff member" : "Facility"}</td>
                        <td className="p-3 capitalize">{offer.provider_role.replaceAll("_", " ")}</td>
                        <td className="p-3">{offer.distance_km == null ? "—" : `${Number(offer.distance_km).toFixed(1)} km`}</td>
                        <td className="p-3">{offer.earnings ? `₹${offer.earnings}` : "—"}</td>
                        <td className={`p-3 font-bold capitalize ${offer.status === "accepted" ? "text-clinical-strong" : offer.status === "pending" ? "" : "text-destructive"}`}>{offer.status}</td>
                        <td className="p-3">{answered == null ? "—" : answered < 60 ? `${answered}s` : `${Math.round(answered / 60)}m`}</td>
                      </tr>
                    );
                  })}
                  {filteredOffers.length === 0 ? <tr><td className="p-4 text-muted-foreground" colSpan={8}>No offers in this list.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "reliability" ? (
          <section className="space-y-3">
            <input className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-xs" placeholder="Search staff by name" value={staffSearch} onChange={(event) => setStaffSearch(event.target.value)} />
            {adjustScore.error ? <p role="alert" className="text-sm font-semibold text-destructive">{(adjustScore.error as Error).message}</p> : null}
            {visibleStaff.length === 0 ? <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No staff have received offers yet.</p> : null}
            {visibleStaff.map((member: any) => {
              const entry = adjust[member.providerId] ?? { delta: "", note: "" };
              const below = member.score < form.minimumReliabilityScore;
              return (
                <article key={member.providerId} className={`rounded-lg border bg-card p-4 ${below ? "border-destructive" : "border-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.offers} offers · {member.accepted} accepted · {member.declined} declined · {member.expired} missed · {member.completed} completed</p>
                      <p className="text-xs text-muted-foreground">Acceptance {member.acceptanceRate == null ? "—" : `${member.acceptanceRate}%`} · Rating {member.averageRating == null ? "new" : `${member.averageRating}★`} · Cancellations {member.cancellations}</p>
                    </div>
                    <div className="text-right">
                      <b className={`text-2xl ${below ? "text-destructive" : "text-clinical-strong"}`}>{member.score}</b>
                      <p className="text-xs text-muted-foreground">reliability{below ? " · no offers" : ""}</p>
                    </div>
                  </div>
                  {member.events.length ? (
                    <div className="mt-3 space-y-1 border-t border-border pt-3">
                      {member.events.map((event: any) => (
                        <div key={event.id} className="flex justify-between text-xs">
                          <span className="capitalize">{event.event_type.replaceAll("_", " ")}{event.note ? ` — ${event.note}` : ""}</span>
                          <span className={`font-bold ${event.score_delta >= 0 ? "text-clinical-strong" : "text-destructive"}`}>{event.score_delta >= 0 ? "+" : ""}{event.score_delta}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <form
                    className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
                    onSubmit={(event) => { event.preventDefault(); adjustScore.mutate({ providerId: member.providerId, scoreDelta: Number(entry.delta), note: entry.note }); }}
                  >
                    <input type="number" min={-50} max={50} required className="min-h-10 w-24 rounded-md border border-input bg-background px-3 text-sm" placeholder="±points" value={entry.delta} onChange={(event) => setAdjust({ ...adjust, [member.providerId]: { ...entry, delta: event.target.value } })} />
                    <input required minLength={3} className="min-h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm" placeholder="Reason for this adjustment" value={entry.note} onChange={(event) => setAdjust({ ...adjust, [member.providerId]: { ...entry, note: event.target.value } })} />
                    <Button size="sm" type="submit" disabled={adjustScore.isPending}>Apply</Button>
                  </form>
                </article>
              );
            })}
          </section>
        ) : null}

        {tab === "issues" ? (
          <section className="space-y-2">
            {(qData?.issues ?? []).length === 0 ? <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No service issues reported.</p> : null}
            {(qData?.issues ?? []).map((issue: any) => (
              <article key={issue.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold capitalize">{issue.category.replaceAll("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">{issue.details}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{titleById[issue.booking_id] ?? "Booking"} · {new Date(issue.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-xs font-bold uppercase text-destructive">{issue.status}</span>
                </div>
                {issue.status !== "resolved" && issue.status !== "dismissed" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input className="min-h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm" placeholder="Review note" value={resolution[issue.id] ?? ""} onChange={(event) => setResolution({ ...resolution, [issue.id]: event.target.value })} />
                    <Button size="sm" onClick={() => resolve.mutate({ issueId: issue.id, status: "resolved", resolution: resolution[issue.id] ?? "" })}>Resolve</Button>
                    <Button size="sm" variant="outline" onClick={() => resolve.mutate({ issueId: issue.id, status: "dismissed", resolution: resolution[issue.id] ?? "" })}>Dismiss</Button>
                  </div>
                ) : issue.resolution ? <p className="mt-2 text-xs">Resolution: {issue.resolution}</p> : null}
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
