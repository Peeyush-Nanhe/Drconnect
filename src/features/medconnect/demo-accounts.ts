import { supabase } from "@/integrations/supabase/client";

export type DemoAccount = {
  label: string;
  email: string;
  password: string;
  name: string;
  role: string;
  view: string;
  group: string;
  specialty?: string;
};

const PW = "CareDemo!2026";

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: "Patient 1", email: "patient1@demo.med", password: PW, name: "Priya Sharma", role: "patient", view: "patient", group: "Patients" },
  { label: "Patient 2", email: "patient2@demo.med", password: PW, name: "Rahul Verma", role: "patient", view: "patient", group: "Patients" },
  { label: "Medico 1", email: "medico1@demo.med", password: PW, name: "Dr. Anita Rao", role: "provider", view: "medico", group: "Doctors & care teams", specialty: "Cardiology" },
  { label: "Medico 2", email: "medico2@demo.med", password: PW, name: "Dr. Vikram Iyer", role: "provider", view: "medico", group: "Doctors & care teams", specialty: "Neurology" },
  { label: "Dr. Rahul Nair", email: "rahul.nair@demo.med", password: PW, name: "Dr. Rahul Nair", role: "provider", view: "medico", group: "Doctors & care teams", specialty: "General Physician" },
  { label: "Care Physician", email: "carephysician@demo.med", password: PW, name: "Dr. Suresh Menon", role: "provider", view: "care_physician", group: "Doctors & care teams", specialty: "General Physician" },
  { label: "Coordinator", email: "coordinator@demo.med", password: PW, name: "Care Coordinator Meera", role: "provider", view: "coordinator", group: "Doctors & care teams" },
  { label: "Seva 1", email: "seva1@demo.med", password: PW, name: "Seva Care Team Alpha", role: "provider", view: "seva", group: "Doctors & care teams" },
  { label: "Seva 2", email: "seva2@demo.med", password: PW, name: "Seva Care Team Beta", role: "provider", view: "seva", group: "Doctors & care teams" },
  { label: "Hub 1", email: "hub1@demo.med", password: PW, name: "Koregaon Park Hub", role: "facility", view: "hub", group: "Hospitals & centres" },
  { label: "Hub 2", email: "hub2@demo.med", password: PW, name: "Santacruz Hub", role: "facility", view: "hub", group: "Hospitals & centres" },
  { label: "Scan 1", email: "scan1@demo.med", password: PW, name: "CityScan Diagnostics Deccan", role: "facility", view: "diagnostic", group: "Hospitals & centres" },
  { label: "Scan 2", email: "scan2@demo.med", password: PW, name: "Metro Imaging Baner", role: "facility", view: "diagnostic", group: "Hospitals & centres" },
  { label: "Labs 1", email: "labs1@demo.med", password: PW, name: "Precision Labs Kothrud", role: "facility", view: "labs", group: "Hospitals & centres" },
  { label: "Labs 2", email: "labs2@demo.med", password: PW, name: "TruePath Labs Viman Nagar", role: "facility", view: "labs", group: "Hospitals & centres" },
  { label: "Pharmacy 1", email: "pharmacy1@demo.med", password: PW, name: "Wellness Pharmacy FC Road", role: "facility", view: "pharmacy", group: "Hospitals & centres" },
  { label: "Pharmacy 2", email: "pharmacy2@demo.med", password: PW, name: "CarePlus Chemist Aundh", role: "facility", view: "pharmacy", group: "Hospitals & centres" },
  { label: "Physiotherapist", email: "physio1@demo.med", password: PW, name: "Dr. Kavita Deshmukh", role: "provider", view: "physio_staff", group: "Nurses, physios & technicians", specialty: "Physiotherapy" },
  { label: "Nurse", email: "nurse1@demo.med", password: PW, name: "Sister Asha Pawar", role: "provider", view: "nurse", group: "Nurses, physios & technicians", specialty: "Nurse" },
  { label: "Technician", email: "tech1@demo.med", password: PW, name: "Rohit Kale (Tech)", role: "provider", view: "technician", group: "Nurses, physios & technicians" },
  { label: "Ambulance 1", email: "ambulance1@demo.med", password: PW, name: "Amb Unit A-101", role: "provider", view: "ambulance", group: "Ambulance" },
  { label: "Ambulance 2", email: "ambulance2@demo.med", password: PW, name: "Amb Unit A-207", role: "provider", view: "ambulance", group: "Ambulance" },
  { label: "Admin console", email: "admin.demo@careconnect.health", password: PW, name: "Ops Admin", role: "admin", view: "admin", group: "Admin" },
  { label: "Super admin", email: "superadmin.demo@careconnect.health", password: PW, name: "Super Admin", role: "super_admin", view: "admin", group: "Admin" },
];

export const DEMO_GROUPS = Array.from(new Set(DEMO_ACCOUNTS.map((d) => d.group)));

/**
 * Signs out any current session and signs straight in as the chosen demo
 * account, then stores the presentation view/name so the home screen opens
 * that role's dashboard. Authorisation still comes from user_roles.
 */
export async function signInAsDemo(demo: DemoAccount): Promise<void> {
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: demo.email,
    password: demo.password,
  });
  if (error) throw error;
  if (!data.user) throw new Error("Demo account is unavailable.");
  if (typeof window !== "undefined") {
    window.localStorage.setItem("mc_view", demo.view);
    window.localStorage.setItem("mc_user_name", demo.name);
    window.localStorage.setItem("mc_user_role", demo.role);
    if (demo.specialty) {
      window.localStorage.setItem("mc_user_specialty", demo.specialty);
    } else {
      window.localStorage.removeItem("mc_user_specialty");
    }
    window.localStorage.setItem("mc_profile_id", data.user.id);
  }
}
