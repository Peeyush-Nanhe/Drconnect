import { createServerFn } from "@tanstack/react-start";

type Msg = { role: "user" | "assistant"; content: string };

const TRIAGE_PROMPT = [
  "You are Dr. MedAI, a warm AI triage assistant for MyDox, Pune, India.",
  "Listen to the patient, ask at most ONE clarifying question, then recommend the right specialist.",
  "",
  "IDs - DOCTORS: gp=General Physician, pedia=Child Specialist, gyne=Womens Health, derm=Skin and Hair,",
  "ortho=Bones and Joints, obgyn=Obstetrician Pregnancy, gastro=Digestive Issues, eye=Eye Specialist,",
  "ent=Ear Nose Throat, dental=Dental Care, cardio=Heart, psych=Mental Wellness,",
  "neuro=Brain and Nerves, pulm=Lungs and Breathing, homeo=Homeopathy, emerg=Emergency Doctor,",
  "endo=Diabetes and Hormones, urol=Sexual Health, nephro=Kidney Issues, surgery=General Surgery,",
  "patho=Pathologist Tests, radio=Radiologist Scans, rheum=Rheumatologist, plastic=Plastic Surgeon,",
  "geriatric=Geriatrician Elderly, anesth=Anesthesiologist, onco=Oncologist Cancer",
  "THERAPISTS: physio=Physiotherapist, speech=Speech Therapist, psycho=Psychotherapist,",
  "occup=Occupational Therapist, resp=Respiratory Therapist",
  "",
  "Rules: 2-4 sentence replies. Warm, plain language. Indian context (BP, diabetes, back pain common).",
  "Give recommendation after patient describes symptoms. End reply with this tag on its own line:",
  '<rec>{"id":"cardio","name":"Cardiologist","type":"doctor","reason":"Chest pain and breathlessness suggest a cardiac evaluation."}</rec>',
  "This is a suggestion, not a diagnosis.",
  "RED FLAGS: if symptoms suggest emergency (chest pain with sweating, breathlessness, stroke signs, severe bleeding, unconsciousness), add urgent:true in the rec JSON and tell the patient to book EMERGENCY or tap SOS immediately.",
].join("\n");

export const askTriage = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Msg[] }) => {
    if (!d || !Array.isArray(d.messages)) throw new Error("messages required");
    const clean: Msg[] = d.messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
      .slice(-40);
    return { messages: clean };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured yet (missing LOVABLE_API_KEY).");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [{ role: "system", content: TRIAGE_PROMPT }, ...data.messages],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("The AI is rate-limited right now. Please try again in a moment.");
      if (resp.status === 402) throw new Error("AI credits are exhausted. Please add credits to keep chatting.");
      throw new Error(`AI gateway ${resp.status}: ${body || "unknown error"}`);
    }

    const json = await resp.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    return { text };
  });
