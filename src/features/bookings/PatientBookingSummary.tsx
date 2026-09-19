import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyUnifiedBookingHub } from "@/lib/unified-booking.functions";
import { useUnifiedBookingRealtime } from "./useUnifiedBookingRealtime";

const ACTIVE = new Set(["requested", "searching", "expanded", "offered", "accepted", "en_route", "arrived", "started", "unavailable"]);

export function PatientBookingSummary() {
  const fetchHub = useServerFn(getMyUnifiedBookingHub);
  const queryClient = useQueryClient();
  useUnifiedBookingRealtime(queryClient);
  const query = useQuery({ queryKey: ["unified-booking-hub"], queryFn: () => fetchHub({}), refetchInterval: 15_000 });
  const active = ((query.data as any)?.bookings ?? []).find((booking: any) => booking.patient_id === booking.requested_by && ACTIVE.has(booking.status));
  const unread = ((query.data as any)?.notifications ?? []).filter((notification: any) => !notification.read_at).length;

  return <section className="border-b border-border bg-card px-4 py-3" aria-label="Live care booking">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        {active ? <><p className="text-[11px] font-extrabold uppercase text-clinical-strong">Live care · {active.status.replaceAll("_", " ")}</p><p className="truncate text-sm font-bold">{active.title}</p><p className="text-xs text-muted-foreground"><MapPin className="mr-1 inline size-3"/>{active.current_radius_km} km search · {active.notified_provider_count} notified</p></> : <><p className="text-sm font-bold">Need care at home or nearby?</p><p className="text-xs text-muted-foreground">Request a verified professional and follow every update.</p></>}
      </div>
      {unread ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive"><Bell className="size-3"/>{unread}</span> : null}
      <Button asChild size="sm" variant="outline"><Link to="/matching">Live matching</Link></Button>
      <Button asChild size="sm"><Link to="/care-booking">Book care<ChevronRight/></Link></Button>
    </div>
  </section>;
}