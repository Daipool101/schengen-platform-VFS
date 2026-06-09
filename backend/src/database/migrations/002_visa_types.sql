-- ============================================================
-- Migration 002: Per-Visa-Type data (fees, service fee, checklists)
-- Sourced directly from VFS Contentful (onePager entries)
-- Focus: India → Schengen routes
-- ============================================================

-- ── Visa types / categories for a route (Business Visit, Study, etc.) ──
CREATE TABLE IF NOT EXISTS visa_types (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id               UUID REFERENCES visa_routes(id) ON DELETE CASCADE,
  category               VARCHAR(100),          -- 'Schengen Visa' | 'National Visa' | 'TRC Collection'
  name                   VARCHAR(150),          -- 'Business Visit', 'Tourist Visit', 'Study'...
  overview               TEXT,
  processing_time        TEXT,                  -- e.g. '15 calendar days'
  photo_specifications   TEXT,
  application_form_url   TEXT,
  service_fee            DECIMAL(10,2),         -- VFS service charge amount
  service_fee_currency   CHAR(3),               -- usually 'INR'
  service_fee_note       TEXT,                  -- raw text, e.g. 'service charge of INR 1026 is applicable'
  checklist_pdf_url      TEXT,                  -- the document checklist PDF
  checklist_name         VARCHAR(250),
  source_url             TEXT,                  -- VFS visa-type page
  display_order          INTEGER DEFAULT 0,
  last_verified_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (route_id, category, name)
);
CREATE INDEX IF NOT EXISTS idx_visa_types_route ON visa_types(route_id);

-- ── Fee rows per visa type (each type has several: adult, child, appeal) ──
CREATE TABLE IF NOT EXISTS visa_type_fees (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_type_id           UUID REFERENCES visa_types(id) ON DELETE CASCADE,
  fee_label              VARCHAR(200),          -- 'Short-term visa (C)'
  fee_inr                DECIMAL(10,2),
  fee_eur                DECIMAL(10,2),
  display_order          INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_visa_type_fees_type ON visa_type_fees(visa_type_id);

-- ── Document checklist items per visa type ──
CREATE TABLE IF NOT EXISTS visa_type_documents (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_type_id           UUID REFERENCES visa_types(id) ON DELETE CASCADE,
  document_name          VARCHAR(300),
  is_mandatory           BOOLEAN DEFAULT TRUE,
  notes                  TEXT,
  display_order          INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_visa_type_docs_type ON visa_type_documents(visa_type_id);

-- ── Fee history: snapshot every crawl so VFS fee changes are versioned ──
CREATE TABLE IF NOT EXISTS visa_fee_history (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id               UUID REFERENCES visa_routes(id) ON DELETE CASCADE,
  visa_type_name         VARCHAR(150),
  fee_label              VARCHAR(200),
  fee_inr                DECIMAL(10,2),
  fee_eur                DECIMAL(10,2),
  service_fee            DECIMAL(10,2),
  service_fee_currency   CHAR(3),
  source_url             TEXT,
  captured_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visa_fee_history_route ON visa_fee_history(route_id);
