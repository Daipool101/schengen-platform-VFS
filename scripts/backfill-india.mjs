/**
 * One-time backfill: adds VFS service fee + VAC centres to existing
 * India -> Schengen routes that were seeded before this data existed.
 * Run: node scripts/backfill-india.mjs
 */

const SUPABASE_URL = 'https://ywpsijrcsvfsyczsqjmx.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cHNpanJjc3Zmc3ljenNxam14Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NjEwMCwiZXhwIjoyMDk2MjUyMTAwfQ.B863HA3zlTQNkloNiPEFa6e-tQWLA_BO_0NYi_Fzx18';

const SCHENGEN = new Set(['AT','BE','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','SK','SI','ES','SE','CH']);

const SERVICE_FEE_INR = 1950;
const VAC_CITIES = [
  'New Delhi','Mumbai','Chennai','Kolkata','Bengaluru',
  'Hyderabad','Ahmedabad','Pune','Chandigarh','Kochi',
];

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function main() {
  // Get all India-origin routes
  const routes = await fetch(
    `${SUPABASE_URL}/rest/v1/visa_routes?origin_country=eq.IN&select=id,destination_country`,
    { headers },
  ).then((r) => r.json());

  const schengenRoutes = routes.filter((r) => SCHENGEN.has(r.destination_country));
  console.log(`Found ${schengenRoutes.length} India -> Schengen routes to backfill`);

  for (const route of schengenRoutes) {
    const dest = route.destination_country;

    // 1) Backfill service fee where missing
    await fetch(
      `${SUPABASE_URL}/rest/v1/visa_requirements?route_id=eq.${route.id}&service_fee=is.null`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ service_fee: SERVICE_FEE_INR, service_fee_currency: 'INR' }),
      },
    );

    // 2) Insert VAC centres if none exist for this route
    const existingVac = await fetch(
      `${SUPABASE_URL}/rest/v1/vac_centers?origin_country=eq.IN&destination_country=eq.${dest}&select=id&limit=1`,
      { headers },
    ).then((r) => r.json());

    if (!existingVac || existingVac.length === 0) {
      const rows = VAC_CITIES.map((city) => ({
        origin_country: 'IN',
        destination_country: dest,
        center_name: `VFS Global Visa Application Centre – ${city}`,
        city,
        address: `${city}, India`,
        working_hours: 'Monday to Friday (submission hours vary by embassy)',
        is_active: true,
      }));
      const res = await fetch(`${SUPABASE_URL}/rest/v1/vac_centers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(rows),
      });
      console.log(`  IN -> ${dest}: service fee set + ${rows.length} VAC centres added (${res.status})`);
    } else {
      console.log(`  IN -> ${dest}: service fee set (VAC centres already present)`);
    }
  }

  console.log('Backfill complete.');
}

main().catch((e) => { console.error(e); process.exit(1); });
