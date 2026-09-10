export const QUALIFICATIONS = [
  { id: "mbbs", label: "MBBS", tier: 3 },
  { id: "bams", label: "BAMS", tier: 2 },
  { id: "bhms", label: "BHMS", tier: 2 },
  { id: "bums", label: "BUMS", tier: 2 },
  { id: "bds", label: "BDS", tier: 2 },
  { id: "md", label: "MD / MS", tier: 4 },
  { id: "dnb", label: "DNB", tier: 4 },
];

export const PROCEDURES = [
  { id: "iv", label: "IV cannulation", emoji: "💉", gated: false },
  { id: "catheter", label: "Catheterisation", emoji: "🩺", gated: false },
  { id: "nasogastric", label: "Ryle's tube", emoji: "🧪", gated: false },
  { id: "suturing", label: "Suturing", emoji: "🪡", gated: false },
  { id: "abg", label: "ABG sampling", emoji: "🩸", gated: false },
  { id: "intubation", label: "Intubation", emoji: "🫁", gated: true },
  { id: "centralline", label: "Central line", emoji: "⚕️", gated: true },
  { id: "ventilator", label: "Ventilator management", emoji: "🖥️", gated: true },
  { id: "acls", label: "ACLS / Code blue", emoji: "⚡", gated: true },
  { id: "lp", label: "Lumbar puncture", emoji: "💫", gated: true },
];

export const AGE_GROUPS = [
  { id: "adult", label: "Adult", emoji: "🧑" },
  { id: "paediatric", label: "Paediatric", emoji: "🧒" },
  { id: "neonatal", label: "Neonatal", emoji: "👶" },
  { id: "geriatric", label: "Geriatric", emoji: "🧓" },
];

export const SPECIALTIES = [
  { id: "cardiology", label: "Cardiology", emoji: "❤️" },
  { id: "pulmonology", label: "Pulmonology", emoji: "🫁" },
  { id: "neurology", label: "Neurology", emoji: "🧠" },
  { id: "nephrology", label: "Nephrology", emoji: "💧" },
  { id: "gynae", label: "Gynaecology", emoji: "🤰" },
  { id: "ortho", label: "Orthopaedics", emoji: "🦴" },
  { id: "gastro", label: "Gastroenterology", emoji: "🩺" },
  { id: "general", label: "General medicine", emoji: "➕" },
];

export const DUTY_TYPES = [
  { id: "homecare", label: "Home care", emoji: "🏠", color: "#0D9668" },
  { id: "ward", label: "Ward duty", emoji: "🛏️", color: "#2563EB" },
  { id: "icu", label: "ICU duty", emoji: "🫀", color: "#DC2626", requiresGated: true },
  { id: "cardiac_icu", label: "Cardiac ICU", emoji: "❤️", color: "#BE123C", requiresGated: true },
  { id: "nicu", label: "NICU", emoji: "🍼", color: "#7C3AED", requiresGated: true },
  { id: "special", label: "Specialty duty", emoji: "⭐", color: "#7C3AED" },
  { id: "emergency", label: "Casualty / ER", emoji: "🚨", color: "#EA580C" },
];

export const AREAS = [
  { id: "wakad", label: "Wakad", hospitals: ["Kush Neuro Cardiac Hospital", "Sahyadri Hospital, Wakad", "Surya Mother & Child"] },
  { id: "pimpri", label: "Pimpri", hospitals: ["DPU Private Super Speciality", "Yashwantrao Chavan Memorial", "Lokmanya Hospital, Pimpri"] },
  { id: "chinchwad", label: "Chinchwad", hospitals: ["Aditya Birla Memorial", "Lokmanya Hospital, Chinchwad", "Sterling Multispeciality"] },
  { id: "bhosari", label: "Bhosari", hospitals: ["Bhosari Multispeciality", "MITR Hospital"] },
  { id: "aundh", label: "Aundh / Baner", hospitals: ["Aundh Institute of Medical Sciences", "Jupiter Hospital, Baner"] },
  { id: "hinjewadi", label: "Hinjewadi", hospitals: ["Ruby Hall Clinic, Hinjewadi", "Life Point Multispeciality"] },
];

export const SHIFT_PRESETS = [
  { id: "morning", label: "Morning", sub: "8 am – 2 pm", start: 8, end: 14 },
  { id: "evening", label: "Evening", sub: "2 pm – 8 pm", start: 14, end: 20 },
  { id: "night", label: "Night", sub: "8 pm – 8 am", start: 20, end: 32 },
  { id: "full_day", label: "12 hours", sub: "8 am – 8 pm", start: 8, end: 20 },
  { id: "24h", label: "24 hours", sub: "8 am – 8 am", start: 8, end: 32 },
];

export const DEFAULT_FEES = {
  homecare: 1200,
  ward: 4000,
  icu: 6500,
  cardiac_icu: 7500,
  nicu: 7000,
  special: 6000,
  emergency: 5500,
};

export const GATED_PROCEDURE_IDS = PROCEDURES.filter((p) => p.gated).map((p) => p.id);

export function dutyMeta(id) {
  return DUTY_TYPES.find((d) => d.id === id) || { id, label: id || "Duty", emoji: "🩺", color: "#64748B" };
}

export function procedureMeta(id) {
  return PROCEDURES.find((p) => p.id === id) || { id, label: id, emoji: "🩺", gated: false };
}

export function areaMeta(id) {
  return AREAS.find((a) => a.id === id) || { id, label: id || "", hospitals: [] };
}

export function normalizeArea(value) {
  if (!value) return "";
  const lower = String(value).trim().toLowerCase();
  const byId = AREAS.find((a) => a.id === lower);
  if (byId) return byId.id;
  const byLabel = AREAS.find((a) => a.label.toLowerCase() === lower);
  return byLabel?.id || lower.replace(/\s+/g, "_");
}

export function qualificationMatches(profileQualification, requestedQualification) {
  const have = String(profileQualification || "").toLowerCase();
  const need = String(requestedQualification || "").toLowerCase();
  if (!need) return true;
  if (have === need) return true;
  // An MD/MS or DNB physician necessarily satisfies an MBBS-level staffing requirement.
  if (need === "mbbs" && ["md", "dnb"].includes(have)) return true;
  // MD/MS and DNB are both postgraduate physician pathways for matching purposes;
  // the specialty field still controls specialty-specific suitability.
  if (["md", "dnb"].includes(need) && ["md", "dnb"].includes(have)) return true;
  return false;
}

export function fitScore(profile, job) {
  if (!profile || !job) return { score: 0, reasons: [], blocked: false };
  let score = 0;
  const reasons = [];

  if (!qualificationMatches(profile.qualification, job.qualification)) {
    return { score: 0, reasons: ["Required qualification not met"], blocked: true };
  }
  if (job.qualification) {
    score += 10;
    reasons.push("Qualification match");
  }
  const requiredExperience = Number(job.experience_years || 0);
  const physicianExperience = Number(profile.experience_years || 0);
  if (physicianExperience < requiredExperience) {
    return { score: 0, reasons: [`${requiredExperience}+ years experience required`], blocked: true };
  }
  if (requiredExperience > 0) {
    score += 5;
    reasons.push("Experience match");
  }

  const procedures = profile.procedures || [];
  const required = job.required_procedures || [];
  const covered = required.filter((id) => procedures.includes(id));
  if (required.length) {
    const ratio = covered.length / required.length;
    score += ratio * 40;
    if (ratio === 1) reasons.push("All required procedures");
    else if (ratio > 0) reasons.push(`${covered.length}/${required.length} procedures`);
  } else {
    score += 25;
  }

  const duty = dutyMeta(job.duty_type);
  const gated = duty.requiresGated || required.some((id) => GATED_PROCEDURE_IDS.includes(id));
  if (gated && !profile.registration_verified) {
    return { score: 0, reasons: ["Registration verification pending"], blocked: true };
  }
  if (gated && !procedures.some((id) => GATED_PROCEDURE_IDS.includes(id))) {
    return { score: 0, reasons: ["Critical-care procedure credential required"], blocked: true };
  }
  if (required.some((id) => !procedures.includes(id))) {
    return { score: Math.round(score), reasons: [...reasons, "Missing required procedure"], blocked: true };
  }

  const specialty = String(job.specialty || "").toLowerCase();
  if ((profile.specialty_interests || []).some((id) => specialty.includes(id))) {
    score += 20;
    reasons.push("Specialty interest match");
  }
  const jobArea = normalizeArea(job.area);
  if (jobArea && (profile.preferred_areas || []).includes(jobArea)) {
    score += 10;
    reasons.push("Preferred area");
  }
  const hospital = job.facility_name || job.hospital || "";
  if (hospital && (profile.preferred_hospitals || []).includes(hospital)) {
    score += 15;
    reasons.push("Prefers this hospital");
  }
  if ((profile.duty_types || []).includes(job.duty_type)) {
    score += 10;
    reasons.push("Preferred duty type");
  }
  if (profile.registration_verified) reasons.push("Verified");
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons, blocked: false };
}

export function toggleArray(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
