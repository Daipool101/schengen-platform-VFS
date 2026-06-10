/**
 * Forces a fresh VFS crawl for EVERY India -> Schengen route, SEQUENTIALLY
 * (one route fully completes before the next starts) to avoid rate-limiting.
 *
 * Run: node scripts/recrawl-india.mjs
 *
 * It first pre-creates any missing route rows (e.g. Latvia if never searched),
 * then wipes stale data and triggers a crawl for each route.
 */
const SUPABASE_URL = 'https://ywpsijrcsvfsyczsqjmx.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cHNpanJjc3Zmc3ljenNxam14Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NjEwMCwiZXhwIjoyMDk2MjUyMTAwfQ.B863HA3zlTQNkloNiPEFa6e-tQWLA_BO_0NYi_Fzx18';
const API = 'http://16.171.33.99/api';
const ADMIN_KEY = process.env.ADMIN_SECRET ?? 'vfs-admin';

const SCHENGEN = [
  'AT','BE','HR','CZ','DK','EE','FI','FR','DE','GR',
  'HU','IS','IT','LV','LI','LT','LU','MT','NL','NO',
  'PL','PT','SK','SI','ES','SE','CH',
];

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Step 1: Pre-create any routes not yet in DB ────────────────────────────
const existing = await fetch(
  `${SUPABASE_URL}/rest/v1/visa_routes?origin_country=eq.IN&select=id,destination_country`,
  { headers },
).then((r) => r.json());

const existingDests = new Set(existing.map((r) => r.destination_country));
const missing = SCHENGEN.filter((d) => !existingDests.has(d));

if (missing.length > 0) {
  console.log(`Pre-creating ${missing.length} missing route(s): ${missing.join(', ')}`);
  await fetch(`${SUPABASE_URL}/rest/v1/visa_routes`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify(
      missing.map((d) => ({ origin_country: 'IN', destination_country: d, route_status: 'pending' })),
    ),
  });
}

// ── Step 2: Re-fetch full list (now includes any newly created routes) ─────
const routes = await fetch(
  `${SUPABASE_URL}/rest/v1/visa_routes?origin_country=eq.IN&select=id,destination_country`,
  { headers },
).then((r) => r.json());
const targets = routes.filter((r) => SCHENGEN.includes(r.destination_country));

console.log(`\nRe-crawling ${targets.length} India -> Schengen routes SEQUENTIALLY`);

for (const r of targets) {
  const dest = r.destination_country;

  // Use the force-recrawl admin endpoint — it wipes visa_types and runs synchronously
  try {
    const res = await fetch(`${API}/routes/IN/${dest}/recrawl`, {
      method: 'POST',
      headers: { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const body = await res.json();
      console.log(`  IN -> ${dest}: ${body.visa_types_count} visa type(s)`);
    } else {
      // Fallback: trigger via normal GET (old behaviour)
      await fetch(`${API}/routes/IN/${dest}`).catch(() => {});
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
      console.log(`  IN -> ${dest}: ${done ? vt + ' visa types (fallback)' : 'timed out'}`);
    }
  } catch (e) {
    console.log(`  IN -> ${dest}: ERROR ${e.message}`);
  }

  await sleep(25000); // breathe between routes so Contentful isn't throttled
}

console.log('\nSequential re-crawl complete.');
