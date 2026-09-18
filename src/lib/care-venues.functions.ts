import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CareVenue = {
  id: string;
  name: string;
  kind: string; // hospital | hub | clinic | diagnostic | labs | pharmacy | physio_centre
  area: string | null;
  city: string | null;
  isHub: boolean; // tie-up hub — machines already on site
};

const KIND_LABEL: Record<string, string> = {
  hospital: "Hospital",
  hub: "Tie-up hub",
  diagnostic: "Scan centre",
  labs: "Pathology lab",
  pharmacy: "Pharmacy",
  physio_centre: "Physio centre",
  clinic: "Clinic",
};

export const venueKindLabel = (kind: string) => KIND_LABEL[kind] ?? kind;

/**
 * Names of every place a nurse, physiotherapist or technician can be posted:
 * hospitals, tie-up hubs, diagnostic centres, labs and physio partner centres.
 * Read-only name/area listing used to build "where I prefer to work" pickers.
 */
export const listCareVenues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ venues: CareVenue[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const [hospitals, hubs, facilities, physioPartners] = await Promise.all([
      sb.from("hospitals").select("id, name, area, city").limit(500),
      sb.from("hubs").select("id, name, area").limit(500),
      sb.from("facilities").select("id, name, kind, area, city").limit(500),
      sb.from("physio_partners").select("id, name, city").limit(500),
    ]);

    const venues: CareVenue[] = [];

    (hospitals.data ?? []).forEach((h: any) =>
      venues.push({ id: h.id, name: h.name, kind: "hospital", area: h.area ?? null, city: h.city ?? null, isHub: false }),
    );
    (hubs.data ?? []).forEach((h: any) =>
      venues.push({ id: h.id, name: h.name, kind: "hub", area: h.area ?? null, city: null, isHub: true }),
    );
    (facilities.data ?? []).forEach((f: any) =>
      venues.push({
        id: f.id,
        name: f.name,
        kind: f.kind ?? "clinic",
        area: f.area ?? null,
        city: f.city ?? null,
        isHub: f.kind === "hub",
      }),
    );
    (physioPartners.data ?? []).forEach((p: any) =>
      venues.push({ id: p.id, name: p.name, kind: "physio_centre", area: null, city: p.city ?? null, isHub: false }),
    );

    venues.sort((a, b) => a.name.localeCompare(b.name));
    return { venues };
  });
