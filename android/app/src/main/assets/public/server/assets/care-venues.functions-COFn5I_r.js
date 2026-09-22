import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/care-venues.functions.ts?tss-serverfn-split
var listCareVenues_createServerFn_handler = createServerRpc({
	id: "5370fda5862ac119a3b62f6f7623095aef0e501e7066aa180e62ec73691cc7e3",
	name: "listCareVenues",
	filename: "src/lib/care-venues.functions.ts"
}, (opts) => listCareVenues.__executeServer(opts));
var listCareVenues = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(listCareVenues_createServerFn_handler, async () => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	const [hospitals, hubs, facilities, physioPartners] = await Promise.all([
		sb.from("hospitals").select("id, name, area, city").limit(500),
		sb.from("hubs").select("id, name, area").limit(500),
		sb.from("facilities").select("id, name, kind, area, city").limit(500),
		sb.from("physio_partners").select("id, name, city").limit(500)
	]);
	const venues = [];
	(hospitals.data ?? []).forEach((h) => venues.push({
		id: h.id,
		name: h.name,
		kind: "hospital",
		area: h.area ?? null,
		city: h.city ?? null,
		isHub: false
	}));
	(hubs.data ?? []).forEach((h) => venues.push({
		id: h.id,
		name: h.name,
		kind: "hub",
		area: h.area ?? null,
		city: null,
		isHub: true
	}));
	(facilities.data ?? []).forEach((f) => venues.push({
		id: f.id,
		name: f.name,
		kind: f.kind ?? "clinic",
		area: f.area ?? null,
		city: f.city ?? null,
		isHub: f.kind === "hub"
	}));
	(physioPartners.data ?? []).forEach((p) => venues.push({
		id: p.id,
		name: p.name,
		kind: "physio_centre",
		area: null,
		city: p.city ?? null,
		isHub: false
	}));
	venues.sort((a, b) => a.name.localeCompare(b.name));
	return { venues };
});
//#endregion
export { listCareVenues_createServerFn_handler };
