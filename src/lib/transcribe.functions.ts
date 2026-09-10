import { createServerFn } from "@tanstack/react-start";

// Uses Lovable AI Gateway speech-to-text. Browser MediaRecorder produces webm/mp4
// (opus/aac). We forward it as an OpenAI-compatible multipart request.
export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((d: { audioBase64: string; mimeType?: string }) => {
    if (!d || typeof d.audioBase64 !== "string" || !d.audioBase64) {
      throw new Error("audioBase64 required");
    }
    // Guard runaway payloads (~10 MB of base64 ≈ 7.5 MB of audio).
    if (d.audioBase64.length > 14_000_000) throw new Error("Audio too long — please record a shorter clip.");
    return { audioBase64: d.audioBase64, mimeType: d.mimeType || "audio/webm" };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured yet (missing LOVABLE_API_KEY).");

    const bin = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const ext = (data.mimeType.split("/")[1] || "webm").split(";")[0];
    const filename = `voice.${ext}`;
    const blob = new Blob([bin], { type: data.mimeType });

    const form = new FormData();
    form.append("file", blob, filename);
    form.append("model", "openai/gpt-4o-transcribe");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("Voice service is rate-limited. Try again in a moment.");
      if (resp.status === 402) throw new Error("AI credits are exhausted.");
      throw new Error(`Transcription failed ${resp.status}: ${body || "unknown error"}`);
    }
    const json = await resp.json();
    const text: string = (json?.text ?? "").toString().trim();
    return { text };
  });
