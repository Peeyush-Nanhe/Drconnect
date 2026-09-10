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
