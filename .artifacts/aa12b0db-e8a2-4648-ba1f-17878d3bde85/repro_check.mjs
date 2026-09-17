import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pyrlvjeectjikvfksukb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNurseVisits() {
  console.log('--- Checking Nurse Visits ---');
  const { data: engs } = await supabase
    .from('nursing_engagements')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1);

  if (engs && engs.length > 0) {
    const engId = engs[0].id;
    const { data: visits, error } = await supabase
      .from('nursing_visits')
      .select('*')
      .eq('engagement_id', engId);

    if (error) {
      console.error('Error fetching visits:', error.message);
    } else {
      console.log(`Engagement ${engId} has ${visits.length} visits.`);
      visits.forEach(v => console.log(` - Seq: ${v.seq}, Date: ${v.visit_date}, Status: ${v.status}`));
    }
  }
}

checkNurseVisits();
