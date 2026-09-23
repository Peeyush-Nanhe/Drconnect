import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/push.functions.ts?tss-serverfn-split
var PLATFORMS = [
	"android",
	"ios",
	"web"
];
var PROVIDERS = [
	"fcm",
	"apns",
	"expo",
	"webpush"
];
/** Register (or refresh) the current user's push token for this device. */
var registerDeviceToken_createServerFn_handler = createServerRpc({
	id: "eed86b1d944a67233fe1c0007f65484482f26e3ede34c365a0ecec262082ae72",
	name: "registerDeviceToken",
	filename: "src/lib/push.functions.ts"
}, (opts) => registerDeviceToken.__executeServer(opts));
var registerDeviceToken = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => {
	if (!data || typeof data !== "object") throw new Error("invalid input");
	if (!data.token || typeof data.token !== "string" || data.token.length > 4096) throw new Error("token required");
	if (!PLATFORMS.includes(data.platform)) throw new Error("invalid platform");
	if (data.provider && !PROVIDERS.includes(data.provider)) throw new Error("invalid provider");
	return data;
}).handler(registerDeviceToken_createServerFn_handler, async ({ data, context }) => {
	const { supabase, userId } = context;
	const provider = data.provider ?? "fcm";
	const { data: row, error } = await supabase.from("device_tokens").upsert({
		user_id: userId,
		token: data.token,
		platform: data.platform,
		provider,
		device_id: data.device_id ?? null,
		app_version: data.app_version ?? null,
		locale: data.locale ?? null,
		enabled: true,
		last_seen_at: (/* @__PURE__ */ new Date()).toISOString()
	}, { onConflict: "provider,token" }).select("id, platform, provider, enabled").single();
	if (error) throw new Error(error.message);
	return row;
});
var unregisterDeviceToken_createServerFn_handler = createServerRpc({
	id: "90de4c4cc73a76b85874a8e52d9a856607befe6646323d341d76a31c7742ad23",
	name: "unregisterDeviceToken",
	filename: "src/lib/push.functions.ts"
}, (opts) => unregisterDeviceToken.__executeServer(opts));
var unregisterDeviceToken = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => {
	if (!data?.token || typeof data.token !== "string") throw new Error("token required");
	return data;
}).handler(unregisterDeviceToken_createServerFn_handler, async ({ data, context }) => {
	const { supabase, userId } = context;
	const { error } = await supabase.from("device_tokens").update({ enabled: false }).eq("user_id", userId).eq("token", data.token);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var listMyPushDeliveries_createServerFn_handler = createServerRpc({
	id: "4592910ff3c97ff5a5f3c6c992f7ee5d86a3d9706a6c9624ecf0c39fef7a58c3",
	name: "listMyPushDeliveries",
	filename: "src/lib/push.functions.ts"
}, (opts) => listMyPushDeliveries.__executeServer(opts));
var listMyPushDeliveries = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(listMyPushDeliveries_createServerFn_handler, async ({ context }) => {
	const { data, error } = await context.supabase.from("push_deliveries").select("id, title, body, data, status, created_at").order("created_at", { ascending: false }).limit(50);
	if (error) throw new Error(error.message);
	return data ?? [];
});
//#endregion
export { listMyPushDeliveries_createServerFn_handler, registerDeviceToken_createServerFn_handler, unregisterDeviceToken_createServerFn_handler };
