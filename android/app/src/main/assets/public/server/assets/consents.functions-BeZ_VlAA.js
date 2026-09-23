import { c as getRequestIP, r as createServerFn, s as getRequestHeader } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/consents.functions.ts?tss-serverfn-split
var recordHomeVisitConsent_createServerFn_handler = createServerRpc({
	id: "b6ca4bae86a8a8f443dc05b29ff9219564919984dbafba004d524c91104da174",
	name: "recordHomeVisitConsent",
	filename: "src/lib/consents.functions.ts"
}, (opts) => recordHomeVisitConsent.__executeServer(opts));
var recordHomeVisitConsent = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => {
	if (!data || typeof data !== "object") throw new Error("invalid input");
	if (!data.booking_id || typeof data.booking_id !== "string") throw new Error("booking_id required");
	if (!data.policy_version || typeof data.policy_version !== "string") throw new Error("policy_version required");
	if (!data.document_text || typeof data.document_text !== "string") throw new Error("document_text required");
	return data;
}).handler(recordHomeVisitConsent_createServerFn_handler, async ({ data, context }) => {
	const { supabase, userId } = context;
	let ip = null;
	try {
		ip = getRequestIP({ xForwardedFor: true }) ?? null;
	} catch {
		ip = null;
	}
	const user_agent = getRequestHeader("user-agent") ?? null;
	const { data: row, error } = await supabase.from("consents").insert({
		user_id: userId,
		booking_kind: "care_request",
		booking_id: data.booking_id,
		consent_type: "home_visit",
		policy_version: data.policy_version,
		document_text: data.document_text,
		ip,
		user_agent
	}).select("id, granted_at").single();
	if (error) {
		if (error.code === "23505") return {
			id: null,
			granted_at: null,
			duplicate: true
		};
		throw new Error(error.message);
	}
	return {
		id: row.id,
		granted_at: row.granted_at,
		duplicate: false
	};
});
//#endregion
export { recordHomeVisitConsent_createServerFn_handler };
