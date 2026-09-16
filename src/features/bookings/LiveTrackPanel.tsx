import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ambulance, Clock3, MapPin, Activity } from "lucide-react";
import { getBookingLiveTracks } from "@/lib/booking-tracking.functions";
import { LiveTrackMap } from "./LiveTrackMap";
import { Card, Section } from "@/features/careteam/StaffUI";

const ROLE_TEXT: Record<string, string> = {
  ambulance: "Ambulance",
  physiotherapist: "Physiotherapist",
  nurse: "Nurse",
  technician: "Technician",
  care_physician: "Care physician",
  hospital: "Hospital team",
};

function minutesAgo(iso: string | null) {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export function LiveTrackPanel() {
  const fetchTracks = useServerFn(getBookingLiveTracks);
  const tracks = useQuery({ queryKey: ["booking-live-tracks"], queryFn: () => fetchTracks({}), refetchInterval: 15_000 });
  const rows = tracks.data?.tracks ?? [];
  if (!rows.length) return null;

  return (
    <Section title="Live location and arrival time" count={rows.length}>
      <div className="space-y-3">
        {rows.map((track) => {
          const stale = minutesAgo(track.provider?.updatedAt ?? null);
          return (
            <Card key={track.bookingId} accent={track.role === "ambulance"}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-bold">
                  {track.role === "ambulance" ? <Ambulance className="size-4 text-clinical-strong" /> : <Activity className="size-4 text-clinical-strong" />}
                  {ROLE_TEXT[track.role] ?? "Professional"}
                  {track.providerName ? <span className="text-muted-foreground">· {track.providerName}</span> : null}
                </p>
                <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold uppercase">{track.status.replaceAll("_", " ")}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <p className="flex items-center gap-1 font-semibold">
                  <MapPin className="size-3 text-clinical-strong" />
                  {track.distanceKm != null ? `${track.distanceKm} km away` : "Distance not available"}
                </p>
                <p className="flex items-center gap-1 font-semibold">
                  <Clock3 className="size-3 text-clinical-strong" />
                  {track.status === "arrived" || track.status === "started" ? "Already with you" : track.etaMinutes != null ? `About ${track.etaMinutes} min away` : "Arrival time not available"}
                </p>
              </div>
              <div className="mt-2">
                <LiveTrackMap destination={track.destination} provider={track.provider} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {track.provider ? (stale != null && stale > 0 ? `Location updated ${stale} min ago` : "Location updating live") : "Waiting for the professional to share their location"}
              </p>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
