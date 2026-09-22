import { n as supabase } from "./client-BSmVQfT1.js";
import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
//#region src/lib/unified-booking.functions.ts
var allowedRoles = /* @__PURE__ */ new Set([
	"nurse",
	"technician",
	"care_physician",
	"hospital",
	"physiotherapist",
	"ambulance"
]);
var allowedPriorities = /* @__PURE__ */ new Set([
	"normal",
	"urgent",
	"emergency"
]);
var allowedModes = /* @__PURE__ */ new Set([
	"home",
	"facility",
	"virtual",
	"locum"
]);
var allowedTransitions = /* @__PURE__ */ new Set([
	"en_route",
	"arrived",
	"started",
	"completed",
	"disputed"
]);
function validateBooking(input) {
	if (!input || !allowedRoles.has(input.providerRole)) throw new Error("Choose a valid professional type");
	if (!allowedPriorities.has(input.priority)) throw new Error("Choose a valid priority");
	if (!allowedModes.has(input.visitMode)) throw new Error("Choose a valid visit type");
	if (!input.title?.trim() || input.title.trim().length > 160) throw new Error("Enter a service title under 160 characters");
	if (input.description && input.description.length > 2e3) throw new Error("Details must be under 2,000 characters");
	if (input.lat !== void 0 && (input.lat < -90 || input.lat > 90)) throw new Error("Invalid latitude");
	if (input.lng !== void 0 && (input.lng < -180 || input.lng > 180)) throw new Error("Invalid longitude");
	return input;
}
var createUnifiedBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(validateBooking).handler(createSsrRpc("332b06966b339fdcde0d586dd0105897cd04a425b947b2d924555ba0c0f3fad3"));
var getMyUnifiedBookingHub = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("951db98fef047462dd3ad5ea77fa9095f7b480ef8c51bd9f760c6417ea61ab61"));
var acceptUnifiedOffer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.offerId) throw new Error("Offer is required");
	return input;
}).handler(createSsrRpc("2dac4cf5c5c08a4c27c98b920dccd945943de669fcc6d86935cae745d45362d4"));
var declineUnifiedOffer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.offerId) throw new Error("Offer is required");
	return input;
}).handler(createSsrRpc("1f1a7fdbc09ec28584ca610717f8271e497d24f56781273bdb63914a924a9d0a"));
var transitionUnifiedBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.bookingId || !allowedTransitions.has(input.status)) throw new Error("Invalid status change");
	return input;
}).handler(createSsrRpc("2ea15a834436b39627bc463b89ba2696645c6b3956ebfddaaa32073b9d40ad83"));
var cancelUnifiedBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.bookingId || !input.reason?.trim()) throw new Error("Please add a cancellation reason");
	return input;
}).handler(createSsrRpc("14143d2091efb7aa042b7d292c712d752fed2e89e7cfbd4505300bbf430e5b01"));
var retryUnifiedBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.bookingId) throw new Error("Booking is required");
	return input;
}).handler(createSsrRpc("350250d664f391ccc1a71e2a3ad0b01d35ae87dae5c33be1538129d147c0bc98"));
var submitUnifiedBookingReview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.bookingId || ![
		input.overall,
		input.quality,
		input.punctuality,
		input.professionalism,
		input.communication
	].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) throw new Error("All ratings must be between 1 and 5");
	return input;
}).handler(createSsrRpc("aca68a1d0de84bcc5c14b5539ada80141f527eab0ac154fe443bcbe789f0baf3"));
var markUnifiedNotificationsRead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => ({ ids: Array.isArray(input?.ids) ? input.ids.slice(0, 100) : [] })).handler(createSsrRpc("eaa766175c22b5fe8c5956b29fbe7eac3c32327b98dcfc13da7ac51c929f966c"));
var getUnifiedBookingOperations = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("6aeb407b344520828681c5d87b4ff8de6ef4dddd7fa425cb874cc1af4fba7066"));
var adjustProviderReliability = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.providerId) throw new Error("Choose a staff member");
	if (!Number.isFinite(input.scoreDelta) || input.scoreDelta < -50 || input.scoreDelta > 50 || input.scoreDelta === 0) throw new Error("Adjustment must be between -50 and +50");
	if (!input.note?.trim() || input.note.trim().length > 500) throw new Error("Add a short reason (under 500 characters)");
	return input;
}).handler(createSsrRpc("501998ae371bd5ddfb44bc38026523b5823a8bcb268d1c3d7587afcfd8c63de5"));
var updateUnifiedMatchingSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input || input.initialRadiusKm < 1 || input.maxRadiusKm < input.initialRadiusKm || input.expansionIntervalMinutes < 1 || input.offerExpiryMinutes < 1 || input.minimumReliabilityScore < 0 || input.minimumReliabilityScore > 100 || [
		input.providerCancellationPenalty,
		input.lateArrivalPenalty,
		input.noShowPenalty
	].some((value) => value > 0 || value < -100)) throw new Error("Invalid matching settings");
	return input;
}).handler(createSsrRpc("38a07ab6878fae81a3a1f5dfe9b6b8fd2080560870fd22584af89225d7b194f9"));
var resolveUnifiedBookingIssue = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.issueId || !input.resolution?.trim()) throw new Error("Add a review note");
	return input;
}).handler(createSsrRpc("5434617f6cd719585ea5357a889596f0853c8bf4f1ce5b15bf6a561c6169b257"));
//#endregion
//#region src/features/bookings/useUnifiedBookingRealtime.ts
var TABLES = [
	"unified_bookings",
	"booking_offers",
	"booking_status_history",
	"booking_reviews",
	"app_notifications"
];
function useUnifiedBookingRealtime(queryClient, showToasts = true) {
	const ready = useRef(false);
	useEffect(() => {
		const channel = supabase.channel(`unified-booking-${crypto.randomUUID()}`);
		for (const table of TABLES) channel.on("postgres_changes", {
			event: "*",
			schema: "public",
			table
		}, (payload) => {
			queryClient.invalidateQueries({ queryKey: ["unified-booking-hub"] });
			queryClient.invalidateQueries({ queryKey: ["booking-operations"] });
			if (showToasts && ready.current && table === "app_notifications" && payload.eventType === "INSERT") {
				const notification = payload.new;
				const message = notification.body || notification.title || "Booking updated";
				if (notification.metadata?.priority === "emergency") toast.error(message);
				else toast(message);
				if (notification.metadata?.priority === "emergency" && "vibrate" in navigator) navigator.vibrate([
					180,
					80,
					180
				]);
			}
		});
		channel.subscribe((status) => {
			if (status === "SUBSCRIBED") ready.current = true;
		});
		return () => {
			ready.current = false;
			supabase.removeChannel(channel);
		};
	}, [queryClient, showToasts]);
}
//#endregion
export { createUnifiedBooking as a, getUnifiedBookingOperations as c, retryUnifiedBooking as d, submitUnifiedBookingReview as f, cancelUnifiedBooking as i, markUnifiedNotificationsRead as l, updateUnifiedMatchingSettings as m, acceptUnifiedOffer as n, declineUnifiedOffer as o, transitionUnifiedBooking as p, adjustProviderReliability as r, getMyUnifiedBookingHub as s, useUnifiedBookingRealtime as t, resolveUnifiedBookingIssue as u };
