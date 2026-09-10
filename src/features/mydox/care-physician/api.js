import { supabase } from "@/integrations/supabase/client";
import { fitScore } from "./data";

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Please sign in to continue.");
  return data.user;
}

async function profileNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  if (error) return new Map();
  return new Map((data || []).map((row) => [row.id, row.full_name || "Hospital"]));
}

export async function getCarePhysicianProfile() {
  const user = await currentUser();
  const { data, error } = await supabase
    .from("care_physician_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveCarePhysicianProfile(input) {
  const user = await currentUser();
  const payload = {
    user_id: user.id,
    qualification: input.qualification,
    council_name: input.council_name || null,
    council_registration_number: input.council_registration_number || null,
    experience_years: Number(input.experience_years || 0),
    procedures: input.procedures || [],
    age_groups: input.age_groups || [],
    specialty_interests: input.specialty_interests || [],
    duty_types: input.duty_types || [],
    preferred_areas: input.preferred_areas || [],
    preferred_hospitals: input.preferred_hospitals || [],
    is_available: input.is_available !== false,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("care_physician_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setCarePhysicianAvailability(isAvailable) {
  const user = await currentUser();
  const { error } = await supabase
    .from("care_physician_profiles")
    .update({ is_available: isAvailable, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function listOpenStaffingJobs() {
  const { data, error } = await supabase
    .from("staffing_jobs")
    .select("id, facility_id, job_type, duty_type, title, specialty, qualification, experience_years, area, shift_label, starts_at, ends_at, compensation, compensation_unit, capacity, urgency, status, description, required_procedures, created_at")
    .eq("status", "open")
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  const names = await profileNames((data || []).map((row) => row.facility_id));
  return (data || []).map((row) => ({ ...row, facility_name: names.get(row.facility_id) || "Hospital" }));
}

export async function listMyStaffingAssignments() {
  const user = await currentUser();
  const { data, error } = await supabase
    .from("staffing_assignments")
    .select("id, job_id, provider_id, status, applied_at, accepted_at, completed_at, checked_in_at, checked_out_at, no_show, cancelled_at, cancel_reason, created_at")
    .eq("provider_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const jobIds = [...new Set((data || []).map((row) => row.job_id))];
  if (!jobIds.length) return [];
  const { data: jobs, error: jobsError } = await supabase
    .from("staffing_jobs")
    .select("id, facility_id, job_type, duty_type, title, specialty, area, shift_label, starts_at, ends_at, compensation, compensation_unit, urgency, required_procedures")
    .in("id", jobIds);
  if (jobsError) throw jobsError;
  const names = await profileNames((jobs || []).map((row) => row.facility_id));
  const jobMap = new Map((jobs || []).map((row) => [row.id, { ...row, facility_name: names.get(row.facility_id) || "Hospital" }]));
  return (data || []).map((assignment) => ({ ...assignment, job: jobMap.get(assignment.job_id) || null }));
}

export async function claimStaffingJob(jobId) {
  const { data, error } = await supabase.rpc("claim_staffing_job", { _job_id: jobId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function postStaffingJob(input) {
  const user = await currentUser();
  const payload = {
    facility_id: user.id,
    job_type: input.job_type || "locum",
    duty_type: input.duty_type || "ward",
    title: input.title,
    specialty: input.specialty || "General Medicine / RMO",
    qualification: input.qualification || null,
    experience_years: Number(input.experience_years || 0),
    area: input.area || null,
    shift_label: input.shift_label || null,
    starts_at: input.starts_at || null,
    ends_at: input.ends_at || null,
    compensation: input.compensation ? Number(input.compensation) : null,
    compensation_unit: input.compensation_unit || "shift",
    capacity: Math.max(1, Number(input.capacity || 1)),
    urgency: input.urgency || "planned",
    description: input.description || null,
    required_procedures: input.required_procedures || [],
    status: "open",
  };
  const { data, error } = await supabase.from("staffing_jobs").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function listMyFacilityJobs() {
  const user = await currentUser();
  const { data, error } = await supabase
    .from("staffing_jobs")
    .select("*")
    .eq("facility_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listFacilityCandidates(jobLike) {
  const [{ data: physicianRows, error: physicianError }, { data: profileRows, error: profileError }] = await Promise.all([
    supabase
      .from("care_physician_profiles")
      .select("*")
      .eq("is_available", true),
    supabase.from("profiles").select("id, full_name, specialty"),
  ]);
  if (physicianError) throw physicianError;
  if (profileError) throw profileError;
  const names = new Map((profileRows || []).map((row) => [row.id, row]));
  return (physicianRows || [])
    .map((profile) => {
      const identity = names.get(profile.user_id) || {};
      const match = fitScore(profile, jobLike);
      return {
        ...profile,
        full_name: identity.full_name || "Care Physician",
        primary_specialty: identity.specialty || null,
        match,
      };
    })
    .sort((a, b) => Number(a.match.blocked) - Number(b.match.blocked) || b.match.score - a.match.score);
}
