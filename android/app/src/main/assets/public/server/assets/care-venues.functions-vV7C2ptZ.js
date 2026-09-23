import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
//#region src/lib/care-venues.functions.ts
var KIND_LABEL = {
	hospital: "Hospital",
	hub: "Tie-up hub",
	diagnostic: "Scan centre",
	labs: "Pathology lab",
	pharmacy: "Pharmacy",
	physio_centre: "Physio centre",
	clinic: "Clinic"
};
var venueKindLabel = (kind) => KIND_LABEL[kind] ?? kind;
/**
* Names of every place a nurse, physiotherapist or technician can be posted:
* hospitals, tie-up hubs, diagnostic centres, labs and physio partner centres.
* Read-only name/area listing used to build "where I prefer to work" pickers.
*/
var listCareVenues = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("5370fda5862ac119a3b62f6f7623095aef0e501e7066aa180e62ec73691cc7e3"));
//#endregion
export { venueKindLabel as n, listCareVenues as t };
