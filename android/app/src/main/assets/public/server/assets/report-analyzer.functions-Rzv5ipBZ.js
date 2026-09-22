import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/report-analyzer.functions.ts?tss-serverfn-split
function parseReport(text) {
	const rows = [];
	const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	const re = /^([A-Za-z][A-Za-z0-9\s()/.-]+?)\s+([\d.]+)\s+([%A-Za-z/µ]+(?:\/[A-Za-z]+)?)\s+([\d.]+)\s*[-–]\s*([\d.]+)\s*$/;
	for (const line of lines) {
		const m = line.match(re);
		if (!m) continue;
		const value = Number(m[2]);
		const refLow = Number(m[4]);
		const refHigh = Number(m[5]);
		if (!Number.isFinite(value) || !Number.isFinite(refLow) || !Number.isFinite(refHigh)) continue;
		const span = Math.max(refHigh - refLow, 1e-4);
		let flag = "normal";
		if (value < refLow) flag = value < refLow - span * .5 ? "critical" : "low";
		else if (value > refHigh) flag = value > refHigh + span * .5 ? "critical" : "high";
		rows.push({
			analyte: m[1].trim(),
			value,
			unit: m[3].trim(),
			refLow,
			refHigh,
			flag
		});
	}
	return rows;
}
async function generateNarration(rows, key) {
	const abnormal = rows.filter((r) => r.flag !== "normal");
	if (rows.length === 0) return "No lab values could be extracted from this report. Please upload a clearer copy.";
	if (abnormal.length === 0) return "All extracted markers are within their normal reference ranges. Keep up your current lifestyle and follow up with your doctor as scheduled.";
	const bullet = rows.map((r) => `- ${r.analyte}: ${r.value} ${r.unit} (ref ${r.refLow}–${r.refHigh}) → ${r.flag}`).join("\n");
	const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${key}`
		},
		body: JSON.stringify({
			model: "openai/gpt-5.5",
			messages: [{
				role: "system",
				content: "You are a friendly health educator. Given a list of lab markers that have ALREADY been flagged, write 2-3 short sentences in plain language for the patient. Only reference the markers listed. Do NOT invent numbers or diagnoses. End with a gentle reminder to confirm with their doctor."
			}, {
				role: "user",
				content: `Markers:\n${bullet}`
			}]
		})
	});
	if (!resp.ok) return "AI narration unavailable right now. The flagged markers above still deserve a review with your doctor.";
	return ((await resp.json())?.choices?.[0]?.message?.content ?? "").toString().trim();
}
var analyzeReport_createServerFn_handler = createServerRpc({
	id: "f41b0a03ce48a925f5d8dd580f5dfb6f2a4d5efc2c522e7835d1f5fddb488aed",
	name: "analyzeReport",
	filename: "src/lib/report-analyzer.functions.ts"
}, (opts) => analyzeReport.__executeServer(opts));
var analyzeReport = createServerFn({ method: "POST" }).inputValidator((d) => {
	if (!d || typeof d.reportText !== "string" || !d.reportText.trim()) throw new Error("reportText required");
	return { reportText: d.reportText.slice(0, 2e4) };
}).handler(analyzeReport_createServerFn_handler, async ({ data }) => {
	const key = process.env.LOVABLE_API_KEY;
	if (!key) throw new Error("AI is not configured yet (missing LOVABLE_API_KEY).");
	const rows = parseReport(data.reportText);
	return {
		rows,
		narration: await generateNarration(rows, key)
	};
});
//#endregion
export { analyzeReport_createServerFn_handler };
