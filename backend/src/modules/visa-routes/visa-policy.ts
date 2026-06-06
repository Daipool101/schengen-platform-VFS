/**
 * Schengen Visa Policy — Visa-Exempt Nationalities
 * ------------------------------------------------
 * Nationals of these countries do NOT need a Schengen visa for short stays
 * (up to 90 days within any 180-day period) for tourism/business.
 *
 * Source: EU Regulation 2018/1806, Annex II (visa-free third countries) plus
 * EU/EEA/EFTA members and European microstates (free movement / visa-free).
 *
 * NOTE: From 2025, most visa-exempt travellers will need an ETIAS travel
 * authorisation (not a visa) before entering the Schengen area.
 */

// ISO alpha-2 codes of nationalities that are visa-exempt for short Schengen stays
export const SCHENGEN_VISA_EXEMPT = new Set<string>([
  // ── EU / EEA / EFTA members + Schengen states (free movement) ──
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL',
  'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'CH',
  // ── European microstates ──
  'AD', 'MC', 'SM', 'VA',
  // ── Annex II visa-free third countries ──
  'AL', 'AG', 'AR', 'AU', 'BS', 'BB', 'BA', 'BR', 'BN', 'CA', 'CL', 'CO',
  'CR', 'DM', 'SV', 'GE', 'GD', 'GT', 'HN', 'HK', 'IL', 'JP', 'KI', 'MO',
  'MY', 'MH', 'MU', 'MX', 'FM', 'MD', 'ME', 'NZ', 'NI', 'MK', 'PW', 'PA',
  'PY', 'PE', 'KN', 'LC', 'VC', 'WS', 'RS', 'SC', 'SG', 'SB', 'KR', 'TW',
  'TL', 'TO', 'TT', 'TV', 'UA', 'AE', 'GB', 'US', 'UY', 'VU', 'VE',
]);

// Schengen destination countries (ISO alpha-2)
export const SCHENGEN_DESTINATIONS = new Set<string>([
  'AT', 'BE', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO',
  'PL', 'PT', 'SK', 'SI', 'ES', 'SE', 'CH',
]);

export interface VisaExemptInfo {
  exempt: boolean;
  reason: string;
  max_stay_days: number;
  period_days: number;
  notes: string;
}

/**
 * Determines whether a traveller from `origin` is visa-exempt when visiting
 * the Schengen destination `destination`.
 */
export function getVisaExemption(
  origin: string,
  destination: string,
): VisaExemptInfo | null {
  const orig = origin.toUpperCase();
  const dest = destination.toUpperCase();

  // Only applies to Schengen destinations
  if (!SCHENGEN_DESTINATIONS.has(dest)) return null;

  // Same-country or intra-Schengen travel
  if (orig === dest) return null;

  if (SCHENGEN_VISA_EXEMPT.has(orig)) {
    const isEuFreeMovement =
      SCHENGEN_DESTINATIONS.has(orig) ||
      ['BG', 'CY', 'IE', 'RO', 'AD', 'MC', 'SM', 'VA'].includes(orig);

    return {
      exempt: true,
      reason: isEuFreeMovement
        ? 'EU/EEA/EFTA or European free-movement nationals do not require a Schengen visa.'
        : 'Nationals of this country are visa-exempt for short stays in the Schengen area.',
      max_stay_days: 90,
      period_days: 180,
      notes: isEuFreeMovement
        ? 'Travel with a valid passport or national ID card. No visa or ETIAS required.'
        : 'No visa required for stays up to 90 days within any 180-day period. From 2025, an ETIAS travel authorisation (not a visa) may be required before travel. Passport must be valid for at least 3 months beyond the intended departure date.',
    };
  }

  return null;
}
