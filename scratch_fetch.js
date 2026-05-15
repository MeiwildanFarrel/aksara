const fs = require('fs');

async function run() {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  let url = '';
  let key = '';
  envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
  });

  const res1 = await fetch(`${url}/rest/v1/sessions?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log("Sessions:", await res1.text());

  const res2 = await fetch(`${url}/rest/v1/skill_nodes?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log("Skill Nodes:", await res2.text());
}
run();
