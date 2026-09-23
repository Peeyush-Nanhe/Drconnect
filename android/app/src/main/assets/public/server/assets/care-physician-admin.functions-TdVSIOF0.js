import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/care-physician-admin.functions.ts?tss-serverfn-split
async function assertAdmin(ctx) {
	const [{ data: isAdmin, error: adminError }, { data: isSuper, error: superError }] = await Promise.all([ctx.supabase.rpc("has_role", {
		_user_id: ctx.userId,
		_role: "admin"
	}), ctx.supabase.rpc("has_role", {
		_user_id: ctx.userId,
		_role: "super_admin"
	})]);
	if (adminError) throw new Error(adminError.message);
	if (superError) throw new Error(superError.message);
	if (!isAdmin && !isSuper) throw new Error("Forbidden: admin only");
}
var getCarePhysicianVerificationQueue_createServerFn_handler = createServerRpc({
	id: "fa2b391fc42b7b5290106b1318a3c447f33198f6b05798ac668344a3b1eb683d",
	name: "getCarePhysicianVerificationQueue",
	filename: "src/lib/care-physician-admin.functions.ts"
}, (opts) => getCarePhysicianVerificationQueue.__executeServer(opts));
var getCarePhysicianVerificationQueue = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getCarePhysicianVerificationQueue_createServerFn_handler, async ({ context }) => {
	await assertAdmin(context);
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	const { data: profiles, error } = await sb.from("care_physician_profiles").select("*").order("registration_verified", { ascending: true }).order("created_at", { ascending: false });
	if (error) throw new Error(error.message);
	const ids = [...new Set((profiles ?? []).map((row) => row.user_id))];
	const identityRes = ids.length ? await sb.from("profiles").select("id, full_name, specialty").in("id", ids) : {
		data: [],
		error: null
	};
	if (identityRes.error) throw new Error(identityRes.error.message);
	const identities = new Map((identityRes.data ?? []).map((row) => [row.id, row]));
	return (profiles ?? []).map((row) => {
		const identity = identities.get(row.user_id) ?? {};
		return {
			...row,
			full_name: identity.full_name ?? "Care physician",
			primary_specialty: identity.specialty ?? null
		};
	});
});
var setCarePhysicianRegistrationVerification_createServerFn_handler = createServerRpc({
	id: "f6428e42314408ff7dd4cc4163b1582f3b1ff41d0352b938c80e077cfa0f03bb",
	name: "setCarePhysicianRegistrationVerification",
	filename: "src/lib/care-physician-admin.functions.ts"
}, (opts) => setCarePhysicianRegistrationVerification.__executeServer(opts));
var setCarePhysicianRegistrationVerification = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.userId) throw new Error("userId is required");
	return {
		userId: input.userId,
		verified: Boolean(input.verified)
	};
}).handler(setCarePhysicianRegistrationVerification_createServerFn_handler, async ({ data, context }) => {
	await assertAdmin(context);
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const { error } = await supabaseAdmin.from("care_physician_profiles").update({
		registration_verified: data.verified,
		verified_at: data.verified ? (/* @__PURE__ */ new Date()).toISOString() : null,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("user_id", data.userId);
	if (error) throw new Error(error.message);
	return { ok: true };
});
//#endregion
export { getCarePhysicianVerificationQueue_createServerFn_handler, setCarePhysicianRegistrationVerification_createServerFn_handler };
