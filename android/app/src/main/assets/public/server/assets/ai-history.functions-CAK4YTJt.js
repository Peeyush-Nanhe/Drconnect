import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
//#region src/lib/ai-history.functions.ts
var saveAiHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d || d.kind !== "triage" && d.kind !== "report" && d.kind !== "voice") throw new Error("invalid kind");
	const title = String(d.title || "Untitled").slice(0, 200);
	return {
		kind: d.kind,
		title,
		payload: d.payload ?? {}
	};
}).handler(createSsrRpc("3b3d1dd705020bb36758f78f847a93f1190504f148f3a1ac88fa30341da78fbc"));
var listAiHistory = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("bd40a1de1923c6cdb41a851a99b1ba20877d592bded34f294584408c06c55d55"));
var getAiHistoryItem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.id) throw new Error("id required");
	return { id: d.id };
}).handler(createSsrRpc("c9cf25fd97e9706d5be43498370a922df716d8ab3d690718d57b4c867c88f2f8"));
var toggleShareAiHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.id) throw new Error("id required");
	return {
		id: d.id,
		share: !!d.share
	};
}).handler(createSsrRpc("63e910a1d5d9b62383e8b2605f0b2f94a7211be958936391e62171947041978d"));
var deleteAiHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.id) throw new Error("id required");
	return { id: d.id };
}).handler(createSsrRpc("823791c992d092e94d0e325fc320abb66dbca8674b488ccbabf6427e88438025"));
var getSharedAiHistory = createServerFn({ method: "GET" }).inputValidator((d) => {
	if (!d?.token || typeof d.token !== "string") throw new Error("token required");
	return { token: d.token.slice(0, 128) };
}).handler(createSsrRpc("f615c6a476bc78ea33e40468accc5f2dba66460dafb1401abaf564a7deb267d0"));
//#endregion
export { saveAiHistory as a, listAiHistory as i, getAiHistoryItem as n, toggleShareAiHistory as o, getSharedAiHistory as r, deleteAiHistory as t };
