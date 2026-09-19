import {
  Stethoscope,
  TestTube,
  House,
  HeartPulse,
  Hospital,
  HeartHandshake,
  Brain,
  Bone,
  Activity,
  Utensils,
  Sparkles,
  Scissors,
  Droplet,
  ScanLine,
  Pill,
  Syringe,
  Baby,
  Wind,
  ShieldCheck,
  Building2,
  Users,
  Ambulance,
  type LucideIcon,
} from "lucide-react";

export type PatientService = { id: string; label: string; icon: LucideIcon; detail?: string };
export type ServiceGroup = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  services: PatientService[];
};

export const TECH_IMG = "data:image/jpeg;base64,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";

export const HEALTH_CARE_SERVICES = [
  {
    id: "therapist",
    label: "Therapist",
    desc: "Physiotherapy & rehab",
    emoji: "🏃",
    bg: "#FCE7F3",
    borderColor: "#FBCFE8",
  },
  {
    id: "technician",
    label: "Technician",
    desc: "ECG, lab & home tech",
    image: TECH_IMG,
    bg: "#FFFFFF",
    borderColor: "#E2E8F0",
  },
  {
    id: "diet",
    label: "Dietitian",
    desc: "Nutrition & meal plans",
    emoji: "🥗",
    bg: "#DCFCE7",
    borderColor: "#BBF7D0",
  },
  {
    id: "prosthetics",
    label: "Prosthetists & Orthotists",
    desc: "Splints, braces & limbs",
    emoji: "🦿",
    bg: "#FEF9C3",
    borderColor: "#FEF08A",
  },
];


// Entry points only. Booking, consent and dispatch remain in the existing workflows.
export const PATIENT_SERVICE_GROUPS: ServiceGroup[] = [
  {
    id: "consultations",
    label: "Doctors & specialists",
    description: "Consultations, therapy & specialist care",
    icon: Stethoscope,
    services: [
      {
        id: "doctor",
        label: "Book a doctor",
        icon: Stethoscope,
        detail: "In person, video or a home visit",
      },
      { id: "therapist", label: "Therapist", icon: Activity },
      { id: "diet", label: "Dietitian", icon: Utensils },
      { id: "prosthetics", label: "Prosthetists & orthotists", icon: Bone },
      { id: "dental", label: "Dental care", icon: HeartPulse },
      { id: "derm", label: "Skin & hair", icon: Sparkles },
      { id: "plastic", label: "Plastic surgery", icon: Scissors },
      { id: "vasc", label: "Vascular surgery", icon: Activity },
      { id: "secondOpinion", label: "Second opinion", icon: Users },
    ],
  },
  {
    id: "diagnostics",
    label: "Tests & scans",
    description: "Lab tests, imaging & technicians",
    icon: TestTube,
    services: [
      {
        id: "labtest",
        label: "Lab tests",
        icon: TestTube,
        detail: "Home collection or a nearby lab",
      },
      { id: "scan", label: "Scans · CT / MRI", icon: ScanLine },
      { id: "technician", label: "Technician", icon: Activity },
      { id: "allergy", label: "BreatheFree allergy clinics", icon: Wind },
    ],
  },
  {
    id: "homecare",
    label: "Care at home",
    description: "Nursing, medicines & everyday support",
    icon: House,
    services: [
      { id: "nurse", label: "Home nurse", icon: Syringe },
      { id: "care", label: "Home care physician", icon: Stethoscope },
      { id: "physio", label: "Home physiotherapy", icon: Activity },
      { id: "medicines", label: "Medicine delivery", icon: Pill },
      { id: "homePackage", label: "Home care package", icon: House },
      { id: "family", label: "Family physician plan", icon: Users },
    ],
  },
  {
    id: "programs",
    label: "Care programs",
    description: "Ongoing support for every stage of life",
    icon: HeartPulse,
    services: [
      { id: "assistive", label: "Assistive living care", icon: HeartHandshake },
      { id: "rehab", label: "De-addiction & rehab", icon: HeartPulse },
      { id: "fertility", label: "IVF & fertility", icon: Baby },
      { id: "weight", label: "Weight management", icon: Utensils },
      { id: "specialneeds", label: "Special needs child care", icon: HeartHandshake },
      { id: "dialysis", label: "Dialysis centre", icon: Droplet },
      { id: "medical_tourism", label: "Medical tourism", icon: Hospital },
      { id: "mental", label: "Mental wellness", icon: Brain },
    ],
  },
  {
    id: "hospitals",
    label: "Hospitals & urgent care",
    description: "Admission, procedures & emergency support",
    icon: Hospital,
    services: [
      { id: "admit", label: "Hospital admission", icon: Hospital },
      { id: "surgery", label: "Surgery & procedures", icon: Scissors },
      { id: "emergency", label: "Emergency care", icon: HeartPulse },
      { id: "sos", label: "Ambulance · SOS", icon: Ambulance },
      { id: "bloodbank", label: "Blood bank & donation", icon: Droplet },
    ],
  },
  {
    id: "community",
    label: "Community & benefits",
    description: "Care for your family, workplace & community",
    icon: HeartHandshake,
    services: [
      { id: "seva", label: "Seva · free treatment", icon: HeartHandshake },
      { id: "society", label: "Society Shield", icon: ShieldCheck },
      { id: "insurance", label: "Insurance benefit", icon: ShieldCheck },
      { id: "corporate", label: "Corporate health", icon: Building2 },
    ],
  },
];
