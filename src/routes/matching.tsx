import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, MapPin, Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/medconnect/backend";
import { getMyUnifiedBookingHub } from "@/lib/unified-booking.functions";
import { UnifiedProviderOffers } from "@/features/bookings/UnifiedProviderOffers";
import { useUnifiedBookingRealtime } from "@/features/bookings/useUnifiedBookingRealtime";
import { Card, Empty, Section, Stat, StaffShell, Tabs } from "@/features/careteam/StaffUI";
import { PhoneAlertsButton } from "@/features/native/PhoneAlertsButton";
import { LiveTrackPanel } from "@/features/bookings/LiveTrackPanel";
import { useState } from "react";

export const Route = createFileRoute("/matching")({
  head: () => ({
    meta: [
      { title: "Live Matching Dashboard — MedConnect" },
      { name: "description", content: "Follow care requests, offers, assignments and job status live for patients, nurses, technicians, physiotherapists and ambulance crews." },
      { property: "og:title", content: "Live Matching Dashboard — MedConnect" },
      { property: "og:description", content: "Live offers, assignments and service status in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MatchingDashboard,
  ssr: false,
});

const ACTIVE = new Set(["requested", "searching", "expanded", "offered", "accepted", "en_route", "arrived", "started", "unavailable"]);
const STAGE: Record<string, string> = {
  requested: "Request received",
  searching: "Searching nearby",
  expanded: "Search area widened",
  offered: "Professionals notified",
  accepted: "Professional assigned",
  en_route: "On the way",
  arrived: "Arrived",
  started: "Service started",
  completed: "Completed",
  cancelled: "Cancelled",
  unavailable: "No match yet",
  disputed: "Under review",
};
const ROLE_LABEL: Record<string, string> = {
  nurse: "nursing",
  technician: "test",
  physiotherapist: "physiotherapy",
  ambulance: "transport",
  care_physician: "consultation",
  hospital: "facility",
};

type Tab = "requests" | "jobs";

function MatchingDashboard() {
  const { user } = useSession();
  const fetchHub = useServerFn(getMyUnifiedBookingHub);
  const queryClient = useQueryClient();
  useUnifiedBookingRealtime(queryClient);
  const hub = useQuery({ queryKey: ["unified-booking-hub"], queryFn: () => fetchHub({}), refetchInterval: 15_000 });
  const [tab, setTab] = useState<Tab>("requests");

  const uid = user?.id;
  const hubData: any = hub.data;
  const bookings = hubData?.bookings ?? [];
  const myRequests = bookings.filter((booking: any) => uid && booking.requested_by === uid);
  const activeRequests = myRequests.filter((booking: any) => ACTIVE.has(booking.status));
  const myJobs = bookings.filter((booking: any) => uid && booking.assigned_provider_id === uid);
  const pendingOffers = (hubData?.offers ?? []).filter((offer: any) => offer.status === "pending" && new Date(offer.expires_at).getTime() > Date.now());
  const unread = (hubData?.notifications ?? []).filter((item: any) => !item.read_at);
  const historyRows = hubData?.history ?? [];
  const historyByBooking = new Map<string, typeof historyRows>();
  for (const event of historyRows) {
    historyByBooking.set(event.booking_id, [...(historyByBooking.get(event.booking_id) ?? []), event]);
  }
  const offerRole = pendingOffers[0]?.provider_role ?? myJobs[0]?.provider_role ?? "";
  const isProviderSide = pendingOffers.length > 0 || myJobs.length > 0;

  return (
    <StaffShell
      title="Live matching dashboard"
      subtitle="Offers, assignments and service status, updating as they happen"
      right={
        <div className="flex items-center gap-2">
          {unread.length ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700">
              <Bell className="size-3" />
              {unread.length}
            </span>
          ) : null}
          <PhoneAlertsButton />
          <Button size="sm" variant="outline" onClick={() => void queryClient.invalidateQueries({ queryKey: ["unified-booking-hub"] })} disabled={hub.isFetching}>
            <RefreshCw />
            {hub.isFetching ? "Updating…" : "Refresh"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="My live requests" value={activeRequests.length} />
        <Stat label="Offers waiting" value={pendingOffers.length} />
        <Stat label="Jobs assigned to me" value={myJobs.filter((booking: any) => ACTIVE.has(booking.status)).length} tone="slate" />
        <Stat label="Completed" value={[...myRequests, ...myJobs].filter((booking: any) => booking.status === "completed").length} tone="slate" />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "requests", label: "My care requests", count: myRequests.length },
          { value: "jobs", label: "My jobs", count: pendingOffers.length + myJobs.length },
        ]}
      />

      {hub.error ? <p role="alert" className="rounded-2xl bg-white p-4 text-sm font-semibold text-rose-700">{(hub.error as Error).message}</p> : null}

      {tab === "requests" ? (
        <>
        <LiveTrackPanel />
        <Section title="Care I have requested" count={myRequests.length}>
          {hub.isLoading ? (
            <Empty>Loading your requests…</Empty>
          ) : myRequests.length ? (
            <div className="space-y-3">
              {myRequests.map((booking: any) => {
                const professionalId = booking.assigned_provider_id ?? booking.assigned_facility_id;
                const professional = professionalId ? hubData?.providerDetails[professionalId] : undefined;
                return (
                  <Card key={booking.id} accent={booking.priority !== "normal"}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold uppercase text-teal-700">
                          {booking.provider_role.replaceAll("_", " ")} · {booking.priority}
                        </p>
                        <h3 className="truncate text-sm font-bold">{booking.title}</h3>
                        <p className="text-[11px] text-slate-500">
                          <MapPin className="mr-1 inline size-3" />
                          {booking.area ?? booking.city} · requested {new Date(booking.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-800">{STAGE[booking.status] ?? booking.status}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <b className="text-sm">{booking.current_radius_km} km</b>
                        <p className="text-[10px] text-slate-500">Search radius</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <b className="text-sm">{booking.notified_provider_count}</b>
                        <p className="text-[10px] text-slate-500">Notified</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <b className="text-sm">{professionalId ? "Assigned" : "Searching"}</b>
                        <p className="text-[10px] text-slate-500">Professional</p>
                      </div>
                    </div>

                    {professional ? (
                      <div className="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-100 font-bold text-teal-800">{professional.name.slice(0, 1)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{professional.name}</p>
                          <p className="truncate text-[11px] text-slate-500">{professional.qualification ?? professional.specialty ?? "Verified care professional"}</p>
                        </div>
                        {professional.phone ? (
                          <Button asChild size="icon" variant="outline">
                            <a href={`tel:${professional.phone}`} aria-label={`Call ${professional.name}`}>
                              <Phone />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    <ol className="mt-3 space-y-1 border-l-2 border-slate-200 pl-3">
                      {(historyByBooking.get(booking.id) ?? []).map((event: any) => (
                        <li key={event.id} className="text-[11px]">
                          <b>{STAGE[event.status] ?? event.status}</b>
                          <span className="ml-2 text-slate-500">{new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </li>
                      ))}
                    </ol>

                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/care-booking">Open booking details</Link>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Empty>
              You have no care requests yet.{" "}
              <Link to="/care-booking" className="font-bold text-teal-700">
                Book care
              </Link>
              .
            </Empty>
          )}
        </Section>
        </>
      ) : (
        <div className="space-y-4">
          {isProviderSide ? null : <Empty>No offers or assigned jobs yet. Go online in your own portal to start receiving work.</Empty>}
          <UnifiedProviderOffers roleLabel={ROLE_LABEL[offerRole] ?? "professional"} />
        </div>
      )}
    </StaffShell>
  );
}
