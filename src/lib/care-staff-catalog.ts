/**
 * Shared option catalogues for the nurse, physiotherapist and technician
 * portals. Client-safe: plain data only, no server imports.
 */

export type Option = { value: string; label: string; group?: string };

/* ------------------------------ nurse ------------------------------ */

export const NURSE_SKILLS: Option[] = [
  { value: "general_ward", label: "General ward", group: "Ward & bedside" },
  { value: "private_room", label: "Private room / deluxe", group: "Ward & bedside" },
  { value: "post_surgical", label: "Post-surgical care", group: "Ward & bedside" },
  { value: "wound_care", label: "Wound & dressing care", group: "Ward & bedside" },
  { value: "stoma_care", label: "Stoma / colostomy care", group: "Ward & bedside" },
  { value: "catheter_care", label: "Catheterisation", group: "Ward & bedside" },
  { value: "ryles_tube", label: "Ryle's tube feeding", group: "Ward & bedside" },
  { value: "injection_iv", label: "IV / injections & cannula", group: "Ward & bedside" },

  { value: "icu", label: "ICU", group: "Critical care" },
  { value: "hdu", label: "HDU / step-down", group: "Critical care" },
  { value: "ccu", label: "Cardiac CCU", group: "Critical care" },
  { value: "ventilator", label: "Ventilator handling", group: "Critical care" },
  { value: "tracheostomy", label: "Tracheostomy care", group: "Critical care" },
  { value: "emergency_casualty", label: "Emergency / casualty", group: "Critical care" },
  { value: "dialysis", label: "Dialysis unit", group: "Critical care" },

  { value: "ot_scrub", label: "OT scrub nurse", group: "Operation theatre" },
  { value: "ot_circulating", label: "OT circulating nurse", group: "Operation theatre" },
  { value: "anaesthesia_assist", label: "Anaesthesia assistant", group: "Operation theatre" },
  { value: "cssd", label: "CSSD / sterilisation", group: "Operation theatre" },

  { value: "maternity", label: "Maternity ward", group: "Mother & child" },
  { value: "labour_room", label: "Labour room", group: "Mother & child" },
  { value: "neonatal_nicu", label: "Neonatal / NICU", group: "Mother & child" },
  { value: "paediatric", label: "Paediatric / PICU", group: "Mother & child" },
  { value: "lactation", label: "Lactation support", group: "Mother & child" },

  { value: "home_attendant", label: "Home nursing attendant", group: "Home care" },
  { value: "elderly_bedridden", label: "Elderly / bedridden care", group: "Home care" },
  { value: "palliative", label: "Palliative & hospice", group: "Home care" },
  { value: "physio_assist", label: "Physio & mobility assist", group: "Home care" },
  { value: "vaccination", label: "Vaccination & sample draw", group: "Home care" },
  { value: "oncology_chemo", label: "Oncology / chemo support", group: "Home care" },
];

export const NURSE_SKILL_LABEL: Record<string, string> = Object.fromEntries(
  NURSE_SKILLS.map((s) => [s.value, s.label]),
);

export const NURSE_SKILL_GROUPS = Array.from(new Set(NURSE_SKILLS.map((s) => s.group ?? "Other")));

export const NURSE_QUALIFICATIONS: Option[] = [
  { value: "anm", label: "ANM" },
  { value: "gnm", label: "GNM" },
  { value: "bsc_nursing", label: "B.Sc Nursing" },
  { value: "post_bsc", label: "Post-basic B.Sc Nursing" },
  { value: "msc_nursing", label: "M.Sc Nursing" },
  { value: "nurse_practitioner", label: "Nurse practitioner (critical care)" },
  { value: "attendant", label: "Trained care attendant" },
];

export const SHIFT_PREFS: Option[] = [
  { value: "day_8h", label: "Day shift (8h)" },
  { value: "night_8h", label: "Night shift (8h)" },
  { value: "day_12h", label: "Day (12h)" },
  { value: "night_12h", label: "Night (12h)" },
  { value: "live_in_24h", label: "24h / live-in" },
  { value: "weekend", label: "Weekends only" },
  { value: "on_call", label: "On-call / emergency" },
];

export const SHIFT_LABEL: Record<string, string> = Object.fromEntries(SHIFT_PREFS.map((s) => [s.value, s.label]));

/* ---------------------------- technician ---------------------------- */

export const TECHNICIAN_TESTS: Option[] = [
  { value: "emg", label: "EMG", group: "Neurophysiology" },
  { value: "nerve_conduction", label: "NCS (nerve conduction)", group: "Neurophysiology" },
  { value: "eeg", label: "EEG", group: "Neurophysiology" },
  { value: "vep", label: "VEP (visual evoked potential)", group: "Neurophysiology" },
  { value: "ssep", label: "SSEP", group: "Neurophysiology" },
  { value: "bera", label: "BERA / ABR", group: "Neurophysiology" },
  { value: "assr", label: "ASSR", group: "Neurophysiology" },
  { value: "rns", label: "Repetitive nerve stimulation", group: "Neurophysiology" },

  { value: "audiometry", label: "Pure tone audiometry", group: "ENT & balance" },
  { value: "tympanometry", label: "Impedance / tympanometry", group: "ENT & balance" },
  { value: "oae", label: "OAE screening", group: "ENT & balance" },
  { value: "vng", label: "VNG (vertigo & balance)", group: "ENT & balance" },
  { value: "eng", label: "ENG", group: "ENT & balance" },
  { value: "speech_audiometry", label: "Speech audiometry", group: "ENT & balance" },

  { value: "ecg", label: "ECG (12-lead)", group: "Cardio-respiratory" },
  { value: "holter", label: "Holter monitoring", group: "Cardio-respiratory" },
  { value: "tmt", label: "TMT / stress test", group: "Cardio-respiratory" },
  { value: "abpm", label: "24h BP monitoring", group: "Cardio-respiratory" },
  { value: "echo_assist", label: "Echo assistance", group: "Cardio-respiratory" },
  { value: "spirometry", label: "Spirometry / PFT", group: "Cardio-respiratory" },
  { value: "sleep_study", label: "Sleep study (PSG)", group: "Cardio-respiratory" },

  { value: "xray", label: "X-ray (portable)", group: "Imaging & sampling" },
  { value: "usg_assist", label: "USG / Doppler assist", group: "Imaging & sampling" },
  { value: "phlebotomy", label: "Blood sample collection", group: "Imaging & sampling" },
  { value: "ot_assist", label: "Operation theatre assist", group: "Imaging & sampling" },
  { value: "other", label: "Other test", group: "Imaging & sampling" },
];

export const TECHNICIAN_TEST_LABEL: Record<string, string> = Object.fromEntries(
  TECHNICIAN_TESTS.map((t) => [t.value, t.label]),
);

export const TECHNICIAN_TEST_GROUPS = Array.from(new Set(TECHNICIAN_TESTS.map((t) => t.group ?? "Other")));

/** Tests that need a machine carried from a tie-up hub when done outside one. */
export const MACHINE_TESTS = new Set([
  "emg",
  "nerve_conduction",
  "eeg",
  "vep",
  "ssep",
  "bera",
  "assr",
  "rns",
  "vng",
  "eng",
  "audiometry",
  "tympanometry",
  "oae",
  "holter",
  "abpm",
  "spirometry",
  "sleep_study",
  "xray",
  "ecg",
]);

export const TECHNICIAN_QUALIFICATIONS: Option[] = [
  { value: "dmlt", label: "DMLT" },
  { value: "bmlt", label: "BMLT" },
  { value: "neurotech_diploma", label: "Diploma in neurotechnology" },
  { value: "cardiac_tech", label: "Cardiac care technology" },
  { value: "radiography", label: "Radiography / X-ray technician" },
  { value: "audiology", label: "Audiology technician" },
  { value: "ot_technician", label: "OT technician" },
  { value: "other", label: "Other" },
];

/* --------------------------- physiotherapy --------------------------- */

export const PHYSIO_SPECIALIZATIONS: Option[] = [
  { value: "neuro", label: "Neuro physiotherapy" },
  { value: "orthopaedic", label: "Orthopaedic therapy" },
  { value: "sports", label: "Sports injury rehab" },
  { value: "paediatric", label: "Paediatric therapy" },
  { value: "geriatric", label: "Geriatric therapy" },
  { value: "cardio_respiratory", label: "Cardio-respiratory" },
  { value: "post_surgical", label: "Post-surgical rehab" },
  { value: "pelvic_floor", label: "Pelvic floor" },
  { value: "general", label: "General physiotherapy" },
];

export const PHYSIO_QUALIFICATIONS: Option[] = [
  { value: "bpt", label: "BPT" },
  { value: "mpt", label: "MPT" },
  { value: "mpt_neuro", label: "MPT (Neuro)" },
  { value: "mpt_ortho", label: "MPT (Ortho)" },
  { value: "mpt_sports", label: "MPT (Sports)" },
  { value: "dpt", label: "DPT" },
];

export const LANGUAGES: Option[] = [
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "marathi", label: "Marathi" },
  { value: "gujarati", label: "Gujarati" },
  { value: "tamil", label: "Tamil" },
  { value: "telugu", label: "Telugu" },
  { value: "kannada", label: "Kannada" },
  { value: "bengali", label: "Bengali" },
];

export const PUNE_AREAS = [
  "Koregaon Park",
  "Kalyani Nagar",
  "Viman Nagar",
  "Kharadi",
  "Baner",
  "Aundh",
  "Kothrud",
  "Deccan",
  "FC Road",
  "Camp",
  "Hadapsar",
  "Wanowrie",
  "Pimpri",
  "Chinchwad",
  "Wakad",
  "Hinjewadi",
  "Katraj",
  "Warje",
];

export const labelFrom = (opts: Option[], value: string) =>
  opts.find((o) => o.value === value)?.label ?? value;
