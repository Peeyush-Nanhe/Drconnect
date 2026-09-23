import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
import { createClient } from "@supabase/supabase-js";
//#region src/lib/ai-history.functions.ts?tss-serverfn-split
function makeToken() {
	const bytes = /* @__PURE__ */ new Uint8Array(18);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
var saveAiHistory_createServerFn_handler = createServerRpc({
	id: "3b3d1dd705020bb36758f78f847a93f1190504f148f3a1ac88fa30341da78fbc",
	name: "saveAiHistory",
	filename: "src/lib/ai-history.functions.ts"
}, (opts) => saveAiHistory.__executeServer(opts));
var saveAiHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d || d.kind !== "triage" && d.kind !== "report" && d.kind !== "voice") throw new Error("invalid kind");
	const title = String(d.title || "Untitled").slice(0, 200);
	return {
		kind: d.kind,
		title,
		payload: d.payload ?? {}
	};
}).handler(saveAiHistory_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("ai_history").insert({
		user_id: context.userId,
		kind: data.kind,
		title: data.title,
		payload: data.payload
	}).select("id, kind, title, created_at, share_token").single();
	if (error) throw new Error(error.message);
	return row;
});
var listAiHistory_createServerFn_handler = createServerRpc({
	id: "bd40a1de1923c6cdb41a851a99b1ba20877d592bded34f294584408c06c55d55",
	name: "listAiHistory",
	filename: "src/lib/ai-history.functions.ts"
}, (opts) => listAiHistory.__executeServer(opts));
var listAiHistory = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(listAiHistory_createServerFn_handler, async ({ context }) => {
	const { data, error } = await context.supabase.from("ai_history").select("id, kind, title, created_at, share_token").order("created_at", { ascending: false }).limit(100);
	if (error) throw new Error(error.message);
	return data || [];
});
var getAiHistoryItem_createServerFn_handler = createServerRpc({
	id: "c9cf25fd97e9706d5be43498370a922df716d8ab3d690718d57b4c867c88f2f8",
	name: "getAiHistoryItem",
	filename: "src/lib/ai-history.functions.ts"
}, (opts) => getAiHistoryItem.__executeServer(opts));
var getAiHistoryItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.id) throw new Error("id required");
	return { id: d.id };
}).handler(getAiHistoryItem_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("ai_history").select("*").eq("id", data.id).maybeSingle();
	if (error) throw new Error(error.message);
	if (!row) throw new Error("Not found");
	return row;
});
var toggleShareAiHistory_createServerFn_handler = createServerRpc({
	id: "63e910a1d5d9b62383e8b2605f0b2f94a7211be958936391e62171947041978d",
	name: "toggleShareAiHistory",
	filename: "src/lib/ai-history.functions.ts"
}, (opts) => toggleShareAiHistory.__executeServer(opts));
var toggleShareAiHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.id) throw new Error("id required");
	return {
		id: d.id,
		share: !!d.share
	};
}).handler(toggleShareAiHistory_createServerFn_handler, async ({ data, context }) => {
	const token = data.share ? makeToken() : null;
	const { data: row, error } = await context.supabase.from("ai_history").update({ share_token: token }).eq("id", data.id).select("id, share_token").single();
	if (error) throw new Error(error.message);
	return row;
});
var deleteAiHistory_createServerFn_handler = createServerRpc({
	id: "823791c992d092e94d0e325fc320abb66dbca8674b488ccbabf6427e88438025",
	name: "deleteAiHistory",
	filename: "src/lib/ai-history.functions.ts"
}, (opts) => deleteAiHistory.__executeServer(opts));
var deleteAiHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.id) throw new Error("id required");
	return { id: d.id };
}).handler(deleteAiHistory_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("ai_history").delete().eq("id", data.id);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var getSharedAiHistory_createServerFn_handler = createServerRpc({
	id: "f615c6a476bc78ea33e40468accc5f2dba66460dafb1401abaf564a7deb267d0",
	name: "getSharedAiHistory",
	filename: "src/lib/ai-history.functions.ts"
}, (opts) => getSharedAiHistory.__executeServer(opts));
var getSharedAiHistory = createServerFn({ method: "GET" }).inputValidator((d) => {
	if (!d?.token || typeof d.token !== "string") throw new Error("token required");
	return { token: d.token.slice(0, 128) };
}).handler(getSharedAiHistory_createServerFn_handler, async ({ data }) => {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_PUBLISHABLE_KEY;
	const isNew = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
	const { data: row, error } = await createClient(url, key, {
		auth: {
			storage: void 0,
			persistSession: false,
			autoRefreshToken: false
		},
		global: { fetch: (input, init) => {
			const h = new Headers(init?.headers);
			if (isNew && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
			h.set("apikey", key);
			return fetch(input, {
				...init,
				headers: h
			});
		} }
	}).from("ai_history").select("kind, title, payload, created_at").eq("share_token", data.token).maybeSingle();
	if (error) throw new Error(error.message);
	if (!row) throw new Error("Shared item not found or link revoked.");
	return row;
});
//#endregion
export { deleteAiHistory_createServerFn_handler, getAiHistoryItem_createServerFn_handler, getSharedAiHistory_createServerFn_handler, listAiHistory_createServerFn_handler, saveAiHistory_createServerFn_handler, toggleShareAiHistory_createServerFn_handler };
