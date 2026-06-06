/**
 * Standard Schengen Short-Stay (Type C) Visa Knowledge Base
 * ---------------------------------------------------------
 * All 27 Schengen countries share the SAME standardized short-stay visa rules
 * (set by EU Regulation (EC) No 810/2009 — the Visa Code). This is authoritative,
 * real-world data used as the reliable baseline, since VFS Global's JavaScript SPA
 * does not expose fees/documents in scrapable HTML.
 *
 * Source: EU Visa Code + official Schengen short-stay visa requirements.
 */

export interface StandardDocument {
  name: string;
  mandatory: boolean;
  notes: string | null;
}

// ─── Standard Schengen short-stay fees & requirements ────────────────────────
export const SCHENGEN_STANDARD_REQUIREMENTS = {
  visa_fee: 90, // Adult short-stay visa fee (EUR)
  visa_fee_currency: 'EUR',
  processing_time_min: 15, // Calendar days (standard)
  processing_time_max: 45, // Can extend in individual cases
  insurance_required: true,
  insurance_min_coverage: 30000, // EUR — mandatory minimum medical coverage
  vaccination_required: false,
  vaccination_notes: 'No mandatory vaccinations for Schengen entry. Check destination-specific health advisories before travel.',
  min_passport_validity_days: 90, // Valid for at least 3 months beyond intended departure
  eligibility_notes:
    'Schengen Short-Stay (Type C) visa permits stays of up to 90 days within any 180-day period for tourism, business, or family visits. Passport must be issued within the last 10 years and valid for at least 3 months beyond the planned departure date, with at least two blank pages.',
};

// ─── Standard Schengen short-stay document checklist ─────────────────────────
export const SCHENGEN_STANDARD_DOCUMENTS: StandardDocument[] = [
  {
    name: 'Visa Application Form',
    mandatory: true,
    notes: 'Fully completed and signed Schengen visa application form.',
  },
  {
    name: 'Valid Passport',
    mandatory: true,
    notes: 'Issued within the last 10 years, valid for at least 3 months beyond departure, with at least two blank pages.',
  },
  {
    name: 'Two Recent Passport-Size Photographs',
    mandatory: true,
    notes: 'Taken within the last 3 months, meeting ICAO/Schengen biometric photo specifications (35x45mm, white background).',
  },
  {
    name: 'Travel Medical Insurance',
    mandatory: true,
    notes: 'Minimum coverage of €30,000 for medical emergencies and repatriation, valid across the entire Schengen area.',
  },
  {
    name: 'Round-Trip Flight Itinerary / Reservation',
    mandatory: true,
    notes: 'Confirmed booking showing entry and exit dates from the Schengen area.',
  },
  {
    name: 'Proof of Accommodation',
    mandatory: true,
    notes: 'Hotel bookings, rental agreement, or an invitation letter from a host for the entire stay.',
  },
  {
    name: 'Proof of Financial Means',
    mandatory: true,
    notes: 'Recent bank statements (last 3-6 months), salary slips, or proof of sufficient funds for the trip.',
  },
  {
    name: 'Cover Letter',
    mandatory: true,
    notes: 'Stating the purpose of visit, travel itinerary, and details of the trip.',
  },
  {
    name: 'Proof of Employment / Occupation',
    mandatory: false,
    notes: 'Employment letter, business registration, or for students a no-objection letter from the institution.',
  },
  {
    name: 'Visa Fee Payment Receipt',
    mandatory: true,
    notes: 'Proof of payment of the €90 visa fee (plus applicable VFS service charges).',
  },
  {
    name: 'Detailed Travel Itinerary',
    mandatory: false,
    notes: 'Day-by-day plan of activities and places to be visited during the stay.',
  },
  {
    name: 'Proof of Civil Status',
    mandatory: false,
    notes: 'Marriage certificate, birth certificate of children, etc. (if applicable).',
  },
];

// ─── Schengen member countries (ISO alpha-2) ─────────────────────────────────
export const SCHENGEN_COUNTRY_CODES = new Set<string>([
  'AT', 'BE', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO',
  'PL', 'PT', 'SK', 'SI', 'ES', 'SE', 'CH',
]);

export function isSchengenCountry(countryCode: string): boolean {
  return SCHENGEN_COUNTRY_CODES.has(countryCode.toUpperCase());
}
