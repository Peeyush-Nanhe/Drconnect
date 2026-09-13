export const EMERGENCY_CATEGORIES = [
  "cardiac", "stroke", "trauma", "breathing", "pregnancy", "other",
] as const;
export type EmergencyCategory = (typeof EMERGENCY_CATEGORIES)[number];

export const EMERGENCY_STATUSES = [
  "searching", "hospital_assigned", "ambulance_en_route", "ambulance_arrived",
  "transporting", "handed_over", "admitted", "cancelled", "closed",
] as const;
export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

export type ResponderRole = "hospital" | "doctor" | "ambulance";

export interface TriageAnswer { q: string; a: string }

export type TransportMode = "ambulance" | "self";

/** How much we trust the pickup pin. "needs_location" holds matching entirely. */
export type LocationStatus = "gps" | "verified" | "needs_location";

/**
 * Everything the crew, hospital and specialist need. Name, phone, emergency
 * contacts and the medical summary are snapshotted from the profile when the
 * case opens, so the emergency screen never asks the patient to type them.
 */
export interface EmergencyCase {
  id: string;
  patient_id: string;
  /** Client-generated per attempt, so a retry cannot open a second case. */
  request_key: string;
  category: EmergencyCategory;
  triage: TriageAnswer[];
  /** "self" means the family drives. Bed and specialist are still booked. */
  transport_mode: TransportMode;

  patient_name: string | null;
  patient_phone: string | null;
  contact_1_name: string | null;
  contact_1_phone: string | null;
  contact_2_name: string | null;
  contact_2_phone: string | null;
  blood_group: string | null;
  allergies: string[];
  conditions: string[];
  medications: string[];

  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_accuracy_m: number | null;
  pickup_captured_at: string | null;
  location_status: LocationStatus;
  /** True when a human needs to act: no pin, or no number to call back. */
  needs_attention: boolean;
  version: number;
  handed_over_at: string | null;

  status: EmergencyStatus;

  search_radius_km: number;
  max_radius_km: number;
  radius_expanded_at: string;

  ambulance_id: string | null;
  ambulance_accepted_at: string | null;
  ambulance_arrived_at: string | null;
  ambulance_eta_seconds: number | null;

  hospital_id: string | null;
  hospital_accepted_by: string | null;
  hospital_accepted_at: string | null;
  bed_label: string | null;

  doctor_id: string | null;
  doctor_accepted_at: string | null;
  doctor_wave: number;
  doctor_wave_at: string | null;

  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface AmbulancePing {
  id: number;
  case_id: string;
  provider_id: string;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  heading_deg: number | null;
  speed_kph: number | null;
  eta_seconds: number | null;
  captured_at: string;
  received_at: string;
}

export const OPEN_STATUSES: EmergencyStatus[] = [
  "searching", "hospital_assigned", "ambulance_en_route", "ambulance_arrived",
  "transporting", "handed_over",
];

export function isOpenCase(c: EmergencyCase | null | undefined): c is EmergencyCase {
  return !!c && OPEN_STATUSES.includes(c.status);
}

/** Reads the way a frightened person reads, not the way the column is named. */
export function statusHeadline(c: EmergencyCase | null | undefined): string {
  if (!c) return "No emergency raised";
  switch (c.status) {
    case "handed_over": return "Handed over to the hospital team";
    case "searching":
      if (c.location_status === "needs_location") return "Waiting for your location";
      return c.transport_mode === "self"
        ? "Finding a hospital that can take you now"
        : "Alerting ambulances and hospitals near you";
    case "hospital_assigned": return "Hospital ready · drive there now";
    case "ambulance_en_route": return "Ambulance on the way to you";
    case "ambulance_arrived": return "Ambulance has reached you";
    case "transporting": return "On the way to the hospital";
    case "admitted": return "Admitted at the hospital";
    case "cancelled": return "Emergency cancelled";
    case "closed": return "Emergency closed";
  }
}

/** "6 min" reads better than "352 seconds" when someone is frightened. */
export function etaLabel(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes === 1 ? "about 1 min away" : `about ${minutes} min away`;
}

export function emergencyContacts(c: EmergencyCase) {
  return [
    { name: c.contact_1_name, phone: c.contact_1_phone },
    { name: c.contact_2_name, phone: c.contact_2_phone },
  ].filter((entry): entry is { name: string | null; phone: string } => !!entry.phone);
}
