import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/technician-provider.functions.ts?tss-serverfn-split
var getTechnicianOffers_createServerFn_handler = createServerRpc({
	id: "dc2488ffae7e1f0c66a77940813ee7f728a13ab17e219bf59e5d8ffbc5c2cf2e",
	name: "getTechnicianOffers",
	filename: "src/lib/technician-provider.functions.ts"
}, (opts) => getTechnicianOffers.__executeServer(opts));
var getTechnicianOffers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getTechnicianOffers_createServerFn_handler, async ({ context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	const uid = context.userId;
	const { data, error } = await sb.from("technician_visits").select("*").or(`status.eq.requested,technician_id.eq.${uid}`).order("created_at", { ascending: false });
	if (error) throw new Error(error.message);
	return data ?? [];
});
var acceptTechnicianVisit_createServerFn_handler = createServerRpc({
	id: "873af770fcb41d86fa63f76f6daa3796bdf74cde2e7c5fdc47d91237d86d4240",
	name: "acceptTechnicianVisit",
	filename: "src/lib/technician-provider.functions.ts"
}, (opts) => acceptTechnicianVisit.__executeServer(opts));
var acceptTechnicianVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => input).handler(acceptTechnicianVisit_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const uid = context.userId;
	const { data: updated, error } = await sb.from("technician_visits").update({
		technician_id: uid,
		status: "assigned",
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("id", data.visitId).eq("status", "requested").select().maybeSingle();
	if (error) throw new Error(error.message);
	if (!updated) throw new Error("Job no longer available or already taken.");
	return { ok: true };
});
var advanceTechnicianStatus_createServerFn_handler = createServerRpc({
	id: "19199a66eff4be13d10e8a0d50fa4e999f8d8133f3edca281c65987af7ac4f6c",
	name: "advanceTechnicianStatus",
	filename: "src/lib/technician-provider.functions.ts"
}, (opts) => advanceTechnicianStatus.__executeServer(opts));
var advanceTechnicianStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => input).handler(advanceTechnicianStatus_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const uid = context.userId;
	const { error } = await sb.from("technician_visits").update({
		status: data.status,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("id", data.visitId).eq("technician_id", uid);
	if (error) throw new Error(error.message);
	return { ok: true };
});
//#endregion
export { acceptTechnicianVisit_createServerFn_handler, advanceTechnicianStatus_createServerFn_handler, getTechnicianOffers_createServerFn_handler };
