-- ============================================================
-- Schengen Visa Route Intelligence Platform - Initial Schema
-- Migration: 001_initial_schema
-- ============================================================

-- countries
CREATE TABLE IF NOT EXISTS countries (
  country_code   CHAR(2) PRIMARY KEY,
  country_code_3 CHAR(3) UNIQUE NOT NULL,
  country_name   VARCHAR(100) NOT NULL,
  currency_code  CHAR(3),
  is_schengen    BOOLEAN DEFAULT FALSE
);

-- visa_routes
CREATE TABLE IF NOT EXISTS visa_routes (
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
);

-- visa_requirements
CREATE TABLE IF NOT EXISTS visa_requirements (
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
);

-- visa_documents
CREATE TABLE IF NOT EXISTS visa_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id       UUID REFERENCES visa_routes(id) ON DELETE CASCADE,
  document_name  VARCHAR(200) NOT NULL,
  is_mandatory   BOOLEAN DEFAULT TRUE,
  notes          TEXT,
  validity_notes TEXT,
  display_order  INTEGER DEFAULT 0
);

-- vac_centers
CREATE TABLE IF NOT EXISTS vac_centers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_country          CHAR(2) REFERENCES countries(country_code),
  destination_country     CHAR(2) REFERENCES countries(country_code),
  center_name             VARCHAR(200),
  city                    VARCHAR(100),
  address                 TEXT,
  phone                   VARCHAR(50),
  email                   VARCHAR(100),
  working_hours           TEXT,
  is_active               BOOLEAN DEFAULT TRUE,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- esim_recommendations
CREATE TABLE IF NOT EXISTS esim_recommendations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_country     CHAR(2) REFERENCES countries(country_code),
  is_recommended          BOOLEAN DEFAULT TRUE,
  providers               TEXT[],
  coverage_notes          TEXT,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- travel_advisories
CREATE TABLE IF NOT EXISTS travel_advisories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id        UUID REFERENCES visa_routes(id) ON DELETE CASCADE,
  advisory_type   VARCHAR(50),
  title           VARCHAR(300),
  description     TEXT,
  effective_date  DATE,
  source_url      TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- source_records
CREATE TABLE IF NOT EXISTS source_records (
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
);

-- change_logs
CREATE TABLE IF NOT EXISTS change_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id     UUID REFERENCES visa_routes(id),
  table_name   VARCHAR(100),
  field_name   VARCHAR(100),
  old_value    TEXT,
  new_value    TEXT,
  detected_at  TIMESTAMPTZ DEFAULT NOW(),
  source_url   TEXT
);

-- exchange_rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  from_currency  CHAR(3),
  to_currency    CHAR(3),
  rate           DECIMAL(15,6) NOT NULL,
  fetched_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(from_currency, to_currency)
);

-- users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(200),
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_visa_routes_origin ON visa_routes(origin_country);
CREATE INDEX IF NOT EXISTS idx_visa_routes_destination ON visa_routes(destination_country);
CREATE INDEX IF NOT EXISTS idx_visa_requirements_route ON visa_requirements(route_id);
CREATE INDEX IF NOT EXISTS idx_visa_documents_route ON visa_documents(route_id);
CREATE INDEX IF NOT EXISTS idx_vac_centers_origin ON vac_centers(origin_country);
CREATE INDEX IF NOT EXISTS idx_vac_centers_destination ON vac_centers(destination_country);
CREATE INDEX IF NOT EXISTS idx_travel_advisories_route ON travel_advisories(route_id);
CREATE INDEX IF NOT EXISTS idx_source_records_route ON source_records(route_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_route ON change_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_esim_destination ON esim_recommendations(destination_country);
