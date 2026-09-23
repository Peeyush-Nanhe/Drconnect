import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
//#region src/lib/physio-patient.functions.ts
var THERAPY_LABEL = {
	neuro: "Neuro physiotherapy",
	orthopaedic: "Orthopaedic therapy",
	sports: "Sports injury rehab",
	paediatric: "Paediatric therapy",
	geriatric: "Geriatric therapy",
	cardio_respiratory: "Cardio-respiratory",
	post_surgical: "Post-surgical rehab",
	pelvic_floor: "Pelvic floor",
	general: "General physiotherapy"
};
var getMyPhysioVisits = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("2d2b535363a649e3dd6aad5a3c74633f34cd498fe827d7391c4798ac9e859b46"));
var submitPhysioVisitFeedback = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error("Rating must be a whole number between 1 and 5");
	return input;
}).handler(createSsrRpc("6af742f862fe7044d8e5ceb6b8ed6dbc8da4f83fc6302cd8454eb8f7a352ff17"));
var cancelPhysioVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	if (input.reason && input.reason.length > 300) throw new Error("Reason must be under 300 characters");
	return {
		visitId: String(input.visitId),
		reason: input.reason?.trim() || null
	};
}).handler(createSsrRpc("f49b30aad92cae3fa588c99d3e444aefa2136e33b19b3c4d90ff988227cab92d"));
var bookPhysioVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.therapyType || !THERAPY_LABEL[input.therapyType]) throw new Error("Choose a valid therapy type");
	if (!input.area?.trim() || input.area.trim().length > 100) throw new Error("Area is required (max 100 chars)");
	if (!input.city?.trim() || input.city.trim().length > 100) throw new Error("City is required (max 100 chars)");
	const when = new Date(input.scheduledAt);
	if (Number.isNaN(when.getTime())) throw new Error("Choose a valid date and time");
	if (when.getTime() < Date.now() - 3e5) throw new Error("Scheduled time must be in the future");
	if (input.address && input.address.length > 500) throw new Error("Address must be under 500 characters");
	if (input.notes && input.notes.length > 1e3) throw new Error("Notes must be under 1000 characters");
	return input;
}).handler(createSsrRpc("4eec26c95cde3817f2c746d4a8a4a1f3822c23c9a7f6c594a5315fae33da90bf"));
createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("91ecfe3ca4d4ef57aeca0f8329bd9634af3a5aaaef415754999286e1625e820c"));
var togglePhysioFavoriteTherapist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.therapistId) throw new Error("therapistId is required");
	return { therapistId: String(input.therapistId) };
}).handler(createSsrRpc("7bd61c673b6dc4dd2aad106ec35d8915ad551a1e6f2592d477885f1e622109a6"));
var getPhysioTherapistRoster = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("b48304ea7e9068fb00e995d8ccaf816f401e1619f92ce0849e018a1e0efbde19"));
var getPhysioTherapistSlots = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.therapistId) throw new Error("therapistId is required");
	if (!Number.isInteger(input.durationMin) || input.durationMin < 15 || input.durationMin > 180) throw new Error("Duration must be between 15 and 180 minutes");
	if (!input.startDate || !input.endDate) throw new Error("startDate and endDate are required");
	return input;
}).handler(createSsrRpc("b5d9321a855f0a1cdbe6b676688d49274bd069863491dcf6fdc95dfcf772a5e0"));
var bookPhysioVisitWithTherapist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.therapistId) throw new Error("therapistId is required");
	if (!input?.therapyType || !THERAPY_LABEL[input.therapyType]) throw new Error("Choose a valid therapy type");
	if (!input.area?.trim() || input.area.trim().length > 100) throw new Error("Area is required (max 100 chars)");
	if (!input.city?.trim() || input.city.trim().length > 100) throw new Error("City is required (max 100 chars)");
	const when = new Date(input.startTime);
	if (Number.isNaN(when.getTime())) throw new Error("Choose a valid date and time");
	if (when.getTime() < Date.now()) throw new Error("Scheduled time must be in the future");
	if (input.address && input.address.length > 500) throw new Error("Address must be under 500 characters");
	if (input.notes && input.notes.length > 1e3) throw new Error("Notes must be under 1000 characters");
	return input;
}).handler(createSsrRpc("ff933326d21b98766e8c156753fd5a384391f6cfc685392511de4398eda229c3"));
//#endregion
export { getMyPhysioVisits as a, submitPhysioVisitFeedback as c, cancelPhysioVisit as i, togglePhysioFavoriteTherapist as l, bookPhysioVisit as n, getPhysioTherapistRoster as o, bookPhysioVisitWithTherapist as r, getPhysioTherapistSlots as s, THERAPY_LABEL as t };
