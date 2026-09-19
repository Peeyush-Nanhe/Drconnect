import type { EmergencyCategory } from "./types";

export interface TriageQuestion {
  q: string;
  opts: string[];
  /** Answers that should push the case to the front of a responder queue. */
  red?: string[];
}

export interface EmergencyCategoryDef {
  id: EmergencyCategory;
  label: string;
  emoji: string;
  /** Shown under the chosen category so the patient knows where they are going. */
  routing: string;
  team: string;
  triage: TriageQuestion[];
}

export const EMERGENCY_CATALOG: EmergencyCategoryDef[] = [
  {
    id: "cardiac",
    label: "Cardiac / Chest pain",
    emoji: "❤️",
    routing: "Will route to a cath-lab–ready hospital",
    team: "Cardiac team",
    triage: [
      { q: "When did the pain start?", opts: ["<30 min", "30–60 min", ">1 hour"], red: ["<30 min"] },
      { q: "Sweating or breathless?", opts: ["Yes", "No"], red: ["Yes"] },
    ],
  },
  {
    id: "stroke",
    label: "Brain / Stroke",
    emoji: "🧠",
    routing: "Will route to a stroke-ready hospital",
    team: "Neuro team",
    triage: [
      { q: "Face drooping on one side?", opts: ["Yes", "No"], red: ["Yes"] },
      { q: "Arm weakness or numbness?", opts: ["Yes", "No"], red: ["Yes"] },
      { q: "Speech slurred?", opts: ["Yes", "No"], red: ["Yes"] },
      { q: "When did it start?", opts: ["<1 hr", "1–3 hr", ">3 hr"], red: ["<1 hr"] },
    ],
  },
  {
    id: "trauma",
    label: "Ortho / Trauma",
    emoji: "🩸",
    routing: "Will route to a trauma centre with blood bank",
    team: "Trauma team",
    triage: [
      { q: "Heavy bleeding?", opts: ["Yes", "No"], red: ["Yes"] },
      { q: "Is the person conscious?", opts: ["Yes", "No"], red: ["No"] },
    ],
  },
  {
    id: "breathing",
    label: "Chest / Breathing",
    emoji: "🫁",
    routing: "Will route to a hospital with ICU beds",
    team: "Pulmonary team",
    triage: [
      { q: "Can they speak full sentences?", opts: ["Yes", "No"], red: ["No"] },
      { q: "Lips or face turning bluish?", opts: ["Yes", "No"], red: ["Yes"] },
    ],
  },
  {
    id: "pregnancy",
    label: "Pregnancy / Obstetrics",
    emoji: "🤰",
    routing: "Will route to an OB-ready hospital with neonatal cover",
    team: "OB & neonatal team",
    triage: [
      { q: "How many weeks pregnant?", opts: ["<28 wk", "28–36 wk", "37+ wk"], red: ["<28 wk"] },
      { q: "Main problem?", opts: ["Bleeding", "Contractions", "Less movement"], red: ["Bleeding"] },
    ],
  },
  {
    id: "other",
    label: "Something else",
    emoji: "🚑",
    routing: "Will route to the nearest equipped emergency room",
    team: "ER team",
    triage: [
      { q: "Is the person conscious?", opts: ["Yes", "No"], red: ["No"] },
      { q: "Is there heavy bleeding?", opts: ["Yes", "No"], red: ["Yes"] },
    ],
  },
];

export function categoryDef(id: string | null | undefined): EmergencyCategoryDef | null {
  return EMERGENCY_CATALOG.find((c) => c.id === id) ?? null;
}

/** True when any answer was flagged red, used to sort responder queues. */
export function hasRedFlag(
  category: string | null | undefined,
  answers: { q: string; a: string }[],
): boolean {
  const def = categoryDef(category);
  if (!def) return false;
  return def.triage.some((question) =>
    (question.red ?? []).some((flag) =>
      answers.some((answer) => answer.q === question.q && answer.a === flag),
    ),
  );
}
