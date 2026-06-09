/**
 * Forces a fresh VFS crawl for every India -> Schengen route, SEQUENTIALLY
 * (one route fully completes before the next starts) to avoid rate-limiting
 * the VFS Contentful endpoint.
 * Run: node scripts/recrawl-india.mjs
 */
const SUPABASE_URL = 'https://ywpsijrcsvfsyczsqjmx.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cHNpanJjc3Zmc3ljenNxam14Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NjEwMCwiZXhwIjoyMDk2MjUyMTAwfQ.B863HA3zlTQNkloNiPEFa6e-tQWLA_BO_0NYi_Fzx18';
const API = 'http://16.171.33.99/api';
const SCHENGEN = new Set(['AT','BE','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','SK','SI','ES','SE','CH']);
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const routes = await fetch(`${SUPABASE_URL}/rest/v1/visa_routes?origin_country=eq.IN&select=id,destination_country`, { headers }).then((r) => r.json());
const targets = routes.filter((r) => SCHENGEN.has(r.destination_country));
console.log(`Re-crawling ${targets.length} India -> Schengen routes SEQUENTIALLY`);

for (const r of targets) {
  const dest = r.destination_country;
  await fetch(`${SUPABASE_URL}/rest/v1/visa_requirements?route_id=eq.${r.id}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/rest/v1/visa_documents?route_id=eq.${r.id}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/rest/v1/visa_types?route_id=eq.${r.id}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/rest/v1/vac_centers?origin_country=eq.IN&destination_country=eq.${dest}`, { method: 'DELETE', headers });
  await fetch(`${SUPABASE_URL}/rest/v1/visa_routes?id=eq.${r.id}`, { method: 'PATCH', headers, body: JSON.stringify({ route_status: 'pending' }) });
  await fetch(`${API}/routes/IN/${dest}`).catch(() => {});

  // Poll until this route has data (or timeout), so the next crawl runs in isolation
  let vt = 0, done = false;
  for (let i = 0; i < 20 && !done; i++) {
    await sleep(4000);
    try {
      const d = await fetch(`${API}/routes/IN/${dest}`).then((x) => x.json());
      if (d.requirements || (d.visa_types && d.visa_types.length)) {
        vt = (d.visa_types || []).length;
        done = true;
      }
    } catch {}
  }
  console.log(`  IN -> ${dest}: ${done ? vt + ' visa types' : 'timed out'}`);
  await sleep(3000); // breathe between routes
}
console.log('Sequential re-crawl complete.');
