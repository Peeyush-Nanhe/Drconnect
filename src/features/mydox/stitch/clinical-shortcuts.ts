import {
  Activity,
  House,
  ScanLine,
  Scissors,
  Stethoscope,
  Syringe,
  TestTube,
  Utensils,
} from "lucide-react";

// Shared presentation and existing service identifiers for the approved theme.
export const clinicalShortcuts = [
  {
    id: "doctor",
    label: "Doctor consult",
    detail: "Clinic / video",
    icon: Stethoscope,
    tone: "blue",
  },
  { id: "nurse", label: "Home nurse", detail: "Nursing care", icon: Syringe, tone: "mint" },
  { id: "care", label: "Doctor visit", detail: "At your home", icon: House, tone: "blue" },
  { id: "labtest", label: "Lab tests", detail: "Sample pickup", icon: TestTube, tone: "blue" },
  { id: "scan", label: "Scans & MRI", detail: "CT / imaging", icon: ScanLine, tone: "lavender" },
  { id: "diet", label: "Dietitian", detail: "Nutrition care", icon: Utensils, tone: "mint" },
  { id: "technician", label: "Home tech", detail: "ECG & more", icon: Activity, tone: "blue" },
  { id: "surgery", label: "Surgeries", detail: "Plan your care", icon: Scissors, tone: "lavender" },
];
