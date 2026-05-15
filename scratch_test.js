const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log("Testing sessions query...");
  const { data: sessions, error: sErr } = await supabase.from('sessions').select('*').limit(1);
  console.log("Sessions error:", sErr);
  
  console.log("Testing skill_nodes query...");
  const { data: nodes, error: nErr } = await supabase.from('skill_nodes').select('id, title, timer').limit(1);
  console.log("Nodes error:", nErr);
}
run();
