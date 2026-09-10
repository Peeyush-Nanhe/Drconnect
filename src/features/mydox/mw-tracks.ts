/* Mental Wellness — track templates & screener instruments.
   Everything here is DATA. Adding a fifth condition should be a change to
   this file only, never to the components. */

export type MwRole = { role: string; label: string; desc: string };
export type MwTeamRole = MwRole & { required: boolean };

export type MwTrack = {
  id: string;
  program: string;
  label: string;
  emoji: string;
  blurb: string;
  accent: string;
  accentDeep: string;
  bg: string;
  depth: "deep" | "shell";
  instrument: "PHQ-9" | "GAD-7" | null;
  items: string[];
  anchorRole: string;
  modality: "either" | "conditional" | "in_person";
  modalityNote: string | null;
  inPersonAt?: number;
  discreet?: boolean;
  team: MwTeamRole[];
  note: string;
};

export const inr = (n: unknown) =>
  typeof n === "number" ? "₹" + n.toLocaleString("en-IN") : "—";

const ROLE: Record<string, MwRole> = {
  psychiatrist: { role: "psychiatrist", label: "Psychiatrist", desc: "Diagnosis, medication, risk review" },
  psychologist: { role: "clinical_psychologist", label: "Clinical Psychologist", desc: "CBT and talking therapy (RCI registered)" },
  coordinator: { role: "care_coordinator", label: "Care Coordinator", desc: "Your named contact — arranges the whole team" },
  physician: { role: "physician", label: "Physician", desc: "Rules out thyroid, B12, vitamin D, anaemia" },
  cardiologist: { role: "cardiologist", label: "Cardiologist", desc: "Rules out cardiac causes of palpitations and chest pain" },
  occupational: { role: "occupational_therapist", label: "Occupational Therapist", desc: "Daily activity, routine, return to work" },
  dietitian: { role: "dietitian", label: "Dietitian", desc: "Appetite, weight and metabolic support" },
  socialworker: { role: "psychiatric_social_worker", label: "Psychiatric Social Worker", desc: "Family support, benefits, community linkage" },
  nurse: { role: "psychiatric_nurse", label: "Psychiatric Nurse", desc: "Medication support and monitoring" },
  vocational: { role: "vocational_rehab", label: "Vocational Rehabilitation", desc: "Skills, job readiness, supported employment" },
  urologist: { role: "urologist", label: "Urologist", desc: "Physical assessment and treatment" },
  endocrinologist: { role: "endocrinologist", label: "Endocrinologist", desc: "Hormone and diabetes assessment" },
  dermatologist: { role: "dermatologist", label: "Dermatologist", desc: "Skin and related conditions" },
  gynaecologist: { role: "gynaecologist", label: "Gynaecologist", desc: "Women's health assessment" },
  pelvicphysio: { role: "pelvic_physiotherapist", label: "Pelvic Floor Physiotherapist", desc: "Pelvic floor assessment and therapy" },
  couples: { role: "couples_therapist", label: "Couples Therapy", desc: "Sessions together with your partner" },
};

const req = (r: MwRole): MwTeamRole => ({ ...r, required: true });
const opt = (r: MwRole): MwTeamRole => ({ ...r, required: false });

export const RESPONSES = [
  { v: 0, label: "Not at all" },
  { v: 1, label: "Several days" },
  { v: 2, label: "More than half the days" },
  { v: 3, label: "Nearly every day" },
];

export const PHQ9_ITEMS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself, or that you are a failure, or have let yourself or your family down",
  "Trouble concentrating on things, such as reading or watching television",
  "Moving or speaking so slowly that other people could have noticed — or being so restless that you have been moving around a lot more than usual",
  "Thoughts that you would be better off dead, or of hurting yourself in some way",
];

export const GAD7_ITEMS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid, as if something awful might happen",
];

/* Index of the item that must trigger an immediate safety response.
   PHQ-9 item 9 asks about thoughts of self-harm. Any answer above 0 stops
   the normal booking flow. */
export const PHQ9_SAFETY_ITEM = 8;

export function scoreBand(instrument: string | null, score: number) {
  if (instrument === "GAD-7") {
    if (score <= 4) return { band: "Minimal", tone: "#16A34A" };
    if (score <= 9) return { band: "Mild", tone: "#65A30D" };
    if (score <= 14) return { band: "Moderate", tone: "#D97706" };
    return { band: "Severe", tone: "#DC2626" };
  }
  if (score <= 4) return { band: "Minimal", tone: "#16A34A" };
  if (score <= 9) return { band: "Mild", tone: "#65A30D" };
  if (score <= 14) return { band: "Moderate", tone: "#D97706" };
  if (score <= 19) return { band: "Moderately severe", tone: "#EA580C" };
  return { band: "Severe", tone: "#DC2626" };
}

/* Under the Telemedicine Practice Guidelines 2020 and the Telepsychiatry
   Operational Guidelines, several medicines commonly needed in psychiatry
   cannot be prescribed online at all. Where a presentation is likely to need
   one, we route the first appointment to an in-person visit and say why. */
export function modalityFor(track: MwTrack, score: number) {
  if (track.modality === "in_person") return { mode: "in_person" as const, reason: track.modalityNote };
  if (track.modality === "conditional" && score >= (track.inPersonAt ?? 15)) {
    return { mode: "in_person" as const, reason: track.modalityNote };
  }
  return { mode: "either" as const, reason: null };
}

export const MW_TRACKS: MwTrack[] = [
  {
    id: "depression",
    program: "mw_depression",
    label: "Depression",
    emoji: "🌧️",
    blurb: "Low mood, loss of interest, fatigue, sleep and appetite changes",
    accent: "#4F46E5", accentDeep: "#3730A3", bg: "#EEF2FF",
    depth: "deep",
    instrument: "PHQ-9",
    items: PHQ9_ITEMS,
    anchorRole: "psychiatrist",
    modality: "either",
    modalityNote: null,
    team: [req(ROLE.psychiatrist), req(ROLE.psychologist), req(ROLE.coordinator), opt(ROLE.physician), opt(ROLE.occupational), opt(ROLE.dietitian)],
    note: "A physician review checks for thyroid, B12, vitamin D and anaemia, which can all mimic or worsen low mood.",
  },
  {
    id: "anxiety",
    program: "mw_anxiety",
    label: "Anxiety & Panic",
    emoji: "💭",
    blurb: "Constant worry, restlessness, panic attacks, palpitations",
    accent: "#0891B2", accentDeep: "#155E75", bg: "#ECFEFF",
    depth: "shell",
    instrument: "GAD-7",
    items: GAD7_ITEMS,
    anchorRole: "psychiatrist",
    modality: "conditional",
    inPersonAt: 15,
    modalityNote: "Some medicines used for severe anxiety cannot be prescribed online under Indian telemedicine rules, so your first appointment is in person.",
    team: [req(ROLE.psychiatrist), req(ROLE.psychologist), req(ROLE.coordinator), opt(ROLE.cardiologist), opt(ROLE.physician)],
    note: "Palpitations and chest pain are common in panic. A cardiology review rules out a heart cause first — we can do that in the same hospital.",
  },
  {
    id: "schizophrenia",
    program: "mw_schizophrenia",
    label: "Schizophrenia Care",
    emoji: "🧩",
    blurb: "Structured multidisciplinary programme across all phases of care",
    accent: "#7C3AED", accentDeep: "#5B21B6", bg: "#F5F3FF",
    depth: "shell",
    instrument: null,
    items: [],
    anchorRole: "psychiatrist",
    modality: "in_person",
    modalityNote: "This programme begins with an in-person psychiatric assessment.",
    team: [req(ROLE.psychiatrist), req(ROLE.psychologist), req(ROLE.socialworker), req(ROLE.nurse), req(ROLE.coordinator), opt(ROLE.occupational), opt(ROLE.vocational), opt(ROLE.physician), opt(ROLE.dietitian)],
    note: "Care runs in three phases — acute, continuation and maintenance — with the same team throughout.",
  },
  {
    id: "sexual_wellness",
    program: "mw_sexual_wellness",
    label: "Sexual Wellness",
    emoji: "🤍",
    blurb: "Confidential care for men and women, medical and psychological",
    accent: "#DB2777", accentDeep: "#9D174D", bg: "#FDF2F8",
    depth: "shell",
    instrument: null,
    items: [],
    anchorRole: "psychiatrist",
    modality: "in_person",
    modalityNote: "A physical assessment is usually needed, so the first appointment is in person.",
    discreet: true,
    team: [req(ROLE.psychiatrist), req(ROLE.psychologist), req(ROLE.coordinator), opt(ROLE.urologist), opt(ROLE.gynaecologist), opt(ROLE.endocrinologist), opt(ROLE.dermatologist), opt(ROLE.pelvicphysio), opt(ROLE.couples)],
    note: "Difficulty with erections can be an early sign of heart or circulation problems, so a cardiac risk check is part of a full assessment.",
  },
];

export const trackById = (id: string) => MW_TRACKS.find((t) => t.id === id) || null;

export const SLA = {
  firstContactHours: 4,
  fullAssemblyHours: 48,
  text: "Your coordinator will call within 4 working hours, and the rest of your team will be booked within 48 hours.",
};

export const URGENT_CONTACTS = [
  { label: "Tele-MANAS — national mental health helpline", value: "14416", note: "Free, 24×7, multiple languages" },
  { label: "KNCH emergency", value: "90-911-911-90", note: "Wakad, Pune" },
];
