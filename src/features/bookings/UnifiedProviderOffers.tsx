import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bell, CheckCircle2, Clock3, MapPin, Navigation, Star, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptUnifiedOffer, cancelUnifiedBooking, declineUnifiedOffer, getMyUnifiedBookingHub, markUnifiedNotificationsRead, transitionUnifiedBooking } from "@/lib/unified-booking.functions";
import { Card, Empty, Section, Stat } from "@/features/careteam/StaffUI";
import { PhoneAlertsButton } from "@/features/native/PhoneAlertsButton";
import { ShareLocationToggle } from "./ShareLocationToggle";
import { useUnifiedBookingRealtime } from "./useUnifiedBookingRealtime";

const NEXT: Record<string, { status: string; label: string }> = {
  accepted: { status: "en_route", label: "Start travel" },
  en_route: { status: "arrived", label: "Mark arrived" },
  arrived: { status: "started", label: "Start service" },
  started: { status: "completed", label: "Complete service" },
};

function notificationPriority(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) && "priority" in metadata
    ? String((metadata as { priority?: unknown }).priority ?? "")
    : "";
}

export function UnifiedProviderOffers({ roleLabel = "professional" }: { roleLabel?: string }) {
  const fetchHub = useServerFn(getMyUnifiedBookingHub);
  const acceptFn = useServerFn(acceptUnifiedOffer);
  const declineFn = useServerFn(declineUnifiedOffer);
  const transitionFn = useServerFn(transitionUnifiedBooking);
  const cancelFn = useServerFn(cancelUnifiedBooking);
  const markReadFn = useServerFn(markUnifiedNotificationsRead);
  const qc = useQueryClient();
  useUnifiedBookingRealtime(qc);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const hub = useQuery({ queryKey: ["unified-booking-hub"], queryFn: () => fetchHub({}), refetchInterval: 15_000 });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["unified-booking-hub"] });
  const accept = useMutation({ mutationFn: (offerId: string) => acceptFn({ data: { offerId } }), onSuccess: refresh });
  const decline = useMutation({ mutationFn: (offerId: string) => declineFn({ data: { offerId } }), onSuccess: refresh });
  const transition = useMutation({ mutationFn: (data: { bookingId: string; status: string }) => transitionFn({ data }), onSuccess: refresh });
  const cancel = useMutation({ mutationFn: ({ bookingId, reason }: { bookingId: string; reason: string }) => cancelFn({ data: { bookingId, reason } }), onSuccess: () => { setCancelTarget(null); setCancelReason(""); refresh(); } });
  const markRead = useMutation({ mutationFn: (ids: string[]) => markReadFn({ data: { ids } }), onSuccess: refresh });
  const hubData: any = hub.data;
  const bookings = hubData?.bookings ?? [];
  const byId = new Map(bookings.map((booking: any) => [booking.id, booking]));
  const pending = (hubData?.offers ?? []).filter((offer: any) => offer.status === "pending" && new Date(offer.expires_at).getTime() > Date.now());
  const active = bookings.filter((booking: any) => (booking.assigned_provider_id || booking.assigned_facility_id) && ["accepted", "en_route", "arrived", "started"].includes(booking.status));
  const unread = (hubData?.notifications ?? []).filter((item: any) => !item.read_at);
  if (hub.isLoading) return <Empty>Loading live assignments…</Empty>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-end gap-2"><ShareLocationToggle active={active.length > 0} /><PhoneAlertsButton /><Button asChild size="sm" variant="outline"><Link to="/matching">Live matching dashboard</Link></Button></div>
    {(hubData?.notifications?.length ?? 0) > 0 ? <Card accent={unread.some((item: any) => notificationPriority(item.metadata) === "emergency")}><div className="flex items-start justify-between gap-3"><button type="button" className="flex min-w-0 gap-2 text-left" onClick={() => setShowNotifications((value) => !value)} aria-expanded={showNotifications}><Bell className="size-4 shrink-0 text-clinical-strong"/><div><p className="text-sm font-bold">Notifications {unread.length ? `(${unread.length} unread)` : ""}</p><p className="truncate text-xs text-muted-foreground">{unread[0]?.title ?? hubData?.notifications[0]?.title}</p></div></button>{unread.length ? <Button size="sm" variant="outline" onClick={() => markRead.mutate(unread.map((item: any) => item.id))}>Mark read</Button> : null}</div>{showNotifications ? <div className="mt-3 max-h-64 space-y-2 overflow-y-auto border-t border-border pt-3">{((hubData?.notifications ?? []) as any[]).map((item: any) => <div key={item.id} className={`rounded-md p-2 text-xs ${notificationPriority(item.metadata) === "emergency" ? "bg-destructive/10 text-destructive" : "bg-muted"}`}><p className="font-bold">{item.title}</p><p>{item.body}</p><time className="text-muted-foreground">{new Date(item.created_at).toLocaleString()}</time></div>)}</div> : null}</Card> : null}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="New offers" value={pending.length}/><Stat label="Active" value={active.length}/><Stat label="Reliability" value={`${hubData?.reliability.score ?? 80}/100`} tone="slate"/><Stat label="Patient rating" value={(() => { const mine=(hubData?.reviews ?? []).filter((review: any) => review.reviewee_id && bookings.some((booking: any) => booking.assigned_provider_id === review.reviewee_id)); return mine.length ? `${(mine.reduce((sum: number, review: any) => sum + review.overall_rating, 0) / mine.length).toFixed(1)}★` : "New"; })()} tone="slate"/></div>
    <Section title={`New ${roleLabel} offers`} count={pending.length}><div className="space-y-3">{pending.length ? pending.map((offer: any) => { const booking: any = byId.get(offer.booking_id); return booking ? <Card key={offer.id} accent={booking.priority !== "normal"}><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className={`text-[11px] font-extrabold uppercase ${booking.priority === "emergency" ? "text-destructive" : "text-clinical-strong"}`}>{booking.priority} · {booking.visit_mode.replace("_", " ")}</p><h3 className="mt-1 truncate text-sm font-bold">{booking.title}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{booking.area ?? booking.city} · {booking.duration_minutes ?? 60} min</p>{booking.service_code ? <p className="mt-1 truncate text-xs font-semibold">Required: {booking.service_code}</p> : null}</div><div className="shrink-0 text-right"><p className="font-bold text-clinical-strong">{offer.earnings ? `₹${offer.earnings}` : "Fee to confirm"}</p>{offer.distance_km != null ? <p className="text-xs text-muted-foreground">{Number(offer.distance_km).toFixed(1)} km</p> : null}</div></div>{booking.description ? <p className="mt-3 text-xs text-muted-foreground">{booking.description}</p> : null}<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"><Button size="sm" onClick={() => accept.mutate(offer.id)} disabled={accept.isPending}><CheckCircle2/>Accept</Button><Button size="sm" variant="outline" onClick={() => decline.mutate(offer.id)} disabled={decline.isPending}><XCircle/>Decline</Button><span className="ml-auto whitespace-nowrap text-[11px] text-muted-foreground"><Clock3 className="mr-1 inline size-3"/>until {new Date(offer.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div></Card> : null; }) : <Empty>No new offers within your selected area.</Empty>}</div></Section>
    <Section title="Active assignments" count={active.length}><div className="space-y-3">{active.length ? active.map((booking: any) => { const next: any = NEXT[booking.status]; return <Card key={booking.id}><div className="flex justify-between gap-3"><div><h3 className="text-sm font-bold">{booking.title}</h3><p className="text-xs text-muted-foreground"><MapPin className="mr-1 inline size-3"/>{booking.address ?? booking.area ?? booking.city}</p><p className="mt-1 text-xs font-semibold capitalize text-clinical-strong">{booking.status.replace("_", " ")}</p></div>{booking.estimated_earnings ? <p className="font-bold">₹{booking.estimated_earnings}</p> : null}</div><div className="mt-3 flex gap-2 border-t border-border pt-3">{next ? <Button size="sm" onClick={() => transition.mutate({ bookingId: booking.id, status: next.status })} disabled={transition.isPending}><Navigation/>{next.label}</Button> : null}<Button size="sm" variant="outline" onClick={() => setCancelTarget(booking.id)} disabled={cancel.isPending}>Cancel & reassign</Button></div>{cancelTarget === booking.id ? <form className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row" onSubmit={(event: any) => { event.preventDefault(); cancel.mutate({ bookingId: booking.id, reason: cancelReason }); }}><input required minLength={3} className="min-h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm" value={cancelReason} onChange={(event: any) => setCancelReason(event.target.value)} placeholder="Reason for cancellation"/><Button size="sm" type="submit" variant="destructive" disabled={cancel.isPending || cancelReason.trim().length < 3}>Confirm reassignment</Button><Button size="sm" type="button" variant="ghost" onClick={() => setCancelTarget(null)}>Keep job</Button></form> : null}</Card>; }) : <Empty>No active assignments.</Empty>}</div></Section>
    {(hubData?.reliability.events.length ?? 0) > 0 ? <Section title="Reliability history"><Card><div className="space-y-2">{hubData?.reliability.events.slice(0, 5).map((event: any, index: number) => <div key={`${event.created_at}-${index}`} className="flex justify-between border-b border-border py-2 last:border-0"><span className="text-xs capitalize">{event.event_type.replaceAll("_", " ")}</span><span className={`text-xs font-bold ${event.score_delta >= 0 ? "text-clinical-strong" : "text-destructive"}`}>{event.score_delta >= 0 ? "+" : ""}{event.score_delta}</span></div>)}</div></Card></Section> : null}
    {(accept.error || decline.error || transition.error || cancel.error) ? <p role="alert" className="text-sm font-semibold text-destructive">{String((accept.error || decline.error || transition.error || cancel.error)?.message)}</p> : null}
  </div>;
}