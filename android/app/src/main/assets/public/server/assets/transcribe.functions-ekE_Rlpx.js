import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/transcribe.functions.ts?tss-serverfn-split
var transcribeAudio_createServerFn_handler = createServerRpc({
	id: "2799d376cda9c2a00885696e66485607d03157e48bbf490b633ed77933c020ff",
	name: "transcribeAudio",
	filename: "src/lib/transcribe.functions.ts"
}, (opts) => transcribeAudio.__executeServer(opts));
var transcribeAudio = createServerFn({ method: "POST" }).inputValidator((d) => {
	if (!d || typeof d.audioBase64 !== "string" || !d.audioBase64) throw new Error("audioBase64 required");
	if (d.audioBase64.length > 14e6) throw new Error("Audio too long — please record a shorter clip.");
	return {
		audioBase64: d.audioBase64,
		mimeType: d.mimeType || "audio/webm"
	};
}).handler(transcribeAudio_createServerFn_handler, async ({ data }) => {
	const key = process.env.LOVABLE_API_KEY;
	if (!key) throw new Error("AI is not configured yet (missing LOVABLE_API_KEY).");
	const bin = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
	const filename = `voice.${(data.mimeType.split("/")[1] || "webm").split(";")[0]}`;
	const blob = new Blob([bin], { type: data.mimeType });
	const form = new FormData();
	form.append("file", blob, filename);
	form.append("model", "openai/gpt-4o-transcribe");
	const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
		method: "POST",
		headers: { Authorization: `Bearer ${key}` },
		body: form
	});
	if (!resp.ok) {
		const body = await resp.text().catch(() => "");
		if (resp.status === 429) throw new Error("Voice service is rate-limited. Try again in a moment.");
		if (resp.status === 402) throw new Error("AI credits are exhausted.");
		throw new Error(`Transcription failed ${resp.status}: ${body || "unknown error"}`);
	}
	return { text: ((await resp.json())?.text ?? "").toString().trim() };
});
//#endregion
export { transcribeAudio_createServerFn_handler };
