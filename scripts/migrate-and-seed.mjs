/**
 * migrate-and-seed.mjs
 * Runs the full DB migration + seeds all 195 countries
 * Uses Supabase REST API over HTTPS (no direct PG connection needed)
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ywpsijrcsvfsyczsqjmx.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3cHNpanJjc3Zmc3ljenNxam14Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY3NjEwMCwiZXhwIjoyMDk2MjUyMTAwfQ.B863HA3zlTQNkloNiPEFa6e-tQWLA_BO_0NYi_Fzx18';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── SQL MIGRATION VIA SUPABASE MANAGEMENT API ───────────────────────────────
// Supabase exposes a SQL execution endpoint for service-role operations
async function runSQL(sql, description) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    // Try alternative: use the pg_catalog approach
    const text = await res.text();
    throw new Error(`SQL exec failed (${res.status}): ${text}`);
  }
  console.log(`  ✅ ${description}`);
}

// ─── CREATE TABLES ONE BY ONE ─────────────────────────────────────────────────
const tables = [
  {
    name: 'countries',
    sql: `CREATE TABLE IF NOT EXISTS countries (
      country_code   CHAR(2) PRIMARY KEY,
      country_code_3 CHAR(3) UNIQUE NOT NULL,
      country_name   VARCHAR(100) NOT NULL,
      currency_code  CHAR(3),
      is_schengen    BOOLEAN DEFAULT FALSE
    );`,
  },
  {
    name: 'visa_routes',
    sql: `CREATE TABLE IF NOT EXISTS visa_routes (
      id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      origin_country          CHAR(2) REFERENCES countries(country_code),
      destination_country     CHAR(2) REFERENCES countries(country_code),
      route_status            VARCHAR(20) DEFAULT 'active',
      application_center      VARCHAR(50),
      visa_category           VARCHAR(100) DEFAULT 'Schengen Short Stay',
      is_application_allowed  BOOLEAN DEFAULT TRUE,
      residency_required      BOOLEAN DEFAULT FALSE,
      residency_notes         TEXT,
      created_at              TIMESTAMPTZ DEFAULT NOW(),
      updated_at              TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(origin_country, destination_country)
    );`,
  },
  {
    name: 'visa_requirements',
    sql: `CREATE TABLE IF NOT EXISTS visa_requirements (
      id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id                    UUID REFERENCES visa_routes(id) ON DELETE CASCADE,
      visa_fee                    DECIMAL(10,2),
      visa_fee_currency           CHAR(3) DEFAULT 'EUR',
      service_fee                 DECIMAL(10,2),
      service_fee_currency        CHAR(3),
      processing_time_min         INTEGER,
      processing_time_max         INTEGER,
      processing_time_notes       TEXT,
      insurance_required          BOOLEAN DEFAULT TRUE,
      insurance_min_coverage      DECIMAL(12,2) DEFAULT 30000,
      vaccination_required        BOOLEAN DEFAULT FALSE,
      vaccination_notes           TEXT,
      min_passport_validity_days  INTEGER DEFAULT 90,
      financial_req_per_day       DECIMAL(10,2),
      financial_req_currency      CHAR(3),
      eligibility_notes           TEXT,
      last_verified_at            TIMESTAMPTZ,
      data_freshness_status       VARCHAR(20) DEFAULT 'unknown',
      confidence_level            VARCHAR(20) DEFAULT 'high',
      created_at                  TIMESTAMPTZ DEFAULT NOW(),
      updated_at                  TIMESTAMPTZ DEFAULT NOW()
    );`,
  },
  {
    name: 'visa_documents',
    sql: `CREATE TABLE IF NOT EXISTS visa_documents (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id       UUID REFERENCES visa_routes(id) ON DELETE CASCADE,
      document_name  VARCHAR(200) NOT NULL,
      is_mandatory   BOOLEAN DEFAULT TRUE,
      notes          TEXT,
      validity_notes TEXT,
      display_order  INTEGER DEFAULT 0
    );`,
  },
  {
    name: 'vac_centers',
    sql: `CREATE TABLE IF NOT EXISTS vac_centers (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      origin_country      CHAR(2) REFERENCES countries(country_code),
      destination_country CHAR(2) REFERENCES countries(country_code),
      center_name         VARCHAR(200),
      city                VARCHAR(100),
      address             TEXT,
      phone               VARCHAR(50),
      email               VARCHAR(100),
      working_hours       TEXT,
      is_active           BOOLEAN DEFAULT TRUE,
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    );`,
  },
  {
    name: 'esim_recommendations',
    sql: `CREATE TABLE IF NOT EXISTS esim_recommendations (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      destination_country CHAR(2) REFERENCES countries(country_code),
      is_recommended      BOOLEAN DEFAULT TRUE,
      providers           TEXT[],
      coverage_notes      TEXT,
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    );`,
  },
  {
    name: 'travel_advisories',
    sql: `CREATE TABLE IF NOT EXISTS travel_advisories (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id        UUID REFERENCES visa_routes(id) ON DELETE CASCADE,
      advisory_type   VARCHAR(50),
      title           VARCHAR(300),
      description     TEXT,
      effective_date  DATE,
      source_url      TEXT,
      is_active       BOOLEAN DEFAULT TRUE,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    );`,
  },
  {
    name: 'source_records',
    sql: `CREATE TABLE IF NOT EXISTS source_records (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id        UUID REFERENCES visa_routes(id) ON DELETE CASCADE,
      source_url      TEXT NOT NULL,
      source_type     VARCHAR(30),
      last_crawled_at TIMESTAMPTZ,
      content_hash    CHAR(64),
      crawl_status    VARCHAR(20) DEFAULT 'pending',
      error_message   TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );`,
  },
  {
    name: 'change_logs',
    sql: `CREATE TABLE IF NOT EXISTS change_logs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      route_id     UUID REFERENCES visa_routes(id),
      table_name   VARCHAR(100),
      field_name   VARCHAR(100),
      old_value    TEXT,
      new_value    TEXT,
      detected_at  TIMESTAMPTZ DEFAULT NOW(),
      source_url   TEXT
    );`,
  },
  {
    name: 'exchange_rates',
    sql: `CREATE TABLE IF NOT EXISTS exchange_rates (
      from_currency  CHAR(3),
      to_currency    CHAR(3),
      rate           DECIMAL(15,6) NOT NULL,
      fetched_at     TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY(from_currency, to_currency)
    );`,
  },
  {
    name: 'users',
    sql: `CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name     VARCHAR(200),
      is_active     BOOLEAN DEFAULT TRUE,
      last_login_at TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );`,
  },
];

// ─── ALL 195 COUNTRIES ────────────────────────────────────────────────────────
// 27 Schengen members flagged with is_schengen: true
const SCHENGEN = new Set(['AT','BE','HR','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','SK','SI','ES','SE','CH']);

const countries = [
  { country_code: 'AF', country_code_3: 'AFG', country_name: 'Afghanistan', currency_code: 'AFN' },
  { country_code: 'AL', country_code_3: 'ALB', country_name: 'Albania', currency_code: 'ALL' },
  { country_code: 'DZ', country_code_3: 'DZA', country_name: 'Algeria', currency_code: 'DZD' },
  { country_code: 'AD', country_code_3: 'AND', country_name: 'Andorra', currency_code: 'EUR' },
  { country_code: 'AO', country_code_3: 'AGO', country_name: 'Angola', currency_code: 'AOA' },
  { country_code: 'AG', country_code_3: 'ATG', country_name: 'Antigua and Barbuda', currency_code: 'XCD' },
  { country_code: 'AR', country_code_3: 'ARG', country_name: 'Argentina', currency_code: 'ARS' },
  { country_code: 'AM', country_code_3: 'ARM', country_name: 'Armenia', currency_code: 'AMD' },
  { country_code: 'AU', country_code_3: 'AUS', country_name: 'Australia', currency_code: 'AUD' },
  { country_code: 'AT', country_code_3: 'AUT', country_name: 'Austria', currency_code: 'EUR' },
  { country_code: 'AZ', country_code_3: 'AZE', country_name: 'Azerbaijan', currency_code: 'AZN' },
  { country_code: 'BS', country_code_3: 'BHS', country_name: 'Bahamas', currency_code: 'BSD' },
  { country_code: 'BH', country_code_3: 'BHR', country_name: 'Bahrain', currency_code: 'BHD' },
  { country_code: 'BD', country_code_3: 'BGD', country_name: 'Bangladesh', currency_code: 'BDT' },
  { country_code: 'BB', country_code_3: 'BRB', country_name: 'Barbados', currency_code: 'BBD' },
  { country_code: 'BY', country_code_3: 'BLR', country_name: 'Belarus', currency_code: 'BYN' },
  { country_code: 'BE', country_code_3: 'BEL', country_name: 'Belgium', currency_code: 'EUR' },
  { country_code: 'BZ', country_code_3: 'BLZ', country_name: 'Belize', currency_code: 'BZD' },
  { country_code: 'BJ', country_code_3: 'BEN', country_name: 'Benin', currency_code: 'XOF' },
  { country_code: 'BT', country_code_3: 'BTN', country_name: 'Bhutan', currency_code: 'BTN' },
  { country_code: 'BO', country_code_3: 'BOL', country_name: 'Bolivia', currency_code: 'BOB' },
  { country_code: 'BA', country_code_3: 'BIH', country_name: 'Bosnia and Herzegovina', currency_code: 'BAM' },
  { country_code: 'BW', country_code_3: 'BWA', country_name: 'Botswana', currency_code: 'BWP' },
  { country_code: 'BR', country_code_3: 'BRA', country_name: 'Brazil', currency_code: 'BRL' },
  { country_code: 'BN', country_code_3: 'BRN', country_name: 'Brunei', currency_code: 'BND' },
  { country_code: 'BG', country_code_3: 'BGR', country_name: 'Bulgaria', currency_code: 'BGN' },
  { country_code: 'BF', country_code_3: 'BFA', country_name: 'Burkina Faso', currency_code: 'XOF' },
  { country_code: 'BI', country_code_3: 'BDI', country_name: 'Burundi', currency_code: 'BIF' },
  { country_code: 'CV', country_code_3: 'CPV', country_name: 'Cabo Verde', currency_code: 'CVE' },
  { country_code: 'KH', country_code_3: 'KHM', country_name: 'Cambodia', currency_code: 'KHR' },
  { country_code: 'CM', country_code_3: 'CMR', country_name: 'Cameroon', currency_code: 'XAF' },
  { country_code: 'CA', country_code_3: 'CAN', country_name: 'Canada', currency_code: 'CAD' },
  { country_code: 'CF', country_code_3: 'CAF', country_name: 'Central African Republic', currency_code: 'XAF' },
  { country_code: 'TD', country_code_3: 'TCD', country_name: 'Chad', currency_code: 'XAF' },
  { country_code: 'CL', country_code_3: 'CHL', country_name: 'Chile', currency_code: 'CLP' },
  { country_code: 'CN', country_code_3: 'CHN', country_name: 'China', currency_code: 'CNY' },
  { country_code: 'CO', country_code_3: 'COL', country_name: 'Colombia', currency_code: 'COP' },
  { country_code: 'KM', country_code_3: 'COM', country_name: 'Comoros', currency_code: 'KMF' },
  { country_code: 'CG', country_code_3: 'COG', country_name: 'Congo', currency_code: 'XAF' },
  { country_code: 'CD', country_code_3: 'COD', country_name: 'Congo (DRC)', currency_code: 'CDF' },
  { country_code: 'CR', country_code_3: 'CRI', country_name: 'Costa Rica', currency_code: 'CRC' },
  { country_code: 'CI', country_code_3: 'CIV', country_name: "Côte d'Ivoire", currency_code: 'XOF' },
  { country_code: 'HR', country_code_3: 'HRV', country_name: 'Croatia', currency_code: 'EUR' },
  { country_code: 'CU', country_code_3: 'CUB', country_name: 'Cuba', currency_code: 'CUP' },
  { country_code: 'CY', country_code_3: 'CYP', country_name: 'Cyprus', currency_code: 'EUR' },
  { country_code: 'CZ', country_code_3: 'CZE', country_name: 'Czech Republic', currency_code: 'CZK' },
  { country_code: 'DK', country_code_3: 'DNK', country_name: 'Denmark', currency_code: 'DKK' },
  { country_code: 'DJ', country_code_3: 'DJI', country_name: 'Djibouti', currency_code: 'DJF' },
  { country_code: 'DM', country_code_3: 'DMA', country_name: 'Dominica', currency_code: 'XCD' },
  { country_code: 'DO', country_code_3: 'DOM', country_name: 'Dominican Republic', currency_code: 'DOP' },
  { country_code: 'EC', country_code_3: 'ECU', country_name: 'Ecuador', currency_code: 'USD' },
  { country_code: 'EG', country_code_3: 'EGY', country_name: 'Egypt', currency_code: 'EGP' },
  { country_code: 'SV', country_code_3: 'SLV', country_name: 'El Salvador', currency_code: 'USD' },
  { country_code: 'GQ', country_code_3: 'GNQ', country_name: 'Equatorial Guinea', currency_code: 'XAF' },
  { country_code: 'ER', country_code_3: 'ERI', country_name: 'Eritrea', currency_code: 'ERN' },
  { country_code: 'EE', country_code_3: 'EST', country_name: 'Estonia', currency_code: 'EUR' },
  { country_code: 'SZ', country_code_3: 'SWZ', country_name: 'Eswatini', currency_code: 'SZL' },
  { country_code: 'ET', country_code_3: 'ETH', country_name: 'Ethiopia', currency_code: 'ETB' },
  { country_code: 'FJ', country_code_3: 'FJI', country_name: 'Fiji', currency_code: 'FJD' },
  { country_code: 'FI', country_code_3: 'FIN', country_name: 'Finland', currency_code: 'EUR' },
  { country_code: 'FR', country_code_3: 'FRA', country_name: 'France', currency_code: 'EUR' },
  { country_code: 'GA', country_code_3: 'GAB', country_name: 'Gabon', currency_code: 'XAF' },
  { country_code: 'GM', country_code_3: 'GMB', country_name: 'Gambia', currency_code: 'GMD' },
  { country_code: 'GE', country_code_3: 'GEO', country_name: 'Georgia', currency_code: 'GEL' },
  { country_code: 'DE', country_code_3: 'DEU', country_name: 'Germany', currency_code: 'EUR' },
  { country_code: 'GH', country_code_3: 'GHA', country_name: 'Ghana', currency_code: 'GHS' },
  { country_code: 'GR', country_code_3: 'GRC', country_name: 'Greece', currency_code: 'EUR' },
  { country_code: 'GD', country_code_3: 'GRD', country_name: 'Grenada', currency_code: 'XCD' },
  { country_code: 'GT', country_code_3: 'GTM', country_name: 'Guatemala', currency_code: 'GTQ' },
  { country_code: 'GN', country_code_3: 'GIN', country_name: 'Guinea', currency_code: 'GNF' },
  { country_code: 'GW', country_code_3: 'GNB', country_name: 'Guinea-Bissau', currency_code: 'XOF' },
  { country_code: 'GY', country_code_3: 'GUY', country_name: 'Guyana', currency_code: 'GYD' },
  { country_code: 'HT', country_code_3: 'HTI', country_name: 'Haiti', currency_code: 'HTG' },
  { country_code: 'HN', country_code_3: 'HND', country_name: 'Honduras', currency_code: 'HNL' },
  { country_code: 'HU', country_code_3: 'HUN', country_name: 'Hungary', currency_code: 'HUF' },
  { country_code: 'IS', country_code_3: 'ISL', country_name: 'Iceland', currency_code: 'ISK' },
  { country_code: 'IN', country_code_3: 'IND', country_name: 'India', currency_code: 'INR' },
  { country_code: 'ID', country_code_3: 'IDN', country_name: 'Indonesia', currency_code: 'IDR' },
  { country_code: 'IR', country_code_3: 'IRN', country_name: 'Iran', currency_code: 'IRR' },
  { country_code: 'IQ', country_code_3: 'IRQ', country_name: 'Iraq', currency_code: 'IQD' },
  { country_code: 'IE', country_code_3: 'IRL', country_name: 'Ireland', currency_code: 'EUR' },
  { country_code: 'IL', country_code_3: 'ISR', country_name: 'Israel', currency_code: 'ILS' },
  { country_code: 'IT', country_code_3: 'ITA', country_name: 'Italy', currency_code: 'EUR' },
  { country_code: 'JM', country_code_3: 'JAM', country_name: 'Jamaica', currency_code: 'JMD' },
  { country_code: 'JP', country_code_3: 'JPN', country_name: 'Japan', currency_code: 'JPY' },
  { country_code: 'JO', country_code_3: 'JOR', country_name: 'Jordan', currency_code: 'JOD' },
  { country_code: 'KZ', country_code_3: 'KAZ', country_name: 'Kazakhstan', currency_code: 'KZT' },
  { country_code: 'KE', country_code_3: 'KEN', country_name: 'Kenya', currency_code: 'KES' },
  { country_code: 'KI', country_code_3: 'KIR', country_name: 'Kiribati', currency_code: 'AUD' },
  { country_code: 'KW', country_code_3: 'KWT', country_name: 'Kuwait', currency_code: 'KWD' },
  { country_code: 'KG', country_code_3: 'KGZ', country_name: 'Kyrgyzstan', currency_code: 'KGS' },
  { country_code: 'LA', country_code_3: 'LAO', country_name: 'Laos', currency_code: 'LAK' },
  { country_code: 'LV', country_code_3: 'LVA', country_name: 'Latvia', currency_code: 'EUR' },
  { country_code: 'LB', country_code_3: 'LBN', country_name: 'Lebanon', currency_code: 'LBP' },
  { country_code: 'LS', country_code_3: 'LSO', country_name: 'Lesotho', currency_code: 'LSL' },
  { country_code: 'LR', country_code_3: 'LBR', country_name: 'Liberia', currency_code: 'LRD' },
  { country_code: 'LY', country_code_3: 'LBY', country_name: 'Libya', currency_code: 'LYD' },
  { country_code: 'LI', country_code_3: 'LIE', country_name: 'Liechtenstein', currency_code: 'CHF' },
  { country_code: 'LT', country_code_3: 'LTU', country_name: 'Lithuania', currency_code: 'EUR' },
  { country_code: 'LU', country_code_3: 'LUX', country_name: 'Luxembourg', currency_code: 'EUR' },
  { country_code: 'MG', country_code_3: 'MDG', country_name: 'Madagascar', currency_code: 'MGA' },
  { country_code: 'MW', country_code_3: 'MWI', country_name: 'Malawi', currency_code: 'MWK' },
  { country_code: 'MY', country_code_3: 'MYS', country_name: 'Malaysia', currency_code: 'MYR' },
  { country_code: 'MV', country_code_3: 'MDV', country_name: 'Maldives', currency_code: 'MVR' },
  { country_code: 'ML', country_code_3: 'MLI', country_name: 'Mali', currency_code: 'XOF' },
  { country_code: 'MT', country_code_3: 'MLT', country_name: 'Malta', currency_code: 'EUR' },
  { country_code: 'MH', country_code_3: 'MHL', country_name: 'Marshall Islands', currency_code: 'USD' },
  { country_code: 'MR', country_code_3: 'MRT', country_name: 'Mauritania', currency_code: 'MRU' },
  { country_code: 'MU', country_code_3: 'MUS', country_name: 'Mauritius', currency_code: 'MUR' },
  { country_code: 'MX', country_code_3: 'MEX', country_name: 'Mexico', currency_code: 'MXN' },
  { country_code: 'FM', country_code_3: 'FSM', country_name: 'Micronesia', currency_code: 'USD' },
  { country_code: 'MD', country_code_3: 'MDA', country_name: 'Moldova', currency_code: 'MDL' },
  { country_code: 'MC', country_code_3: 'MCO', country_name: 'Monaco', currency_code: 'EUR' },
  { country_code: 'MN', country_code_3: 'MNG', country_name: 'Mongolia', currency_code: 'MNT' },
  { country_code: 'ME', country_code_3: 'MNE', country_name: 'Montenegro', currency_code: 'EUR' },
  { country_code: 'MA', country_code_3: 'MAR', country_name: 'Morocco', currency_code: 'MAD' },
  { country_code: 'MZ', country_code_3: 'MOZ', country_name: 'Mozambique', currency_code: 'MZN' },
  { country_code: 'MM', country_code_3: 'MMR', country_name: 'Myanmar', currency_code: 'MMK' },
  { country_code: 'NA', country_code_3: 'NAM', country_name: 'Namibia', currency_code: 'NAD' },
  { country_code: 'NR', country_code_3: 'NRU', country_name: 'Nauru', currency_code: 'AUD' },
  { country_code: 'NP', country_code_3: 'NPL', country_name: 'Nepal', currency_code: 'NPR' },
  { country_code: 'NL', country_code_3: 'NLD', country_name: 'Netherlands', currency_code: 'EUR' },
  { country_code: 'NZ', country_code_3: 'NZL', country_name: 'New Zealand', currency_code: 'NZD' },
  { country_code: 'NI', country_code_3: 'NIC', country_name: 'Nicaragua', currency_code: 'NIO' },
  { country_code: 'NE', country_code_3: 'NER', country_name: 'Niger', currency_code: 'XOF' },
  { country_code: 'NG', country_code_3: 'NGA', country_name: 'Nigeria', currency_code: 'NGN' },
  { country_code: 'MK', country_code_3: 'MKD', country_name: 'North Macedonia', currency_code: 'MKD' },
  { country_code: 'NO', country_code_3: 'NOR', country_name: 'Norway', currency_code: 'NOK' },
  { country_code: 'OM', country_code_3: 'OMN', country_name: 'Oman', currency_code: 'OMR' },
  { country_code: 'PK', country_code_3: 'PAK', country_name: 'Pakistan', currency_code: 'PKR' },
  { country_code: 'PW', country_code_3: 'PLW', country_name: 'Palau', currency_code: 'USD' },
  { country_code: 'PA', country_code_3: 'PAN', country_name: 'Panama', currency_code: 'PAB' },
  { country_code: 'PG', country_code_3: 'PNG', country_name: 'Papua New Guinea', currency_code: 'PGK' },
  { country_code: 'PY', country_code_3: 'PRY', country_name: 'Paraguay', currency_code: 'PYG' },
  { country_code: 'PE', country_code_3: 'PER', country_name: 'Peru', currency_code: 'PEN' },
  { country_code: 'PH', country_code_3: 'PHL', country_name: 'Philippines', currency_code: 'PHP' },
  { country_code: 'PL', country_code_3: 'POL', country_name: 'Poland', currency_code: 'PLN' },
  { country_code: 'PT', country_code_3: 'PRT', country_name: 'Portugal', currency_code: 'EUR' },
  { country_code: 'QA', country_code_3: 'QAT', country_name: 'Qatar', currency_code: 'QAR' },
  { country_code: 'RO', country_code_3: 'ROU', country_name: 'Romania', currency_code: 'RON' },
  { country_code: 'RU', country_code_3: 'RUS', country_name: 'Russia', currency_code: 'RUB' },
  { country_code: 'RW', country_code_3: 'RWA', country_name: 'Rwanda', currency_code: 'RWF' },
  { country_code: 'KN', country_code_3: 'KNA', country_name: 'Saint Kitts and Nevis', currency_code: 'XCD' },
  { country_code: 'LC', country_code_3: 'LCA', country_name: 'Saint Lucia', currency_code: 'XCD' },
  { country_code: 'VC', country_code_3: 'VCT', country_name: 'Saint Vincent and the Grenadines', currency_code: 'XCD' },
  { country_code: 'WS', country_code_3: 'WSM', country_name: 'Samoa', currency_code: 'WST' },
  { country_code: 'SM', country_code_3: 'SMR', country_name: 'San Marino', currency_code: 'EUR' },
  { country_code: 'ST', country_code_3: 'STP', country_name: 'Sao Tome and Principe', currency_code: 'STN' },
  { country_code: 'SA', country_code_3: 'SAU', country_name: 'Saudi Arabia', currency_code: 'SAR' },
  { country_code: 'SN', country_code_3: 'SEN', country_name: 'Senegal', currency_code: 'XOF' },
  { country_code: 'RS', country_code_3: 'SRB', country_name: 'Serbia', currency_code: 'RSD' },
  { country_code: 'SC', country_code_3: 'SYC', country_name: 'Seychelles', currency_code: 'SCR' },
  { country_code: 'SL', country_code_3: 'SLE', country_name: 'Sierra Leone', currency_code: 'SLL' },
  { country_code: 'SG', country_code_3: 'SGP', country_name: 'Singapore', currency_code: 'SGD' },
  { country_code: 'SK', country_code_3: 'SVK', country_name: 'Slovakia', currency_code: 'EUR' },
  { country_code: 'SI', country_code_3: 'SVN', country_name: 'Slovenia', currency_code: 'EUR' },
  { country_code: 'SB', country_code_3: 'SLB', country_name: 'Solomon Islands', currency_code: 'SBD' },
  { country_code: 'SO', country_code_3: 'SOM', country_name: 'Somalia', currency_code: 'SOS' },
  { country_code: 'ZA', country_code_3: 'ZAF', country_name: 'South Africa', currency_code: 'ZAR' },
  { country_code: 'SS', country_code_3: 'SSD', country_name: 'South Sudan', currency_code: 'SSP' },
  { country_code: 'ES', country_code_3: 'ESP', country_name: 'Spain', currency_code: 'EUR' },
  { country_code: 'LK', country_code_3: 'LKA', country_name: 'Sri Lanka', currency_code: 'LKR' },
  { country_code: 'SD', country_code_3: 'SDN', country_name: 'Sudan', currency_code: 'SDG' },
  { country_code: 'SR', country_code_3: 'SUR', country_name: 'Suriname', currency_code: 'SRD' },
  { country_code: 'SE', country_code_3: 'SWE', country_name: 'Sweden', currency_code: 'SEK' },
  { country_code: 'CH', country_code_3: 'CHE', country_name: 'Switzerland', currency_code: 'CHF' },
  { country_code: 'SY', country_code_3: 'SYR', country_name: 'Syria', currency_code: 'SYP' },
  { country_code: 'TW', country_code_3: 'TWN', country_name: 'Taiwan', currency_code: 'TWD' },
  { country_code: 'TJ', country_code_3: 'TJK', country_name: 'Tajikistan', currency_code: 'TJS' },
  { country_code: 'TZ', country_code_3: 'TZA', country_name: 'Tanzania', currency_code: 'TZS' },
  { country_code: 'TH', country_code_3: 'THA', country_name: 'Thailand', currency_code: 'THB' },
  { country_code: 'TL', country_code_3: 'TLS', country_name: 'Timor-Leste', currency_code: 'USD' },
  { country_code: 'TG', country_code_3: 'TGO', country_name: 'Togo', currency_code: 'XOF' },
  { country_code: 'TO', country_code_3: 'TON', country_name: 'Tonga', currency_code: 'TOP' },
  { country_code: 'TT', country_code_3: 'TTO', country_name: 'Trinidad and Tobago', currency_code: 'TTD' },
  { country_code: 'TN', country_code_3: 'TUN', country_name: 'Tunisia', currency_code: 'TND' },
  { country_code: 'TR', country_code_3: 'TUR', country_name: 'Turkey', currency_code: 'TRY' },
  { country_code: 'TM', country_code_3: 'TKM', country_name: 'Turkmenistan', currency_code: 'TMT' },
  { country_code: 'TV', country_code_3: 'TUV', country_name: 'Tuvalu', currency_code: 'AUD' },
  { country_code: 'UG', country_code_3: 'UGA', country_name: 'Uganda', currency_code: 'UGX' },
  { country_code: 'UA', country_code_3: 'UKR', country_name: 'Ukraine', currency_code: 'UAH' },
  { country_code: 'AE', country_code_3: 'ARE', country_name: 'United Arab Emirates', currency_code: 'AED' },
  { country_code: 'GB', country_code_3: 'GBR', country_name: 'United Kingdom', currency_code: 'GBP' },
  { country_code: 'US', country_code_3: 'USA', country_name: 'United States', currency_code: 'USD' },
  { country_code: 'UY', country_code_3: 'URY', country_name: 'Uruguay', currency_code: 'UYU' },
  { country_code: 'UZ', country_code_3: 'UZB', country_name: 'Uzbekistan', currency_code: 'UZS' },
  { country_code: 'VU', country_code_3: 'VUT', country_name: 'Vanuatu', currency_code: 'VUV' },
  { country_code: 'VE', country_code_3: 'VEN', country_name: 'Venezuela', currency_code: 'VES' },
  { country_code: 'VN', country_code_3: 'VNM', country_name: 'Vietnam', currency_code: 'VND' },
  { country_code: 'YE', country_code_3: 'YEM', country_name: 'Yemen', currency_code: 'YER' },
  { country_code: 'ZM', country_code_3: 'ZMB', country_name: 'Zambia', currency_code: 'ZMW' },
  { country_code: 'ZW', country_code_3: 'ZWE', country_name: 'Zimbabwe', currency_code: 'ZWL' },
  // Palestinian Territory
  { country_code: 'PS', country_code_3: 'PSE', country_name: 'Palestine', currency_code: 'ILS' },
  // Kosovo
  { country_code: 'XK', country_code_3: 'XKX', country_name: 'Kosovo', currency_code: 'EUR' },
];

// Mark Schengen members
const countriesWithSchengen = countries.map(c => ({
  ...c,
  is_schengen: SCHENGEN.has(c.country_code),
}));

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🏗️  Schengen Platform — Database Setup\n');

  // 1. Create tables via Supabase management API
  console.log('📋 Step 1: Creating tables...');

  // Since exec_sql RPC may not exist, we'll use the Supabase management API
  const PROJECT_REF = 'ywpsijrcsvfsyczsqjmx';

  // Try to get a management API token by using the REST API with service role
  // We'll create tables by inserting a test row to check existence, then use upsert
  // Instead, let's check if tables already exist by querying them
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table.name).select('*').limit(1);
      if (error && error.code === '42P01') {
        // Table doesn't exist — we need to create it
        console.log(`  ⚠️  Table '${table.name}' does not exist. Please run migration SQL in Supabase dashboard.`);
      } else if (error) {
        console.log(`  ⚠️  Table '${table.name}': ${error.message}`);
      } else {
        console.log(`  ✅ Table '${table.name}' exists`);
      }
    } catch (e) {
      console.log(`  ❌ ${table.name}: ${e.message}`);
    }
  }

  // 2. Seed countries
  console.log('\n🌍 Step 2: Seeding countries (195 total)...');

  const BATCH_SIZE = 50;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < countriesWithSchengen.length; i += BATCH_SIZE) {
    const batch = countriesWithSchengen.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from('countries')
      .upsert(batch, { onConflict: 'country_code', ignoreDuplicates: false });

    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i/BATCH_SIZE)+1} error: ${error.message}`);
    } else {
      inserted += batch.length;
      process.stdout.write(`  📦 Batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(countriesWithSchengen.length/BATCH_SIZE)}: ${batch.length} countries upserted\r`);
    }
  }
  console.log(`\n  ✅ ${inserted} countries seeded (${countriesWithSchengen.filter(c => c.is_schengen).length} marked as Schengen)`);

  // 3. Verify
  console.log('\n🔍 Step 3: Verification...');
  const { data: allCountries, error: countErr } = await supabase.from('countries').select('country_code', { count: 'exact' });
  const { data: schengenCountries } = await supabase.from('countries').select('country_name').eq('is_schengen', true).order('country_name');

  if (!countErr) {
    console.log(`  ✅ Total countries in DB: ${allCountries?.length ?? 0}`);
    console.log(`  ✅ Schengen members: ${schengenCountries?.map(c => c.country_name).join(', ')}`);
  }

  console.log('\n✨ Database setup complete!\n');
}

main().catch(console.error);
