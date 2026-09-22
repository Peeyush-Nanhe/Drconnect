import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
//#region src/lib/booking-tracking.functions.ts
var shareProviderLocation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => {
	if (!input || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) throw new Error("Location is required");
	if (input.lat < -90 || input.lat > 90 || input.lng < -180 || input.lng > 180) throw new Error("Invalid location");
	return input;
}).handler(createSsrRpc("060c918c7419996da5c9dffd2f70d0ad353eaa048e4782db830ad373ba87a7ca"));
var getBookingLiveTracks = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("a76fae128e3cb67a90a3f06d4f7543cce269ad791cd40c0f1b259ad460560b89"));
var postFacilityNurseDuty = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => {
	if (!input?.hospitalId) throw new Error("Choose the hospital posting this duty");
	if (!input.skill?.trim()) throw new Error("Choose the nursing skill needed");
	if (!input.title?.trim() || input.title.trim().length > 160) throw new Error("Enter a duty title under 160 characters");
	if (input.description && input.description.length > 2e3) throw new Error("Details must be under 2,000 characters");
	if (![
		"normal",
		"urgent",
		"emergency"
	].includes(input.priority)) throw new Error("Choose a valid urgency");
	if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 30 || input.durationMinutes > 1440) throw new Error("Duty length must be between 30 minutes and 24 hours");
	if (!Number.isFinite(input.payInr) || input.payInr < 0 || input.payInr > 1e5) throw new Error("Enter a valid pay amount");
	return input;
}).handler(createSsrRpc("af5b7e0438ba76ca97c727ccc9141e86cf65b4e13ffada5261c1b609487a161a"));
var getFacilityNurseDuties = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("c36fd4889d6522013b8958b4d176f56f9d3900a0891610b8d5307724ff78e6cb"));
//#endregion
export { shareProviderLocation as i, getFacilityNurseDuties as n, postFacilityNurseDuty as r, getBookingLiveTracks as t };
