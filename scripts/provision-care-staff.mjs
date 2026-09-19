import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import fs from "node:fs";

// Load .env
const envText = fs.readFileSync(".env", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx > 0) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

const url = env.VITE_SUPABASE_URL || "https://pyrlvjeectjikvfksukb.supabase.co";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY;

if (!serviceKey || !anonKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or anon key in .env");
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEFAULT_PASS = "demo123456";
const REVIEWER_ID = "c9b79c1d-203f-4918-b11c-bc22525ceabf";

const STAFF_ACCOUNTS = [
  {
    email: "physio1@demo.med",
    fullName: "Dr. Kavita Deshmukh",
    role: "provider",
    view: "physio_staff",
    type: "physio",
    specialty: "Physiotherapy",
  },
  {
    email: "nurse1@demo.med",
    fullName: "Sister Asha Pawar",
    role: "provider",
    view: "nurse",
    type: "nurse",
  },
  {
    email: "tech1@demo.med",
    fullName: "Rohit Kale",
    role: "provider",
    view: "technician",
    type: "tech",
  },
  {
    email: "rahul.nair@demo.med",
    fullName: "Dr. Rahul Nair",
    role: "provider",
    view: "medico",
    type: "doctor",
  },
];

async function run() {
  console.log("==> Step 1: Listing existing Auth users...");
  const existingUsers = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email) existingUsers.set(u.email.toLowerCase(), u);
    }
    if (data.users.length < 200) break;
  }

  const createdUserMap = new Map();

  console.log("==> Step 2: Creating or updating Auth users with demo123456...");
  for (const acc of STAFF_ACCOUNTS) {
    const existing = existingUsers.get(acc.email.toLowerCase());
    let userId;
    const userPayload = {
      password: DEFAULT_PASS,
      email_confirm: true,
      user_metadata: {
        full_name: acc.fullName,
        role: "provider",
        subtype: acc.view,
        email_verified: true,
      },
      app_metadata: {
        provider: "email",
        providers: ["email"],
        careconnect_demo: true,
        staging_project: "pyrlvjeectjikvfksukb",
      },
    };

    if (existing) {
      console.log(`Updating existing auth user: ${acc.email} (${existing.id})`);
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, userPayload);
      if (error) throw error;
      userId = data.user.id;
    } else {
      console.log(`Creating new auth user: ${acc.email}`);
      const { data, error } = await admin.auth.admin.createUser({
        email: acc.email,
        ...userPayload,
      });
      if (error) throw error;
      userId = data.user.id;
    }

    createdUserMap.set(acc.email, userId);

    // Ensure profiles
    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        full_name: acc.fullName,
        view: acc.view,
        specialty: acc.specialty || null,
      },
      { onConflict: "id" }
    );
    if (pErr) console.warn("profiles upsert:", pErr.message);

    // Ensure user_roles
    for (const r of ["patient", "provider"]) {
      const { error: rErr } = await admin.from("user_roles").upsert(
        { user_id: userId, role: r },
        { onConflict: "user_id,role", ignoreDuplicates: true }
      );
      if (rErr) console.warn("user_roles upsert:", rErr.message);
    }

    // Ensure account_role_requests
    const { error: reqErr } = await admin.from("account_role_requests").upsert(
      {
        user_id: userId,
        requested_role: "provider",
        requested_view: acc.view,
        status: "approved",
        reviewed_by: REVIEWER_ID,
        reviewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (reqErr) console.warn("account_role_requests upsert:", reqErr.message);
  }

  console.log("==> Step 3: Setting up role-specific staff records...");

  // 1. physio1@demo.med (Kavita Deshmukh)
  const physio1Id = createdUserMap.get("physio1@demo.med");
  const { error: pt1Err } = await admin.from("physio_therapists").upsert(
    {
      user_id: physio1Id,
      full_name: "Kavita Deshmukh",
      phone: "+91 98230 11223",
      specializations: ["orthopaedic", "neuro", "sports"],
      area: "Kothrud",
      areas: ["Kothrud", "Deccan", "FC Road", "Baner"],
      city: "Pune",
      registration_number: "PT-MH-2018-04421",
      qualification: "MPT (Ortho)",
      years_experience: 8,
      languages: ["english", "hindi", "marathi"],
      bio: "Senior consultant physiotherapist specializing in musculoskeletal rehabilitation, joint mobility and post-trauma recovery.",
      is_online: true,
      verified: true,
      active: true,
      home_visits: true,
      clinic_visits: true,
      preferred_facilities: ["Precision Labs Kothrud", "Koregaon Park Hub"],
      lat: 18.5074,
      lng: 73.8077,
    },
    { onConflict: "user_id" }
  );
  if (pt1Err) console.warn("physio_therapists (physio1):", pt1Err.message);

  // 3. nurse1@demo.med (Sister Asha Pawar)
  const nurse1Id = createdUserMap.get("nurse1@demo.med");
  const { error: nErr } = await admin.from("nurses").upsert(
    {
      user_id: nurse1Id,
      full_name: "Sister Asha Pawar",
      phone: "+91 98221 44556",
      qualification: "B.Sc Nursing",
      registration_number: "MNC-2016-88124",
      years_experience: 10,
      skills: [
        "general_ward",
        "post_surgical",
        "wound_care",
        "catheter_care",
        "injection_iv",
        "elderly_bedridden",
        "home_attendant",
      ],
      specialty: "Critical & Home Care",
      shift_prefs: ["day_8h", "night_8h", "day_12h", "on_call"],
      home_care: true,
      hospital_duty: true,
      areas: ["Koregaon Park", "Kalyani Nagar", "Viman Nagar", "Camp"],
      city: "Pune",
      preferred_facilities: ["Koregaon Park Hub", "Santacruz Hub"],
      languages: ["english", "hindi", "marathi"],
      bio: "Experienced nursing supervisor with 10+ years in critical care, post-operative bedside nursing and palliative home care.",
      is_online: true,
      verified: true,
      active: true,
      lat: 18.5362,
      lng: 73.894,
    },
    { onConflict: "user_id" }
  );
  if (nErr) console.warn("nurses (nurse1):", nErr.message);

  // 4. tech1@demo.med (Rohit Kale)
  const tech1Id = createdUserMap.get("tech1@demo.med");
  const { error: tErr } = await admin.from("technicians").upsert(
    {
      user_id: tech1Id,
      full_name: "Rohit Kale",
      phone: "+91 98229 77889",
      test_types: ["ecg", "eeg", "nerve_conduction", "emg", "holter", "spirometry", "phlebotomy"],
      org: "City Diagnostics & Neurotech",
      qualification: "Diploma in neurotechnology",
      years_experience: 6,
      areas: ["Deccan", "FC Road", "Kothrud", "Baner", "Aundh"],
      city: "Pune",
      home_visits: true,
      clinic_visits: true,
      carries_machine: true,
      preferred_hubs: ["CityScan Diagnostics Deccan", "Precision Labs Kothrud"],
      preferred_facilities: ["CityScan Diagnostics Deccan", "Precision Labs Kothrud"],
      bio: "Certified electro-neurophysiology technician experienced in portable 12-lead ECG, digital EEG, and nerve conduction studies.",
      is_online: true,
      verified: true,
      active: true,
      lat: 18.5158,
      lng: 73.8418,
    },
    { onConflict: "user_id" }
  );
  if (tErr) console.warn("technicians (tech1):", tErr.message);

  console.log("==> Step 4: Verifying sign-in for all accounts via password 'demo123456'...");
  for (const acc of STAFF_ACCOUNTS) {
    const { data: signData, error: signErr } = await client.auth.signInWithPassword({
      email: acc.email,
      password: DEFAULT_PASS,
    });
    if (signErr) {
      console.error(`❌ FAILED login for ${acc.email}:`, signErr.message);
      process.exitCode = 1;
    } else {
      console.log(`✅ SUCCESS login for ${acc.email} (${signData.user.id})`);
    }
  }

  console.log("Provisioning complete!");
}

run().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
