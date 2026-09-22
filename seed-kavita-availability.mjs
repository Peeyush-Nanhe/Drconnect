import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: profs } = await supabase.from('profiles').select('id, full_name').ilike('full_name', '%Kavita%');
  
  if (!profs || profs.length === 0) {
    console.error('Kavita not found in profiles!');
    return;
  }
  
  const uid = profs[0].id;
  const workingHours = {
    mon: [{ start: "00:00", end: "23:59" }],
    tue: [{ start: "00:00", end: "23:59" }],
    wed: [{ start: "00:00", end: "23:59" }],
    thu: [{ start: "00:00", end: "23:59" }],
    fri: [{ start: "00:00", end: "23:59" }],
    sat: [{ start: "00:00", end: "23:59" }],
    sun: [{ start: "00:00", end: "23:59" }]
  };
  
  const { error: upsertError } = await supabase.from('provider_availability').upsert({
    user_id: uid,
    is_online: true,
    timezone: 'Asia/Kolkata',
    working_hours: workingHours,
    blocked_dates: []
  });
  
  if (upsertError) {
    console.error('Upsert error:', upsertError);
  } else {
    console.log('Successfully seeded availability for Kavita!');
  }
}

run();
